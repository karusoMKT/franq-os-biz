CREATE POLICY "company_members_list_payable_units" ON public.units FOR SELECT TO authenticated USING (company_id = public.current_company_id());
GRANT SELECT ON public.units TO authenticated;