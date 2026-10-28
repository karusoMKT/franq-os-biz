CREATE POLICY "occurrences_delete_owner"
  ON public.occurrences
  FOR DELETE
  TO authenticated
  USING (company_id = current_company_id() AND has_role(auth.uid(), 'owner'::app_role));