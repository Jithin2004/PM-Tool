import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

export async function estimateProjectHours(name: string, description: string): Promise<number> {
  if (!process.env.GEMINI_API_KEY) {
    console.warn("GEMINI_API_KEY not found. Returning default estimation.");
    return 8;
  }

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Estimate the total developer hours for a project with the following details. Return ONLY the number.
      Name: ${name}
      Description: ${description}`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.NUMBER,
        },
      },
    });

    const text = response.text;
    return parseFloat(text) || 8;
  } catch (error) {
    console.error("AI Estimation failed:", error);
    return 8;
  }
}
