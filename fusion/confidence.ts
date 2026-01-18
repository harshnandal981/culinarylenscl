
import { Ingredient, NeuralProtocol } from '../types';
import { STORAGE_KEYS } from '../constants';

/**
 * Computes a Composite Confidence Score (CCS).
 * Formula: 0.5 × ML + 0.3 × Gemini + 0.2 × Constraint Satisfaction
 * Includes confirmation memory bias for personalized robustness.
 */
export const calculateCompositeConfidence = (
  mlInventory: Ingredient[],
  protocol: NeuralProtocol
): number => {
  // 1. ML Mean Confidence + Memory Bias
  const saved = localStorage.getItem(STORAGE_KEYS.USER_PREFERENCES);
  const prefs = saved ? JSON.parse(saved) : {};
  const memory = prefs.confidenceMemory || {};

  const mlConfidence = mlInventory.reduce((acc, curr) => {
    let score = curr.confidence;
    
    // Upgrade for confirmed items
    if (curr.verificationStatus === 'confirmed') {
      score = Math.max(score, 0.85);
    }

    // Apply memory bias (max +0.10)
    const bias = Math.min((memory[curr.name.toLowerCase()] || 0) * 0.02, 0.10);
    return acc + Math.min(score + bias, 1.0);
  }, 0) / mlInventory.length || 1;

  // 2. Gemini Coherence (Heuristic: completeness of instructions)
  const geminiCoherence = protocol.instructions.length > 3 ? 1.0 : 0.7;

  // 3. Constraint Satisfaction (No hallucinations)
  const mlNames = new Set(mlInventory.map(i => i.name.toLowerCase()));
  const hallucinations = protocol.ingredients_used.filter(ing => !mlNames.has(ing.toLowerCase())).length;
  const constraintSatisfaction = Math.max(0, 1 - (hallucinations / protocol.ingredients_used.length));

  const composite = (0.5 * mlConfidence) + (0.3 * geminiCoherence) + (0.2 * constraintSatisfaction);
  
  return Math.round(composite * 100);
};
