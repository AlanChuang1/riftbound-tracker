import { GoogleGenerativeAI, GenerativeModel, Part } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

// Fallback chain ordered by capability (highest to lowest)
const FLASH_MODELS = [
  "gemini-2.5-flash",
  "gemini-2.5-flash-lite-preview-06-17",
  "gemini-2.0-flash",
  "gemini-2.0-flash-lite",
];

function isQuotaError(error: unknown): boolean {
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    return (
      msg.includes("resource_exhausted") ||
      msg.includes("quota") ||
      msg.includes("rate limit") ||
      msg.includes("429") ||
      msg.includes("too many requests")
    );
  }
  return false;
}

/**
 * Generate content using the flash model fallback chain.
 * Tries each model in order, falling back on quota/rate-limit errors.
 */
export async function generateWithFallback(
  parts: (string | Part)[],
): Promise<{ text: string; model: string }> {
  let lastError: unknown;

  for (const modelName of FLASH_MODELS) {
    const model: GenerativeModel = genAI.getGenerativeModel({ model: modelName });
    try {
      const result = await model.generateContent(parts);
      return { text: result.response.text().trim(), model: modelName };
    } catch (error) {
      if (isQuotaError(error)) {
        console.warn(`Gemini model ${modelName} quota exceeded, trying next...`);
        lastError = error;
        continue;
      }
      throw error; // Non-quota errors should propagate immediately
    }
  }

  throw lastError || new Error("All Gemini models exhausted");
}

export const geminiPro = genAI.getGenerativeModel({
  model: "gemini-2.5-pro",
});
