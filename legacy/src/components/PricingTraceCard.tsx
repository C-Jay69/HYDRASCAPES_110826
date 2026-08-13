import React from 'react';
import { DollarSign, TrendingUp, Sparkles, AlertCircle, Info } from 'lucide-react';
import { PriceSuggestion } from '../types/nest.js';
import { formatCurrency } from '../lib/money.js';

interface PricingTraceCardProps {
  suggestion: PriceSuggestion;
}

export const PricingTraceCard: React.FC<PricingTraceCardProps> = ({ suggestion }) => {
  const trace = suggestion.reasoning_trace;

  return (
    <div className="bg-[#1C242F] rounded-2xl border border-[#2A3441] p-5 shadow-lg">
      <div className="flex items-center justify-between pb-3 border-b border-[#2A3441] mb-4">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-[#FF7A45]" />
          <h4 className="font-bold text-sm text-[#F5F7FA]">Dynamic Pricing Reasoning Trace</h4>
        </div>
        <span className="text-[11px] px-2 py-0.5 rounded bg-[#14B8A6]/20 text-[#5EEAD4] font-medium border border-[#14B8A6]/30">
          Deterministic + AI Refined
        </span>
      </div>

      {/* Base Rate */}
      <div className="flex items-center justify-between text-xs py-1.5 border-b border-[#2A3441]/50">
        <span className="text-[#B4BCC8]">Owner Base Nightly Rate</span>
        <span className="font-bold text-[#F5F7FA]">{formatCurrency(trace.base_price_minor)}</span>
      </div>

      {/* Multiplier Factors */}
      <div className="space-y-2 my-3">
        {trace.factors.map((factor, idx) => (
          <div key={idx} className="flex items-center justify-between text-xs bg-[#0B0F14]/60 p-2 rounded-lg border border-[#2A3441]">
            <div className="flex flex-col">
              <span className="font-medium text-[#F5F7FA]">{factor.label}</span>
              <span className="text-[10px] text-[#7A8494]">Source: {factor.source}</span>
            </div>
            <div className="text-right">
              <span className={`font-semibold ${factor.delta_minor >= 0 ? 'text-[#22C55E]' : 'text-[#EF4444]'}`}>
                {factor.delta_minor >= 0 ? '+' : ''}{formatCurrency(factor.delta_minor)}
              </span>
              <span className="text-[10px] text-[#7A8494] block">({factor.multiplier}x)</span>
            </div>
          </div>
        ))}
      </div>

      {/* AI Layer Refinement */}
      <div className="bg-[#FF7A45]/10 border border-[#FF7A45]/30 p-3 rounded-xl mb-4">
        <div className="flex items-center justify-between text-xs mb-1">
          <span className="font-bold text-[#FFB067] flex items-center gap-1">
            <Sparkles className="w-3.5 h-3.5" />
            Layer 3 AI Refinement
          </span>
          <span className="font-bold text-[#FFB067]">{trace.ai_multiplier}x Multiplier</span>
        </div>
        <p className="text-[11px] text-[#B4BCC8] italic">"{trace.ai_rationale}"</p>
      </div>

      {/* Final Suggested Rate */}
      <div className="flex items-center justify-between p-3 bg-[#0B0F14] rounded-xl border border-[#14B8A6]/40">
        <div>
          <span className="text-xs text-[#7A8494] block">Final Calculated Price</span>
          <span className="text-xs text-[#5EEAD4] font-medium">Clamped within Owner Floor/Ceiling</span>
        </div>
        <div className="text-right">
          <div className="text-xl font-black text-[#14B8A6]">
            {formatCurrency(suggestion.suggested_price_minor)}
            <span className="text-xs font-normal text-[#B4BCC8]"> / night</span>
          </div>
        </div>
      </div>
    </div>
  );
};
