import { withMcp, intParam, textParam } from '@/app/lib/mcp/handler';
import { toPayoutDto } from '@/app/lib/mcp/serialize';
import { HttpError } from '@/app/lib/http-error';
import type { Payout, PayoutState } from '@/app/core/entities';

export const dynamic = 'force-dynamic';

const VALID_STATES: PayoutState[] = ['held', 'releasable', 'released', 'failed', 'frozen'];

/**
 * GET /api/mcp/payouts — filters: status (comma-separated), limit (default 25).
 *
 * Read-only view of the settlement ledger. Releasing money is an operator
 * action with its own authenticated endpoint, not an MCP tool.
 */
export async function GET(request: Request) {
  return withMcp(request, async ({ url, service }) => {
    const statusParam = textParam(url, 'status', 100);
    const limit = intParam(url, 'limit', { min: 1, max: 100, fallback: 25 }) ?? 25;

    const statuses = statusParam
      ? statusParam.split(',').map((value) => value.trim()).filter(Boolean)
      : [];

    for (const status of statuses) {
      if (!VALID_STATES.includes(status as PayoutState)) {
        throw new HttpError(400, `Unknown payout status "${status}"`);
      }
    }

    let query = service
      .from('payouts')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (statuses.length > 0) query = query.in('status', statuses);

    const { data, error } = await query;
    if (error) {
      console.error('MCP payout list failed:', error);
      throw new HttpError(500, 'Could not load payouts');
    }

    return {
      count: data?.length ?? 0,
      payouts: ((data ?? []) as Payout[]).map(toPayoutDto),
    };
  });
}
