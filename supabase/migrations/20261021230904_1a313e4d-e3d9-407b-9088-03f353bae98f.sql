CREATE OR REPLACE FUNCTION public.protect_self_company_membership() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
 IF current_user IN ('authenticated','anon') AND auth.uid()=NEW.user_id THEN
  IF TG_OP='INSERT' THEN
   IF NEW.company_id IS NOT NULL THEN RAISE EXCEPTION 'Use um convite para vincular-se à empresa'; END IF;
  ELSIF NEW.company_id IS DISTINCT FROM OLD.company_id THEN
   RAISE EXCEPTION 'Use um convite para alterar sua empresa';
  END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER protect_self_company_membership BEFORE INSERT OR UPDATE OF company_id ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.protect_self_company_membership();