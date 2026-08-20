import type { PropertyGateway } from '@/infrastructure/db/property.gateway';
import type { ProfileGateway } from '@/infrastructure/db/profile.gateway';
import type { Money } from '@/app/core/entities';
import type { Property, PropertyState } from '@/app/core/entities';
import type { OpenRouterPort } from '@/infrastructure/ai/openrouter.adapter';

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
  visionStatus: 'pending' | 'analyzing' | 'completed' | 'failed';
}

export class CreatePropertyUseCase {
  private propertyGateway: PropertyGateway;
  private profileGateway: ProfileGateway;
  private aiPort: OpenRouterPort;

  constructor(
    propertyGateway: PropertyGateway,
    profileGateway: ProfileGateway,
    aiPort: OpenRouterPort
  ) {
    this.propertyGateway = propertyGateway;
    this.profileGateway = profileGateway;
    this.aiPort = aiPort;
  }

  async execute(input: CreatePropertyInput): Promise<CreatePropertyOutput> {
    // Validate owner exists
    const owner = await this.profileGateway.getById(input.ownerId);
    if (!owner) {
      throw new Error('Owner profile not found');
    }

    // Generate property ID
    const propertyId = crypto.randomUUID();

    // Create property with pending vision status
    const now = new Date().toISOString();

    const property: Property = {
      id: propertyId,
      owner_id: input.ownerId,
      assigned_host_id: null,
      title: input.title,
      description: input.description,
      address_json: input.addressJson,
      latitude: input.latitude,
      longitude: input.longitude,
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
      cover_photo: input.coverPhoto,
      vision_analysis: {},
      vision_status: 'pending',
      created_at: now,
      updated_at: now,
    };

    await this.propertyGateway.create(property);

    // TODO: In the full clean architecture, AI analysis would be triggered asynchronously
    // via a message queue or edge function. For now, we mark it as pending and let
    // the existing API route handler trigger it when called.

    return {
      property,
      visionStatus: 'pending',
    };
  }
}