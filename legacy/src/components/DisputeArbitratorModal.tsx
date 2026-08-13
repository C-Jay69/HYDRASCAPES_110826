import React, { useState } from 'react';
import { ShieldAlert, X, Sparkles, CheckCircle2, AlertTriangle, FileText, Lock } from 'lucide-react';
import { Dispute, BookingInspection } from '../types/nest.js';
import { formatCurrency, dollarsToCents } from '../lib/money.js';

interface DisputeArbitratorModalProps {
  dispute: Dispute;
  inspections: BookingInspection[];
  onClose: () => void;
  onAssessAI: (disputeId: string) => void;
  onResolveAdmin?: (disputeId: string, decision: string, awardCents: number) => void;
  isAssessing?: boolean;
  isAdmin?: boolean;
}

export const DisputeArbitratorModal: React.FC<DisputeArbitratorModalProps> = ({
  dispute,
  inspections,
  onClose,
  onAssessAI,
  onResolveAdmin,
  isAssessing,
  isAdmin
}) => {
  const checkIn = inspections.find(i => i.kind === 'check_in');
  const checkOut = inspections.find(i => i.kind === 'check_out');

  const [decisionNotes, setDecisionNotes] = useState("Award approved after comparative AI inspection analysis.");
  const [awardCents, setAwardCents] = useState(dispute.amount_claimed_minor);

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-[#141B24] border border-[#2A3441] rounded-2xl max-w-4xl w-full p-6 shadow-2xl my-8">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-4 border-b border-[#2A3441] mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#EF4444]/20 border border-[#EF4444]/40 flex items-center justify-center">
              <ShieldAlert className="w-5 h-5 text-[#EF4444]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-lg text-[#F5F7FA]">Inspection Dispute Arbitrator</h3>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#EF4444]/20 text-[#EF4444] uppercase">
                  Payout Frozen
                </span>
              </div>
              <p className="text-xs text-[#B4BCC8]">Dispute ID: {dispute.id} • Booking: {dispute.booking_id}</p>
            </div>
          </div>

          <button onClick={onClose} className="p-2 rounded-lg bg-[#0B0F14] hover:bg-[#2A3441] text-[#7A8494] hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Claim Summary */}
        <div className="bg-[#0B0F14] p-4 rounded-xl border border-[#2A3441] mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
            <span className="text-xs font-semibold text-[#FFB067]">Claim Description</span>
            <span className="text-sm font-bold text-[#EF4444]">
              Amount Claimed: {formatCurrency(dispute.amount_claimed_minor)}
            </span>
          </div>
          <p className="text-xs text-[#B4BCC8] leading-relaxed">"{dispute.description}"</p>
        </div>

        {/* Side-by-Side Inspection Evidence Comparison */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          {/* Check-In Photos */}
          <div className="bg-[#1C242F] p-4 rounded-xl border border-[#2A3441]">
            <h4 className="font-bold text-xs text-[#5EEAD4] uppercase mb-2 flex items-center justify-between">
              <span>Check-In Inspection Photos</span>
              <span className="text-[10px] text-[#7A8494]">{checkIn ? checkIn.photos.length : 0} Photos</span>
            </h4>
            {checkIn && checkIn.photos.length > 0 ? (
              <div className="grid grid-cols-2 gap-2">
                {checkIn.photos.map((url, idx) => (
                  <img key={idx} src={url} alt={`CheckIn ${idx}`} className="w-full h-28 object-cover rounded-lg border border-[#2A3441]" />
                ))}
              </div>
            ) : (
              <div className="p-6 text-center text-xs text-[#7A8494] italic border border-dashed border-[#2A3441] rounded-lg">
                No check-in inspection photos recorded.
              </div>
            )}
            {checkIn?.notes && <p className="text-[11px] text-[#B4BCC8] mt-2 italic">"{checkIn.notes}"</p>}
          </div>

          {/* Check-Out Photos */}
          <div className="bg-[#1C242F] p-4 rounded-xl border border-[#2A3441]">
            <h4 className="font-bold text-xs text-[#FFB067] uppercase mb-2 flex items-center justify-between">
              <span>Check-Out Inspection Photos</span>
              <span className="text-[10px] text-[#7A8494]">{checkOut ? checkOut.photos.length : 0} Photos</span>
            </h4>
            {checkOut && checkOut.photos.length > 0 ? (
              <div className="grid grid-cols-2 gap-2">
                {checkOut.photos.map((url, idx) => (
                  <img key={idx} src={url} alt={`CheckOut ${idx}`} className="w-full h-28 object-cover rounded-lg border border-[#2A3441]" />
                ))}
              </div>
            ) : (
              <div className="p-6 text-center text-xs text-[#7A8494] italic border border-dashed border-[#2A3441] rounded-lg">
                No check-out inspection photos recorded.
              </div>
            )}
            {checkOut?.notes && <p className="text-[11px] text-[#B4BCC8] mt-2 italic">"{checkOut.notes}"</p>}
          </div>
        </div>

        {/* AI Dispute Assessment Results */}
        {dispute.ai_assessment ? (
          <div className="bg-[#1C242F] p-5 rounded-xl border border-[#14B8A6]/40 mb-6">
            <div className="flex items-center justify-between pb-3 border-b border-[#2A3441] mb-3">
              <div className="flex items-center gap-2 text-[#5EEAD4] font-bold text-sm">
                <Sparkles className="w-4 h-4 text-[#FF7A45]" />
                AI Dispute Assessment Advisory Result
              </div>
              <span className="text-xs px-2 py-0.5 rounded bg-[#FF7A45]/20 text-[#FFB067] font-semibold">
                Recommended Award: {dispute.ai_assessment.recommended_award_pct}%
              </span>
            </div>

            <p className="text-xs text-[#B4BCC8] leading-relaxed mb-3">"{dispute.ai_assessment.rationale}"</p>

            <div className="bg-[#0B0F14] p-3 rounded-lg border border-[#2A3441]">
              <span className="text-[10px] uppercase font-bold text-[#7A8494] block mb-1">Itemized Visual Findings:</span>
              <ul className="space-y-1">
                {dispute.ai_assessment.itemised_findings.map((f, i) => (
                  <li key={i} className="text-xs text-[#F5F7FA] flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-[#22C55E]" />
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ) : (
          <div className="bg-[#1C242F] p-4 rounded-xl border border-[#2A3441] text-center mb-6">
            <p className="text-xs text-[#B4BCC8] mb-3">Execute Gemini AI visual comparison between check-in and check-out photos.</p>
            <button
              onClick={() => onAssessAI(dispute.id)}
              disabled={isAssessing}
              className="px-4 py-2 bg-gradient-to-r from-[#FF7A45] to-[#14B8A6] text-white text-xs font-bold rounded-lg shadow-md hover:opacity-90"
            >
              <Sparkles className="w-3.5 h-3.5 inline mr-1.5" />
              {isAssessing ? 'Analyzing Evidence...' : 'Run AI Dispute Assessment'}
            </button>
          </div>
        )}

        {/* Admin Final Resolution Section */}
        {isAdmin && dispute.status !== 'resolved' && (
          <div className="bg-[#0B0F14] p-4 rounded-xl border border-[#F5B841]/40 pt-4">
            <h4 className="text-xs font-bold text-[#F5B841] uppercase mb-3 flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5" />
              Admin Adjudication & Payout Release
            </h4>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-[#B4BCC8] block mb-1">Award Amount to Claimant (Cents / Dollars):</label>
                <input
                  type="number"
                  value={centsToDollars(awardCents)}
                  onChange={(e) => setAwardCents(dollarsToCents(Number(e.target.value)))}
                  className="w-full bg-[#1C242F] border border-[#2A3441] text-[#F5F7FA] text-xs rounded-lg p-2"
                />
              </div>

              <div>
                <label className="text-xs text-[#B4BCC8] block mb-1">Resolution Decision Notes:</label>
                <textarea
                  value={decisionNotes}
                  onChange={(e) => setDecisionNotes(e.target.value)}
                  className="w-full bg-[#1C242F] border border-[#2A3441] text-[#F5F7FA] text-xs rounded-lg p-2 h-20"
                />
              </div>

              <div className="flex justify-end gap-2">
                <button
                  onClick={() => onResolveAdmin && onResolveAdmin(dispute.id, decisionNotes, awardCents)}
                  className="px-4 py-2 bg-[#22C55E] text-black text-xs font-bold rounded-lg hover:bg-[#22C55E]/90"
                >
                  Finalize Adjudication & Unfreeze Payout
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

function centsToDollars(cents: number): number {
  return cents / 100;
}
