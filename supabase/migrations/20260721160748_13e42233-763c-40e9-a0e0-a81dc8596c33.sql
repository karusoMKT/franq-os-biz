
DROP POLICY IF EXISTS profiles_select_self_or_owner ON public.profiles;
DROP POLICY IF EXISTS profiles_update_self_or_owner ON public.profiles;

CREATE POLICY profiles_select_self_or_owner ON public.profiles
FOR SELECT
USING (
  user_id = auth.uid()
  OR (company_id = public.current_company_id() AND public."current_role"() IN ('owner','manager'))
  OR (company_id IS NULL AND public."current_role"() IN ('owner','manager'))
);

CREATE POLICY profiles_update_self_or_owner ON public.profiles
FOR UPDATE
USING (
  user_id = auth.uid()
  OR (company_id = public.current_company_id() AND public."current_role"() = 'owner')
  OR (company_id IS NULL AND public."current_role"() = 'owner')
)
WITH CHECK (
  user_id = auth.uid()
  OR company_id = public.current_company_id()
);
