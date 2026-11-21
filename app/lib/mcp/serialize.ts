/**
 * External shapes for MCP responses.
 *
 * These are intentionally narrower than the database rows: no guest emails, no
 * Stripe identifiers, no storage paths. The MCP server is trusted, but a tool
 * result also lands in a model's context, so the habit is to expose what a
 * question needs and nothing more.
 */

import type { Booking, Payout, Property, VisionAnalysisResponse } from '@/app/core/entities';

export function toPropertyDto(property: Property) {
  const address = (property.address_json ?? {}) as Record<string, unknown>;
  const vision = property.vision_analysis as Partial<VisionAnalysisResponse> | null;

  return {
    id: property.id,
    title: property.title,
    description: property.description,
    city: typeof address.city === 'string' ? address.city : null,
    country: typeof address.country === 'string' ? address.country : null,
    status: property.status,
    bedrooms: property.bedrooms,
    bathrooms: Number(property.bathrooms),
    maxGuests: property.max_guests,
    amenities: property.amenities ?? [],
    price: {
      currency: property.currency,
      baseMinor: Number(property.base_price_minor),
      minMinor: Number(property.min_price_minor),
      maxMinor: Number(property.max_price_minor),
      cleaningMinor: Number(property.cleaning_fee_minor),
    },
    vision:
      property.vision_status === 'complete' && vision && typeof vision.conditionScore === 'number'
        ? {
            qualityTier: vision.qualityTier,
            conditionScore: vision.conditionScore,
            interiorModernity: vision.interiorModernity,
            curbAppeal: vision.curbAppeal,
            confidence: vision.confidence,
            highlights: vision.highlights ?? [],
            redFlags: vision.redFlags ?? [],
          }
        : null,
    visionStatus: property.vision_status,
    createdAt: property.created_at,
  };
}

export function toBookingDto(booking: Booking, propertyTitle: string | null = null) {
  return {
    id: booking.id,
    status: booking.status,
    propertyId: booking.property_id,
    propertyTitle,
    checkin: booking.checkin,
    checkout: booking.checkout,
    nights: booking.nights,
    guests: booking.guests_count,
    amounts: {
      currency: booking.currency,
      perNightMinor: Number(booking.per_night_rate_minor),
      nightlySubtotalMinor: Number(booking.nightly_subtotal_minor),
      cleaningMinor: Number(booking.cleaning_fee_minor),
      taxesMinor: Number(booking.taxes_minor),
      totalMinor: Number(booking.total_amount_minor),
      refundedMinor:
        booking.refund_amount_minor === null ? null : Number(booking.refund_amount_minor),
    },
    cancellationPolicy: {
      key: booking.cancellation_policy_key,
      version: booking.cancellation_policy_version,
    },
    paid: Boolean(booking.stripe_payment_intent_id),
    createdAt: booking.created_at,
  };
}

export function toPayoutDto(payout: Payout) {
  return {
    id: payout.id,
    bookingId: payout.booking_id,
    status: payout.status,
    currency: payout.currency,
    amounts: {
      ownerMinor: Number(payout.owner_amount_minor),
      hostMinor: Number(payout.host_amount_minor),
      platformMinor: Number(payout.platform_amount_minor),
      settlementBaseMinor: Number(payout.settlement_base_minor),
    },
    releasableAt: payout.releasable_at,
    releasedAt: payout.released_at,
    failureReason: payout.failure_reason,
  };
}
