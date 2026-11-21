#!/usr/bin/env node
/**
 * Hydrascapes MCP server (read-only).
 *
 * Exposes marketplace data to Claude over stdio. Every tool calls the
 * Hydrascapes read API under /api/mcp with a bearer key; this process holds no
 * database credentials and can only perform the queries that API exposes.
 *
 * Design notes:
 *  - One tool per action (small surface, schemas land in context once).
 *  - Read-only on purpose: creating, cancelling or transferring money are
 *    operator decisions that deserve a separate, reviewed design.
 *  - stdout is the MCP protocol stream. All logging goes to stderr.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

const BASE_URL = (process.env.HYDRASCAPES_URL ?? 'http://localhost:3000').replace(/\/+$/, '');
const API_KEY = process.env.HYDRASCAPES_MCP_KEY ?? '';

class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST';
  query?: Record<string, string | number | boolean | undefined>;
  body?: unknown;
}

async function api<T>(path: string, options: RequestOptions = {}): Promise<T> {
  if (!API_KEY) {
    throw new ApiError(
      'HYDRASCAPES_MCP_KEY is not set. Copy mcp-server/.env.example to .env and fill it in.',
      0,
    );
  }

  const url = new URL(`${BASE_URL}${path}`);
  for (const [key, value] of Object.entries(options.query ?? {})) {
    if (value !== undefined) url.searchParams.set(key, String(value));
  }

  const response = await fetch(url, {
    method: options.method ?? 'GET',
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    let message = detail;
    try {
      message = (JSON.parse(detail) as { error?: string }).error ?? detail;
    } catch {
      // Non-JSON error body; keep the text.
    }
    throw new ApiError(
      `Hydrascapes API ${response.status}: ${message || response.statusText}`.slice(0, 500),
      response.status,
    );
  }

  return (await response.json()) as T;
}

/** Wraps a handler's result as MCP text content, converting errors to tool errors. */
function toolResult(data: unknown) {
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }],
  };
}

function toolError(error: unknown) {
  const message =
    error instanceof ApiError
      ? error.message
      : error instanceof Error
        ? error.message
        : 'Unknown error';
  return {
    isError: true,
    content: [{ type: 'text' as const, text: message }],
  };
}

const server = new McpServer({
  name: 'hydrascapes',
  version: '0.1.0',
});

server.registerTool(
  'search_properties',
  {
    title: 'Search properties',
    description:
      'Search listed Hydrascapes properties by title, city, guest capacity or nightly price. ' +
      'Prices are integer minor units (e.g. 42000 = 420.00). Use this first when the user asks ' +
      'what is available or wants examples in a city.',
    inputSchema: {
      q: z.string().max(120).optional().describe('Text to match in the property title'),
      city: z.string().max(120).optional().describe('City to match, e.g. "London"'),
      guests: z.number().int().min(1).max(100).optional().describe('Minimum guest capacity'),
      minPriceMinor: z.number().int().min(0).optional().describe('Minimum nightly price, minor units'),
      maxPriceMinor: z.number().int().min(0).optional().describe('Maximum nightly price, minor units'),
      limit: z.number().int().min(1).max(50).optional().describe('Results to return (default 20)'),
    },
  },
  async ({ q, city, guests, minPriceMinor, maxPriceMinor, limit }) => {
    try {
      return toolResult(
        await api('/api/mcp/properties', {
          query: { q, city, guests, minPrice: minPriceMinor, maxPrice: maxPriceMinor, limit },
        }),
      );
    } catch (error) {
      return toolError(error);
    }
  },
);

server.registerTool(
  'get_property',
  {
    title: 'Get property',
    description:
      'Fetch one property by id: full details, amenities, price band and its AI Property Eye analysis ' +
      '(an assessment, not a verified inspection). Works for drafts as well as listed properties.',
    inputSchema: {
      id: z.string().describe('Property UUID'),
    },
  },
  async ({ id }) => {
    try {
      return toolResult(await api(`/api/mcp/properties/${encodeURIComponent(id)}`));
    } catch (error) {
      return toolError(error);
    }
  },
);

server.registerTool(
  'get_availability',
  {
    title: 'Get availability',
    description:
      'List reserved and owner-blocked date ranges for a property within a window. ' +
      'Dates are YYYY-MM-DD. Use before telling a user dates are free.',
    inputSchema: {
      propertyId: z.string().describe('Property UUID'),
      from: z.string().optional().describe('Window start, YYYY-MM-DD (default today)'),
      to: z.string().optional().describe('Window end, YYYY-MM-DD (default one year out)'),
    },
  },
  async ({ propertyId, from, to }) => {
    try {
      return toolResult(
        await api(`/api/mcp/properties/${encodeURIComponent(propertyId)}/availability`, {
          query: { from, to },
        }),
      );
    } catch (error) {
      return toolError(error);
    }
  },
);

server.registerTool(
  'quote_stay',
  {
    title: 'Quote a stay',
    description:
      'Price a stay: nights x nightly rate + cleaning fee, with availability and the cancellation ' +
      'policy. Creates nothing. Always use this rather than calculating prices yourself.',
    inputSchema: {
      propertyId: z.string().describe('Property UUID'),
      checkin: z.string().describe('Check-in date, YYYY-MM-DD'),
      checkout: z.string().describe('Check-out date, YYYY-MM-DD'),
      guestsCount: z.number().int().min(1).max(100).describe('Number of guests'),
    },
  },
  async ({ propertyId, checkin, checkout, guestsCount }) => {
    try {
      return toolResult(
        await api('/api/mcp/quote', {
          method: 'POST',
          body: { propertyId, checkin, checkout, guestsCount },
        }),
      );
    } catch (error) {
      return toolError(error);
    }
  },
);

server.registerTool(
  'list_bookings',
  {
    title: 'List bookings',
    description:
      'List bookings newest first. Filter by status (pending_payment, reserved, confirmed, ' +
      'checked_in, checked_out, completed, cancelled, refunded) and optionally only upcoming stays.',
    inputSchema: {
      status: z
        .string()
        .optional()
        .describe('Comma-separated statuses, e.g. "confirmed,checked_in"'),
      upcoming: z.boolean().optional().describe('Only stays with checkout today or later'),
      limit: z.number().int().min(1).max(100).optional().describe('Results to return (default 25)'),
    },
  },
  async ({ status, upcoming, limit }) => {
    try {
      return toolResult(await api('/api/mcp/bookings', { query: { status, upcoming, limit } }));
    } catch (error) {
      return toolError(error);
    }
  },
);

server.registerTool(
  'get_booking',
  {
    title: 'Get booking',
    description:
      'Fetch one booking with its money breakdown and payout record (status, amounts, release time).',
    inputSchema: {
      id: z.string().describe('Booking UUID'),
    },
  },
  async ({ id }) => {
    try {
      return toolResult(await api(`/api/mcp/bookings/${encodeURIComponent(id)}`));
    } catch (error) {
      return toolError(error);
    }
  },
);

server.registerTool(
  'list_payouts',
  {
    title: 'List payouts',
    description:
      'List settlement payouts: owner, host and platform shares in minor units, with release status. ' +
      'Read-only — this server cannot release money.',
    inputSchema: {
      status: z
        .string()
        .optional()
        .describe('Comma-separated statuses: held, releasable, released, failed, frozen'),
      limit: z.number().int().min(1).max(100).optional().describe('Results to return (default 25)'),
    },
  },
  async ({ status, limit }) => {
    try {
      return toolResult(await api('/api/mcp/payouts', { query: { status, limit } }));
    } catch (error) {
      return toolError(error);
    }
  },
);

server.registerTool(
  'get_overview',
  {
    title: 'Get marketplace overview',
    description:
      'One-call summary: property counts by status, live booking counts, arrivals in the next 30 days ' +
      'and payout totals by status. Money is summed server-side in minor units.',
    inputSchema: {},
  },
  async () => {
    try {
      return toolResult(await api('/api/mcp/summary'));
    } catch (error) {
      return toolError(error);
    }
  },
);

async function main(): Promise<void> {
  if (!API_KEY) {
    console.error(
      '[hydrascapes-mcp] HYDRASCAPES_MCP_KEY is not set; tools will return an error until it is.',
    );
  }
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(`[hydrascapes-mcp] ready — API ${BASE_URL}`);
}

main().catch((error) => {
  console.error('[hydrascapes-mcp] fatal:', error);
  process.exit(1);
});
