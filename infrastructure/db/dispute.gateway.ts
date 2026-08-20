import { SupabaseClient } from '@supabase/supabase-js';

export interface DisputeGateway {
  getById: (id: string) => Promise<any | null>;
  listByProperty: (propertyId: string) => Promise<any[]>;
  create: (dispute: {
    id: string;
    booking_id: string;
    claimant_id: string;
    respondent_id: string;
    amount_claimed_minor: number;
    description: string;
  }) => Promise<any>;
  update: (id: string, updates: Partial<{ ai_assessment: Record<string, unknown>; admin_award_claimant_minor: number }>) => Promise<any | null>;
}

export class SupabaseDisputeGateway implements DisputeGateway {
  private client: SupabaseClient;

  constructor(client: SupabaseClient) {
    this.client = client;
  }

  async getById(id: string): Promise<any | null> {
    const { data, error } = await this.client
      .from('disputes')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      console.error(`Dispute getById error for ${id}:`, error);
      return null;
    }
    return data as any | null;
  }

  async listByProperty(propertyId: string): Promise<any[]> {
    const { data, error } = await this.client
      .from('disputes')
      .select('*')
      .eq('booking_id', propertyId);

    if (error) {
      console.error(`Dispute listByProperty error for ${propertyId}:`, error);
      return [];
    }
    return data as any[];
  }

  async create(dispute: {
    id: string;
    booking_id: string;
    claimant_id: string;
    respondent_id: string;
    amount_claimed_minor: number;
    description: string;
  }): Promise<any> {
    const { data, error } = await this.client.from('disputes').insert([dispute]).select().single();
    if (error) {
      console.error('Dispute create error:', error);
      throw error;
    }
    return data as any;
  }

  async update(id: string, updates: Partial<{ ai_assessment: Record<string, unknown>; admin_award_claimant_minor: number }>): Promise<any | null> {
    const { data, error } = await this.client
      .from('disputes')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error(`Dispute update error for ${id}:`, error);
      return null;
    }
    return data as any | null;
  }
}