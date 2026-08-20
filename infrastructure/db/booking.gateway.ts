import { SupabaseClient } from '@supabase/supabase-js';
import type { BookingState } from '@/app/core/entities';

export interface BookingGateway {
  getById: (id: string) => Promise<any | null>;
  listByProperty: (propertyId: string) => Promise<any[]>;
  listByGuest: (guestId: string) => Promise<any[]>;
  create: (booking: {
    id: string;
    property_id: string;
    guest_id: string;
    checkin: string;
    checkout: string;
    status: BookingState;
    total_amount_minor: number;
  }) => Promise<any>;
  update: (id: string, updates: Partial<{ status: BookingState; total_amount_minor: number }>) => Promise<any | null>;
}

export class SupabaseBookingGateway implements BookingGateway {
  private client: SupabaseClient;

  constructor(client: SupabaseClient) {
    this.client = client;
  }

  async getById(id: string): Promise<any | null> {
    const { data, error } = await this.client
      .from('bookings')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      console.error(`Booking getById error for ${id}:`, error);
      return null;
    }
    return data as any | null;
  }

  async listByProperty(propertyId: string): Promise<any[]> {
    const { data, error } = await this.client
      .from('bookings')
      .select('*')
      .eq('property_id', propertyId);

    if (error) {
      console.error(`Booking listByProperty error for ${propertyId}:`, error);
      return [];
    }
    return data as any[];
  }

  async listByGuest(guestId: string): Promise<any[]> {
    const { data, error } = await this.client
      .from('bookings')
      .select('*')
      .eq('guest_id', guestId);

    if (error) {
      console.error(`Booking listByGuest error for ${guestId}:`, error);
      return [];
    }
    return data as any[];
  }

  async create(booking: {
    id: string;
    property_id: string;
    guest_id: string;
    checkin: string;
    checkout: string;
    status: BookingState;
    total_amount_minor: number;
  }): Promise<any> {
    const { data, error } = await this.client.from('bookings').insert([booking]).select().single();
    if (error) {
      console.error('Booking create error:', error);
      throw error;
    }
    return data as any;
  }

  async update(id: string, updates: Partial<{ status: BookingState; total_amount_minor: number }>): Promise<any | null> {
    const { data, error } = await this.client
      .from('bookings')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error(`Booking update error for ${id}:`, error);
      return null;
    }
    return data as any | null;
  }
}