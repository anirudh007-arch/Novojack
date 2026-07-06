-- Voice ids moved from OpenAI TTS names (alloy, ash, ...) to Gemini prebuilt
-- voice names (Kore, Puck, ...) now that TTS goes straight to Gemini instead
-- of through the old AI gateway. Update the default and backfill existing rows.
ALTER TABLE public.profiles ALTER COLUMN preferred_voice SET DEFAULT 'Kore';
UPDATE public.profiles SET preferred_voice = 'Kore' WHERE preferred_voice = 'alloy';
