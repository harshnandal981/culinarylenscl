
import React, { useState } from 'react';
import { NeuralProtocol, Ingredient, UserPreferences, AnalysisStep } from '../types';
import { synthesizeProtocol, generatePlatingVisual, generateDrinkVisual, generateIngredientVisual, generateSchematic, checkOnlineStatus, generateVisualBlueprint, VisualBlueprint } from '../services/geminiService';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, ShoppingCart, Wine, ChevronRight, LayoutTemplate, Sparkles, Check, Zap, ZapOff, Layers, Loader2, Droplets, Leaf, AlertTriangle, Eye } from 'lucide-react';
import { ERROR_MESSAGES } from '../constants';

interface SynthesisProps {
  inventory: Ingredient[];
  onExecute: () => void;
  onBack: () => void;
  onProtocolReady: (protocol: NeuralProtocol) => void;
}

const CUISINES = [
  { id: 'french', name: 'French Modern', desc: 'Precision architecture and technical emulsions.' },
  { id: 'japanese', name: 'Japanese Purity', desc: 'Minimalist aesthetic with high umami density.' },
  { id: 'indian', name: 'Indian Molecular', desc: 'Complex spice matrices and aromatic layering.' },
  { id: 'italian', name: 'Neo-Italian', desc: 'Product-focused rusticity and textures.' },
  { id: 'nordic', name: 'Neo-Nordic', desc: 'Technical fermentation and botanical profiles.' },
  { id: 'mexican', name: 'Modern Mexican', desc: 'Structural acid balance and scorched earth notes.' },
];

const DIETARY = ['None', 'Vegan', 'Vegetarian', 'Keto', 'Paleo'] as const;

const SYNTHESIS_STEPS: AnalysisStep[] = [
  { id: 'manifest', label: 'Alignment', status: 'pending' },
  { id: 'plating', label: 'Plating', status: 'pending' },
  { id: 'sommelier', label: 'Sommelier', status: 'pending' },
  { id: 'blueprint', label: 'Blueprint', status: 'pending' },
  { id: 'procurement', label: 'Procurement', status: 'pending' }
];

const Synthesis: React.FC<SynthesisProps> = ({ inventory, onExecute, onBack, onProtocolReady }) => {
  const [phase, setPhase] = useState<'CALIBRATION' | 'VERIFICATION' | 'PROCESSING' | 'RESULTS'>('CALIBRATION');
  const [localInventory] = useState<Ingredient[]>(inventory);
  const [selectedCuisine, setSelectedCuisine] = useState<string | null>(null);
  const [dietary, setDietary] = useState<typeof DIETARY[number]>('None');
  const [protocol, setProtocol] = useState<NeuralProtocol | null>(null);
  const [visualUrl, setVisualUrl] = useState<string | null>(null);
  const [drinkUrl, setDrinkUrl] = useState<string | null>(null);
  const [schematicUrl, setSchematicUrl] = useState<string | null>(null);
  const [visualBlueprint, setVisualBlueprint] = useState<VisualBlueprint | null>(null);
  const [progress, setProgress] = useState(0);
  const [statusLog, setStatusLog] = useState("Initializing Core...");
  const [steps, setSteps] = useState<AnalysisStep[]>(SYNTHESIS_STEPS);
  const [errorMessage, setErrorMessage] = useState('');
  const isOnline = checkOnlineStatus();

  const updateStep = (id: string, status: AnalysisStep['status']) => {
    setSteps(prev => prev.map(s => s.id === id ? { ...s, status } : s));
  };

  const handleStartSynthesis = async () => {
    // Check if inventory has items
    if (localInventory.length === 0) {
      setErrorMessage(`${ERROR_MESSAGES.ANALYZE_IMAGE_FIRST} to detect ingredients.`);
      return;
    }

    setPhase('PROCESSING');
    setSteps(SYNTHESIS_STEPS);
    setProgress(5);
    setStatusLog("Aligning Molecular Manifest...");
    setErrorMessage('');
    updateStep('manifest', 'active');

    const prefs: UserPreferences = {
      dietary: dietary,
      allergies: [],
      cuisinePreference: selectedCuisine || 'Global Modern',
      instamartSync: true,
      highFidelityVisuals: true
    };

    try {
      setStatusLog("Invoking Intelligence Node...");
      setProgress(20);
      const generatedProtocol = await synthesizeProtocol(localInventory, prefs);
      setProtocol(generatedProtocol);
      updateStep('manifest', 'complete');
      updateStep('plating', 'active');
      setProgress(40);

      // Non-blocking image generation with fallback
      setStatusLog("Generating Visual Assets...");
      try {
        const v = await generatePlatingVisual(generatedProtocol);
        if (v) {
          setVisualUrl(v);
        } else {
          // Fallback to visual blueprint
          console.log('[Synthesis] Image generation returned empty, requesting visual blueprint...');
          const blueprint = await generateVisualBlueprint(generatedProtocol.title, generatedProtocol.description);
          setVisualBlueprint(blueprint);
        }
      } catch (imgErr) {
        console.warn('[Synthesis] Plating visual failed, using blueprint fallback:', imgErr);
        const blueprint = await generateVisualBlueprint(generatedProtocol.title, generatedProtocol.description);
        setVisualBlueprint(blueprint);
      }
      updateStep('plating', 'complete');
      updateStep('sommelier', 'active');
      setProgress(60);

      // Non-blocking drink visual generation
      try {
        const d = await generateDrinkVisual(generatedProtocol.drinkPairing.name);
        setDrinkUrl(d);
      } catch (drinkErr) {
        console.warn('[Synthesis] Drink visual failed, continuing without image:', drinkErr);
      }
      updateStep('sommelier', 'complete');
      updateStep('blueprint', 'active');
      setProgress(80);

      // Non-blocking schematic generation
      try {
        const s = await generateSchematic(generatedProtocol);
        setSchematicUrl(s);
      } catch (schematicErr) {
        console.warn('[Synthesis] Schematic failed, continuing without image:', schematicErr);
      }
      updateStep('blueprint', 'complete');
      updateStep('procurement', 'complete');

      setProgress(100);
      onProtocolReady(generatedProtocol);
      setTimeout(() => setPhase('RESULTS'), 800);
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : '';
      if (errorMsg.includes(ERROR_MESSAGES.API_KEY_NOT_CONFIGURED)) {
        setErrorMessage(`${ERROR_MESSAGES.API_KEY_NOT_CONFIGURED}. Please add your API key in Settings.`);
      } else {
        setErrorMessage(ERROR_MESSAGES.AI_SYNTHESIS_FAILED);
      }
      setPhase('CALIBRATION');
    }
  };

  if (phase === 'CALIBRATION') {
    return (
      <div className="min-h-screen pt-28 pb-12 px-12 lg:px-24 bg-white overflow-hidden flex flex-col items-center justify-center">
        <div className="max-w-6xl w-full">
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col md:flex-row justify-between items-end gap-8 mb-16">
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-1 h-1 bg-[#C5A028] rounded-full animate-pulse"></div>
                <span className="text-[9px] uppercase tracking-[0.4em] font-bold text-black/30">{isOnline ? 'Neural Link Online' : 'Sovereign Edge Node'}</span>
              </div>
              <h2 className="text-6xl font-bold tracking-tighter text-[#0A0A0B] leading-none">
                Synthesis <span className="serif italic text-[#C5A028] font-normal">Matrix</span>
              </h2>
            </div>
            <button onClick={onBack} className="text-[9px] uppercase tracking-[0.3em] font-bold text-black/30 hover:text-black transition-all flex items-center gap-3 py-2">
              <ArrowLeft size={12} /> Abort Sequence
            </button>
          </motion.div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
            <div className="lg:col-span-8 space-y-10">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {CUISINES.map((c) => (
                  <motion.div 
                    key={c.id} whileHover={{ y: -2 }} onClick={() => setSelectedCuisine(c.name)} 
                    className={`group p-6 rounded-[2rem] cursor-pointer border transition-all duration-500 relative ${selectedCuisine === c.name ? 'bg-[#0A0A0B] border-black shadow-xl' : 'bg-white border-black/[0.03] hover:border-black/10'}`}
                  >
                    <div className="flex justify-between items-start mb-3">
                      <h4 className={`text-xl font-bold tracking-tight ${selectedCuisine === c.name ? 'text-white' : 'text-[#0A0A0B]'}`}>{c.name}</h4>
                      {selectedCuisine === c.name && <Check size={12} className="text-[#C5A028]" strokeWidth={3} />}
                    </div>
                    <p className={`text-[10px] leading-relaxed font-medium uppercase tracking-tight ${selectedCuisine === c.name ? 'text-white/30' : 'text-black/40'}`}>{c.desc}</p>
                  </motion.div>
                ))}
              </div>
            </div>

            <div className="lg:col-span-4 space-y-8">
              <div className="bg-white p-8 rounded-[2.5rem] border border-black/[0.03] shadow-sm space-y-8">
                 <div className="space-y-4">
                    <h3 className="text-[9px] uppercase tracking-[0.4em] font-bold text-black/20">Bio-Constraints</h3>
                    <div className="grid grid-cols-2 gap-2">
                      {DIETARY.map(d => (
                        <button key={d} onClick={() => setDietary(d)} className={`px-3 py-2.5 rounded-xl border text-[8px] font-bold uppercase tracking-[0.15em] transition-all ${dietary === d ? 'bg-[#0A0A0B] text-white border-black shadow-md' : 'bg-black/[0.02] border-transparent text-black/30'}`}>{d}</button>
                      ))}
                    </div>
                 </div>
              </div>

              <motion.button 
                disabled={!selectedCuisine || !isOnline} whileHover={(!selectedCuisine || !isOnline) ? {} : { y: -3 }} onClick={handleStartSynthesis}
                className={`w-full py-6 rounded-[1.8rem] text-[10px] font-bold transition-all duration-700 uppercase tracking-[0.3em] shadow-xl ${(selectedCuisine && isOnline) ? 'bg-[#0A0A0B] text-white' : 'bg-black/5 text-black/10 cursor-not-allowed'}`}
              >
                Synthesize <ChevronRight size={12} className="inline ml-1" />
              </motion.button>

              {errorMessage && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-4 bg-rose-50 text-rose-700 rounded-2xl border border-rose-100 text-[10px] font-bold flex items-center gap-3"
                >
                  <AlertTriangle size={14} />
                  <span>{errorMessage}</span>
                </motion.div>
              )}

              {!isOnline && (
                <div className="p-4 bg-amber-50 text-amber-700 rounded-2xl border border-amber-100 text-[10px] font-bold flex items-center gap-3">
                  <AlertTriangle size={14} />
                  <span>{ERROR_MESSAGES.API_KEY_NOT_CONFIGURED}. Please add your API key in Settings.</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (phase === 'PROCESSING') {
    return (
      <div className="fixed inset-0 z-[200] flex items-center justify-center bg-white/95 backdrop-blur-3xl px-8">
        <motion.div initial={{ scale: 0.99, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="w-full max-w-[600px] bg-white rounded-[3rem] shadow-2xl border border-black/[0.015] overflow-hidden mac-window">
          <div className="p-12">
            <div className="flex justify-between items-end mb-10">
               <div className="space-y-1">
                  <h4 className="text-2xl font-bold tracking-tighter italic serif text-[#0A0A0B]">Synthesis Cycle</h4>
                  <p className="text-[8px] uppercase tracking-[0.2em] font-bold text-black/30">{statusLog}</p>
               </div>
               <span className="mono text-[10px] font-bold text-[#C5A028]">{progress}%</span>
            </div>
            <div className="w-full h-[1px] bg-black/[0.03] rounded-full overflow-hidden mb-12">
              <motion.div className="h-full bg-black" initial={{ width: 0 }} animate={{ width: `${progress}%` }} />
            </div>
            <div className="grid grid-cols-5 gap-4">
               {steps.map((step) => (
                 <div key={step.id} className="relative flex flex-col items-center text-center">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 transition-all duration-700 ${
                      step.status === 'complete' ? 'bg-[#C5A028] text-white' : step.status === 'active' ? 'bg-[#0A0A0B] text-white shadow-lg scale-110' : 'bg-black/[0.02] text-black/10'
                    }`}>
                       {step.id === 'manifest' && <Layers size={14} />}
                       {step.id === 'plating' && <Sparkles size={14} />}
                       {step.id === 'sommelier' && <Wine size={14} />}
                       {step.id === 'blueprint' && <LayoutTemplate size={14} />}
                       {step.id === 'procurement' && <ShoppingCart size={14} />}
                    </div>
                    <span className={`text-[6px] uppercase tracking-[0.1em] font-bold leading-tight transition-opacity ${step.status === 'active' ? 'opacity-100' : 'opacity-20'}`}>{step.label}</span>
                 </div>
               ))}
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  if (phase === 'RESULTS' && protocol) {
    return (
      <div className="min-h-screen pt-28 pb-12 px-12 lg:px-24 max-w-[1600px] mx-auto overflow-hidden">
        {protocol.isOffline && (
           <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-8 p-4 bg-[#0A0A0B] text-white rounded-3xl flex items-center gap-4 shadow-xl border border-white/5">
             <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-[#C5A028]"><ZapOff size={14} /></div>
             <div className="space-y-0">
                <h3 className="text-sm font-bold tracking-tight uppercase">Sovereign Mode</h3>
                <p className="text-[7px] text-white/30 uppercase tracking-[0.1em] font-bold">Edge compute active. Offline intelligence handshake complete.</p>
             </div>
          </motion.div>
        )}

        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
          <div className="lg:col-span-7 space-y-10">
            <div className="relative aspect-video rounded-[3rem] overflow-hidden shadow-2xl bg-white border border-black/[0.015] flex items-center justify-center">
               {visualUrl ? (
                 <motion.img initial={{ opacity: 0 }} animate={{ opacity: 1 }} src={visualUrl} alt={protocol.title} className="w-full h-full object-cover" />
               ) : visualBlueprint ? (
                 <motion.div 
                   initial={{ opacity: 0 }} 
                   animate={{ opacity: 1 }} 
                   className="w-full h-full p-12 flex flex-col justify-center gap-6 bg-gradient-to-br from-black/[0.015] to-transparent"
                 >
                   <div className="flex items-center gap-3 mb-4">
                     <Eye size={16} className="text-[#C5A028]" />
                     <h3 className="text-[9px] uppercase tracking-[0.3em] font-bold text-black/40">Visual Blueprint</h3>
                   </div>
                   <div className="space-y-4">
                     <div>
                       <h4 className="text-[7px] uppercase tracking-[0.2em] font-bold text-[#C5A028] mb-1">Plating</h4>
                       <p className="text-sm text-black/60 leading-relaxed">{visualBlueprint.plating}</p>
                     </div>
                     <div>
                       <h4 className="text-[7px] uppercase tracking-[0.2em] font-bold text-[#C5A028] mb-1">Colors</h4>
                       <p className="text-sm text-black/60 leading-relaxed">{visualBlueprint.colors}</p>
                     </div>
                     <div>
                       <h4 className="text-[7px] uppercase tracking-[0.2em] font-bold text-[#C5A028] mb-1">Textures</h4>
                       <p className="text-sm text-black/60 leading-relaxed">{visualBlueprint.textures}</p>
                     </div>
                     <div>
                       <h4 className="text-[7px] uppercase tracking-[0.2em] font-bold text-[#C5A028] mb-1">Composition</h4>
                       <p className="text-sm text-black/60 leading-relaxed">{visualBlueprint.composition}</p>
                     </div>
                   </div>
                 </motion.div>
               ) : (
                 <div className="flex flex-col items-center opacity-5">
                   <LayoutTemplate size={48} strokeWidth={0.5} />
                 </div>
               )}
            </div>

            <div className="grid grid-cols-3 gap-6">
               <div className="bg-white p-8 rounded-[2.5rem] border border-black/[0.015] shadow-sm flex flex-col justify-between h-36">
                  <div className="flex items-center gap-2.5">
                    <Droplets size={12} className="text-[#C5A028]/50" />
                    <h3 className="text-[8px] uppercase tracking-[0.25em] font-bold text-black/30">Conservation</h3>
                  </div>
                  <div><p className="text-3xl font-bold tracking-tighter">{protocol.impactMetrics?.waterSavedLitres}</p><p className="text-[7px] uppercase tracking-[0.2em] text-black/30 font-bold mt-0.5">L Saved</p></div>
               </div>
               <div className="bg-white p-8 rounded-[2.5rem] border border-black/[0.015] shadow-sm flex flex-col justify-between h-36">
                  <div className="flex items-center gap-2.5">
                    <Leaf size={12} className="text-emerald-700/50" />
                    <h3 className="text-[8px] uppercase tracking-[0.25em] font-bold text-black/30">Sustainability</h3>
                  </div>
                  <div><p className="text-3xl font-bold tracking-tighter">{protocol.impactMetrics?.co2SavedKg}</p><p className="text-[7px] uppercase tracking-[0.2em] text-black/30 font-bold mt-0.5">kg CO2e</p></div>
               </div>
               <motion.button onClick={onExecute} whileHover={{ y: -3 }} className="bg-[#0A0A0B] text-white rounded-[2.8rem] flex flex-col items-center justify-center gap-3 text-lg font-bold group shadow-xl h-36">
                  <span>Execute</span><ChevronRight size={18} className="group-hover:translate-x-1 transition-transform text-[#C5A028]" />
               </motion.button>
            </div>
          </div>

          <div className="lg:col-span-5 space-y-10">
            <div className="space-y-4">
              <button onClick={() => setPhase('CALIBRATION')} className="flex items-center gap-2 text-[8px] uppercase tracking-[0.3em] text-[#C5A028] font-bold hover:opacity-60 transition-all"><ArrowLeft size={10} /> Re-Align</button>
              <h1 className="text-5xl font-bold tracking-tighter text-[#0A0A0B] leading-[0.9]">{protocol.title}</h1>
              <p className="text-lg text-black/40 italic serif leading-relaxed tracking-tight">{protocol.description}</p>
            </div>
            
            <div className="space-y-6">
              <div className="glass-premium p-8 rounded-[2.5rem] flex items-center gap-6 border-black/[0.015]">
                 <div className="w-16 h-16 bg-black/[0.02] rounded-2xl overflow-hidden flex-shrink-0 border border-black/[0.015]">
                    {drinkUrl ? <img src={drinkUrl} alt={protocol.drinkPairing.name} className="w-full h-full object-cover grayscale opacity-40" /> : <div className="w-full h-full flex items-center justify-center"><Wine size={20} className="text-black/10" /></div>}
                 </div>
                 <div>
                    <div className="flex items-center gap-2 mb-1">
                       <Wine size={10} className="text-[#C5A028]/50" />
                       <h3 className="text-[8px] uppercase tracking-[0.2em] font-bold text-black/30">Sommelier Note</h3>
                    </div>
                    <h4 className="text-lg font-bold tracking-tight mb-0.5">{protocol.drinkPairing.name}</h4>
                    <p className="text-[10px] text-black/40 leading-tight font-medium">{protocol.drinkPairing.description}</p>
                 </div>
              </div>

              <div className="relative aspect-square rounded-[2.5rem] overflow-hidden shadow-lg bg-white border border-black/[0.015] flex items-center justify-center p-8">
                 {schematicUrl ? <img src={schematicUrl} alt={`${protocol.title} schematic`} className="w-full h-full object-contain opacity-30 mix-blend-multiply" /> : <LayoutTemplate size={32} className="text-black/5" />}
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  return null;
};

export default Synthesis;
