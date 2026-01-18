
export enum ViewState {
  LANDING = 'LANDING',
  UPLOAD = 'UPLOAD',
  ANALYSIS = 'ANALYSIS',
  DASHBOARD = 'DASHBOARD',
  CUISINE_SELECTOR = 'CUISINE_SELECTOR',
  SYNTHESIS = 'SYNTHESIS',
  EXECUTION = 'EXECUTION',
  SETTINGS = 'SETTINGS'
}

export enum ModelType {
  DETECTION = 'DETECTION',
  CLASSIFICATION = 'CLASSIFICATION',
  REASONING = 'REASONING'
}

export interface OfflineModel {
  id: string;
  name: string;
  version: string;
  type: ModelType;
  accuracy: number;
  coverage: string[];
}

export interface Ingredient {
  id: string;
  name: string;
  scientificName: string;
  category: string;
  mass_grams: number;
  vitality_score: number; // 0-100 (freshness)
  expires_in_days: number;
  confidence: number;
  molecularProfile?: string[];
  flavorNodes?: string[];
  verificationStatus?: 'unverified' | 'confirmed' | 'dismissed';
}

export interface RecallHypothesis {
  name: string;
  justification: string;
  visualHint: string;
  confidence: number;
}

export interface AnalysisStep {
  id: string;
  label: string;
  status: 'pending' | 'active' | 'complete' | 'failed';
}

export interface DrinkPairing {
  name: string;
  description: string;
  visualUrl?: string;
}

export interface ImpactMetrics {
  co2SavedKg: number;
  waterSavedLitres: number;
  wasteAvoidedGrams: number;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

export interface NeuralProtocol {
  id: string;
  title: string;
  description: string;
  complexity: 'Low' | 'Medium' | 'High';
  duration_minutes: number;
  ingredients_used: string[];
  missing_ingredients?: string[];
  molecularAffinity: number; // 0-100
  instructions: ProtocolStep[];
  platingTips: string[];
  drinkPairing: DrinkPairing;
  nutrition: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  };
  visualUrl?: string;
  schematicUrl?: string;
  groundingSources: string[];
  impactMetrics?: ImpactMetrics;
  substitutionRisk?: 'SAFE' | 'EXPERIMENTAL' | 'RISKY';
  isOffline?: boolean;
}

export interface ProtocolStep {
  order: number;
  instruction: string;
  technique: string;
  target_temp?: string;
  timer_seconds?: number;
  arHint?: string;
}

export interface UserPreferences {
  dietary: 'None' | 'Vegan' | 'Vegetarian' | 'Keto' | 'Paleo';
  allergies: string[];
  cuisinePreference?: string;
  instamartSync: boolean;
  highFidelityVisuals: boolean;
  confidenceMemory?: Record<string, number>; 
  outcomeFeedback?: Record<string, 'success' | 'neutral' | 'improvement'>;
}

export interface PerceptionResult {
  ingredients: Ingredient[];
}

export interface FoodAnalysisResult {
  ingredients: string[];
  cuisine: string;
  cookingStyle: string;
  freshness: string;
  visualDescription: string;
  generatedImage?: string;
}