import { z } from 'zod';

const dateOnly = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Dates must be YYYY-MM-DD')
  .refine((value) => !Number.isNaN(new Date(`${value}T00:00:00Z`).getTime()), 'Invalid date');

/**
 * Postgres accepts any UUID-shaped string, including the all-zero variant
 * used by the seeded fixtures. Zod's `.uuid()` enforces RFC 4122 version and
 * variant bits and would reject those rows, so match the database instead.
 */
const uuidLike = z
  .string()
  .regex(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    'A valid property id is required',
  );

export const createBookingSchema = z
  .object({
    propertyId: uuidLike,
    checkin: dateOnly,
    checkout: dateOnly,
    guestsCount: z.number().int().min(1).max(100),
    notes: z.string().trim().max(1000).optional(),
    policyKey: z.enum(['flexible', 'moderate', 'strict']).optional(),
  })
  .refine((value) => value.checkout > value.checkin, {
    message: 'Checkout must be after check-in',
    path: ['checkout'],
  });

export const quoteSchema = z.object({
  propertyId: uuidLike,
  checkin: dateOnly,
  checkout: dateOnly,
  guestsCount: z.number().int().min(1).max(100),
});

export type CreateBookingRequest = z.infer<typeof createBookingSchema>;
export type QuoteRequest = z.infer<typeof quoteSchema>;

/** Next 15 route params are async; this keeps the handlers readable. */
export function formatIssues(error: z.ZodError): { field: string; message: string }[] {
  return error.issues.map((issue) => ({
    field: issue.path.join('.') || '<root>',
    message: issue.message,
  }));
}
