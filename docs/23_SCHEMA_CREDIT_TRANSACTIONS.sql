-- 23_SCHEMA_CREDIT_TRANSACTIONS.sql
-- Create a table to track all credit history (additions, usage, admin top-ups)

CREATE TABLE IF NOT EXISTS public.credit_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    amount INTEGER NOT NULL,
    type TEXT NOT NULL, -- e.g., 'charge', 'use', 'admin_topup'
    description TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create an index to quickly fetch history by user
CREATE INDEX IF NOT EXISTS idx_credit_transactions_user_id ON public.credit_transactions(user_id);

-- Create a robust RPC function to safely update credits and record the transaction in one go
CREATE OR REPLACE FUNCTION public.record_credit_transaction(
  p_user_id UUID,
  p_amount INTEGER,
  p_type TEXT,
  p_description TEXT
) RETURNS void AS $$
BEGIN
  -- 1. Update the user's credit balance
  UPDATE public.profiles
  SET credits = COALESCE(credits, 120) + p_amount
  WHERE id = p_user_id;
  
  -- 2. Insert the transaction record
  INSERT INTO public.credit_transactions (user_id, amount, type, description)
  VALUES (p_user_id, p_amount, p_type, p_description);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
