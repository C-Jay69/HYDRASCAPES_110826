import type { PropertyGateway, NewProperty } from '@/infrastructure/db/property.gateway';
import type { ProfileGateway } from '@/infrastructure/db/profile.gateway';
import type { Property } from '@/app/core/entities';

export interface CreatePropertyInput {
  title: string;
  description?: string;
  addressJson: Record<string, unknown>;
  latitude?: number | null;
  longitude?: number | null;
  bedrooms: number;
  bathrooms: number;
  maxGuests: number;
  amenities: string[];
  basePriceMinor: number;
  minPriceMinor: number;
  maxPriceMinor: number;
  currency: string;
  cleaningFeeMinor: number;
  photos: string[];
  coverPhoto?: string | null;
  ownerId: string;
}

export interface CreatePropertyOutput {
  property: Property;
}

/**
 * Creates a property draft.
 *
 * Deliberately does not touch the AI layer: vision runs asynchronously after
 * the save so a slow or failing model never blocks the owner (spec §1).
 */
export class CreatePropertyUseCase {
  private propertyGateway: PropertyGateway;
  private profileGateway: ProfileGateway;

  constructor(propertyGateway: PropertyGateway, profileGateway: ProfileGateway) {
    this.propertyGateway = propertyGateway;
    this.profileGateway = profileGateway;
  }

  async execute(input: CreatePropertyInput): Promise<CreatePropertyOutput> {
    const owner = await this.profileGateway.getById(input.ownerId);
    if (!owner) {
      throw new Error('Owner profile not found');
    }

    const now = new Date().toISOString();

    const property: NewProperty = {
      id: crypto.randomUUID(),
      owner_id: input.ownerId,
      assigned_host_id: null,
      title: input.title,
      description: input.description ?? null,
      address_json: input.addressJson,
      latitude: input.latitude ?? null,
      longitude: input.longitude ?? null,
      bedrooms: input.bedrooms,
      bathrooms: input.bathrooms,
      max_guests: input.maxGuests,
      amenities: input.amenities,
      base_price_minor: input.basePriceMinor,
      min_price_minor: input.minPriceMinor,
      max_price_minor: input.maxPriceMinor,
      currency: input.currency,
      cleaning_fee_minor: input.cleaningFeeMinor,
      status: 'draft',
      photos: input.photos,
      cover_photo: input.coverPhoto ?? null,
      created_at: now,
      updated_at: now,
    };

    const created = await this.propertyGateway.create(property);
    return { property: created };
  }
}
