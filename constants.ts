/**
 * Shared constants for the CulinaryLens application
 */

// LocalStorage keys
export const STORAGE_KEYS = {
  GEMINI_API_KEY: 'culinary_lens_gemini_key',
  USER_PREFERENCES: 'culinary_lens_prefs',
} as const;

// Error messages
export const ERROR_MESSAGES = {
  API_KEY_NOT_CONFIGURED: 'Gemini API key not configured',
  ANALYZE_IMAGE_FIRST: 'Analyze an image first',
  AI_SYNTHESIS_FAILED: 'AI synthesis failed, please retry',
} as const;
