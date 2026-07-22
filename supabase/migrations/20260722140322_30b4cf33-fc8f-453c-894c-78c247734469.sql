
-- Add routine_type column to occurrences
ALTER TABLE public.occurrences ADD COLUMN IF NOT EXISTS routine_type TEXT;

-- Grants (in case not set)
GRANT SELECT, INSERT, UPDATE ON public.occurrences TO authenticated;
GRANT ALL ON public.occurrences TO service_role;

ALTER TABLE public.occurrences ENABLE ROW LEVEL SECURITY;

-- Owner can SELECT all occurrences of their company
DROP POLICY IF EXISTS occurrences_select_company ON public.occurrences;
CREATE POLICY occurrences_select_company ON public.occurrences
  FOR SELECT TO authenticated
  USING (company_id = public.current_company_id());

-- Any authenticated user of the company can INSERT occurrences for their company
DROP POLICY IF EXISTS occurrences_insert_company ON public.occurrences;
CREATE POLICY occurrences_insert_company ON public.occurrences
  FOR INSERT TO authenticated
  WITH CHECK (company_id = public.current_company_id());

-- Owners can UPDATE (resolve)
DROP POLICY IF EXISTS occurrences_update_owner ON public.occurrences;
CREATE POLICY occurrences_update_owner ON public.occurrences
  FOR UPDATE TO authenticated
  USING (company_id = public.current_company_id() AND public.has_role(auth.uid(), 'owner'))
  WITH CHECK (company_id = public.current_company_id());

-- Function to fetch managers of a specific unit (for freezer alerts)
CREATE OR REPLACE FUNCTION public.get_unit_manager_recipients(_unit_id uuid)
RETURNS TABLE(profile_id uuid, company_id uuid)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT p.id, p.company_id
  FROM public.profiles p
  JOIN public.units u ON u.id = _unit_id
  WHERE p.company_id = u.company_id
    AND p.role = 'manager'
    AND p.unit_id = _unit_id;
$$;
