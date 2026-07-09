
ALTER TABLE public.checklist_executions
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'in_progress',
  ADD COLUMN IF NOT EXISTS checked_items jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS execution_date date NOT NULL DEFAULT CURRENT_DATE;

ALTER TABLE public.checklist_executions
  DROP CONSTRAINT IF EXISTS checklist_executions_status_check;
ALTER TABLE public.checklist_executions
  ADD CONSTRAINT checklist_executions_status_check
  CHECK (status IN ('in_progress','completed'));

CREATE INDEX IF NOT EXISTS idx_checklist_executions_daily
  ON public.checklist_executions(checklist_id, unit_id, execution_date, status);
