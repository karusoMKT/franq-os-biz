
-- Invite code column
ALTER TABLE public.units ADD COLUMN IF NOT EXISTS invite_code TEXT;

-- Generator function (6-char uppercase alphanumeric, avoids ambiguous chars)
CREATE OR REPLACE FUNCTION public.generate_invite_code()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result TEXT := '';
  i INT;
BEGIN
  FOR i IN 1..6 LOOP
    result := result || substr(chars, floor(random() * length(chars))::int + 1, 1);
  END LOOP;
  RETURN result;
END;
$$;

-- Backfill existing rows with unique codes
DO $$
DECLARE
  r RECORD;
  new_code TEXT;
BEGIN
  FOR r IN SELECT id FROM public.units WHERE invite_code IS NULL LOOP
    LOOP
      new_code := public.generate_invite_code();
      EXIT WHEN NOT EXISTS (SELECT 1 FROM public.units WHERE invite_code = new_code);
    END LOOP;
    UPDATE public.units SET invite_code = new_code WHERE id = r.id;
  END LOOP;
END $$;

ALTER TABLE public.units ALTER COLUMN invite_code SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS units_invite_code_key ON public.units(invite_code);

-- Trigger to auto-generate on insert if not provided
CREATE OR REPLACE FUNCTION public.units_set_invite_code()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  new_code TEXT;
BEGIN
  IF NEW.invite_code IS NULL OR NEW.invite_code = '' THEN
    LOOP
      new_code := public.generate_invite_code();
      EXIT WHEN NOT EXISTS (SELECT 1 FROM public.units WHERE invite_code = new_code);
    END LOOP;
    NEW.invite_code := new_code;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_units_set_invite_code ON public.units;
CREATE TRIGGER trg_units_set_invite_code
BEFORE INSERT ON public.units
FOR EACH ROW EXECUTE FUNCTION public.units_set_invite_code();

-- SECURITY DEFINER: redeem invite code and attach caller's profile as employee
CREATE OR REPLACE FUNCTION public.redeem_invite_code(_code TEXT, _name TEXT DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_email TEXT;
  v_unit RECORD;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  SELECT email INTO v_email FROM auth.users WHERE id = v_user_id;

  SELECT id, company_id INTO v_unit
  FROM public.units
  WHERE upper(invite_code) = upper(trim(_code))
  LIMIT 1;

  IF v_unit.id IS NULL THEN
    RAISE EXCEPTION 'Código de convite inválido';
  END IF;

  INSERT INTO public.profiles (user_id, name, email, role, company_id, unit_id)
  VALUES (v_user_id, COALESCE(_name, v_email), v_email, 'employee', v_unit.company_id, v_unit.id)
  ON CONFLICT (user_id) DO UPDATE
    SET role = 'employee',
        company_id = EXCLUDED.company_id,
        unit_id = EXCLUDED.unit_id,
        name = COALESCE(public.profiles.name, EXCLUDED.name);

  RETURN jsonb_build_object('success', true, 'unit_id', v_unit.id, 'company_id', v_unit.company_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.redeem_invite_code(TEXT, TEXT) TO authenticated;
