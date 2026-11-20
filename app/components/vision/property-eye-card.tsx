'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, Sparkles, AlertTriangle, RefreshCw } from 'lucide-react';
import type { VisionState, VisionAnalysisResponse } from '@/app/core/entities';

interface PropertyEyeCardProps {
  propertyId: string;
  visionStatus: VisionState;
  /** Stored analysis; may be empty or partial, so every field is read defensively. */
  analysis: Partial<VisionAnalysisResponse> | null;
  /** Owners can re-run; guests never see the control. */
  canReanalyze?: boolean;
}

const TIER_LABEL: Record<string, string> = {
  Luxury: 'Luxury tier',
  Premium: 'Premium tier',
  Standard: 'Standard tier',
  Economy: 'Economy tier',
};

/**
 * Property Eye (spec §1, §9).
 *
 * AI output is always labelled as an AI assessment. It is never presented as
 * a verified fact, and no failure state hides the property.
 */
export default function PropertyEyeCard({
  propertyId,
  visionStatus,
  analysis,
  canReanalyze = false,
}: PropertyEyeCardProps) {
  const router = useRouter();
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isProcessing = visionStatus === 'processing' || running;
  const hasAnalysis = Boolean(analysis && typeof analysis.conditionScore === 'number');

  async function runAnalysis() {
    setRunning(true);
    setError(null);
    try {
      const response = await fetch(`/api/properties/${propertyId}/analyze-vision`, {
        method: 'POST',
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? 'Analysis failed');
      router.refresh();
    } catch (runError) {
      setError(runError instanceof Error ? runError.message : 'Analysis failed');
    } finally {
      setRunning(false);
    }
  }

  if (isProcessing) {
    return (
      <section className="rounded-2xl border border-ember-500/40 bg-card p-6">
        <div className="mb-3 flex items-center gap-3 text-ember-300">
          <Eye className="h-5 w-5 animate-pulse" aria-hidden />
          <h2 className="text-lg font-semibold">Property Eye is analysing the photos</h2>
        </div>
        <p className="text-sm text-foreground-muted">
          Vision analysis runs in the background. The listing stays available while it finishes.
        </p>
      </section>
    );
  }

  if (!analysis || typeof analysis.conditionScore !== 'number') {
    return (
      <section className="rounded-2xl border border-divider bg-card p-6">
        <div className="mb-2 flex items-center gap-2 text-foreground-muted">
          <Eye className="h-5 w-5" aria-hidden />
          <h2 className="text-lg font-semibold">Property Eye</h2>
        </div>
        <p className="text-sm text-foreground-muted">
          {visionStatus === 'failed'
            ? 'The last analysis did not complete. The listing is unaffected.'
            : 'These photos have not been analysed yet.'}
        </p>
        {canReanalyze && (
          <button
            type="button"
            onClick={runAnalysis}
            disabled={running}
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-ember-500 to-teal-500 px-4 py-2 text-sm font-semibold text-void disabled:opacity-60"
          >
            <RefreshCw className="h-4 w-4" aria-hidden />
            Run analysis
          </button>
        )}
        {error && (
          <p role="alert" className="mt-3 text-sm text-danger">
            {error}
          </p>
        )}
      </section>
    );
  }

  const highlights = Array.isArray(analysis.highlights) ? analysis.highlights : [];
  const redFlags = Array.isArray(analysis.redFlags) ? analysis.redFlags : [];
  const confidence = typeof analysis.confidence === 'number' ? analysis.confidence : null;

  return (
    <section className="rounded-2xl border border-divider bg-card p-6">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Eye className="h-5 w-5 text-ember-300" aria-hidden />
        <h2 className="text-lg font-semibold">Property Eye</h2>
        {analysis.qualityTier && (
          <span className="rounded-md border border-teal-500/30 bg-teal-500/15 px-2 py-0.5 text-[11px] font-semibold uppercase text-teal-300">
            {TIER_LABEL[analysis.qualityTier] ?? analysis.qualityTier}
          </span>
        )}
        <span className="ml-auto text-[11px] uppercase tracking-wide text-foreground-faint">
          AI assessment, not a verified inspection
        </span>
      </div>

      <dl className="grid grid-cols-3 gap-3 text-center">
        {(
          [
            ['Condition', analysis.conditionScore],
            ['Interior', analysis.interiorModernity],
            ['Curb appeal', analysis.curbAppeal],
          ] as const
        ).map(([label, score]) => (
          <div key={label} className="rounded-lg border border-divider bg-surface px-3 py-2">
            <dt className="text-xs text-foreground-faint">{label}</dt>
            <dd className="text-lg font-semibold">
              {typeof score === 'number' ? `${score.toFixed(1)}/10` : '—'}
            </dd>
          </div>
        ))}
      </dl>

      {highlights.length > 0 && (
        <div className="mt-4">
          <h3 className="mb-2 flex items-center gap-1.5 text-sm font-medium text-teal-300">
            <Sparkles className="h-4 w-4" aria-hidden />
            AI-assessed highlights
          </h3>
          <ul className="space-y-1 text-sm text-foreground-muted">
            {highlights.map((highlight) => (
              <li key={highlight}>• {highlight}</li>
            ))}
          </ul>
        </div>
      )}

      {redFlags.length > 0 && (
        <div className="mt-4">
          <h3 className="mb-2 flex items-center gap-1.5 text-sm font-medium text-warning">
            <AlertTriangle className="h-4 w-4" aria-hidden />
            Points to check
          </h3>
          <ul className="space-y-1 text-sm text-foreground-muted">
            {redFlags.map((flag) => (
              <li key={flag}>• {flag}</li>
            ))}
          </ul>
        </div>
      )}

      {analysis.reasoning && (
        <p className="mt-4 border-t border-divider pt-4 text-sm text-foreground-muted">
          {analysis.reasoning}
        </p>
      )}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        {confidence !== null && (
          <p className="text-xs text-foreground-faint">
            Model confidence: {Math.round(confidence * 100)}%
          </p>
        )}
        {canReanalyze && (
          <button
            type="button"
            onClick={runAnalysis}
            disabled={running}
            className="inline-flex items-center gap-2 rounded-lg border border-divider px-3 py-1.5 text-sm text-foreground-muted hover:text-foreground disabled:opacity-60"
          >
            <RefreshCw className="h-4 w-4" aria-hidden />
            Re-run analysis
          </button>
        )}
      </div>

      {error && (
        <p role="alert" className="mt-3 text-sm text-danger">
          {error}
        </p>
      )}
    </section>
  );
}
