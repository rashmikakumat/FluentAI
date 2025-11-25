import React, { useState, useEffect, useRef, useCallback } from 'react';
import { AssessmentMode, SessionStatus, Topic, AssessmentReport } from '../types';
import { generateAssessmentReport } from '../services/geminiService';
import { createBlob } from '../utils/audioUtils';
import AudioVisualizer from './AudioVisualizer';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';

interface Props {
  mode: AssessmentMode;
  topic: Topic;
  onComplete: (report: AssessmentReport) => void;
  onCancel: () => void;
  onError: (msg: string) => void;
}

const SessionManager: React.FC<Props> = ({ mode, topic, onComplete, onCancel, onError }) => {
  const [status, setStatus] = useState<SessionStatus>(SessionStatus.SETUP);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [wordCountEst, setWordCountEst] = useState(0);
  const [aiIsSpeaking, setAiIsSpeaking] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('Initializing...');

  // Refs for Audio & Analysis
  const audioContextRef = useRef<AudioContext | null>(null); // Output Audio Context
  const inputAudioContextRef = useRef<AudioContext | null>(null); // Input Audio Context
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  
  // Live API specific refs
  const liveSessionRef = useRef<any>(null); // To store session object
  const outputSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const nextAudioStartTimeRef = useRef<number>(0);
  
  // State refs for closures
  const isMountedRef = useRef(true);
  const statusRef = useRef(status);

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  // Timer
  useEffect(() => {
    let interval: number;
    if (status === SessionStatus.IN_PROGRESS) {
      interval = window.setInterval(() => {
        setElapsedTime(prev => prev + 1);
        // Rough estimation: 130 words per minute speaking rate
        // Only counting user time approximately
        if (!aiIsSpeaking) {
             setWordCountEst(prev => prev + (130 / 60));
        }
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [status, aiIsSpeaking]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; cleanup(); };
  }, []);

  const cleanup = () => {
    if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(track => track.stop());
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close();
    }
    if (inputAudioContextRef.current && inputAudioContextRef.current.state !== 'closed') {
        inputAudioContextRef.current.close();
    }
    if (liveSessionRef.current) {
        // Close session if method exists, though library handles disconnect on garbage collect typically
        // Explicit close isn't always available on the session object depending on version, but we drop reference
        liveSessionRef.current = null; 
    }
  };

  const startSession = async () => {
    try {
      setLoadingMessage("Accessing microphone...");
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: { 
          sampleRate: 16000, 
          channelCount: 1,
          echoCancellation: true 
        } 
      });
      mediaStreamRef.current = stream;

      // Start recording in BOTH modes to ensure we have audio for analysis
      startRecording(stream);

      if (mode === AssessmentMode.EXTEMPORE) {
        startExtempore();
      } else {
        await startConversation(stream);
      }
    } catch (err: any) {
        console.error(err);
        onError(`Failed to start session: ${err.message}`);
        setStatus(SessionStatus.ERROR);
    }
  };

  const startRecording = (stream: MediaStream) => {
    // Simple MediaRecorder to get a high quality blob for final analysis
    // We use a separate recorder from the Live API stream processing
    const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
    mediaRecorderRef.current = recorder;
    audioChunksRef.current = [];

    recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
            audioChunksRef.current.push(event.data);
        }
    };

    recorder.start(1000); // Collect 1s chunks
  };

  const stopRecording = async () => {
     if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
        // Wait briefly for last chunk to be pushed
        await new Promise(resolve => setTimeout(resolve, 500));
     }
  };

  // --- EXTEMPORE LOGIC ---
  const startExtempore = () => {
    setStatus(SessionStatus.IN_PROGRESS);
  };

  // --- CONVERSATION LOGIC (GEMINI LIVE API) ---
  const startConversation = async (stream: MediaStream) => {
    setLoadingMessage("Connecting to AI Tutor...");
    
    // Setup AudioContext for playback
    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
    audioContextRef.current = audioCtx;
    
    // Setup Input Stream Processing for Live API
    const inputAudioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
    inputAudioContextRef.current = inputAudioCtx;
    
    const source = inputAudioCtx.createMediaStreamSource(stream);
    const processor = inputAudioCtx.createScriptProcessor(4096, 1, 1);
    
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
    
    const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        callbacks: {
            onopen: () => {
                console.log("Live Session Open");
                setStatus(SessionStatus.IN_PROGRESS);
            },
            onmessage: async (msg: LiveServerMessage) => {
                 const audioData = msg.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
                 if (audioData) {
                     setAiIsSpeaking(true);
                     await playAudioChunk(audioData, audioCtx);
                 }

                 if (msg.serverContent?.turnComplete) {
                     setAiIsSpeaking(false);
                 }
            },
            onclose: () => {
                console.log("Session Closed");
            },
            onerror: (err) => {
                console.error("Live API Error", err);
                // Only trigger error if we are not already finishing or cancelled
                if (isMountedRef.current && statusRef.current !== SessionStatus.COMPLETED && statusRef.current !== SessionStatus.ANALYZING) {
                    onError("Connection to AI lost.");
                }
            }
        },
        config: {
            responseModalities: [Modality.AUDIO],
            speechConfig: {
                voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } }
            },
            // Improved system instruction to start the conversation naturally without needing a text prompt
            systemInstruction: `You are a friendly, encouraging English tutor. Your goal is to help the student practice speaking about the topic: "${topic.title}". 
            ${topic.prompt}
            Start the conversation by greeting the student and asking a question related to the topic. 
            Keep your responses relatively short (1-3 sentences) to give the student more time to speak. 
            Correct major errors gently in passing, but prioritize flow.`,
        }
    });

    liveSessionRef.current = sessionPromise;

    processor.onaudioprocess = (e) => {
        // Use refs for safe access inside closure
        if (!isMountedRef.current || statusRef.current !== SessionStatus.IN_PROGRESS) return;
        
        const inputData = e.inputBuffer.getChannelData(0);
        const blob = createBlob(inputData);

        sessionPromise.then(session => {
             session.sendRealtimeInput({
                media: blob
            });
        });
    };

    source.connect(processor);
    processor.connect(inputAudioCtx.destination);
    scriptProcessorRef.current = processor;
  };

  const playAudioChunk = async (base64Audio: string, ctx: AudioContext) => {
      const binaryString = atob(base64Audio);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      
      const int16 = new Int16Array(bytes.buffer);
      const float32 = new Float32Array(int16.length);
      for (let i=0; i<int16.length; i++) {
          float32[i] = int16[i] / 32768.0;
      }

      const buffer = ctx.createBuffer(1, float32.length, 24000);
      buffer.getChannelData(0).set(float32);

      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);
      
      const now = ctx.currentTime;
      // Schedule slightly in future if queue is behind, or immediately if reset
      const start = Math.max(now, nextAudioStartTimeRef.current);
      source.start(start);
      nextAudioStartTimeRef.current = start + buffer.duration;
      
      outputSourceRef.current = source;
  };

  const finishSession = async () => {
    setStatus(SessionStatus.ANALYZING);
    setLoadingMessage("Analyzing your performance...");
    
    // Stop recording first to ensure we have the full blob
    await stopRecording();
    cleanup();

    try {
        let report: AssessmentReport;

        // We use the recorded blob for BOTH modes now.
        // This ensures the analysis is based on actual user speech in Conversation mode too.
        if (audioChunksRef.current.length > 0) {
             const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
             report = await generateAssessmentReport(null, blob);
        } else {
             // Fallback if audio failed for some reason
             report = await generateAssessmentReport(`[User engaged in a conversation about ${topic.title} for ${elapsedTime} seconds but audio recording failed.]`, null);
        }

        onComplete(report);
    } catch (err: any) {
        console.error(err);
        onError("Analysis failed: " + err.message);
        setStatus(SessionStatus.ERROR);
    }
  };

  // --- RENDER ---

  if (status === SessionStatus.SETUP) {
      return (
          <div className="flex flex-col items-center justify-center p-8 space-y-6 text-center animate-fade-in">
              <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mb-4 shadow-sm">
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>
              </div>
              <h2 className="text-xl font-bold text-slate-800">Ready for {mode === AssessmentMode.EXTEMPORE ? 'Extempore' : 'Conversation'}?</h2>
              <p className="text-slate-600 max-w-md">
                  Topic: <span className="font-semibold text-slate-900">{topic.title}</span><br/>
                  Ensure you are in a quiet environment. 
              </p>
              <div className="flex gap-4 pt-4">
                  <button onClick={onCancel} className="px-6 py-2.5 text-slate-600 font-medium hover:bg-slate-100 rounded-xl transition-colors">Cancel</button>
                  <button onClick={startSession} className="px-6 py-2.5 bg-blue-600 text-white font-medium rounded-xl hover:bg-blue-700 shadow-lg shadow-blue-200 transition-all active:scale-95">Start Session</button>
              </div>
          </div>
      );
  }

  if (status === SessionStatus.ANALYZING || (status === SessionStatus.IDLE && loadingMessage)) {
      return (
          <div className="flex flex-col items-center justify-center p-12 space-y-6 animate-fade-in">
              <div className="relative">
                <div className="w-16 h-16 border-4 border-slate-200 border-t-blue-600 rounded-full animate-spin"></div>
                <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
                </div>
              </div>
              <div className="text-center space-y-2">
                 <p className="text-slate-800 font-semibold text-lg">{loadingMessage}</p>
                 <p className="text-slate-500 text-sm">This usually takes 5-10 seconds.</p>
              </div>
          </div>
      );
  }

  return (
    <div className="flex flex-col items-center w-full max-w-2xl mx-auto p-6 space-y-8 animate-fade-in">
        {/* Status Bar */}
        <div className="w-full flex justify-between items-center text-sm font-medium text-slate-500 bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
            <div className="flex items-center gap-2">
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                </span>
                <span className="text-slate-700">Live Recording</span>
            </div>
            <div className="font-mono text-slate-700 bg-slate-100 px-2 py-1 rounded">{Math.floor(elapsedTime / 60)}:{(elapsedTime % 60).toString().padStart(2, '0')}</div>
            <div>~{Math.round(wordCountEst)} words</div>
        </div>

        {/* Visualizer */}
        <div className="w-full bg-white p-8 rounded-3xl shadow-lg border border-slate-100 flex flex-col items-center space-y-8 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-purple-500"></div>
            
            <div className="text-center space-y-2 z-10">
                <h3 className="text-2xl font-bold text-slate-800">{topic.title}</h3>
                <p className="text-slate-500">
                    {mode === AssessmentMode.EXTEMPORE 
                        ? "Speak clearly and cover the key points." 
                        : (aiIsSpeaking ? "Listening to AI..." : "Your turn to speak...")}
                </p>
            </div>

            <div className="w-full z-10">
                <AudioVisualizer isActive={true} stream={mediaStreamRef.current} />
            </div>

            {mode === AssessmentMode.CONVERSATION && (
                <div className={`transition-all duration-500 ease-in-out z-10 ${aiIsSpeaking ? 'opacity-100 transform scale-100' : 'opacity-40 transform scale-90 grayscale'}`}>
                    <div className="relative">
                        {aiIsSpeaking && <div className="absolute -inset-4 bg-purple-100 rounded-full animate-pulse"></div>}
                        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-xl text-white relative z-10 border-4 border-white">
                            <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>
                        </div>
                    </div>
                </div>
            )}
        </div>

        {/* Controls */}
        <div className="flex flex-col items-center gap-4 relative w-full">
             {elapsedTime < 5 && (
                 <div className="text-xs text-amber-600 bg-amber-50 px-3 py-1 rounded-full border border-amber-100 animate-pulse">
                     Session too short for analysis
                 </div>
             )}
            <button 
                onClick={finishSession}
                disabled={elapsedTime < 5} 
                className={`w-full sm:w-auto px-10 py-4 rounded-xl font-bold shadow-xl transition-all transform hover:scale-[1.02] active:scale-[0.98] ${
                    elapsedTime < 5 
                    ? 'bg-slate-100 text-slate-400 cursor-not-allowed shadow-none' 
                    : 'bg-gradient-to-r from-red-500 to-red-600 text-white hover:from-red-600 hover:to-red-700 shadow-red-200'
                }`}
            >
                End Session & Analyze
            </button>
        </div>
    </div>
  );
};

export default SessionManager;