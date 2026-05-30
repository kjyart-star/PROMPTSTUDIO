-- 20_SCHEMA_ADD_CREDITS.sql
-- Add credits column to profiles table for managing user credits

ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS credits INTEGER DEFAULT 120;

-- Optional: Create a function for safe credit addition/subtraction
-- This helps avoid race conditions when multiple updates happen at once
CREATE OR REPLACE FUNCTION public.update_user_credits(
  target_user_id UUID,
  credit_delta INTEGER
) RETURNS void AS $$
BEGIN
  UPDATE public.profiles
  SET credits = COALESCE(credits, 120) + credit_delta
  WHERE id = target_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
