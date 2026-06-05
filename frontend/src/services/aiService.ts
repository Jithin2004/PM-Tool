import { GoogleGenAI, Type } from "@google/genai";

const apiKey = process.env.GEMINI_API_KEY || '';
const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;

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

export function getLocalTelemetryInsight(stats: any): string {
  const confidence = stats.deliveryConfidence ?? 100;
  const bandwidth = stats.teamBandwidth ?? 0;
  const decay = stats.dailyFatigue ?? 0;
  const overloaded = stats.overloadedSquads || [];

  const responses: string[] = [];

  if (overloaded.length > 0) {
    const squadNames = overloaded.map((s: any) => s.name).join(", ");
    responses.push(`Critical load variance detected. Teams [${squadNames}] exhibit severe overload analytics. Recommend rapid team reallocation to counter Delivery Risk.`);
  }

  if (confidence < 75) {
    responses.push(`System delivery confidence is running at a sub-nominal ${confidence}%. Active project fatigue and task decay metrics indicate high execution risk.`);
  } else if (confidence > 90) {
    responses.push(`System delivery confidence registers a highly nominal ${confidence}%. Execution vectors remain optimized with minimal architectural bias.`);
  }

  if (bandwidth > 85) {
    responses.push(`Team bandwidth utilization is peaking at a sub-critical ${bandwidth}%. Team fatigue thresholds are at high-risk limits; variance correction is advised.`);
  } else if (bandwidth < 50) {
    responses.push(`Under-utilization pattern observed: team bandwidth is currently ${bandwidth}%. Optimization of workflow intake is suggested.`);
  }

  if (decay > 15) {
    responses.push(`Predictive task decay is elevated at ${decay} hours. System metrics show progressive fatigue trends, likely dragging down sprint confidence.`);
  }

  if (responses.length === 0) {
    responses.push(`Analytics nominal. Overall bandwidth utilization is ${bandwidth}% with zero team overload. Delivery confidence is solid at ${confidence}%.`);
  }

  return responses[0];
}

export async function estimateProject(description: string) {
  if (!ai || !apiKey) {
    return {
      coreHours: 12,
      overheadMultiplier: 1.5,
      suggestedPriority: 3,
      overheadItems: [
        { label: "QA & Integration Testing", hours: 4 },
        { label: "Deployment & Verification Pipeline", hours: 2 }
      ]
    };
  }

  try {
    const response = await callGeminiWithRetry(() => ai.models.generateContent({
      model: "gemini-3.1-flash-lite",
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
    }));

    const text = response.text;
    if (!text) throw new Error("No response from AI");
    
    return JSON.parse(text);
  } catch (error) {
    console.error("AI Estimation failed, returning offline heuristics:", error);
    return {
      coreHours: 12,
      overheadMultiplier: 1.5,
      suggestedPriority: 3,
      overheadItems: [
        { label: "QA & Integration Testing (Offline Heuristics)", hours: 4 },
        { label: "Deployment Pipeline (Offline Heuristics)", hours: 2 }
      ]
    };
  }
}

export async function generateSystemInsight(stats: any) {
  if (!ai || !apiKey) {
    return getLocalTelemetryInsight(stats);
  }

  try {
    const response = await callGeminiWithRetry(() => ai.models.generateContent({
      model: "gemini-3.1-flash-lite",
      contents: `
        You are an elite, highly technical AI Project Manager overseeing an engineering system.
        Analyze the following real-time analytics from the dashboard and provide a single, 1-2 sentence technical insight.
        Maintain a high-fidelity, predictive, and slightly cybernetic tone (e.g., use terms like "nominal", "variance", "analytics", "Delivery Risk").
        Do NOT use markdown. Do NOT use pleasantries. Just return the raw string insight.
        
        Analytics:
        - Active Workflows: ${stats.totalProjects}
        - Delivery Confidence: ${stats.deliveryConfidence}%
        - Team Allocation (Bandwidth): ${stats.teamBandwidth}%
        - Delivery Risk (Variance/Fatigue): ${stats.dailyFatigue} hours
        - Overloaded Teams: ${stats.overloadedSquads?.length > 0 ? stats.overloadedSquads.map((s:any) => s.name).join(", ") : "None"}
      `
    }));

    return response.text?.trim() || getLocalTelemetryInsight(stats);
  } catch (error) {
    return getLocalTelemetryInsight(stats);
  }
}
