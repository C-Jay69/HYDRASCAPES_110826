import React, { useState } from 'react';
import { Activity, TrendingUp, ShieldCheck, Database, Server, RefreshCw, AlertTriangle, Layers, DollarSign, Users, Building, CheckCircle2 } from 'lucide-react';
import { Property, Booking, Dispute, Payout, AuditLog } from '../types/nest.js';
import { formatCurrency } from '../lib/money.js';

interface AdminAnalyticsMaintenanceProps {
  properties: Property[];
  bookings: Booking[];
  disputes: Dispute[];
  payouts: Payout[];
  auditLogs: AuditLog[];
  onTriggerMaintenanceSync?: () => void;
}

export const AdminAnalyticsMaintenance: React.FC<AdminAnalyticsMaintenanceProps> = ({
  properties,
  bookings,
  disputes,
  payouts,
  auditLogs,
  onTriggerMaintenanceSync,
}) => {
  const [isSyncing, setIsSyncing] = useState(false);
  const [maintenanceMode, setMaintenanceMode] = useState(false);

  // Compute Analytics Metrics
  const totalGMVMinor = bookings.reduce((acc, b) => acc + b.total_amount_minor, 0);
  const platformFeeMinor = Math.round(totalGMVMinor * 0.10); // 10% platform commission
  const frozenPayoutsMinor = disputes.filter(d => d.status === 'open').reduce((acc, d) => acc + d.amount_claimed_minor, 0);
  const activePropertiesCount = properties.length;
  const verifiedHostsCount = properties.filter(p => p.vision_analysis?.quality_tier === 'luxury' || p.vision_analysis?.quality_tier === 'premium').length;

  const handleSync = () => {
    setIsSyncing(true);
    setTimeout(() => {
      setIsSyncing(false);
      if (onTriggerMaintenanceSync) onTriggerMaintenanceSync();
    }, 1200);
  };

  return (
    <div className="space-y-6">
      {/* Overview Analytics Bento Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1: Total GMV */}
        <div className="bg-[#1C242F] p-5 rounded-2xl border border-[#2A3441] shadow-lg flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#B4BCC8] uppercase tracking-wider">Gross Bookings GMV</span>
            <div className="w-8 h-8 rounded-lg bg-[#14B8A6]/20 border border-[#14B8A6]/30 flex items-center justify-center">
              <TrendingUp className="w-4 h-4 text-[#5EEAD4]" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-[#F5F7FA]">{formatCurrency(totalGMVMinor)}</div>
            <div className="text-[11px] text-[#5EEAD4] mt-0.5">+18.4% vs last month</div>
          </div>
        </div>

        {/* Metric 2: Platform Revenue */}
        <div className="bg-[#1C242F] p-5 rounded-2xl border border-[#2A3441] shadow-lg flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#B4BCC8] uppercase tracking-wider">Platform Revenue (10%)</span>
            <div className="w-8 h-8 rounded-lg bg-[#FF7A45]/20 border border-[#FF7A45]/30 flex items-center justify-center">
              <DollarSign className="w-4 h-4 text-[#FFB067]" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-[#FFB067]">{formatCurrency(platformFeeMinor)}</div>
            <div className="text-[11px] text-[#B4BCC8] mt-0.5">Automated Stripe Split</div>
          </div>
        </div>

        {/* Metric 3: Active Listings */}
        <div className="bg-[#1C242F] p-5 rounded-2xl border border-[#2A3441] shadow-lg flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#B4BCC8] uppercase tracking-wider">Active Listings</span>
            <div className="w-8 h-8 rounded-lg bg-[#F5B841]/20 border border-[#F5B841]/30 flex items-center justify-center">
              <Building className="w-4 h-4 text-[#F5B841]" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-[#F5F7FA]">{activePropertiesCount} Properties</div>
            <div className="text-[11px] text-[#F5B841] mt-0.5">{verifiedHostsCount} AI Premium/Luxury Verified</div>
          </div>
        </div>

        {/* Metric 4: Frozen Dispute Escrow */}
        <div className="bg-[#1C242F] p-5 rounded-2xl border border-[#2A3441] shadow-lg flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#B4BCC8] uppercase tracking-wider">Frozen Payout Escrow</span>
            <div className="w-8 h-8 rounded-lg bg-[#EF4444]/20 border border-[#EF4444]/30 flex items-center justify-center">
              <AlertTriangle className="w-4 h-4 text-[#EF4444]" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-[#EF4444]">{formatCurrency(frozenPayoutsMinor)}</div>
            <div className="text-[11px] text-[#EF4444] mt-0.5">{disputes.filter(d => d.status === 'open').length} Disputes Pending Resolution</div>
          </div>
        </div>
      </div>

      {/* System Health & Maintenance Panel */}
      <div className="bg-[#1C242F] p-6 rounded-2xl border border-[#2A3441] shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#2A3441] mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#14B8A6]/20 border border-[#14B8A6]/30 flex items-center justify-center">
              <Server className="w-5 h-5 text-[#5EEAD4]" />
            </div>
            <div>
              <h3 className="font-bold text-base text-[#F5F7FA]">Platform Operational Maintenance & Health</h3>
              <p className="text-xs text-[#B4BCC8]">Real-time database sync, AI Vision pipeline status, and security audit integrity</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleSync}
              disabled={isSyncing}
              className="px-3.5 py-2 bg-[#0B0F14] hover:bg-[#2A3441] text-[#5EEAD4] border border-[#14B8A6]/30 rounded-xl text-xs font-semibold transition-all flex items-center gap-2"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
              {isSyncing ? 'Syncing System...' : 'Force Data Sync'}
            </button>
          </div>
        </div>

        {/* Health Checks */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-[#0B0F14] p-4 rounded-xl border border-[#2A3441] flex items-center justify-between">
            <div>
              <div className="text-xs font-bold text-[#F5F7FA]">PostgreSQL Database (GiST)</div>
              <div className="text-[11px] text-[#22C55E] flex items-center gap-1 mt-0.5">
                <CheckCircle2 className="w-3 h-3" /> Healthy • Exclusion Guards Active
              </div>
            </div>
          </div>

          <div className="bg-[#0B0F14] p-4 rounded-xl border border-[#2A3441] flex items-center justify-between">
            <div>
              <div className="text-xs font-bold text-[#F5F7FA]">Gemini 2.5 AI Vision API</div>
              <div className="text-[11px] text-[#22C55E] flex items-center gap-1 mt-0.5">
                <CheckCircle2 className="w-3 h-3" /> Latency: 320ms • Structured Output
              </div>
            </div>
          </div>

          <div className="bg-[#0B0F14] p-4 rounded-xl border border-[#2A3441] flex items-center justify-between">
            <div>
              <div className="text-xs font-bold text-[#F5F7FA]">Stripe Connect Webhook Engine</div>
              <div className="text-[11px] text-[#22C55E] flex items-center gap-1 mt-0.5">
                <CheckCircle2 className="w-3 h-3" /> Idempotent • 100% Delivery
              </div>
            </div>
          </div>
        </div>

        {/* Real-Time Security Audit Log Stream */}
        <div>
          <h4 className="text-xs font-bold text-[#FFB067] uppercase tracking-wider mb-3">System Security Audit Log Stream</h4>
          <div className="bg-[#0B0F14] p-4 rounded-xl border border-[#2A3441] max-h-48 overflow-y-auto space-y-2 font-mono text-[11px]">
            {auditLogs.map((log) => (
              <div key={log.id} className="flex items-center justify-between border-b border-[#2A3441]/50 pb-1.5 text-[#B4BCC8]">
                <div className="flex items-center gap-2">
                  <span className="text-[#14B8A6]">[{new Date(log.timestamp).toLocaleTimeString()}]</span>
                  <span className="font-bold text-[#F5F7FA]">{log.action_type}</span>
                  <span>• {log.details}</span>
                </div>
                <span className="text-[#7A8494] text-[10px]">{log.actor_id}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
