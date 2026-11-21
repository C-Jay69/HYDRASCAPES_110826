import type { SupabaseClient } from '@supabase/supabase-js';
import type { Payout, PayoutState } from '@/app/core/entities';

export type NewPayout = Omit<Payout, 'id' | 'created_at' | 'released_at' | 'failure_reason'> & {
  released_at?: string | null;
  failure_reason?: string | null;
};

export interface PayoutGateway {
  getById: (id: string) => Promise<Payout | null>;
  getByBookingId: (bookingId: string) => Promise<Payout | null>;
  listByOwner: (ownerId: string) => Promise<Payout[]>;
  /** Payouts that are due for transfer at `now` (held or releasable, not frozen). */
  listDue: (now: Date) => Promise<Payout[]>;
  create: (payout: NewPayout) => Promise<Payout>;
  updateStatus: (id: string, status: PayoutState, extra?: Partial<Payout>) => Promise<Payout | null>;
}

export class SupabasePayoutGateway implements PayoutGateway {
  constructor(private readonly client: SupabaseClient) {}

  async getById(id: string): Promise<Payout | null> {
    const { data, error } = await this.client.from('payouts').select('*').eq('id', id).maybeSingle();
    if (error) {
      console.error(`Payout getById error for ${id}:`, error);
      return null;
    }
    return (data as Payout | null) ?? null;
  }

  async getByBookingId(bookingId: string): Promise<Payout | null> {
    const { data, error } = await this.client
      .from('payouts')
      .select('*')
      .eq('booking_id', bookingId)
      .maybeSingle();

    if (error) {
      console.error(`Payout getByBookingId error for ${bookingId}:`, error);
      return null;
    }
    return (data as Payout | null) ?? null;
  }

  async listByOwner(ownerId: string): Promise<Payout[]> {
    const { data, error } = await this.client
      .from('payouts')
      .select('*')
      .eq('owner_id', ownerId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error(`Payout listByOwner error for ${ownerId}:`, error);
      return [];
    }
    return (data as Payout[]) ?? [];
  }

  async listDue(now: Date): Promise<Payout[]> {
    const { data, error } = await this.client
      .from('payouts')
      .select('*')
      .in('status', ['held', 'releasable'])
      .lte('releasable_at', now.toISOString())
      .order('releasable_at', { ascending: true })
      .limit(200);

    if (error) {
      console.error('Payout listDue error:', error);
      return [];
    }
    return (data as Payout[]) ?? [];
  }

  async create(payout: NewPayout): Promise<Payout> {
    const { data, error } = await this.client.from('payouts').insert([payout]).select().single();
    if (error) throw error;
    return data as Payout;
  }

  async updateStatus(
    id: string,
    status: PayoutState,
    extra: Partial<Payout> = {},
  ): Promise<Payout | null> {
    const { data, error } = await this.client
      .from('payouts')
      .update({ ...extra, status })
      .eq('id', id)
      .select()
      .maybeSingle();

    if (error) {
      console.error(`Payout update error for ${id}:`, error);
      return null;
    }
    return (data as Payout | null) ?? null;
  }
}
