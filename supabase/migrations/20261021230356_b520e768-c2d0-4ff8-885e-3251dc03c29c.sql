ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS subscription_status text NOT NULL DEFAULT 'trialing', ADD COLUMN IF NOT EXISTS trial_ends_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'), ADD COLUMN IF NOT EXISTS plan text NOT NULL DEFAULT 'trial', ADD COLUMN IF NOT EXISTS efi_charges jsonb NOT NULL DEFAULT '{}'::jsonb;
GRANT SELECT ON public.companies TO authenticated;
GRANT ALL ON public.companies TO service_role;
UPDATE public.companies c SET subscription_status = CASE WHEN EXISTS (SELECT 1 FROM public.profiles p WHERE p.company_id=c.id AND p.subscription_status IN ('active','paid')) THEN 'active' ELSE 'trialing' END, plan = CASE WHEN EXISTS (SELECT 1 FROM public.profiles p WHERE p.company_id=c.id AND p.subscription_status IN ('active','paid')) THEN 'complete' ELSE 'trial' END, trial_ends_at = COALESCE((SELECT min(p.trial_ends_at) FROM public.profiles p WHERE p.company_id=c.id AND p.role='owner'), c.created_at + interval '7 days');
CREATE OR REPLACE FUNCTION public.protect_company_billing() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
 IF auth.uid() IS NOT NULL AND COALESCE(auth.role(),'') <> 'service_role' THEN
  IF TG_OP='INSERT' THEN
   NEW.subscription_status := 'trialing'; NEW.plan := 'trial'; NEW.trial_ends_at := now()+interval '7 days'; NEW.efi_charges := '{}'::jsonb;
  ELSIF NEW.subscription_status IS DISTINCT FROM OLD.subscription_status OR NEW.trial_ends_at IS DISTINCT FROM OLD.trial_ends_at OR NEW.plan IS DISTINCT FROM OLD.plan OR NEW.efi_charges IS DISTINCT FROM OLD.efi_charges THEN
   RAISE EXCEPTION 'Somente o serviço de pagamentos pode alterar o plano da empresa';
  END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER protect_company_billing BEFORE INSERT OR UPDATE ON public.companies FOR EACH ROW EXECUTE FUNCTION public.protect_company_billing();
CREATE OR REPLACE FUNCTION public.inherit_company_subscription() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_company public.companies%ROWTYPE;
BEGIN
 IF NEW.company_id IS NOT NULL THEN
  SELECT * INTO v_company FROM public.companies WHERE id=NEW.company_id;
  IF FOUND THEN NEW.subscription_status := v_company.subscription_status; NEW.trial_ends_at := v_company.trial_ends_at; END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER inherit_company_subscription BEFORE INSERT OR UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.inherit_company_subscription();
UPDATE public.profiles p SET subscription_status=c.subscription_status, trial_ends_at=c.trial_ends_at FROM public.companies c WHERE p.company_id=c.id;
CREATE OR REPLACE FUNCTION public.register_company_efi_charge(p_company_id uuid, p_user_id uuid, p_txid text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF length(p_txid) NOT BETWEEN 26 AND 35 OR p_txid !~ '^[A-Za-z0-9]+$' THEN RAISE EXCEPTION 'Txid inválido'; END IF;
 IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE user_id=p_user_id AND company_id=p_company_id) THEN RAISE EXCEPTION 'Membro não vinculado à empresa'; END IF;
 UPDATE public.companies SET efi_charges=efi_charges || jsonb_build_object(p_txid,jsonb_build_object('company_id',p_company_id,'user_id',p_user_id,'amount','97.00','status','pending','created_at',now())), subscription_status=CASE WHEN subscription_status IN ('active','paid') THEN subscription_status ELSE 'pending_payment' END WHERE id=p_company_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'Empresa não encontrada'; END IF;
END $$;
REVOKE ALL ON FUNCTION public.register_company_efi_charge(uuid,uuid,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.register_company_efi_charge(uuid,uuid,text) TO service_role;
CREATE OR REPLACE FUNCTION public.confirm_company_efi_charge(p_txid text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 UPDATE public.companies SET subscription_status='active', plan='complete', efi_charges=jsonb_set(efi_charges,ARRAY[p_txid,'status'],'"paid"'::jsonb) WHERE efi_charges ? p_txid;
 IF NOT FOUND THEN RAISE EXCEPTION 'Cobrança não vinculada'; END IF;
END $$;
REVOKE ALL ON FUNCTION public.confirm_company_efi_charge(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_company_efi_charge(text) TO service_role;
CREATE INDEX IF NOT EXISTS companies_efi_charges_idx ON public.companies USING gin(efi_charges);
