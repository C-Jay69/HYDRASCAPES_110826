import { withMcp } from '@/app/lib/mcp/handler';
import { HttpError } from '@/app/lib/http-error';

export const dynamic = 'force-dynamic';

const LIVE_STATES = ['pending_payment', 'reserved', 'confirmed', 'checked_in', 'checked_out'];

/**
 * GET /api/mcp/summary
 *
 * One round-trip overview: property status counts, live bookings, upcoming
 * trips and payout totals in minor units. Aggregates are computed here rather
 * than by the caller so the model never has to sum money itself.
 */
export async function GET(request: Request) {
  return withMcp(request, async ({ service }) => {
    const today = new Date().toISOString().slice(0, 10);
    const in30Days = new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10);

    const [properties, liveBookings, upcoming, payouts] = await Promise.all([
      service.from('properties').select('status'),
      service.from('bookings').select('status').in('status', LIVE_STATES),
      service
        .from('bookings')
        .select('id')
        .gte('checkin', today)
        .lte('checkin', in30Days)
        .in('status', ['confirmed', 'reserved']),
      service.from('payouts').select('status, owner_amount_minor, host_amount_minor, platform_amount_minor'),
    ]);

    if (properties.error || liveBookings.error || upcoming.error || payouts.error) {
      console.error('MCP summary query failed:', {
        properties: properties.error,
        bookings: liveBookings.error,
        payouts: payouts.error,
      });
      throw new HttpError(500, 'Could not build the summary');
    }

    const propertyCounts = countBy(properties.data ?? [], 'status');
    const bookingCounts = countBy(liveBookings.data ?? [], 'status');

    const payoutTotals: Record<string, { ownerMinor: number; hostMinor: number; platformMinor: number }> = {};
    for (const payout of payouts.data ?? []) {
      const key = String(payout.status);
      payoutTotals[key] ??= { ownerMinor: 0, hostMinor: 0, platformMinor: 0 };
      payoutTotals[key].ownerMinor += Number(payout.owner_amount_minor ?? 0);
      payoutTotals[key].hostMinor += Number(payout.host_amount_minor ?? 0);
      payoutTotals[key].platformMinor += Number(payout.platform_amount_minor ?? 0);
    }

    return {
      today,
      properties: propertyCounts,
      liveBookings: bookingCounts,
      upcomingArrivalsNext30Days: upcoming.data?.length ?? 0,
      payouts: payoutTotals,
    };
  });
}

function countBy(rows: Record<string, unknown>[], key: string): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const row of rows) {
    const value = String(row[key]);
    counts[value] = (counts[value] ?? 0) + 1;
  }
  return counts;
}
