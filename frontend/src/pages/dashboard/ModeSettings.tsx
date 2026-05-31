import React, { useEffect, useState } from 'react';
import { LayoutDashboard, Maximize, Minimize2, Sun, Moon } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';

export default function ModeSettings() {
  const { theme, setTheme } = useTheme();
  const [density, setDensity] = useState<'comfortable' | 'compact' | 'executive'>('comfortable');

  useEffect(() => {
    const saved = localStorage.getItem('app-density') as 'comfortable' | 'compact' | 'executive';
    if (saved) {
      setDensity(saved);
      applyDensityClass(saved);
    }
  }, []);

  const applyDensityClass = (mode: 'comfortable' | 'compact' | 'executive') => {
    document.body.classList.remove('density-comfortable', 'density-compact', 'density-executive');
    document.body.classList.add(`density-${mode}`);
  };

  const handleDensityChange = (mode: 'comfortable' | 'compact' | 'executive') => {
    setDensity(mode);
    localStorage.setItem('app-density', mode);
    applyDensityClass(mode);
  };

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-sans tracking-tight text-text-primary font-medium mb-1">Visual Settings</h1>
        <p className="text-sm text-text-tertiary">Calibrate the global design system and operational density.</p>
      </div>
      
      <div className="space-y-4">
        <h2 className="text-sm font-medium text-text-secondary uppercase tracking-wide">Operational Density</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          
          <button 
            onClick={() => handleDensityChange('comfortable')}
            className={`p-6 text-left rounded-lg border transition-all duration-200 ${density === 'comfortable' ? 'border-accent-primary bg-accent-primary/5 shadow-sm' : 'border-border bg-surface hover:border-border-subtle hover:bg-surface-2'}`}
          >
            <LayoutDashboard className={`w-5 h-5 mb-4 ${density === 'comfortable' ? 'text-accent-primary' : 'text-text-tertiary'}`} />
            <h3 className="font-sans font-medium text-text-primary mb-2">Comfortable</h3>
            <p className="text-xs text-text-tertiary leading-relaxed">Standard spacing with breathable margins. Best for general orchestration and daily oversight.</p>
          </button>

          <button 
            onClick={() => handleDensityChange('compact')}
            className={`p-6 text-left rounded-lg border transition-all duration-200 ${density === 'compact' ? 'border-accent-primary bg-accent-primary/5 shadow-sm' : 'border-border bg-surface hover:border-border-subtle hover:bg-surface-2'}`}
          >
            <Minimize2 className={`w-5 h-5 mb-4 ${density === 'compact' ? 'text-accent-primary' : 'text-text-tertiary'}`} />
            <h3 className="font-sans font-medium text-text-primary mb-2">Compact</h3>
            <p className="text-xs text-text-tertiary leading-relaxed">High-density data view. Reduced padding for maximum information visibility in complex tasks.</p>
          </button>

          <button 
            onClick={() => handleDensityChange('executive')}
            className={`p-6 text-left rounded-lg border transition-all duration-200 ${density === 'executive' ? 'border-accent-primary bg-accent-primary/5 shadow-sm' : 'border-border bg-surface hover:border-border-subtle hover:bg-surface-2'}`}
          >
            <Maximize className={`w-5 h-5 mb-4 ${density === 'executive' ? 'text-accent-primary' : 'text-text-tertiary'}`} />
            <h3 className="font-sans font-medium text-text-primary mb-2">Executive</h3>
            <p className="text-xs text-text-tertiary leading-relaxed">Generous whitespace and larger typography. Optimized for high-level reviews and presentations.</p>
          </button>

        </div>
      </div>
      
      <div className="space-y-4 pt-6 border-t border-border-subtle">
        <h2 className="text-sm font-medium text-text-secondary uppercase tracking-wide">Theme Preference</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <button 
            onClick={() => setTheme('light')}
            className={`p-6 text-left rounded-lg border transition-all duration-200 ${theme === 'light' ? 'border-accent-primary bg-accent-primary/5 shadow-sm' : 'border-border bg-surface hover:border-border-subtle hover:bg-surface-2'}`}
          >
            <Sun className={`w-5 h-5 mb-4 ${theme === 'light' ? 'text-accent-primary' : 'text-text-tertiary'}`} />
            <h3 className="font-sans font-medium text-text-primary mb-2">Executive Light</h3>
            <p className="text-xs text-text-tertiary leading-relaxed">Warm, paper-like surfaces designed for daytime visibility.</p>
          </button>

          <button 
            onClick={() => setTheme('dark')}
            className={`p-6 text-left rounded-lg border transition-all duration-200 ${theme === 'dark' ? 'border-accent-primary bg-accent-primary/5 shadow-sm' : 'border-border bg-surface hover:border-border-subtle hover:bg-surface-2'}`}
          >
            <Moon className={`w-5 h-5 mb-4 ${theme === 'dark' ? 'text-accent-primary' : 'text-text-tertiary'}`} />
            <h3 className="font-sans font-medium text-text-primary mb-2">Executive Dark</h3>
            <p className="text-xs text-text-tertiary leading-relaxed">Deep midnight navy surfaces optimized for reduced cognitive load.</p>
          </button>
        </div>
      </div>
    </div>
  );
}
