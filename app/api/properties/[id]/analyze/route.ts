/**
 * Deprecated alias.
 *
 * The specification (§18) names this endpoint
 * `/api/properties/[id]/analyze-vision`. This path is kept so any existing
 * caller keeps working; new code should use the canonical route.
 */

export { POST } from '@/app/api/properties/[id]/analyze-vision/route';
