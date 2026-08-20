import { SupabaseClient } from '@supabase/supabase-js';
import type {
  Property,
  PropertyState,
  PropertySummary,
  Money,
} from '@/app/core/entities';
import type { Profile } from '@/app/core/entities';

export interface PropertyGateway {
  getById: (id: string) => Promise<Property | null>;
  listByOwner: (ownerId: string) => Promise<PropertySummary[]>;
  listByStatus: (status: PropertyState, ownerId?: string) => Promise<PropertySummary[]>;
  create: (property: Omit<Property, 'id' | 'created_at' | 'updated_at' | 'vision_analysis' | 'vision_status'> & { id: string; created_at: string; updated_at: string }) => Promise<Property>;
  update: (id: string, updates: Partial<Property>) => Promise<Property | null>;
  delete: (id: string) => Promise<void>;
  updateVisionAnalysis: (id: string, analysis: Record<string, unknown>, status: 'pending' | 'analyzing' | 'completed' | 'failed') => Promise<Property | null>;
}

export class SupabasePropertyGateway implements PropertyGateway {
  private client: SupabaseClient;

  constructor(client: SupabaseClient) {
    this.client = client;
  }

  async getById(id: string): Promise<Property | null> {
    const { data, error } = await this.client
      .from('properties')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      console.error(`Property getById error for ${id}:`, error);
      return null;
    }
    return data as Property | null;
  }

  async listByOwner(ownerId: string): Promise<PropertySummary[]> {
    const { data, error } = await this.client
      .from('properties')
      .select('id, title, status, owner_id, base_price_minor, currency, vision_status')
      .eq('owner_id', ownerId);

    if (error) {
      console.error(`Property listByOwner error for ${ownerId}:`, error);
      return [];
    }
    return (data as Property[])?.map((p: any) => ({
      id: p.id,
      title: p.title,
      status: p.status,
      ownerId: p.owner_id,
      basePriceMinor: p.base_price_minor,
      currency: p.currency,
      visionStatus: p.vision_status,
    })) || [];
  }

  async listByStatus(status: PropertyState, ownerId?: string): Promise<PropertySummary[]> {
    let query = this.client.from('properties').select('id, title, status, owner_id, base_price_minor, currency, vision_status').eq('status', status);

    if (ownerId) {
      query = query.eq('owner_id', ownerId);
    }

    const { data, error } = await query;
    if (error) {
      console.error(`Property listByStatus error for status=${status}:`, error);
      return [];
    }
    return (data as Property[])?.map((p: any) => ({
      id: p.id,
      title: p.title,
      status: p.status,
      ownerId: p.owner_id,
      basePriceMinor: p.base_price_minor,
      currency: p.currency,
      visionStatus: p.vision_status,
    })) || [];
  }

  async create(property: Omit<Property, 'id' | 'created_at' | 'updated_at' | 'vision_analysis' | 'vision_status'> & { id: string; created_at: string; updated_at: string }): Promise<Property> {
    const { data, error } = await this.client
      .from('properties')
      .insert([property])
      .select()
      .single();

    if (error) {
      console.error('Property creation error:', error);
      throw error;
    }
    return data as Property;
  }

  async update(id: string, updates: Partial<Property>): Promise<Property | null> {
    const { data, error } = await this.client
      .from('properties')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error(`Property update error for ${id}:`, error);
      return null;
    }
    return data as Property | null;
  }

  async delete(id: string): Promise<void> {
    const { error } = await this.client.from('properties').delete().eq('id', id);
    if (error) {
      console.error(`Property delete error for ${id}:`, error);
      throw error;
    }
  }

  async updateVisionAnalysis(
    id: string,
    analysis: Record<string, unknown>,
    status: 'pending' | 'analyzing' | 'completed' | 'failed'
  ): Promise<Property | null> {
    const { data, error } = await this.client
      .from('properties')
      .update({ vision_analysis: analysis, vision_status: status })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error(`Property vision analysis update error for ${id}:`, error);
      return null;
    }
    return data as Property | null;
  }
}