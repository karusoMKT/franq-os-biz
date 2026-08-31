ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '7 days'),
  ADD COLUMN IF NOT EXISTS subscription_status TEXT NOT NULL DEFAULT 'trialing',
  ADD COLUMN IF NOT EXISTS asaas_customer_id TEXT,
  ADD COLUMN IF NOT EXISTS asaas_subscription_id TEXT;

ALTER TABLE public.profiles ALTER COLUMN trial_ends_at SET DEFAULT (now() + INTERVAL '7 days');
ALTER TABLE public.profiles ALTER COLUMN subscription_status SET DEFAULT 'trialing';

UPDATE public.profiles SET trial_ends_at = now() + INTERVAL '7 days' WHERE trial_ends_at IS NULL;
UPDATE public.profiles SET subscription_status = 'trialing' WHERE subscription_status IS NULL;

CREATE INDEX IF NOT EXISTS profiles_asaas_customer_id_idx ON public.profiles (asaas_customer_id);
CREATE INDEX IF NOT EXISTS profiles_asaas_subscription_id_idx ON public.profiles (asaas_subscription_id);