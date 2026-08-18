-- 0008_update_vision_config.sql
-- Add vision analysis configuration and update existing property schema
-- Ensure proper default values and add comment guidance

begin;

-- Update vision analysis defaults for existing properties that may have null values
-- These defaults ensure backward compatibility

update public.properties
set
  vision_status = coalesce(vision_status, 'pending'::public.vision_state),
  vision_analysis = coalesce(vision_analysis, '{}'::jsonb),
  vision_model = coalesce(vision_model, 'openrouter'::text),
  vision_analyzed_at = coalesce(vision_analyzed_at, now()),
  vision_photos_hash = coalesce(vision_photos_hash, ''::text)
where
  vision_status is null
  or vision_analysis is null
  or vision_model is null;

-- Add index for faster vision status queries
create index if not exists properties_vision_status_idx
  on public.properties(vision_status);

-- Add comment to document vision workflow
comment on column public.properties.vision_status is '
  Property vision analysis status.
  "pending" = Awaiting AI analysis
  "analyzing" = AI analysis in progress
  "completed" = AI analysis finished, results stored
  "failed" = AI analysis encountered an error
';

comment on column public.properties.vision_analysis is '
  JSONB object containing AI vision analysis results.
  Includes: condition_score, interior_modernity, curb_appeal, quality_tier,
  highlights, red_flags, reasoning, confidence, model, analyzed_at
';

commit;