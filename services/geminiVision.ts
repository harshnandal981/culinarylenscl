
import { GoogleGenAI, Type, GenerateContentResponse } from "@google/genai";
import { FoodAnalysisResult } from "../types";
import { checkOnlineStatus } from "./geminiService";

/**
 * Exponential backoff utility for API resilience (reused pattern).
 */
const withRetry = async <T>(fn: () => Promise<T>, retries = 3, delay = 2000): Promise<T> => {
  try {
    return await fn();
  } catch (err: any) {
    const errorMsg = err?.message || '';
    const isQuotaExceeded = errorMsg.toLowerCase().includes('quota') || errorMsg.includes('429') || errorMsg.includes('RESOURCE_EXHAUSTED');
    const isTransient = isQuotaExceeded || errorMsg.includes('500') || errorMsg.includes('fetch');

    if (isTransient && retries > 0 && !isQuotaExceeded) {
      console.warn(`[Gemini Vision] Retrying in ${delay}ms... (${retries} attempts left)`);
      await new Promise(resolve => setTimeout(resolve, delay));
      return withRetry(fn, retries - 1, delay * 2);
    }
    throw err;
  }
};

/**
 * Standardized AI Instance Creator (reused pattern).
 */
const getAi = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) throw new Error("API_KEY_NULL");
  return new GoogleGenAI({ apiKey });
};

/**
 * Fallback data for when vision analysis fails or is offline.
 */
const getFallbackAnalysis = (): FoodAnalysisResult => ({
  ingredients: ["unknown"],
  cuisine: "Mixed",
  cookingStyle: "varied",
  freshness: "analysis unavailable - offline mode",
  visualDescription: "A culinary composition awaiting detailed analysis. Visual assessment requires online connectivity.",
  generatedImage: undefined
});

/**
 * Analyzes a food image using Gemini's multimodal vision capabilities.
 * Extracts comprehensive culinary data including ingredients, cuisine type,
 * cooking style, freshness indicators, and visual descriptions.
 * 
 * @param imageBase64 - Base64-encoded image data (without data:image prefix)
 * @returns FoodAnalysisResult with structured culinary analysis
 */
export const analyzeFoodImage = async (imageBase64: string): Promise<FoodAnalysisResult> => {
  // Check online status first
  if (!checkOnlineStatus()) {
    console.warn("[Gemini Vision] Offline mode - returning fallback analysis");
    return getFallbackAnalysis();
  }

  try {
    const ai = getAi();
    
    // Comprehensive culinary vision prompt
    const visionPrompt = `You are an expert culinary vision analyst with deep knowledge of global cuisines, cooking techniques, and food quality assessment.

Analyze this food image comprehensively and extract the following information:

1. **Ingredients**: List ALL visible ingredients you can identify. Be thorough and specific.
2. **Cuisine Type**: Identify the cuisine style (e.g., Italian, Japanese, French, Fusion, Mediterranean, etc.)
3. **Cooking Style**: Determine the primary cooking method used (e.g., grilled, roasted, sautéed, raw, fried, steamed, etc.)
4. **Freshness Assessment**: Evaluate the freshness based on visual cues like color vibrancy, texture, and overall appearance. Provide a brief assessment.
5. **Visual Description**: Create a detailed, vivid description of the dish as it appears - describe colors, plating, arrangement, and presentation style. This should be suitable for recreating the visual appearance.

CRITICAL: Return ONLY a valid JSON object with this exact structure, no markdown formatting, no additional text:
{
  "ingredients": ["ingredient1", "ingredient2", "..."],
  "cuisine": "cuisine type",
  "cookingStyle": "cooking method",
  "freshness": "freshness assessment with visual indicators",
  "visualDescription": "detailed visual description of the plated dish",
  "generatedImage": null
}`;

    const response = await withRetry<GenerateContentResponse>(() => ai.models.generateContent({
      model: 'gemini-1.5-pro',
      contents: {
        parts: [
          { inlineData: { data: imageBase64, mimeType: 'image/jpeg' } },
          { text: visionPrompt }
        ]
      },
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            ingredients: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            },
            cuisine: { type: Type.STRING },
            cookingStyle: { type: Type.STRING },
            freshness: { type: Type.STRING },
            visualDescription: { type: Type.STRING },
            generatedImage: { type: Type.STRING, nullable: true }
          },
          required: ['ingredients', 'cuisine', 'cookingStyle', 'freshness', 'visualDescription']
        }
      }
    }));

    // Parse the response
    const analysisText = response.text || "{}";
    const analysis: FoodAnalysisResult = JSON.parse(analysisText);

    // Validate the response has required fields
    if (!analysis.ingredients || !analysis.cuisine || !analysis.cookingStyle) {
      console.warn("[Gemini Vision] Invalid response structure, using fallback");
      return getFallbackAnalysis();
    }

    console.log("[Gemini Vision] Analysis complete:", analysis);
    return analysis;

  } catch (err: any) {
    console.error("[Gemini Vision] Analysis failed:", err);
    return getFallbackAnalysis();
  }
};
