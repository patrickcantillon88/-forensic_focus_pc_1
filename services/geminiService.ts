
import { GoogleGenAI, Type } from "@google/genai";
import { SessionStats, AIAnalysis } from "../types";

export const analyzeSession = async (stats: SessionStats): Promise<AIAnalysis> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const prompt = `
    Analyze these biometric and environmental session stats from a user's focus tracking app:
    - Total Time: ${stats.totalTimeSeconds} seconds
    - Engagement Score: ${stats.engagementScore}%
    - Gaze Events (Attendance): ${stats.totalLooks}
    - Total Blinks: ${stats.totalBlinks}
    - Hand Fidgeting: ${stats.handFidgetCount}
    - Avg Noise Level: ${Math.round(stats.avgNoiseLevel)}%
    - Voice Activity: ${stats.voiceTimeSeconds}s
    - Physical Impacts/Thumps: ${stats.thumpCount}
    - Head Tilt: ${Math.round(stats.headTiltDegrees)}°
    - Brow Furrows (Stress): ${stats.browFurrowCount}
    - Ambient Brightness: ${Math.round(stats.avgBrightness)}
    - System Stress (Hardware lag): ${Math.round(stats.systemStressScore)}%

    Provide a concise behavioral verdict. Categorize engagement level as 'High', 'Medium', or 'Low'.
    Give 3 actionable tactical tips to improve focus or comfort.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            summary: { type: Type.STRING, description: "A concise behavioral verdict." },
            tips: { 
              type: Type.ARRAY, 
              items: { type: Type.STRING },
              description: "3 actionable tactical tips."
            },
            engagementLevel: { 
              type: Type.STRING, 
              enum: ["High", "Medium", "Low"],
              description: "Overall engagement category."
            }
          },
          required: ["summary", "tips", "engagementLevel"]
        }
      }
    });

    const result = JSON.parse(response.text || "{}");
    return {
      summary: result.summary || "Unable to synthesize behavioral data.",
      tips: result.tips || ["Take a short break.", "Check your lighting.", "Reduce background noise."],
      engagementLevel: result.engagementLevel || "Medium"
    };
  } catch (error) {
    console.error("Gemini Analysis Error:", error);
    return {
      summary: "Diagnostic engine encountered a network or processing error.",
      tips: ["Try restarting the session.", "Ensure your API key is active.", "Check your internet connection."],
      engagementLevel: "Medium"
    };
  }
};
