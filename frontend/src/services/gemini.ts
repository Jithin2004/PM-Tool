import { GoogleGenAI, Type } from "@google/genai";

const apiKey = ''; // Disabled for security
const ai = new GoogleGenAI({ apiKey });

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

function isPermanentQuotaExhaustion(error: any): boolean {
  if (!error) return false;
  const errMsg = String(error.message || error.status || '').toLowerCase();
  return (
    errMsg.includes("quota exceeded") ||
    errMsg.includes("exceeded your current quota") ||
    errMsg.includes("billing details") ||
    errMsg.includes("plan and billing")
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
      if (isPermanentQuotaExhaustion(error)) {
        console.error("Gemini API daily quota fully exhausted. Skipping retries to save bandwidth and instantly using local fallback.", error);
        throw error;
      }
      if (isRateLimitError(error) && attempt <= maxAttempts) {
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
  if (!apiKey) {
    return 8;
  }

  try {
    const response = await callGeminiWithRetry(() => ai.models.generateContent({
      model: "gemini-3.1-flash-lite",
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
