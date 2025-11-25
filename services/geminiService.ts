import { GoogleGenAI, Type, Modality } from "@google/genai";
import { ANALYSIS_SYSTEM_PROMPT } from "../constants";
import { AssessmentReport, FeedbackMetric } from "../types";
import { blobToBase64 } from "../utils/audioUtils";

const apiKey = process.env.API_KEY || '';
const ai = new GoogleGenAI({ apiKey });

// Helper to ensure metric exists and has defaults
const sanitizeMetric = (metric: any, defaultLabel: string): FeedbackMetric => {
  return {
    score: typeof metric?.score === 'number' ? metric.score : 0,
    label: metric?.label || defaultLabel,
    feedback: metric?.feedback || "No feedback available."
  };
};

export const generateAssessmentReport = async (
  transcript: string | null,
  audioBlob: Blob | null
): Promise<AssessmentReport> => {
  
  if (!apiKey) throw new Error("API Key is missing");

  const model = "gemini-2.5-flash"; // Best for analysis
  
  const parts: any[] = [];
  
  if (audioBlob) {
    const base64Audio = await blobToBase64(audioBlob);
    parts.push({
      inlineData: {
        mimeType: audioBlob.type || 'audio/webm',
        data: base64Audio
      }
    });
    parts.push({ text: "Please analyze the audio of this speaker based on the rubrics." });
  } else if (transcript) {
    parts.push({ text: `Please analyze the following transcript of a speaker: "${transcript}"` });
  } else {
    throw new Error("No input provided for analysis");
  }

  const response = await ai.models.generateContent({
    model: model,
    contents: {
      parts: parts
    },
    config: {
      systemInstruction: ANALYSIS_SYSTEM_PROMPT,
      responseMimeType: "application/json",
      maxOutputTokens: 8192, // Increased limit to prevent transcript truncation
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          overallScore: { type: Type.NUMBER },
          cefrLevel: { type: Type.STRING },
          fluency: { 
            type: Type.OBJECT,
            properties: { score: { type: Type.NUMBER }, label: { type: Type.STRING }, feedback: { type: Type.STRING } },
            required: ["score", "label", "feedback"]
          },
          pronunciation: { 
            type: Type.OBJECT,
            properties: { score: { type: Type.NUMBER }, label: { type: Type.STRING }, feedback: { type: Type.STRING } },
            required: ["score", "label", "feedback"]
          },
          grammar: { 
            type: Type.OBJECT,
            properties: { score: { type: Type.NUMBER }, label: { type: Type.STRING }, feedback: { type: Type.STRING } },
            required: ["score", "label", "feedback"]
          },
          vocabulary: { 
            type: Type.OBJECT,
            properties: { score: { type: Type.NUMBER }, label: { type: Type.STRING }, feedback: { type: Type.STRING } },
            required: ["score", "label", "feedback"]
          },
          strengths: { type: Type.ARRAY, items: { type: Type.STRING } },
          improvements: { type: Type.ARRAY, items: { type: Type.STRING } },
          annotatedTranscript: { 
            type: Type.ARRAY, 
            items: { 
              type: Type.OBJECT,
              properties: {
                text: { type: Type.STRING },
                errorType: { type: Type.STRING, nullable: true },
                suggestion: { type: Type.STRING, nullable: true }
              },
              required: ["text"]
            } 
          },
          generalFeedback: { type: Type.STRING }
        },
        required: [
          "overallScore", 
          "cefrLevel", 
          "fluency", 
          "pronunciation", 
          "grammar", 
          "vocabulary", 
          "strengths", 
          "improvements", 
          "annotatedTranscript", 
          "generalFeedback"
        ]
      }
    }
  });

  if (!response.text) {
    throw new Error("Empty response from AI");
  }

  try {
    const raw = JSON.parse(response.text);
    
    // Sanitize and apply defaults to ensure UI never crashes
    const report: AssessmentReport = {
        overallScore: typeof raw.overallScore === 'number' ? raw.overallScore : 0,
        cefrLevel: raw.cefrLevel || 'N/A',
        fluency: sanitizeMetric(raw.fluency, 'Fluency'),
        pronunciation: sanitizeMetric(raw.pronunciation, 'Pronunciation'),
        grammar: sanitizeMetric(raw.grammar, 'Grammar'),
        vocabulary: sanitizeMetric(raw.vocabulary, 'Vocabulary'),
        strengths: Array.isArray(raw.strengths) ? raw.strengths : [],
        improvements: Array.isArray(raw.improvements) ? raw.improvements : [],
        annotatedTranscript: Array.isArray(raw.annotatedTranscript) ? raw.annotatedTranscript : [],
        generalFeedback: raw.generalFeedback || "Analysis complete."
    };

    return report;
  } catch (e) {
    console.error("Failed to parse JSON", response.text);
    throw new Error("Invalid response format from AI");
  }
};

export const generateFeedbackAudio = async (report: AssessmentReport): Promise<string> => {
  if (!apiKey) throw new Error("API Key is missing");

  // Summarize report for audio generation
  const summaryPrompt = `
    You are a friendly, encouraging English coach acting as a voice bot.
    The student has just completed an assessment.
    Here is their report:
    Overall Score: ${report.overallScore}/10.
    CEFR Level: ${report.cefrLevel}.
    Key Strength: ${report.strengths[0] || 'Good effort'}.
    Main Improvement Area: ${report.improvements[0] || 'Keep practicing'}.
    
    Speak directly to the student. 
    1. Start with a warm congratulation on completing the session.
    2. Mention their score and one key strength.
    3. Gently suggest one main area to focus on for next time.
    4. End with an encouraging closing.
    
    Keep it under 40 seconds. Spoken English style, natural and conversational.
  `;

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-preview-tts", // CORRECTED MODEL FOR TTS
    contents: {
      parts: [{ text: summaryPrompt }]
    },
    config: {
      responseModalities: [Modality.AUDIO],
      speechConfig: {
        voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } }
      }
    }
  });

  const audioData = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  if (!audioData) {
    throw new Error("Failed to generate audio feedback");
  }

  return audioData;
};

export const createLiveSession = () => {
   return ai.live.connect({
      model: 'gemini-2.5-flash-native-audio-preview-09-2025',
      config: {
        responseModalities: ["AUDIO"],
        systemInstruction: "You are a friendly, encouraging English tutor helping a student practice conversation. Keep your responses relatively short (1-3 sentences) to encourage the user to speak more. Correct major errors gently in passing, but focus on maintaining the flow.",
      }
   });
};