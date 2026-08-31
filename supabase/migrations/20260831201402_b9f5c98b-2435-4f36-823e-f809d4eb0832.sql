ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS trial_ends_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  ADD COLUMN IF NOT EXISTS subscription_status text NOT NULL DEFAULT 'trialing';

UPDATE public.profiles SET trial_ends_at = created_at + interval '7 days' WHERE trial_ends_at IS NULL;