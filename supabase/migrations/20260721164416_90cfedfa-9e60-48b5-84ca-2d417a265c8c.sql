
CREATE OR REPLACE FUNCTION public.invite_code_valid(_code TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.units WHERE upper(invite_code) = upper(trim(_code))
  );
$$;
GRANT EXECUTE ON FUNCTION public.invite_code_valid(TEXT) TO anon, authenticated;
