
import React, { useState, useRef } from 'react';
import { refineManifestWithEnsemble, auditRecall, checkOnlineStatus } from '../services/geminiService';
import { analyzeFoodImage } from '../services/geminiVision';
import { run_perception_pipeline, run_targeted_rescan } from '../perception/pipeline';
import { Ingredient, AnalysisStep } from '../types';
import { motion, AnimatePresence } from 'framer-motion';
import { Camera, ShieldCheck, Cpu, Search, Sparkles, Database, Layers, AlertTriangle, ZapOff, Eye } from 'lucide-react';
import { registry } from '../services/modelRegistry';

interface AnalyzerProps {
  onComplete: (ingredients: Ingredient[]) => void;
}

const INITIAL_STEPS: AnalysisStep[] = [
  { id: 'detect', label: 'Optical Initialization', status: 'pending' },
  { id: 'segment', label: 'Boundary Refinement', status: 'pending' },
  { id: 'audit', label: 'Semantic Recall Audit', status: 'pending' },
  { id: 'rescan', label: 'Targeted Re-scan', status: 'pending' },
  { id: 'fuse', label: 'Manifest Fusion', status: 'pending' },
  { id: 'vision', label: 'Vision Analysis', status: 'pending' }
];

const Analyzer: React.FC<AnalyzerProps> = ({ onComplete }) => {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState("Initializing System...");
  const [steps, setSteps] = useState<AnalysisStep[]>(INITIAL_STEPS);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isOnline = checkOnlineStatus();

  const updateStep = (id: string, status: AnalysisStep['status']) => {
    setSteps(prev => prev.map(s => s.id === id ? { ...s, status } : s));
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64 = (event.target?.result as string).split(',')[1];
      setIsAnalyzing(true);
      setError(null);
      setSteps(INITIAL_STEPS);
      
      try {
        updateStep('detect', 'active');
        setProgress(15);
        const primaryManifest = await run_perception_pipeline(base64, (msg) => setStatusText(msg));
        updateStep('detect', 'complete');
        updateStep('segment', 'complete');

        await new Promise(r => setTimeout(r, 600));

        updateStep('audit', 'active');
        setStatusText(isOnline ? "Identifying hidden items..." : "Local Edge prediction active...");
        setProgress(55);
        const hypotheses = await auditRecall(primaryManifest);
        updateStep('audit', 'complete');

        updateStep('rescan', 'active');
        setStatusText("Validating inferred materials...");
        setProgress(75);
        const recoveredItems = await run_targeted_rescan(base64, hypotheses);
        const aggregatedManifest = [...primaryManifest, ...recoveredItems];
        updateStep('rescan', 'complete');

        updateStep('fuse', 'active');
        setStatusText("Consolidating inventory...");
        setProgress(85);
        const ensembleIngredients = await refineManifestWithEnsemble(aggregatedManifest);
        updateStep('fuse', 'complete');

        updateStep('vision', 'active');
        setStatusText("Analyzing culinary composition...");
        setProgress(95);
        const visionAnalysis = await analyzeFoodImage(base64);
        updateStep('vision', 'complete');

        setProgress(100);
        setStatusText("Inference Complete.");
        setTimeout(() => onComplete(ensembleIngredients), 800);
      } catch (err: any) {
        setIsAnalyzing(false);
        setError("Critical analysis failure. Check configuration.");
      }
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="min-h-screen pt-32 pb-16 px-10 flex flex-col items-center justify-center bg-transparent">
      <AnimatePresence mode="wait">
        {!isAnalyzing ? (
          <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="max-w-4xl w-full flex flex-col items-center">
            <div className="text-center mb-16">
              <div className="flex items-center justify-center gap-3 mb-6 opacity-40">
                {isOnline ? <ShieldCheck size={10} className="text-[#D4AF37]" /> : <ZapOff size={10} className="text-[#C5A028]" />}
                <span className="text-[9px] uppercase tracking-[0.4em] font-bold text-[#1A1A1D]">
                  {isOnline ? 'Neural Handshake Cycle' : 'Edge Mode Active'}
                </span>
              </div>
              <h2 className="text-6xl md:text-7xl font-bold tracking-tighter mb-6 text-[#1A1A1D] leading-none">
                Initial <span className="serif italic text-[#D4AF37] font-normal">Perception</span>
              </h2>
              <p className="text-[#1A1A1D]/40 text-lg font-light max-w-xl mx-auto leading-relaxed">
                {isOnline 
                  ? 'A multi-stage cloud-accelerated inference cycle for peak fidelity.'
                  : `Operating offline using ${registry.getStats().totalModels} local edge models.`}
              </p>
            </div>

            {error && (
              <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="mb-10 p-6 bg-rose-50 border border-rose-100 rounded-[2rem] flex items-center gap-5 text-rose-800 shadow-sm">
                <AlertTriangle size={18} className="text-rose-500" />
                <div className="text-[10px] font-bold uppercase tracking-widest">{error}</div>
              </motion.div>
            )}

            <motion.div onClick={() => fileInputRef.current?.click()} whileHover={{ scale: 1.002, y: -2 }} className="relative aspect-video w-full max-w-2xl rounded-[3rem] glass-premium flex flex-col items-center justify-center shadow-xl border-black/[0.01] cursor-pointer group">
              <div className="w-16 h-16 rounded-[1.5rem] bg-[#0A0A0B] flex items-center justify-center mb-4 shadow-xl transition-transform duration-700 group-hover:scale-110">
                <Camera color="#D4AF37" size={24} strokeWidth={1.5} />
              </div>
              <span className="text-[9px] uppercase tracking-[0.4em] font-bold text-black/30">Initiate Optical Gateway</span>
              <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileChange} />
            </motion.div>
          </motion.div>
        ) : (
          <motion.div key="analyzing" className="fixed inset-0 z-[200] flex items-center justify-center bg-white/95 backdrop-blur-3xl px-8">
            <motion.div initial={{ scale: 0.99, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="w-full max-w-[650px] bg-white rounded-[3rem] shadow-2xl border border-black/[0.02] overflow-hidden mac-window">
              <div className="p-16">
                <div className="flex justify-between items-end mb-10">
                   <div>
                      <h4 className="text-2xl font-bold tracking-tighter mb-1 italic serif">
                        {isOnline ? 'System Processing' : 'Edge Computing'}
                      </h4>
                      <p className="text-[8px] uppercase tracking-[0.2em] font-bold text-black/20">{statusText}</p>
                   </div>
                   <span className="mono text-[10px] font-bold text-[#D4AF37]">{progress}%</span>
                </div>

                <div className="w-full h-[1px] bg-black/[0.02] rounded-full overflow-hidden mb-12">
                  <motion.div className="h-full bg-black" initial={{ width: 0 }} animate={{ width: `${progress}%` }} transition={{ duration: 0.8 }} />
                </div>

                <div className="grid grid-cols-6 gap-3">
                   {steps.map((step) => (
                     <div key={step.id} className="relative flex flex-col items-center text-center">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 transition-all duration-700 ${
                          step.status === 'complete' ? 'bg-[#D4AF37] text-white' : 
                          step.status === 'active' ? 'bg-black text-white shadow-lg scale-110' : 'bg-black/[0.02] text-black/10'
                        }`}>
                           {step.id === 'detect' && <Cpu size={14} />}
                           {step.id === 'segment' && <Layers size={14} />}
                           {step.id === 'audit' && <Search size={14} />}
                           {step.id === 'rescan' && <Sparkles size={14} />}
                           {step.id === 'fuse' && <Database size={14} />}
                           {step.id === 'vision' && <Eye size={14} />}
                        </div>
                        <span className={`text-[7px] uppercase tracking-[0.15em] font-bold leading-tight transition-opacity duration-700 ${step.status === 'active' ? 'opacity-100' : 'opacity-20'}`}>
                           {step.label}
                        </span>
                     </div>
                   ))}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Analyzer;
