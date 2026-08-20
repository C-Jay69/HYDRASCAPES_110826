import { SupabaseClient } from '@supabase/supabase-js';
import type { Profile, UserRole, KycState } from '@/app/core/entities';

export interface ProfileGateway {
  getById: (id: string) => Promise<Profile | null>;
  getByEmail: (email: string) => Promise<Profile | null>;
  update: (id: string, updates: Partial<Profile>) => Promise<Profile | null>;
  insert: (profile: Profile) => Promise<Profile>;
}

export class SupabaseProfileGateway implements ProfileGateway {
  private client: SupabaseClient;

  constructor(client: SupabaseClient) {
    this.client = client;
  }

  async getById(id: string): Promise<Profile | null> {
    const { data, error } = await this.client
      .from('profiles')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      console.error(`Profile getById error for ${id}:`, error);
      return null;
    }
    return data as Profile | null;
  }

  async getByEmail(email: string): Promise<Profile | null> {
    const { data, error } = await this.client
      .from('profiles')
      .select('*')
      .eq('email', email)
      .single();

    if (error) {
      console.error(`Profile getByEmail error for ${email}:`, error);
      return null;
    }
    return data as Profile | null;
  }

  async update(id: string, updates: Partial<Profile>): Promise<Profile | null> {
    const { data, error } = await this.client
      .from('profiles')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error(`Profile update error for ${id}:`, error);
      return null;
    }
    return data as Profile | null;
  }

  async insert(profile: Profile): Promise<Profile> {
    const { data, error } = await this.client.from('profiles').insert([profile]).select().single();
    if (error) {
      console.error('Profile insert error:', error);
      throw error;
    }
    return data as Profile;
  }
}