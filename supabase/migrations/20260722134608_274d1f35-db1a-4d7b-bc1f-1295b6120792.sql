
-- Relax INSERT on notifications to any authenticated user
DROP POLICY IF EXISTS "Company members create notifications" ON public.notifications;
CREATE POLICY "Authenticated can create notifications"
  ON public.notifications
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.role() = 'authenticated');

-- Security definer helper to fetch recipient profile IDs (owners of company + managers of unit)
CREATE OR REPLACE FUNCTION public.get_pdv_notification_recipients(_unit_id uuid)
RETURNS TABLE(profile_id uuid, company_id uuid)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.company_id
  FROM public.profiles p
  JOIN public.units u ON u.id = _unit_id
  WHERE p.company_id = u.company_id
    AND (
      p.role = 'owner'
      OR (p.role = 'manager' AND p.unit_id = _unit_id)
    );
$$;

GRANT EXECUTE ON FUNCTION public.get_pdv_notification_recipients(uuid) TO authenticated;
