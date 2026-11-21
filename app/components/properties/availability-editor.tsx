'use client';

import { useState } from 'react';

interface Block {
  start: string;
  end: string;
  reason: string | null;
}

interface AvailabilityEditorProps {
  propertyId: string;
  initialBlocks: Block[];
}

const inputClass =
  'w-full rounded-lg border border-divider bg-void px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ember-500/20';

/**
 * Owner-side date blocking.
 *
 * Blocks are enforced by the quote endpoint and by the booking conflict check,
 * so a guest cannot book a blocked range even if the UI is bypassed. Dates are
 * saved as one replace-all payload, which keeps the overlap rule checkable
 * before anything is deleted.
 */
export default function AvailabilityEditor({ propertyId, initialBlocks }: AvailabilityEditorProps) {
  const [blocks, setBlocks] = useState<Block[]>(initialBlocks);
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function addBlock() {
    setError(null);
    setSaved(false);

    if (!start || !end) return setError('Pick a start and end date');
    if (end <= start) return setError('The end date must be after the start date');

    const overlaps = blocks.some((block) => start < block.end && end > block.start);
    if (overlaps) return setError('That range overlaps an existing block');

    setBlocks((current) =>
      [...current, { start, end, reason: reason.trim() || null }].sort((a, b) =>
        a.start.localeCompare(b.start),
      ),
    );
    setStart('');
    setEnd('');
    setReason('');
  }

  function removeBlock(index: number) {
    setSaved(false);
    setBlocks((current) => current.filter((_, i) => i !== index));
  }

  async function save() {
    setSaving(true);
    setError(null);
    setSaved(false);

    try {
      const response = await fetch(`/api/properties/${propertyId}/availability`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ blocks }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? 'Could not save availability');
      setSaved(true);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not save availability');
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-2xl border border-divider bg-card p-8">
      <h2 className="text-lg font-semibold">Availability</h2>
      <p className="mt-1 text-sm text-foreground-muted">
        Block dates you do not want to rent. Guests cannot book a blocked range.
      </p>

      {blocks.length > 0 ? (
        <ul className="mt-4 space-y-2">
          {blocks.map((block, index) => (
            <li
              key={`${block.start}-${block.end}-${index}`}
              className="flex items-center justify-between rounded-lg border border-divider bg-surface px-3 py-2 text-sm"
            >
              <span>
                {block.start} → {block.end}
                {block.reason && <span className="ml-2 text-foreground-faint">{block.reason}</span>}
              </span>
              <button
                type="button"
                onClick={() => removeBlock(index)}
                className="text-xs text-danger hover:underline"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 text-sm text-foreground-faint">No blocked dates.</p>
      )}

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <label className="text-sm">
          <span className="mb-1 block text-foreground-muted">From</span>
          <input type="date" value={start} onChange={(e) => setStart(e.target.value)} className={inputClass} />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-foreground-muted">To</span>
          <input type="date" value={end} onChange={(e) => setEnd(e.target.value)} className={inputClass} />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-foreground-muted">Reason (optional)</span>
          <input
            type="text"
            value={reason}
            maxLength={200}
            placeholder="Maintenance"
            onChange={(e) => setReason(e.target.value)}
            className={inputClass}
          />
        </label>
      </div>

      <div className="mt-3 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={addBlock}
          className="rounded-lg border border-divider px-4 py-2 text-sm font-medium text-foreground-muted hover:text-foreground"
        >
          Block dates
        </button>
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="rounded-lg bg-gradient-to-r from-ember-500 to-teal-500 px-4 py-2 text-sm font-semibold text-void disabled:opacity-60"
        >
          {saving ? 'Saving…' : 'Save availability'}
        </button>
      </div>

      {error && (
        <p role="alert" className="mt-3 text-sm text-danger">
          {error}
        </p>
      )}
      {saved && <p className="mt-3 text-sm text-success">Availability saved.</p>}
    </section>
  );
}
