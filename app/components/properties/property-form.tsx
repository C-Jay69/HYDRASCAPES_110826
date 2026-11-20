'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { parseAmountToMinor, formatMinor, minorUnitDigits } from '@/app/lib/money';

const CURRENCIES = ['USD', 'EUR', 'GBP', 'CAD'] as const;

const inputClass =
  'w-full rounded-lg border border-divider bg-void px-4 py-3 text-foreground placeholder:text-foreground-faint focus:outline-none focus:ring-2 focus:ring-ember-500/20';

export interface UploadedPhoto {
  path: string;
  previewUrl: string;
}

export interface PropertyFormValues {
  id?: string;
  title?: string;
  description?: string | null;
  address?: { line1?: string; city?: string; country?: string };
  bedrooms?: number;
  bathrooms?: number;
  maxGuests?: number;
  basePriceMinor?: number;
  cleaningFeeMinor?: number;
  currency?: string;
  status?: 'draft' | 'listed';
  coverPhoto?: string | null;
}

interface PropertyFormProps {
  /** Present when editing; absent when creating. */
  property?: PropertyFormValues;
  /** Existing photos with signed preview URLs (edit mode only). */
  initialPhotos?: UploadedPhoto[];
  /** Whether the property can be deleted (edit mode, owner only). */
  canDelete?: boolean;
}

export default function PropertyForm({ property, initialPhotos = [], canDelete = false }: PropertyFormProps) {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const isEdit = Boolean(property?.id);

  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [photos, setPhotos] = useState<UploadedPhoto[]>(initialPhotos);

  const initialCurrency = property?.currency ?? 'USD';
  const [currency, setCurrency] = useState<string>(initialCurrency);
  const [basePrice, setBasePrice] = useState(
    property?.basePriceMinor ? formatMinor(property.basePriceMinor, initialCurrency) : '',
  );
  const [cleaningFee, setCleaningFee] = useState(
    property?.cleaningFeeMinor ? formatMinor(property.cleaningFeeMinor, initialCurrency) : '',
  );
  const [status, setStatus] = useState<'draft' | 'listed'>(property?.status ?? 'draft');

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setError(null);
    setUploading(true);

    try {
      for (const file of Array.from(files)) {
        const formData = new FormData();
        formData.append('bucket', 'property-photos');
        formData.append('file', file);

        const response = await fetch('/api/uploads', { method: 'POST', body: formData });
        const result = await response.json();

        if (!response.ok) throw new Error(result.error ?? 'Upload failed');

        setPhotos((current) => [
          ...current,
          { path: result.path, previewUrl: URL.createObjectURL(file) },
        ]);
      }
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'Upload failed');
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = '';
    }
  }

  function removePhoto(path: string) {
    setPhotos((current) => current.filter((photo) => photo.path !== path));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const formData = new FormData(event.currentTarget);
    const title = String(formData.get('title') ?? '').trim();
    const basePriceMinor = parseAmountToMinor(basePrice, currency);
    const cleaningFeeMinor = cleaningFee ? parseAmountToMinor(cleaningFee, currency) : 0;

    if (title.length < 3) return setError('Title must be at least 3 characters');
    if (basePriceMinor === null || basePriceMinor <= 0) {
      return setError(`Enter a valid nightly price (up to ${minorUnitDigits(currency)} decimals)`);
    }
    if (cleaningFeeMinor === null) {
      return setError('Enter a valid cleaning fee, or leave it blank');
    }

    const payload = {
      title,
      description: String(formData.get('description') ?? '').trim() || null,
      addressJson: {
        line1: String(formData.get('line1') ?? '').trim(),
        city: String(formData.get('city') ?? '').trim(),
        country: String(formData.get('country') ?? '').trim(),
      },
      bedrooms: Number(formData.get('bedrooms') ?? 1),
      bathrooms: Number(formData.get('bathrooms') ?? 1),
      maxGuests: Number(formData.get('maxGuests') ?? 2),
      basePriceMinor,
      minPriceMinor: basePriceMinor,
      maxPriceMinor: basePriceMinor,
      currency,
      cleaningFeeMinor,
      photos: photos.map((photo) => photo.path),
      coverPhoto: photos[0]?.path ?? null,
      ...(isEdit ? { status } : {}),
    };

    setSubmitting(true);

    try {
      const response = await fetch(
        isEdit ? `/api/properties/${property!.id}` : '/api/properties',
        {
          method: isEdit ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        },
      );

      const result = response.status === 204 ? {} : await response.json();

      if (!response.ok) {
        const issues = Array.isArray(result.issues)
          ? result.issues.map(
              (issue: { field: string; message: string }) => `${issue.field}: ${issue.message}`,
            )
          : [];
        throw new Error(issues.length > 0 ? issues.join('; ') : (result.error ?? 'Could not save'));
      }

      router.push('/dashboard/owner/properties');
      router.refresh();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Could not save property');
      setSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!isEdit) return;
    if (!window.confirm('Delete this property? This cannot be undone.')) return;

    setError(null);
    setDeleting(true);

    try {
      const response = await fetch(`/api/properties/${property!.id}`, { method: 'DELETE' });
      if (!response.ok && response.status !== 204) {
        const result = await response.json().catch(() => ({}));
        throw new Error(result.error ?? 'Could not delete property');
      }
      router.push('/dashboard/owner/properties');
      router.refresh();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Could not delete property');
      setDeleting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label htmlFor="title" className="mb-2 block text-sm font-medium">
            Property title
          </label>
          <input
            id="title"
            name="title"
            type="text"
            required
            minLength={3}
            maxLength={140}
            defaultValue={property?.title ?? ''}
            className={inputClass}
            placeholder="e.g. Modern downtown apartment"
          />
        </div>

        <div className="sm:col-span-2">
          <label htmlFor="description" className="mb-2 block text-sm font-medium">
            Description
          </label>
          <textarea
            id="description"
            name="description"
            rows={3}
            maxLength={5000}
            defaultValue={property?.description ?? ''}
            className={inputClass}
            placeholder="What makes this stay worth booking?"
          />
        </div>

        <div>
          <label htmlFor="line1" className="mb-2 block text-sm font-medium">
            Street address
          </label>
          <input
            id="line1"
            name="line1"
            type="text"
            defaultValue={property?.address?.line1 ?? ''}
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="city" className="mb-2 block text-sm font-medium">
            City
          </label>
          <input
            id="city"
            name="city"
            type="text"
            defaultValue={property?.address?.city ?? ''}
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="country" className="mb-2 block text-sm font-medium">
            Country
          </label>
          <input
            id="country"
            name="country"
            type="text"
            defaultValue={property?.address?.country ?? ''}
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="currency" className="mb-2 block text-sm font-medium">
            Currency
          </label>
          <select
            id="currency"
            name="currency"
            value={currency}
            onChange={(event) => setCurrency(event.target.value)}
            className={inputClass}
          >
            {CURRENCIES.map((code) => (
              <option key={code} value={code}>
                {code}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div>
          <label htmlFor="bedrooms" className="mb-2 block text-sm font-medium">
            Bedrooms
          </label>
          <input
            id="bedrooms"
            name="bedrooms"
            type="number"
            min={0}
            max={100}
            defaultValue={property?.bedrooms ?? 1}
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="bathrooms" className="mb-2 block text-sm font-medium">
            Bathrooms
          </label>
          <input
            id="bathrooms"
            name="bathrooms"
            type="number"
            min={0}
            step="0.5"
            max={100}
            defaultValue={property?.bathrooms ?? 1}
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="maxGuests" className="mb-2 block text-sm font-medium">
            Max guests
          </label>
          <input
            id="maxGuests"
            name="maxGuests"
            type="number"
            min={1}
            max={100}
            defaultValue={property?.maxGuests ?? 2}
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="basePrice" className="mb-2 block text-sm font-medium">
            Nightly price
          </label>
          <input
            id="basePrice"
            name="basePrice"
            type="text"
            inputMode="decimal"
            required
            value={basePrice}
            onChange={(event) => setBasePrice(event.target.value)}
            className={inputClass}
            placeholder="150.00"
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="cleaningFee" className="mb-2 block text-sm font-medium">
            Cleaning fee (optional)
          </label>
          <input
            id="cleaningFee"
            name="cleaningFee"
            type="text"
            inputMode="decimal"
            value={cleaningFee}
            onChange={(event) => setCleaningFee(event.target.value)}
            className={inputClass}
            placeholder="25.00"
          />
        </div>

        {isEdit && (
          <div>
            <label htmlFor="status" className="mb-2 block text-sm font-medium">
              Visibility
            </label>
            <select
              id="status"
              name="status"
              value={status}
              onChange={(event) => setStatus(event.target.value as 'draft' | 'listed')}
              className={inputClass}
            >
              <option value="draft">Draft — hidden from search</option>
              <option value="listed">Listed — visible in search</option>
            </select>
          </div>
        )}
      </div>

      <div>
        <span className="mb-2 block text-sm font-medium">Photos</span>
        <input
          ref={fileInput}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          disabled={uploading}
          onChange={(event) => handleFiles(event.target.files)}
          className="block w-full text-sm text-foreground-muted file:mr-4 file:rounded-lg file:border-0 file:bg-surface file:px-4 file:py-2 file:text-sm file:font-medium file:text-foreground"
        />
        <p className="mt-2 text-xs text-foreground-faint">
          JPEG, PNG or WebP, up to 10 MB each. Re-encoded server-side, metadata stripped, stored
          privately. The first photo is the cover.
        </p>

        {photos.length > 0 && (
          <ul className="mt-4 grid grid-cols-3 gap-3">
            {photos.map((photo) => (
              <li key={photo.path} className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element -- signed or object URL preview */}
                <img src={photo.previewUrl} alt="" className="h-24 w-full rounded-lg object-cover" />
                <button
                  type="button"
                  onClick={() => removePhoto(photo.path)}
                  className="absolute right-1 top-1 rounded bg-void/80 px-2 py-0.5 text-xs text-danger"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}

        {uploading && <p className="mt-2 text-xs text-foreground-muted">Uploading…</p>}
      </div>

      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}

      <div className="flex flex-col gap-3 sm:flex-row">
        <button
          type="submit"
          disabled={submitting || uploading || deleting}
          className="flex-1 rounded-lg bg-gradient-to-r from-ember-500 to-teal-500 px-6 py-3 text-base font-semibold text-void transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {submitting ? 'Saving…' : isEdit ? 'Save changes' : 'Save draft'}
        </button>

        {isEdit && canDelete && (
          <button
            type="button"
            onClick={handleDelete}
            disabled={submitting || deleting}
            className="rounded-lg border border-danger/40 px-6 py-3 text-sm font-semibold text-danger transition-colors hover:bg-danger/10 disabled:opacity-60"
          >
            {deleting ? 'Deleting…' : 'Delete'}
          </button>
        )}
      </div>
    </form>
  );
}
