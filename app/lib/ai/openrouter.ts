/**
 * OpenRouter AI Client for Hydrascapes
 * Provides vision analysis for property photos using OpenRouter's unified API
 * Supports multimodal models like Google Gemini, Anthropic Claude, OpenAI GPT-4V
 */

export interface OpenRouterConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
  timeoutMs: number;
}

export interface VisionAnalysisRequest {
  images: string[]; // Array of image URLs or base64 data URLs
  prompt: string;
  maxTokens?: number;
  temperature?: number;
}

export interface VisionAnalysisResponse {
  conditionScore: number; // 1-10
  interiorModernity: number; // 1-10
  curbAppeal: number; // 1-10
  qualityTier: 'Luxury' | 'Premium' | 'Standard' | 'Economy';
  highlights: string[];
  redFlags: string[];
  reasoning: string;
  confidence: number; // 0-1
}

export interface OpenRouterChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string | OpenRouterContent[];
}

export interface OpenRouterContent {
  type: 'text' | 'image_url';
  text?: string;
  image_url?: {
    url: string;
    detail?: 'low' | 'high' | 'auto';
  };
}

export interface OpenRouterRequest {
  model: string;
  messages: OpenRouterChatMessage[];
  max_tokens?: number;
  temperature?: number;
  response_format?: { type: 'json_object' };
}

export interface OpenRouterResponse {
  id: string;
  choices: Array<{
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

/**
 * Validates and parses environment configuration
 */
function getOpenRouterConfig(): OpenRouterConfig {
  const apiKey = process.env.OPENROUTER_API_KEY || process.env.AI_API_KEY;
  const baseUrl = process.env.AI_BASE_URL || 'https://openrouter.ai/api/v1';
  const model = process.env.AI_MODEL || 'google/gemini-pro-vision';
  const timeoutMs = parseInt(process.env.AI_REQUEST_TIMEOUT_MS || '45000', 10);

  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY or AI_API_KEY environment variable is required');
  }

  return { apiKey, baseUrl, model, timeoutMs };
}

/**
 * Builds the vision analysis prompt for property photos
 */
function buildVisionPrompt(): string {
  return `You are an expert property inspector analyzing photos for a co-hosting marketplace.
Analyze the provided property photos and return a JSON object with the following structure:

{
  "conditionScore": number (1-10, overall property condition),
  "interiorModernity": number (1-10, how modern/updated the interior is),
  "curbAppeal": number (1-10, exterior attractiveness),
  "qualityTier": "Luxury" | "Premium" | "Standard" | "Economy",
  "highlights": string[] (key selling points, max 5),
  "redFlags": string[] (structural/aesthetic concerns, max 5),
  "reasoning": string (detailed analysis explanation),
  "confidence": number (0-1, your confidence in this assessment)
}

Guidelines:
- Be objective and specific
- Focus on visible evidence in photos
- Consider: structural integrity, maintenance, updates, cleanliness, layout, lighting, outdoor space
- Luxury: High-end finishes, premium appliances, designer touches, exceptional condition
- Premium: Well-maintained, modern updates, quality materials, above average
- Standard: Average condition, functional but dated, minor wear visible
- Economy: Significant wear, outdated, needs repairs/updates, budget-friendly

Return ONLY the JSON object, no additional text.`;
}

/**
 * Converts image URLs to OpenRouter content format
 */
function prepareImageContent(imageUrls: string[]): OpenRouterContent[] {
  return imageUrls.map((url) => ({
    type: 'image_url',
    image_url: {
      url,
      detail: 'high' as const,
    },
  }));
}

/**
 * Makes a request to OpenRouter's chat completions API
 */
async function callOpenRouter(
  config: OpenRouterConfig,
  messages: OpenRouterChatMessage[]
): Promise<OpenRouterResponse> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), config.timeoutMs);

  try {
    const response = await fetch(`${config.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`,
        'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
        'X-Title': 'Hydrascapes',
      },
      body: JSON.stringify({
        model: config.model,
        messages,
        max_tokens: 2000,
        temperature: 0.1,
        response_format: { type: 'json_object' },
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenRouter API error (${response.status}): ${errorText}`);
    }

    return await response.json();
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('OpenRouter request timed out');
    }
    throw error;
  }
}

/**
 * Health check for OpenRouter API
 */
export async function checkOpenRouterHealth(): Promise<{
  healthy: boolean;
  model: string;
  message: string;
}> {
  try {
    const config = getOpenRouterConfig();

    // Test with a simple text request
    const response = await fetch(`${config.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.model,
        messages: [{ role: 'user', content: 'Health check' }],
        max_tokens: 5,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return {
        healthy: false,
        model: config.model,
        message: `API error: ${errorText}`,
      };
    }

    return {
      healthy: true,
      model: config.model,
      message: 'API key valid and model accessible',
    };
  } catch (error) {
    return {
      healthy: false,
      model: process.env.AI_MODEL || 'unknown',
      message: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Analyzes property photos using OpenRouter vision models
 */
export async function analyzePropertyPhotos(
  imageUrls: string[],
  customPrompt?: string
): Promise<VisionAnalysisResponse> {
  if (!imageUrls || imageUrls.length === 0) {
    throw new Error('At least one image URL is required');
  }

  const config = getOpenRouterConfig();
  const prompt = customPrompt || buildVisionPrompt();

  const messages: OpenRouterChatMessage[] = [
    {
      role: 'user',
      content: [
        { type: 'text', text: prompt },
        ...prepareImageContent(imageUrls),
      ],
    },
  ];

  const response = await callOpenRouter(config, messages);

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error('Empty response from OpenRouter');
  }

  try {
    const analysis = JSON.parse(content) as VisionAnalysisResponse;

    // Validate response structure
    const requiredFields = [
      'conditionScore',
      'interiorModernity',
      'curbAppeal',
      'qualityTier',
      'highlights',
      'redFlags',
      'reasoning',
      'confidence',
    ];

    for (const field of requiredFields) {
      if (!(field in analysis)) {
        throw new Error(`Missing required field: ${field}`);
      }
    }

    // Clamp scores to valid ranges
    analysis.conditionScore = Math.max(1, Math.min(10, analysis.conditionScore));
    analysis.interiorModernity = Math.max(1, Math.min(10, analysis.interiorModernity));
    analysis.curbAppeal = Math.max(1, Math.min(10, analysis.curbAppeal));
    analysis.confidence = Math.max(0, Math.min(1, analysis.confidence));

    return analysis;
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error(`Failed to parse OpenRouter response as JSON: ${content.substring(0, 200)}`);
    }
    throw error;
  }
}

/**
 * Generates a public URL for Supabase storage path
 */
export function getSupabasePublicUrl(bucket: string, path: string): string {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const bucketName = bucket;
  if (!supabaseUrl) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL is required');
  }
  return `${supabaseUrl}/storage/v1/object/public/${bucketName}/${path}`;
}

/**
 * Converts Supabase storage paths to public URLs
 */
export function convertStoragePathsToUrls(
  paths: string[],
  bucket: string = 'property-photos'
): string[] {
  return paths.map((path) => getSupabasePublicUrl(bucket, path));
}