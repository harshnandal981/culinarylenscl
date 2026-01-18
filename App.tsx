
import React, { useState, useEffect } from 'react';
import { ViewState, Ingredient, NeuralProtocol, UserPreferences } from './types';
import Landing from './components/Landing';
import Analyzer from './components/Analyzer';
import Dashboard from './components/Dashboard';
import Synthesis from './components/Synthesis';
import ExecutionMode from './components/ExecutionMode';
import Settings from './components/Settings';
import Header from './components/Header';
import { STORAGE_KEYS } from './constants';

const App: React.FC = () => {
  const [viewState, setViewState] = useState<ViewState>(ViewState.LANDING);
  const [inventory, setInventory] = useState<Ingredient[]>([]);
  const [currentProtocol, setCurrentProtocol] = useState<NeuralProtocol | null>(null);
  const [preferences, setPreferences] = useState<UserPreferences>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.USER_PREFERENCES);
    return saved ? JSON.parse(saved) : {
      dietary: 'None',
      allergies: [],
      cuisinePreference: '',
      instamartSync: true,
      highFidelityVisuals: true
    };
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.USER_PREFERENCES, JSON.stringify(preferences));
  }, [preferences]);

  const handleStart = () => setViewState(ViewState.UPLOAD);
  
  const handleAnalysisComplete = (newIngredients: Ingredient[]) => {
    setInventory(prev => [...prev, ...newIngredients]);
    setViewState(ViewState.DASHBOARD);
  };

  const handleSynthesize = () => setViewState(ViewState.SYNTHESIS);
  
  const handleProtocolReady = (protocol: NeuralProtocol) => {
    setCurrentProtocol(protocol);
  };

  const handleStartExecution = () => setViewState(ViewState.EXECUTION);
  const handleFinishExecution = () => {
    setViewState(ViewState.DASHBOARD);
    setCurrentProtocol(null);
  };

  const renderView = () => {
    switch (viewState) {
      case ViewState.LANDING:
        return <Landing onStart={handleStart} />;
      case ViewState.UPLOAD:
      case ViewState.ANALYSIS:
        return <Analyzer onComplete={handleAnalysisComplete} />;
      case ViewState.DASHBOARD:
        return (
          <Dashboard 
            inventory={inventory} 
            protocol={currentProtocol}
            onSynthesize={handleSynthesize} 
            onAddMore={() => setViewState(ViewState.UPLOAD)}
          />
        );
      case ViewState.SYNTHESIS:
        return (
          <Synthesis 
            inventory={inventory}
            onProtocolReady={handleProtocolReady}
            onExecute={handleStartExecution} 
            onBack={() => setViewState(ViewState.DASHBOARD)} 
          />
        );
      case ViewState.SETTINGS:
        return (
          <Settings 
            preferences={preferences}
            onUpdate={setPreferences}
            onBack={() => setViewState(ViewState.DASHBOARD)}
          />
        );
      case ViewState.EXECUTION:
        return currentProtocol ? (
          <ExecutionMode 
            protocol={currentProtocol} 
            onComplete={handleFinishExecution} 
          />
        ) : null;
      default:
        return <Landing onStart={handleStart} />;
    }
  };

  return (
    <div className="min-h-screen selection:bg-[#D4AF37]/20 selection:text-[#1A1A1D]">
      {viewState !== ViewState.LANDING && viewState !== ViewState.EXECUTION && (
        <Header viewState={viewState} onOpenSettings={() => setViewState(ViewState.SETTINGS)} />
      )}
      <main className="transition-all duration-1000 ease-in-out">
        {renderView()}
      </main>
    </div>
  );
};

export default App;