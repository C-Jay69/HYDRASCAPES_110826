import { z } from "zod";
import { getGenAIClient } from "./provider.js";

/**
 * Executes structured AI generation and validates output against a Zod schema.
 * Never directly uses untrusted model output.
 */
export async function aiJson<T>(
  prompt: string,
  schema: z.ZodType<T>,
  systemInstruction?: string,
  imageParts?: Array<{ inlineData: { mimeType: string; data: string } }>
): Promise<{ data: T; model: string; rawText: string }> {
  const ai = getGenAIClient();
  const modelName = "gemini-3.6-flash";

  const contentsParts: any[] = [{ text: prompt }];
  if (imageParts && imageParts.length > 0) {
    contentsParts.push(...imageParts);
  }

  try {
    const response = await ai.models.generateContent({
      model: modelName,
      contents: contentsParts.length === 1 ? prompt : { parts: contentsParts },
      config: {
        systemInstruction: systemInstruction || "You are an expert AI evaluator for Hydrascapes co-hosting marketplace. Return strict valid JSON.",
        responseMimeType: "application/json",
      },
    });

    const rawText = response.text || "{}";
    const cleanedText = rawText.replace(/^```json\s*/i, "").replace(/\s*```$/i, "").trim();
    const parsed = JSON.parse(cleanedText);
    const validated = schema.parse(parsed);

    return {
      data: validated,
      model: modelName,
      rawText: cleanedText,
    };
  } catch (error: any) {
    console.error("aiJson processing error:", error?.message || error);
    throw new Error(`AI structured processing failed: ${error?.message || "Schema validation error"}`);
  }
}
