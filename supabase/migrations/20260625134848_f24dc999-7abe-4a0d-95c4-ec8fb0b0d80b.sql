DROP TRIGGER IF EXISTS trg_seed_company_defaults ON public.companies;
CREATE TRIGGER trg_seed_company_defaults
AFTER INSERT ON public.companies
FOR EACH ROW EXECUTE FUNCTION public.seed_company_defaults();

DROP TRIGGER IF EXISTS trg_init_unit_score ON public.units;
CREATE TRIGGER trg_init_unit_score
AFTER INSERT ON public.units
FOR EACH ROW EXECUTE FUNCTION public.init_unit_score();