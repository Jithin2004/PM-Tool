import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function estimateProject(description: string) {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `
        As an expert technical project manager, estimate the development effort for the following project:
        "${description}"
      `,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            coreHours: { type: Type.NUMBER, description: "Fundamental coding time in hours" },
            overheadMultiplier: { type: Type.NUMBER, description: "Multiplier between 1.3 and 2.5" },
            suggestedPriority: { type: Type.NUMBER, description: "Priority from 1 to 5" },
            overheadItems: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  label: { type: Type.STRING },
                  hours: { type: Type.NUMBER }
                }
              }
            }
          },
          required: ["coreHours", "overheadMultiplier", "suggestedPriority"]
        }
      }
    });

    const text = response.text;
    if (!text) throw new Error("No response from AI");
    
    return JSON.parse(text);
  } catch (error) {
    console.error("AI Estimation failed:", error);
    throw error;
  }
}
