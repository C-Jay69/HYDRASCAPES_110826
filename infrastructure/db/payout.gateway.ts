import { SupabaseClient } from '@supabase/supabase-js';

export interface PayoutGateway {
  getById: (id: string) => Promise<any | null>;
  listByOwner: (ownerId: string) => Promise<any[]>;
  update: (id: string, updates: Partial<{ owner_amount_minor: number; status: string }>) => Promise<any | null>;
}

export class SupabasePayoutGateway implements PayoutGateway {
  private client: SupabaseClient;

  constructor(client: SupabaseClient) {
    this.client = client;
  }

  async getById(id: string): Promise<any | null> {
    const { data, error } = await this.client
      .from('payouts')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      console.error(`Payout getById error for ${id}:`, error);
      return null;
    }
    return data as any | null;
  }

  async listByOwner(ownerId: string): Promise<any[]> {
    const { data, error } = await this.client
      .from('payouts')
      .select('*')
      .eq('owner_id', ownerId);

    if (error) {
      console.error(`Payout listByOwner error for ${ownerId}:`, error);
      return [];
    }
    return data as any[];
  }

  async update(id: string, updates: Partial<{ owner_amount_minor: number; status: string }>): Promise<any | null> {
    const { data, error } = await this.client
      .from('payouts')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error(`Payout update error for ${id}:`, error);
      return null;
    }
    return data as any | null;
  }
}