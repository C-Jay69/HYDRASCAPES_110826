import { SupabaseClient } from '@supabase/supabase-js';
import type { BookingState } from '@/app/core/entities';

export interface HostApplicationGateway {
  getById: (id: string) => Promise<any | null>;
  listByProperty: (propertyId: string) => Promise<any[]>;
  listByHost: (hostId: string) => Promise<any[]>;
  create: (application: {
    id: string;
    property_id: string;
    host_id: string;
    proposed_fee_pct: number;
    pitch_text: string;
    ai_match_score?: number;
  }) => Promise<any>;
  update: (id: string, updates: Partial<{ proposed_fee_pct: number; pitch_text: string; status: string }>) => Promise<any | null>;
}

export class SupabaseHostApplicationGateway implements HostApplicationGateway {
  private client: SupabaseClient;

  constructor(client: SupabaseClient) {
    this.client = client;
  }

  async getById(id: string): Promise<any | null> {
    const { data, error } = await this.client
      .from('host_applications')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      console.error(`Host application getById error for ${id}:`, error);
      return null;
    }
    return data as any | null;
  }

  async listByProperty(propertyId: string): Promise<any[]> {
    const { data, error } = await this.client
      .from('host_applications')
      .select('*')
      .eq('property_id', propertyId);

    if (error) {
      console.error(`Host application listByProperty error for ${propertyId}:`, error);
      return [];
    }
    return data as any[];
  }

  async listByHost(hostId: string): Promise<any[]> {
    const { data, error } = await this.client
      .from('host_applications')
      .select('*')
      .eq('host_id', hostId);

    if (error) {
      console.error(`Host application listByHost error for ${hostId}:`, error);
      return [];
    }
    return data as any[];
  }

  async create(application: {
    id: string;
    property_id: string;
    host_id: string;
    proposed_fee_pct: number;
    pitch_text: string;
    ai_match_score?: number;
  }): Promise<any> {
    const { data, error } = await this.client.from('host_applications').insert([application]).select().single();
    if (error) {
      console.error('Host application create error:', error);
      throw error;
    }
    return data as any;
  }

  async update(id: string, updates: Partial<{ proposed_fee_pct: number; pitch_text: string; status: string }>): Promise<any | null> {
    const { data, error } = await this.client
      .from('host_applications')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error(`Host application update error for ${id}:`, error);
      return null;
    }
    return data as any | null;
  }
}