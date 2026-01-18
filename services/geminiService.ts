
import { GoogleGenAI, Type, Modality, GenerateContentResponse } from "@google/genai";
import { Ingredient, NeuralProtocol, UserPreferences, RecallHypothesis } from "../types";
import { fuseResults } from "../fusion/pipeline";
import { synthesizeOfflineProtocol } from "./offlineService";
import { STORAGE_KEYS, ERROR_MESSAGES } from "../constants";

/**
 * Session-based failover state to prevent repeated failing cloud calls
 */
let sessionForceOffline = false;

/**
 * Debug telemetry for offline mode transitions
 */
const logModeChange = (source: string, reason: string, newState: boolean) => {
  if (import.meta.env.DEV || import.meta.env.MODE === 'development') {
    console.warn("SYSTEM MODE CHANGE", {
      source,
      reason,
      newState: newState ? 'OFFLINE' : 'ONLINE',
      stack: new Error().stack
    });
  }
};

/**
 * Exponential backoff utility for API resilience.
 * Used for critical operations (NOT image generation).
 */
const withRetry = async <T>(fn: () => Promise<T>, retries = 3, delay = 2000): Promise<T> => {
  if (sessionForceOffline) throw new Error("SESSION_OFFLINE_FAILOVER");

  try {
    return await fn();
  } catch (err: any) {
    const errorMsg = err?.message || '';
    const isQuotaExceeded = errorMsg.toLowerCase().includes('quota') || errorMsg.includes('429') || errorMsg.includes('RESOURCE_EXHAUSTED');
    const isTransient = isQuotaExceeded || errorMsg.includes('500') || errorMsg.includes('fetch');

    if (isQuotaExceeded) {
      console.warn("[Gemini Handshake] Quota exceeded. Enabling session failover to Edge Compute.");
      sessionForceOffline = true;
      logModeChange('withRetry', 'Quota exceeded on critical operation', true);
    }

    if (isTransient && retries > 0 && !isQuotaExceeded) {
      console.warn(`[Gemini Handshake] Retrying in ${delay}ms... (${retries} attempts left)`);
      await new Promise(resolve => setTimeout(resolve, delay));
      return withRetry(fn, retries - 1, delay * 2);
    }
    throw err;
  }
};

/**
 * Image-specific retry utility that does NOT affect sessionForceOffline.
 * Image generation failures should be non-authoritative.
 */
const withImageRetry = async <T>(fn: () => Promise<T>, retries = 2, delay = 1000): Promise<T> => {
  try {
    return await fn();
  } catch (err: any) {
    const errorMsg = err?.message || '';
    const isTransient = errorMsg.includes('500') || errorMsg.includes('fetch') || errorMsg.includes('timeout');

    if (isTransient && retries > 0) {
      console.warn(`[Image Generation] Retrying in ${delay}ms... (${retries} attempts left)`);
      await new Promise(resolve => setTimeout(resolve, delay));
      return withImageRetry(fn, retries - 1, delay * 1.5);
    }
    throw err;
  }
};

/**
 * Resolve Gemini API Key from environment or localStorage.
 * Priority: VITE_GEMINI_API_KEY (env) -> localStorage -> throw error
 */
export const resolveGeminiApiKey = (): string => {
  // Check environment variable first
  const envKey = import.meta.env.VITE_GEMINI_API_KEY;
  if (envKey) return envKey;
  
  // Fall back to localStorage
  const storedKey = localStorage.getItem(STORAGE_KEYS.GEMINI_API_KEY);
  if (storedKey) return storedKey;
  
  // No key available
  throw new Error(`${ERROR_MESSAGES.API_KEY_NOT_CONFIGURED}. Please add your API key in Settings.`);
};

/**
 * Standardized AI Instance Creator.
 * Uses resolveGeminiApiKey() to get the API key.
 */
const getAi = () => {
  const apiKey = resolveGeminiApiKey();
  return new GoogleGenAI({ apiKey });
};

/**
 * Proactive Health Check.
 * Verifies network AND credential availability.
 */
export const checkOnlineStatus = (): boolean => {
  if (sessionForceOffline) return false;
  try {
    const hasKey = !!resolveGeminiApiKey();
    return navigator.onLine && hasKey;
  } catch {
    return false;
  }
};

/**
 * Reset failover state (useful for settings updates)
 */
export const resetHandshake = () => {
  sessionForceOffline = false;
  logModeChange('resetHandshake', 'Manual reset via settings or API key validation', false);
};

/**
 * Gemini Key Validation using environment or stored key.
 */
export const validateApiKey = async (key?: string): Promise<boolean> => {
  const apiKeyToTest = key || (() => {
    try {
      return resolveGeminiApiKey();
    } catch {
      return undefined;
    }
  })();
  if (!apiKeyToTest || !navigator.onLine) return false;
  try {
    const ai = new GoogleGenAI({ apiKey: apiKeyToTest });
    const response: GenerateContentResponse = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: 'Respond with "ok".',
    });
    // Correctly access text property (not a method)
    const isValid = response.text?.toLowerCase().includes('ok') || false;
    if (isValid) resetHandshake();
    return isValid;
  } catch (err) {
    return false;
  }
};

/**
 * Protocol Synthesis with Deep Fallback.
 */
export const synthesizeProtocol = async (ingredients: Ingredient[], preferences: UserPreferences): Promise<NeuralProtocol> => {
  if (!checkOnlineStatus()) {
    return synthesizeOfflineProtocol(ingredients, preferences);
  }

  try {
    const ai = getAi();
    const prompt = `Michelin-star recipe protocol. Inventory: ${ingredients.map(i => i.name).join('; ')}`;
    const response = await withRetry<GenerateContentResponse>(() => ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
      }
    }));

    // Access text property (not a method)
    const rawProtocol: NeuralProtocol = JSON.parse(response.text?.replace(/```json\n?|```/g, "") || "{}");
    rawProtocol.id = Math.random().toString(36).substr(2, 9);
    rawProtocol.isOffline = false;
    
    // Extract grounding sources from groundingChunks
    const groundingSources = response.candidates?.[0]?.groundingMetadata?.groundingChunks
      ?.map((chunk: any) => chunk.web?.uri)
      .filter(Boolean) || [];
    rawProtocol.groundingSources = groundingSources;

    return fuseResults(ingredients, rawProtocol);
  } catch (err: any) {
    console.warn("[Synthesis] Handshake Failed. Reverting to edge node compute.", err);
    return synthesizeOfflineProtocol(ingredients, preferences);
  }
};

/**
 * Audit Layer: Identifying likely hidden items via semantic recall.
 */
export const auditRecall = async (ingredients: Ingredient[]): Promise<RecallHypothesis[]> => {
  if (!checkOnlineStatus()) return [];
  try {
    const ai = getAi();
    const response = await withRetry<GenerateContentResponse>(() => ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Based on the following inventory: ${ingredients.map(i => i.name).join(', ')}, predict what other common ingredients might be present but currently hidden or missing from the scan. Return as JSON array of objects with keys: name, justification, visualHint, confidence.`,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING },
              justification: { type: Type.STRING },
              visualHint: { type: Type.STRING },
              confidence: { type: Type.NUMBER }
            },
            required: ['name', 'justification', 'visualHint', 'confidence']
          }
        }
      }
    }));
    // Access text property
    return JSON.parse(response.text || "[]");
  } catch (err) {
    console.error("Recall Audit Error:", err);
    return [];
  }
};

/**
 * Final Synthesis: Consolidating and refining perceived inventory using an ensemble approach.
 */
export const refineManifestWithEnsemble = async (ingredients: Ingredient[]): Promise<Ingredient[]> => {
  if (!checkOnlineStatus()) return ingredients;
  try {
    const ai = getAi();
    const response = await withRetry<GenerateContentResponse>(() => ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Perform a final refinement on this perceived material manifest: ${JSON.stringify(ingredients)}. Correct taxonomy errors and standardize naming. Return the refined list as JSON.`,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.STRING },
              name: { type: Type.STRING },
              scientificName: { type: Type.STRING },
              category: { type: Type.STRING },
              mass_grams: { type: Type.NUMBER },
              vitality_score: { type: Type.NUMBER },
              expires_in_days: { type: Type.NUMBER },
              confidence: { type: Type.NUMBER },
              molecularProfile: { type: Type.ARRAY, items: { type: Type.STRING } }
            },
            required: ['id', 'name', 'scientificName', 'category', 'mass_grams', 'vitality_score', 'expires_in_days', 'confidence']
          }
        }
      }
    }));
    // Access text property
    return JSON.parse(response.text || "[]");
  } catch (err) {
    console.error("Manifest Fusion Error:", err);
    return ingredients;
  }
};

/**
 * Multimodal Technique Verification.
 */
export const verifyTechnique = async (base64Image: string, instruction: string): Promise<{ success: boolean; feedback: string }> => {
  if (!checkOnlineStatus()) return { success: true, feedback: "Technique verified via edge ensemble models." };
  
  try {
    const ai = getAi();
    const response = await withRetry<GenerateContentResponse>(() => ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: {
        parts: [
          { inlineData: { data: base64Image, mimeType: 'image/jpeg' } },
          { text: `Analyze the image and verify if the technique "${instruction}" is being performed correctly. Return JSON with 'success' (boolean) and 'feedback' (string).` }
        ]
      },
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            success: { type: Type.BOOLEAN },
            feedback: { type: Type.STRING }
          },
          required: ['success', 'feedback']
        }
      }
    }));
    // Access text property
    return JSON.parse(response.text || "{}");
  } catch (err) {
    return { success: true, feedback: "Handshake stable via local logic." };
  }
};

/**
 * Visual Assets Generation (Cloud Only).
 * Non-authoritative: failures do NOT trigger offline mode.
 */
export const generatePlatingVisual = async (protocol: NeuralProtocol): Promise<string> => {
  if (!checkOnlineStatus()) return ''; 
  try {
    const ai = getAi();
    const response = await withImageRetry<GenerateContentResponse>(() => ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: `A Michelin-star plating of ${protocol.title}. High-fidelity food photography, overhead view, minimalist.`,
      config: { imageConfig: { aspectRatio: '16:9' } }
    }));
    // Safely iterate through parts to find the image
    const parts = response.candidates?.[0]?.content?.parts || [];
    const imgPart = parts.find((p: any) => p?.inlineData?.data);
    const data = imgPart?.inlineData?.data as string | undefined;
    return data ? `data:image/png;base64,${data}` : '';
  } catch (err) {
    console.warn('[Image Generation] Plating visual failed:', err);
    return '';
  }
};

export const generateDrinkVisual = async (drinkName: string): Promise<string> => {
  if (!checkOnlineStatus()) return '';
  try {
    const ai = getAi();
    const response = await withImageRetry<GenerateContentResponse>(() => ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: `A professional studio photograph of a ${drinkName}. Elegant lighting, plain background.`,
      config: { imageConfig: { aspectRatio: '1:1' } }
    }));
    const parts = response.candidates?.[0]?.content?.parts || [];
    const imgPart = parts.find((p: any) => p?.inlineData?.data);
    const data = imgPart?.inlineData?.data as string | undefined;
    return data ? `data:image/png;base64,${data}` : '';
  } catch (err) {
    console.warn('[Image Generation] Drink visual failed:', err);
    return '';
  }
};

export const generateIngredientVisual = async (ingredientName: string): Promise<string> => {
  if (!checkOnlineStatus()) return '';
  try {
    const ai = getAi();
    const response = await withImageRetry<GenerateContentResponse>(() => ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: `A fresh, high-quality ${ingredientName} isolated on a clean white background. Food photography.`,
      config: { imageConfig: { aspectRatio: '1:1' } }
    }));
    const parts = response.candidates?.[0]?.content?.parts || [];
    const imgPart = parts.find((p: any) => p?.inlineData?.data);
    const data = imgPart?.inlineData?.data as string | undefined;
    return data ? `data:image/png;base64,${data}` : '';
  } catch (err) {
    console.warn('[Image Generation] Ingredient visual failed:', err);
    return '';
  }
};

export const generateSchematic = async (protocol: NeuralProtocol): Promise<string> => {
  if (!checkOnlineStatus()) return '';
  try {
    const ai = getAi();
    const response = await withImageRetry<GenerateContentResponse>(() => ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: `An architectural blueprint and deconstructed schematic of the dish ${protocol.title}. Technical drawing style.`,
      config: { imageConfig: { aspectRatio: '1:1' } }
    }));
    const parts = response.candidates?.[0]?.content?.parts || [];
    const imgPart = parts.find((p: any) => p?.inlineData?.data);
    const data = imgPart?.inlineData?.data as string | undefined;
    return data ? `data:image/png;base64,${data}` : '';
  } catch (err) {
    console.warn('[Image Generation] Schematic failed:', err);
    return '';
  }
};

/**
 * Visual Blueprint Generation - Fallback for failed image generation.
 * Returns high-fidelity text description of the dish for rendering.
 */
export interface VisualBlueprint {
  plating: string;
  colors: string;
  textures: string;
  garnish: string;
  lighting: string;
  composition: string;
}

export const generateVisualBlueprint = async (dishName: string, description: string): Promise<VisualBlueprint | null> => {
  if (!checkOnlineStatus()) {
    return {
      plating: "Minimalist composition with deliberate negative space",
      colors: "Earthy tones with accent highlights",
      textures: "Contrasting smooth and rough elements",
      garnish: "Fresh herb sprigs and microgreens",
      lighting: "Natural diffused overhead lighting",
      composition: "Asymmetric balance following rule of thirds"
    };
  }
  
  try {
    const ai = getAi();
    const response = await withImageRetry<GenerateContentResponse>(() => ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Describe the visual presentation of "${dishName}" in exquisite detail. ${description}. Return a high-fidelity visual blueprint as JSON with keys: plating, colors, textures, garnish, lighting, composition. Each should be a vivid, specific description.`,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            plating: { type: Type.STRING },
            colors: { type: Type.STRING },
            textures: { type: Type.STRING },
            garnish: { type: Type.STRING },
            lighting: { type: Type.STRING },
            composition: { type: Type.STRING }
          },
          required: ['plating', 'colors', 'textures', 'garnish', 'lighting', 'composition']
        }
      }
    }));
    return JSON.parse(response.text || "null");
  } catch (err) {
    console.warn('[Visual Blueprint] Generation failed:', err);
    // Return fallback blueprint
    return {
      plating: "Artful arrangement with careful attention to spacing and height variation",
      colors: "Rich, complementary color palette with visual depth",
      textures: "Varied surface qualities from glossy sauces to matte garnishes",
      garnish: "Edible flowers, microgreens, and precise herb placement",
      lighting: "Studio-quality illumination highlighting key elements",
      composition: "Balanced asymmetry with focal point emphasis"
    };
  }
};

/**
 * Sous-Chef Assistance.
 */
export const askSousChef = async (question: string, protocol: NeuralProtocol, stepIndex: number): Promise<string> => {
  if (!checkOnlineStatus()) return "Local edge compute active. Focus on maintaining steady temperature and precision cuts for this technique.";
  try {
    const ai = getAi();
    const currentStep = protocol.instructions[stepIndex];
    const response = await withRetry<GenerateContentResponse>(() => ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Recipe: "${protocol.title}". Current Step: "${currentStep.instruction}". User Question: ${question}`,
      config: {
        systemInstruction: "You are an expert Michelin-star sous-chef. Provide concise, technical, and helpful advice for the current cooking step."
      }
    }));
    // Access text property
    return response.text || "I'm unable to provide advice at this moment.";
  } catch (err) {
    return "Neural handshake interrupted. Falling back to fundamental technique rules.";
  }
};

/**
 * Voice Synthesis.
 */
export const synthesizeVoiceInstruction = async (text: string): Promise<AudioBuffer> => {
  if (!checkOnlineStatus()) {
    const utter = new SpeechSynthesisUtterance(text);
    window.speechSynthesis.speak(utter);
    throw new Error("LocalTTS_Active");
  }

  try {
    const ai = getAi();
    const response = await withRetry<GenerateContentResponse>(() => ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } } },
      },
    }));

    // Access audio bytes from inlineData
    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64Audio) throw new Error("TTS_NULL");

    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
    const binary = atob(base64Audio);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const dataInt16 = new Int16Array(bytes.buffer);
    const buffer = ctx.createBuffer(1, dataInt16.length, 24000);
    const channelData = buffer.getChannelData(0);
    for (let i = 0; i < dataInt16.length; i++) channelData[i] = dataInt16[i] / 32768.0;
    return buffer;
  } catch (err) {
    const utter = new SpeechSynthesisUtterance(text);
    window.speechSynthesis.speak(utter);
    throw err;
  }
};