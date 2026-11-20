import { NextResponse } from 'next/server';
import { requireUser } from '@/app/lib/authorization';
import { SupabaseBookingGateway } from '@/infrastructure/db/booking.gateway';
import { SupabasePayoutGateway } from '@/infrastructure/db/payout.gateway';
import { bookingErrorResponse } from '@/app/lib/bookings/http';
import { BookingPermissionError, BookingNotFoundError } from '@/app/lib/bookings/errors';

/** GET /api/bookings/[id] — booking participants and admins only. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const { supabase, user, profile } = await requireUser();

    const bookingGateway = new SupabaseBookingGateway(supabase);
    const booking = await bookingGateway.getById(id);
    if (!booking) throw new BookingNotFoundError();

    const isParticipant =
      booking.guest_id === user.id ||
      booking.owner_id === user.id ||
      booking.host_id === user.id;

    if (!isParticipant && profile.role !== 'admin') {
      throw new BookingPermissionError('You do not have access to this booking');
    }

    const payout = isParticipant
      ? await new SupabasePayoutGateway(supabase).getByBookingId(id)
      : null;

    return NextResponse.json({
      booking,
      // The payout is only exposed to the owner/host side, never the guest.
      payout: booking.guest_id === user.id ? null : payout,
    });
  } catch (error) {
    return bookingErrorResponse(error);
  }
}
