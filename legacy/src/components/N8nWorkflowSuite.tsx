import React from 'react';
import { Play, CheckCircle2, Clock, Activity, Cpu } from 'lucide-react';
import { N8nWorkflow } from '../types/nest.js';

interface N8nWorkflowSuiteProps {
  workflows: N8nWorkflow[];
  onTriggerWorkflow: (id: string) => void;
}

export const N8nWorkflowSuite: React.FC<N8nWorkflowSuiteProps> = ({
  workflows,
  onTriggerWorkflow
}) => {
  return (
    <div className="bg-[#1C242F] rounded-2xl border border-[#2A3441] p-6 shadow-xl">
      <div className="flex items-center justify-between pb-4 border-b border-[#2A3441] mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#F5B841]/20 border border-[#F5B841]/40 flex items-center justify-center">
            <Cpu className="w-5 h-5 text-[#F5B841]" />
          </div>
          <div>
            <h3 className="font-bold text-lg text-[#F5F7FA]">n8n Automation Workflows Suite</h3>
            <p className="text-xs text-[#B4BCC8]">All 10 required v1 marketplace automation workflows</p>
          </div>
        </div>
        <span className="text-xs font-semibold px-2.5 py-1 rounded bg-[#22C55E]/15 text-[#22C55E] border border-[#22C55E]/30">
          10 Active Workflows
        </span>
      </div>

      {/* Workflow List */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {workflows.map((wf) => (
          <div key={wf.id} className="bg-[#0B0F14] p-4 rounded-xl border border-[#2A3441] flex flex-col justify-between hover:border-[#14B8A6] transition-all">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="font-bold text-xs text-[#F5F7FA]">{wf.name}</span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-[#14B8A6]/20 text-[#5EEAD4] font-medium">
                  {wf.nodesCount} Nodes
                </span>
              </div>
              <p className="text-xs text-[#B4BCC8] mb-3 leading-relaxed">{wf.description}</p>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-[#2A3441] text-xs">
              <span className="text-[10px] text-[#7A8494] flex items-center gap-1">
                <Clock className="w-3 h-3 text-[#14B8A6]" />
                Trigger: {wf.triggerEvent}
              </span>
              <button
                onClick={() => onTriggerWorkflow(wf.id)}
                className="px-2.5 py-1 bg-[#14B8A6]/15 hover:bg-[#14B8A6] hover:text-black text-[#5EEAD4] rounded-lg text-xs font-semibold transition-all flex items-center gap-1"
              >
                <Play className="w-3 h-3" />
                Run
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
