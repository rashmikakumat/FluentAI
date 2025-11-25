import React, { useState, useRef, useEffect } from 'react';
import { AssessmentReport } from '../types';
import { generateFeedbackAudio } from '../services/geminiService';
import { convertPCMToAudioBuffer } from '../utils/audioUtils';

interface Props {
  report: AssessmentReport;
  onClose: () => void;
}

const ScoreCard: React.FC<{ label: string; score: number; colorClass: string }> = ({ label, score, colorClass }) => (
  <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col items-center hover:shadow-md transition-shadow">
    <div className={`text-3xl font-bold mb-1 ${colorClass}`}>{(score || 0).toFixed(1)}</div>
    <div className="text-xs text-slate-500 uppercase tracking-wider font-semibold text-center">{label}</div>
  </div>
);

const AssessmentView: React.FC<Props> = ({ report, onClose }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [loadingAudio, setLoadingAudio] = useState(false);
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null);

  useEffect(() => {
    return () => {
      stopAudio();
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close();
      }
    };
  }, []);

  const stopAudio = () => {
    if (sourceNodeRef.current) {
        try {
            sourceNodeRef.current.stop();
        } catch (e) { /* ignore */ }
        sourceNodeRef.current = null;
    }
    setIsPlaying(false);
  };

  const handlePlayFeedback = async () => {
    if (isPlaying) {
      stopAudio();
      return;
    }

    try {
      setLoadingAudio(true);
      
      // Initialize Audio Context on user gesture
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      } else if (audioContextRef.current.state === 'suspended') {
        await audioContextRef.current.resume();
      }

      const base64Audio = await generateFeedbackAudio(report);
      const buffer = await convertPCMToAudioBuffer(base64Audio, audioContextRef.current);
      
      const source = audioContextRef.current.createBufferSource();
      source.buffer = buffer;
      source.connect(audioContextRef.current.destination);
      source.onended = () => setIsPlaying(false);
      
      sourceNodeRef.current = source;
      source.start();
      setIsPlaying(true);

    } catch (e) {
      console.error("Failed to load audio feedback", e);
      alert("Could not load audio coach at this time.");
    } finally {
      setLoadingAudio(false);
    }
  };

  // Safety checks in case of partial JSON
  if (!report) return <div className="p-8 text-center">No report data available.</div>;

  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-fade-in pb-10">
      {/* Header */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col md:flex-row justify-between items-center gap-4">
        <div>
            <h2 className="text-2xl font-bold text-slate-800">Session Analysis</h2>
            <p className="text-slate-500">CEFR Level Achieved: <span className="font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded">{report.cefrLevel || 'N/A'}</span></p>
        </div>
        <div className="flex items-center gap-4">
            <div className="text-right">
                <div className="text-sm text-slate-500">Overall Score</div>
                <div className="text-4xl font-bold text-slate-900">{(report.overallScore || 0)}/10</div>
            </div>
            <button onClick={onClose} className="bg-slate-900 text-white px-6 py-2.5 rounded-lg hover:bg-slate-800 transition-colors font-medium">
                Back to Home
            </button>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <ScoreCard label="Fluency" score={report.fluency?.score || 0} colorClass="text-emerald-500" />
        <ScoreCard label="Pronunciation" score={report.pronunciation?.score || 0} colorClass="text-purple-500" />
        <ScoreCard label="Grammar" score={report.grammar?.score || 0} colorClass="text-amber-500" />
        <ScoreCard label="Vocabulary" score={report.vocabulary?.score || 0} colorClass="text-blue-500" />
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        
        {/* Left Col: Feedback & Coach */}
        <div className="lg:col-span-1 space-y-6">
            
            {/* Audio Coach Section */}
            <div className="bg-gradient-to-r from-indigo-600 to-blue-600 p-6 rounded-2xl text-white shadow-lg flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-lg">AI Coach Feedback</h3>
                  <p className="text-indigo-100 text-sm">Listen to your personalized summary.</p>
                </div>
                <button 
                  onClick={handlePlayFeedback}
                  disabled={loadingAudio}
                  className="w-12 h-12 bg-white rounded-full flex items-center justify-center text-indigo-600 shadow-md hover:scale-105 active:scale-95 transition-all disabled:opacity-70 disabled:scale-100"
                >
                  {loadingAudio ? (
                    <div className="w-5 h-5 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
                  ) : isPlaying ? (
                    <svg className="w-6 h-6 ml-0.5" fill="currentColor" viewBox="0 0 24 24"><path d="M6 6h12v12H6z"/></svg>
                  ) : (
                    <svg className="w-6 h-6 ml-1" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                  )}
                </button>
            </div>

            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                <h3 className="font-semibold text-lg mb-4 text-slate-800 flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-green-100 text-green-600 flex items-center justify-center text-xs">✓</span>
                    Key Strengths
                </h3>
                <ul className="space-y-3">
                    {report.strengths?.length > 0 ? report.strengths.map((s, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-slate-600">
                            <span className="text-green-500 mt-1 min-w-[12px]">✓</span> {s}
                        </li>
                    )) : <li className="text-sm text-slate-400 italic">No specific strengths identified.</li>}
                </ul>
            </div>

            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                <h3 className="font-semibold text-lg mb-4 text-slate-800 flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center text-xs">!</span>
                    Areas for Improvement
                </h3>
                <ul className="space-y-3">
                    {report.improvements?.length > 0 ? report.improvements.map((s, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-slate-600">
                             <span className="text-amber-500 mt-1 min-w-[12px]">!</span> {s}
                        </li>
                    )) : <li className="text-sm text-slate-400 italic">No specific improvements suggested.</li>}
                </ul>
            </div>
            
            <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200">
                <h3 className="font-semibold text-slate-900 mb-2 text-sm uppercase tracking-wide">Overall Assessment</h3>
                <p className="text-slate-700 text-sm leading-relaxed">{report.generalFeedback || "No general feedback available."}</p>
            </div>
        </div>

        {/* Right Col: Detailed Transcript */}
        <div className="lg:col-span-2 space-y-6">
            <h3 className="font-bold text-xl text-slate-800 flex items-center gap-2">
                Detailed Transcript Analysis
                <span className="text-sm font-normal text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">Sentence by Sentence</span>
            </h3>
            
            <div className="space-y-4">
                {report.annotatedTranscript?.length > 0 ? report.annotatedTranscript.map((segment, i) => (
                    <div key={i} className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                        <div className="grid md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-100">
                            
                            {/* Original */}
                            <div className="p-5 relative">
                                <span className="absolute top-3 left-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Original</span>
                                <p className={`mt-4 text-slate-700 leading-relaxed ${segment.errorType ? 'bg-red-50/50 -mx-1 px-1 rounded decoration-red-200 underline decoration-wavy underline-offset-4' : ''}`}>
                                    "{segment.text}"
                                </p>
                                {segment.errorType && (
                                    <div className="mt-3 flex gap-2">
                                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium uppercase tracking-wide
                                            ${segment.errorType === 'grammar' ? 'bg-amber-100 text-amber-700' : 
                                              segment.errorType === 'pronunciation' ? 'bg-purple-100 text-purple-700' :
                                              segment.errorType === 'vocabulary' ? 'bg-blue-100 text-blue-700' :
                                              'bg-emerald-100 text-emerald-700'}
                                        `}>
                                            {segment.errorType} Issue
                                        </span>
                                    </div>
                                )}
                            </div>

                            {/* Improved */}
                            <div className="p-5 relative bg-slate-50/50">
                                <span className="absolute top-3 left-3 text-[10px] font-bold text-emerald-600 uppercase tracking-wider">Improved Version</span>
                                {segment.suggestion ? (
                                    <p className="mt-4 text-slate-800 font-medium leading-relaxed text-lg">
                                        "{segment.suggestion}"
                                    </p>
                                ) : (
                                    <p className="mt-4 text-slate-400 italic text-sm">No significant changes needed.</p>
                                )}
                            </div>
                        </div>
                    </div>
                )) : (
                    <div className="text-center py-12 bg-white rounded-xl border border-slate-200 border-dashed">
                        <p className="text-slate-400">No transcript details available for this session.</p>
                    </div>
                )}
            </div>
        </div>

      </div>
    </div>
  );
};

export default AssessmentView;