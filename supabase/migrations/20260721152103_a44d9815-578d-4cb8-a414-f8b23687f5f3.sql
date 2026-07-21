-- Grants + RLS for notifications
GRANT SELECT, INSERT, UPDATE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Owners and managers of the same company can view notifications for units in their company
CREATE POLICY "Owners and managers view company notifications"
  ON public.notifications FOR SELECT
  TO authenticated
  USING (
    company_id = public.current_company_id()
    AND public.current_role() IN ('owner','manager')
  );

-- Any authenticated user tied to the same company can insert notifications (employees triggering opening)
CREATE POLICY "Company members create notifications"
  ON public.notifications FOR INSERT
  TO authenticated
  WITH CHECK (company_id = public.current_company_id());

-- Owners/managers can mark as read
CREATE POLICY "Owners and managers update notifications"
  ON public.notifications FOR UPDATE
  TO authenticated
  USING (
    company_id = public.current_company_id()
    AND public.current_role() IN ('owner','manager')
  )
  WITH CHECK (company_id = public.current_company_id());
