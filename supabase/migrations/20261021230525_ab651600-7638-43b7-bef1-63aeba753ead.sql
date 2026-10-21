REVOKE ALL ON FUNCTION public.inherit_company_subscription() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.inherit_company_subscription() TO service_role;