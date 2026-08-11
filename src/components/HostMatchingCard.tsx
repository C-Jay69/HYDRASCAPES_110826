import React from 'react';
import { UserCheck, Sparkles, CheckCircle2, AlertTriangle, MessageSquare } from 'lucide-react';
import { HostApplication } from '../types/nest.js';

interface HostMatchingCardProps {
  application: HostApplication;
  onEvaluateAI?: (appId: string) => void;
  isEvaluating?: boolean;
}

export const HostMatchingCard: React.FC<HostMatchingCardProps> = ({
  application,
  onEvaluateAI,
  isEvaluating
}) => {
  return (
    <div className="bg-[#1C242F] rounded-2xl border border-[#2A3441] p-5 shadow-lg flex flex-col justify-between">
      <div>
        {/* Host Avatar & Name */}
        <div className="flex items-center justify-between pb-3 border-b border-[#2A3441] mb-3">
          <div className="flex items-center gap-3">
            <img
              src={application.host_avatar || 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150'}
              alt={application.host_name}
              className="w-10 h-10 rounded-full object-cover border border-[#14B8A6]"
            />
            <div>
              <h4 className="font-bold text-sm text-[#F5F7FA]">{application.host_name}</h4>
              <div className="flex items-center gap-1 text-xs text-[#B4BCC8]">
                <span>Rating: ★ {application.host_rating || 5.0}</span>
                <span>• Proposed Fee: <strong className="text-[#FFB067]">{application.proposed_fee_pct}%</strong></span>
              </div>
            </div>
          </div>

          {/* AI Match Score Badge */}
          {application.ai_match_score !== undefined ? (
            <div className="text-right">
              <div className="text-xl font-black text-[#14B8A6]">{application.ai_match_score}%</div>
              <div className="text-[10px] text-[#5EEAD4] uppercase font-semibold">AI Match Score</div>
            </div>
          ) : (
            onEvaluateAI && (
              <button
                onClick={() => onEvaluateAI(application.id)}
                disabled={isEvaluating}
                className="px-3 py-1.5 bg-[#FF7A45]/20 text-[#FFB067] border border-[#FF7A45]/30 rounded-lg text-xs font-semibold hover:bg-[#FF7A45] hover:text-white transition-all flex items-center gap-1"
              >
                <Sparkles className="w-3.5 h-3.5" />
                {isEvaluating ? 'Evaluating...' : 'Run AI Match'}
              </button>
            )
          )}
        </div>

        {/* Pitch Statement */}
        {application.pitch_text && (
          <div className="bg-[#0B0F14] p-3 rounded-xl border border-[#2A3441] text-xs text-[#B4BCC8] mb-3 leading-relaxed">
            <span className="font-semibold text-[#F5F7FA] block mb-0.5">Host Pitch Proposal:</span>
            "{application.pitch_text}"
          </div>
        )}

        {/* AI Reasoning */}
        {application.ai_match_reasoning && (
          <div className="bg-[#14B8A6]/10 border border-[#14B8A6]/30 p-3 rounded-xl text-xs text-[#5EEAD4]">
            <span className="font-bold block mb-1 flex items-center gap-1 text-[#F5F7FA]">
              <Sparkles className="w-3.5 h-3.5 text-[#FF7A45]" />
              AI Advisory Reasoning:
            </span>
            {application.ai_match_reasoning}
          </div>
        )}
      </div>

      <div className="mt-4 pt-3 border-t border-[#2A3441] flex items-center justify-between text-xs text-[#7A8494]">
        <span>Applied {new Date(application.created_at).toLocaleDateString()}</span>
        <span className="text-xs text-[#22C55E] font-medium uppercase">{application.status}</span>
      </div>
    </div>
  );
};
