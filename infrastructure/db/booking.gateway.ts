import type { SupabaseClient } from '@supabase/supabase-js';
import type { Booking, BookingState } from '@/app/core/entities';
import { LIVE_BOOKING_STATES } from '@/app/lib/bookings/state';
import type { AvailabilityWindow, RevenueSplit } from '@/app/lib/bookings/types';
import { DEFAULT_SPLIT } from '@/app/lib/bookings/settlement';

/** Everything required to insert a booking; pricing is decided by the caller. */
export type NewBooking = Omit<
  Booking,
  | 'nights' // generated column: checkout - checkin
  | 'created_at'
  | 'updated_at'
  | 'cancelled_at'
  | 'cancelled_by'
  | 'refund_amount_minor'
>;

export interface BookingGateway {
  getById: (id: string) => Promise<Booking | null>;
  findByPaymentIntent: (paymentIntentId: string) => Promise<Booking | null>;
  listByGuest: (guestId: string) => Promise<Booking[]>;
  listByProperty: (propertyId: string) => Promise<Booking[]>;
  /** Bookings in any of the given states, for the lifecycle scheduler. */
  listByStatuses: (statuses: BookingState[]) => Promise<Booking[]>;
  /** Live bookings overlapping the half-open range [checkin, checkout). */
  findConflicts: (propertyId: string, checkin: string, checkout: string) => Promise<Booking[]>;
  /** Owner-blocked windows overlapping the range. */
  blockedWindows: (propertyId: string, checkin: string, checkout: string) => Promise<AvailabilityWindow[]>;
  create: (booking: NewBooking) => Promise<Booking>;
  /**
   * Applies a status change only if the row is still in one of `from`.
   * Returns null when another writer got there first — the optimistic lock.
   */
  transition: (
    id: string,
    from: BookingState[],
    to: BookingState,
    extra?: Partial<Booking>,
  ) => Promise<Booking | null>;
  update: (id: string, updates: Partial<Booking>) => Promise<Booking | null>;
  setPaymentIntent: (id: string, paymentIntentId: string) => Promise<void>;
  revenueSplit: () => Promise<RevenueSplit>;
  /** Configured processing-fee assumptions (`platform_settings.processing_fees`). */
  processingFees: () => Promise<{ bps: number; fixedMinor: number }>;
}

const COLUMNS =
  'id, property_id, guest_id, host_id, owner_id, checkin, checkout, nights, guests_count, ' +
  'per_night_rate_minor, nightly_subtotal_minor, cleaning_fee_minor, taxes_minor, ' +
  'total_amount_minor, currency, status, stripe_payment_intent_id, cancellation_policy_key, ' +
  'cancellation_policy_version, cancellation_policy_snapshot, cancelled_at, cancelled_by, ' +
  'refund_amount_minor, guest_preferences, created_at, updated_at';

export class SupabaseBookingGateway implements BookingGateway {
  constructor(private readonly client: SupabaseClient) {}

  async getById(id: string): Promise<Booking | null> {
    const { data, error } = await this.client
      .from('bookings')
      .select(COLUMNS)
      .eq('id', id)
      .maybeSingle();

    if (error) {
      console.error(`Booking getById error for ${id}:`, error);
      return null;
    }
    return (data as unknown as Booking | null) ?? null;
  }

  async findByPaymentIntent(paymentIntentId: string): Promise<Booking | null> {
    const { data, error } = await this.client
      .from('bookings')
      .select(COLUMNS)
      .eq('stripe_payment_intent_id', paymentIntentId)
      .maybeSingle();

    if (error) {
      console.error(`Booking findByPaymentIntent error for ${paymentIntentId}:`, error);
      return null;
    }
    return (data as unknown as Booking | null) ?? null;
  }

  async listByGuest(guestId: string): Promise<Booking[]> {    const { data, error } = await this.client
      .from('bookings')
      .select(COLUMNS)
      .eq('guest_id', guestId)
      .order('checkin', { ascending: false });

    if (error) {
      console.error(`Booking listByGuest error for ${guestId}:`, error);
      return [];
    }
    return (data as unknown as Booking[]) ?? [];
  }

  async listByProperty(propertyId: string): Promise<Booking[]> {
    const { data, error } = await this.client
      .from('bookings')
      .select(COLUMNS)
      .eq('property_id', propertyId)
      .order('checkin', { ascending: false });

    if (error) {
      console.error(`Booking listByProperty error for ${propertyId}:`, error);
      return [];
    }
    return (data as unknown as Booking[]) ?? [];
  }

  async listByStatuses(statuses: BookingState[]): Promise<Booking[]> {
    if (statuses.length === 0) return [];
    const { data, error } = await this.client
      .from('bookings')
      .select(COLUMNS)
      .in('status', statuses)
      .lte('checkin', new Date().toISOString().slice(0, 10))
      .order('checkin', { ascending: true })
      .limit(500);

    if (error) {
      console.error('Booking listByStatuses error:', error);
      return [];
    }
    return (data as unknown as Booking[]) ?? [];
  }

  async findConflicts(propertyId: string, checkin: string, checkout: string): Promise<Booking[]> {
    // Overlap test for half-open ranges: existing.start < new.end AND existing.end > new.start
    const { data, error } = await this.client
      .from('bookings')
      .select(COLUMNS)
      .eq('property_id', propertyId)
      .in('status', [...LIVE_BOOKING_STATES])
      .lt('checkin', checkout)
      .gt('checkout', checkin);

    if (error) {
      console.error(`Booking conflict query error for ${propertyId}:`, error);
      throw new Error('Could not check availability');
    }
    return (data as unknown as Booking[]) ?? [];
  }

  async blockedWindows(
    propertyId: string,
    checkin: string,
    checkout: string,
  ): Promise<AvailabilityWindow[]> {
    const { data, error } = await this.client
      .from('availability_blocks')
      .select('start_date, end_date, reason')
      .eq('property_id', propertyId)
      .lt('start_date', checkout)
      .gt('end_date', checkin);

    if (error) {
      console.error(`Availability block query error for ${propertyId}:`, error);
      return [];
    }

    return (data ?? []).map((row) => ({
      start: row.start_date as string,
      end: row.end_date as string,
      reason: (row.reason as string | null) ?? null,
    }));
  }

  async create(booking: NewBooking): Promise<Booking> {
    const { data, error } = await this.client
      .from('bookings')
      .insert([booking])
      .select(COLUMNS)
      .single();

    if (error) {
      throw error;
    }
    return data as unknown as Booking;
  }

  async transition(
    id: string,
    from: BookingState[],
    to: BookingState,
    extra: Partial<Booking> = {},
  ): Promise<Booking | null> {
    const { data, error } = await this.client
      .from('bookings')
      .update({ ...extra, status: to })
      .eq('id', id)
      .in('status', from)
      .select(COLUMNS)
      .maybeSingle();

    if (error) {
      console.error(`Booking transition ${from.join('|')} -> ${to} failed for ${id}:`, error);
      return null;
    }
    return (data as unknown as Booking | null) ?? null;
  }

  async update(id: string, updates: Partial<Booking>): Promise<Booking | null> {
    const { data, error } = await this.client
      .from('bookings')
      .update(updates)
      .eq('id', id)
      .select(COLUMNS)
      .maybeSingle();

    if (error) {
      console.error(`Booking update failed for ${id}:`, error);
      return null;
    }
    return (data as unknown as Booking | null) ?? null;
  }

  async setPaymentIntent(id: string, paymentIntentId: string): Promise<void> {
    const { error } = await this.client
      .from('bookings')
      .update({ stripe_payment_intent_id: paymentIntentId })
      .eq('id', id);

    if (error) {
      console.error(`Could not attach payment intent to booking ${id}:`, error);
    }
  }

  async processingFees(): Promise<{ bps: number; fixedMinor: number }> {
    const { data } = await this.client
      .from('platform_settings')
      .select('value_json')
      .eq('key', 'processing_fees')
      .maybeSingle();

    const value = data?.value_json as { bps?: unknown; fixed_minor?: unknown } | undefined;
    if (!value || typeof value.bps !== 'number' || typeof value.fixed_minor !== 'number') {
      return { bps: 290, fixedMinor: 30 };
    }
    return { bps: value.bps, fixedMinor: value.fixed_minor };
  }

  async revenueSplit(): Promise<RevenueSplit> {
    const { data } = await this.client
      .from('platform_settings')
      .select('value_json')
      .eq('key', 'revenue_split')
      .maybeSingle();

    const value = data?.value_json as Partial<RevenueSplit> | undefined;
    if (
      !value ||
      typeof value.ownerPct !== 'number' ||
      typeof value.hostPct !== 'number' ||
      typeof value.platformPct !== 'number'
    ) {
      return DEFAULT_SPLIT;
    }
    return value as RevenueSplit;
  }
}
