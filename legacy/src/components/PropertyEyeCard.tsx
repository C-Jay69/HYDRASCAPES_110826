import React from 'react';
import { Eye, Sparkles, CheckCircle2, AlertTriangle, ShieldCheck, Sun, Layers, HelpCircle } from 'lucide-react';
import { VisionAnalysis } from '../types/nest.js';

interface PropertyEyeCardProps {
  vision?: VisionAnalysis;
  visionStatus: string;
  onTriggerReanalysis?: () => void;
  isProcessing?: boolean;
}

export const PropertyEyeCard: React.FC<PropertyEyeCardProps> = ({
  vision,
  visionStatus,
  onTriggerReanalysis,
  isProcessing
}) => {
  if (visionStatus === 'processing' || isProcessing) {
    return (
      <div className="bg-[#1C242F] rounded-2xl border border-[#FF7A45]/40 p-6 shadow-xl animate-pulse">
        <div className="flex items-center gap-3 text-[#FFB067] mb-4">
          <Eye className="w-6 h-6 animate-spin text-[#FF7A45]" />
          <h3 className="font-bold text-lg">AI Property Eye Is Analyzing Images...</h3>
        </div>
        <p className="text-sm text-[#B4BCC8]">
          Multimodal vision processing evaluating condition score, architectural quality tier, curb appeal, and lighting quality.
        </p>
      </div>
    );
  }

  if (!vision) {
    return (
      <div className="bg-[#1C242F] rounded-2xl border border-[#2A3441] p-6 text-center">
        <Eye className="w-8 h-8 text-[#7A8494] mx-auto mb-2" />
        <p className="text-sm text-[#B4BCC8] mb-4">Property photos have not undergone AI Vision analysis yet.</p>
        {onTriggerReanalysis && (
          <button
            onClick={onTriggerReanalysis}
            className="px-4 py-2 bg-gradient-to-r from-[#FF7A45] to-[#14B8A6] text-white text-xs font-semibold rounded-lg shadow-md"
          >
            Run AI Property Eye Analysis
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="bg-[#1C242F] rounded-2xl border border-[#2A3441] p-6 shadow-xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#2A3441] mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#FF7A45]/15 border border-[#FF7A45]/30 flex items-center justify-center">
            <Eye className="w-5 h-5 text-[#FFB067]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-lg text-[#F5F7FA]">AI Property Eye</h3>
              <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-[#14B8A6]/20 text-[#5EEAD4] border border-[#14B8A6]/30 uppercase">
                {vision.quality_tier} Tier
              </span>
            </div>
            <p className="text-xs text-[#B4BCC8]">Schema-Validated Multimodal Vision Assessment</p>
          </div>
        </div>

        {onTriggerReanalysis && (
          <button
            onClick={onTriggerReanalysis}
            className="px-3 py-1.5 bg-[#0B0F14] hover:bg-[#2A3441] text-[#5EEAD4] border border-[#14B8A6]/30 text-xs font-medium rounded-lg transition-all flex items-center gap-1.5"
          >
            <Sparkles className="w-3.5 h-3.5 text-[#FF7A45]" />
            Re-Analyze Vision
          </button>
        )}
      </div>

      {/* Visual Scores Bento Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <div className="bg-[#0B0F14] p-3 rounded-xl border border-[#2A3441] text-center">
          <div className="text-[10px] text-[#7A8494] uppercase font-semibold mb-1">Condition Score</div>
          <div className="text-2xl font-black text-[#14B8A6]">{vision.condition_score}<span className="text-xs text-[#7A8494]">/10</span></div>
        </div>

        <div className="bg-[#0B0F14] p-3 rounded-xl border border-[#2A3441] text-center">
          <div className="text-[10px] text-[#7A8494] uppercase font-semibold mb-1">Modernity Score</div>
          <div className="text-2xl font-black text-[#FFB067]">{vision.interior_modernity_score}<span className="text-xs text-[#7A8494]">/10</span></div>
        </div>

        <div className="bg-[#0B0F14] p-3 rounded-xl border border-[#2A3441] text-center">
          <div className="text-[10px] text-[#7A8494] uppercase font-semibold mb-1">Curb Appeal</div>
          <div className="text-2xl font-black text-[#5EEAD4]">{vision.curb_appeal_score}<span className="text-xs text-[#7A8494]">/10</span></div>
        </div>

        <div className="bg-[#0B0F14] p-3 rounded-xl border border-[#2A3441] text-center">
          <div className="text-[10px] text-[#7A8494] uppercase font-semibold mb-1">Aesthetic Vibe</div>
          <div className="text-xs font-bold text-[#F5B841] capitalize mt-2">{vision.aesthetic_vibe.replace('_', ' ')}</div>
        </div>
      </div>

      {/* Guest Highlights */}
      {vision.highlights && vision.highlights.length > 0 && (
        <div className="mb-6 bg-[#0B0F14]/70 p-4 rounded-xl border border-[#14B8A6]/20">
          <div className="flex items-center gap-2 text-xs font-bold text-[#5EEAD4] uppercase mb-2">
            <Sparkles className="w-3.5 h-3.5 text-[#FF7A45]" />
            AI Assessed Guest Highlights
          </div>
          <ul className="space-y-1.5">
            {vision.highlights.map((h, idx) => (
              <li key={idx} className="text-xs text-[#F5F7FA] flex items-start gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#22C55E] shrink-0 mt-0.5" />
                <span>{h}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Notable Features & Red Flags */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div>
          <h4 className="text-xs font-semibold text-[#B4BCC8] mb-2 flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-[#22C55E]" />
            Recognized Features
          </h4>
          <div className="flex flex-wrap gap-1.5">
            {vision.notable_features.map((feat, i) => (
              <span key={i} className="px-2.5 py-1 rounded-md text-xs bg-[#14B8A6]/10 text-[#5EEAD4] border border-[#14B8A6]/20">
                {feat}
              </span>
            ))}
          </div>
        </div>

        <div>
          <h4 className="text-xs font-semibold text-[#B4BCC8] mb-2 flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 text-[#F5B841]" />
            Flagged Considerations
          </h4>
          <div className="flex flex-wrap gap-1.5">
            {vision.red_flags.length > 0 ? (
              vision.red_flags.map((flag, i) => (
                <span key={i} className="px-2.5 py-1 rounded-md text-xs bg-[#EF4444]/15 text-[#EF4444] border border-[#EF4444]/30">
                  {flag}
                </span>
              ))
            ) : (
              <span className="text-xs text-[#7A8494] italic">No visual defects detected.</span>
            )}
          </div>
        </div>
      </div>

      {/* AI Justification Explanation */}
      <div className="bg-[#0B0F14] p-3.5 rounded-xl border border-[#2A3441] text-xs text-[#B4BCC8] leading-relaxed">
        <span className="font-semibold text-[#F5F7FA] block mb-1">AI Visual Evaluation Rationale:</span>
        "{vision.visual_justification}"
      </div>
    </div>
  );
};
