import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

function isRateLimitError(error: any): boolean {
  if (!error) return false;
  return (
    error.status === 429 ||
    error.statusCode === 429 ||
    String(error.message || '').includes("429") ||
    String(error.message || '').includes("RESOURCE_EXHAUSTED") ||
    String(error.message || '').includes("rate limit")
  );
}

async function callGeminiWithRetry<T>(fn: () => Promise<T>): Promise<T> {
  let attempt = 1;
  let delay = 2000; // start at 2 seconds
  const maxAttempts = 3;

  while (true) {
    try {
      return await fn();
    } catch (error) {
      if (isRateLimitError(error) && attempt <= maxAttempts) {
        console.warn(`Gemini API rate-limited (429). Attempt ${attempt} of ${maxAttempts}. Retrying in ${delay}ms...`, error);
        await new Promise(resolve => setTimeout(resolve, delay));
        attempt++;
        delay *= 2; // double the duration (exponential backoff)
      } else {
        throw error;
      }
    }
  }
}

export async function estimateProjectHours(name: string, description: string): Promise<number> {
  if (!process.env.GEMINI_API_KEY) {
    console.warn("GEMINI_API_KEY not found. Returning default estimation.");
    return 8;
  }

  try {
    const response = await callGeminiWithRetry(() => ai.models.generateContent({
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
    }));

    const text = response.text;
    return parseFloat(text) || 8;
  } catch (error) {
    console.error("AI Estimation failed:", error);
    return 8;
  }
}
