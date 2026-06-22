import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Activity, TrendingUp, TrendingDown, DollarSign, X } from 'lucide-react';
import { IconContainer } from '../ui/IconContainer';

interface CompanyHealthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CompanyHealthModal({ isOpen, onClose }: CompanyHealthModalProps) {
  const [dataPoints, setDataPoints] = useState<number[]>([]);
  
  useEffect(() => {
    if (isOpen) {
      // Simulate live data generation
      const baseValue = 125000;
      const points = Array.from({ length: 30 }).map((_, i) => {
        return baseValue + (Math.sin(i / 2) * 15000) + (i * 2000) + (Math.random() * 8000 - 4000);
      });
      setDataPoints(points);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // SVG Calculations
  const width = 600;
  const height = 150;
  const padding = 20;
  const max = Math.max(...(dataPoints.length ? dataPoints : [0]));
  const min = Math.min(...(dataPoints.length ? dataPoints : [0]));
  const range = max - min || 1;

  const points = dataPoints.map((val, i) => {
    const x = padding + (i / (dataPoints.length - 1)) * (width - padding * 2);
    const y = height - padding - ((val - min) / range) * (height - padding * 2);
    return `${x},${y}`;
  }).join(' ');

  const currentRevenue = dataPoints.length > 0 ? dataPoints[dataPoints.length - 1] : 0;
  const previousRevenue = dataPoints.length > 1 ? dataPoints[dataPoints.length - 2] : 0;
  const isUp = currentRevenue >= previousRevenue;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
      />

      {/* Modal */}
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20, rotateX: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0, rotateX: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10, rotateX: -10 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="relative w-full max-w-2xl recessed-metal rounded-2xl overflow-hidden shadow-2xl z-10"
        style={{ transformStyle: 'preserve-3d', perspective: '1000px' }}
      >
        <div className="p-6 border-b border-white/5 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <IconContainer className="bg-emerald-500/10 border-emerald-500/20 text-emerald-400">
              <Activity className="w-4 h-4" />
            </IconContainer>
            <div>
              <h2 className="font-serif-headers text-xl font-medium text-white tracking-tight">Enterprise Velocity</h2>
              <p className="font-mono-data text-[10px] text-white/40 uppercase tracking-widest mt-0.5">Real-time Operational Health</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-lg text-white/40 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-8">
          <div className="flex items-end justify-between mb-8">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <DollarSign className="w-5 h-5 text-emerald-400" />
                <span className="font-mono-data text-4xl font-light text-white tracking-tight">
                  {currentRevenue.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })}
                </span>
              </div>
              <div className={`flex items-center gap-1.5 font-mono-data text-xs ${isUp ? 'text-emerald-400' : 'text-rose-400'}`}>
                {isUp ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                <span>{Math.abs(((currentRevenue - previousRevenue) / previousRevenue) * 100).toFixed(1)}% vs last epoch</span>
              </div>
            </div>
            <div className="text-right">
              <div className="font-mono-data text-[10px] text-white/40 uppercase tracking-widest mb-1">Burn Rate</div>
              <div className="font-mono-data text-lg text-white/80">$42,500 <span className="text-[10px] text-white/40">/mo</span></div>
            </div>
          </div>

          {/* SVG Sparkline */}
          <div className="relative w-full h-[150px] mt-4">
            {dataPoints.length > 0 && (
              <svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className="overflow-visible">
                {/* Gradient Definition */}
                <defs>
                  <linearGradient id="sparkline-gradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="rgb(52, 211, 153)" stopOpacity="0.3" />
                    <stop offset="100%" stopColor="rgb(52, 211, 153)" stopOpacity="0" />
                  </linearGradient>
                </defs>

                {/* Area Fill */}
                <path
                  d={`M ${padding},${height - padding} L ${points} L ${width - padding},${height - padding} Z`}
                  fill="url(#sparkline-gradient)"
                  className="motion-friction-all"
                  style={{ animation: 'fade-in 1s ease-out forwards' }}
                />

                {/* The Line */}
                <polyline
                  points={points}
                  fill="none"
                  stroke="rgb(52, 211, 153)"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="pulse-line"
                />

                {/* Pulsing End Node */}
                {dataPoints.length > 0 && (
                  <circle
                    cx={padding + ((dataPoints.length - 1) / (dataPoints.length - 1)) * (width - padding * 2)}
                    cy={height - padding - ((currentRevenue - min) / range) * (height - padding * 2)}
                    r="4"
                    fill="rgb(52, 211, 153)"
                    className="animate-ping"
                    style={{ transformOrigin: 'center' }}
                  />
                )}
                {dataPoints.length > 0 && (
                  <circle
                    cx={padding + ((dataPoints.length - 1) / (dataPoints.length - 1)) * (width - padding * 2)}
                    cy={height - padding - ((currentRevenue - min) / range) * (height - padding * 2)}
                    r="4"
                    fill="rgb(52, 211, 153)"
                  />
                )}
              </svg>
            )}
          </div>
          
          <div className="flex justify-between mt-4 border-t border-white/5 pt-4">
            <span className="font-mono-data text-[10px] text-white/30 uppercase tracking-widest">T-30 Days</span>
            <span className="font-mono-data text-[10px] text-emerald-400/80 uppercase tracking-widest flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> Live
            </span>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
