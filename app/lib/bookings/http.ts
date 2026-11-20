import { NextResponse } from 'next/server';
import { errorResponse } from '@/app/lib/http-error';
import {
  BookingConflictError,
  BookingNotFoundError,
  BookingPermissionError,
  BookingValidationError,
} from '@/app/lib/bookings/errors';
import { QuoteError } from '@/app/lib/bookings/quote';

/** Maps booking-domain errors to HTTP responses, leaving the rest generic. */
export function bookingErrorResponse(error: unknown): NextResponse {
  if (error instanceof BookingConflictError) {
    return NextResponse.json({ error: error.message, code: 'dates_unavailable' }, { status: 409 });
  }
  if (error instanceof BookingValidationError || error instanceof QuoteError) {
    return NextResponse.json({ error: error.message, code: 'invalid_booking' }, { status: 400 });
  }
  if (error instanceof BookingNotFoundError) {
    return NextResponse.json({ error: error.message }, { status: 404 });
  }
  if (error instanceof BookingPermissionError) {
    return NextResponse.json({ error: error.message }, { status: 403 });
  }
  return errorResponse(error);
}
