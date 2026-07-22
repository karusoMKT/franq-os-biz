
-- 1) Simplifica a rotina "Recebimento de Mercadoria": apenas foto do canhoto
DELETE FROM public.checklist_items ci
USING public.checklists c
WHERE ci.checklist_id = c.id
  AND c.title = 'Recebimento de Mercadoria'
  AND ci.response_type <> 'photo_upload';

-- Garante que os checklists existentes tenham o item de foto
INSERT INTO public.checklist_items (checklist_id, question, required, response_type)
SELECT c.id, 'Foto do canhoto', FALSE, 'photo_upload'
FROM public.checklists c
WHERE c.title = 'Recebimento de Mercadoria'
  AND NOT EXISTS (
    SELECT 1 FROM public.checklist_items ci
    WHERE ci.checklist_id = c.id AND ci.response_type = 'photo_upload'
  );

-- Renomeia o item existente para o rótulo padrão
UPDATE public.checklist_items ci
SET question = 'Foto do canhoto'
FROM public.checklists c
WHERE ci.checklist_id = c.id
  AND c.title = 'Recebimento de Mercadoria'
  AND ci.response_type = 'photo_upload';

-- 2) Atualiza o seed para novas empresas
CREATE OR REPLACE FUNCTION public.seed_company_defaults()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_id UUID;
BEGIN
  IF LOWER(NEW.segment) = 'sorveteria' THEN
    INSERT INTO public.financial_categories (company_id, name, type) VALUES
      (NEW.id, 'Faturamento', 'income'),
      (NEW.id, 'Royalties', 'expense'),
      (NEW.id, 'Fundo de Propaganda', 'expense'),
      (NEW.id, 'Energia', 'expense'),
      (NEW.id, 'Água', 'expense'),
      (NEW.id, 'Internet', 'expense'),
      (NEW.id, 'Aluguel', 'expense'),
      (NEW.id, 'Folha de Pagamento', 'expense'),
      (NEW.id, 'Marketing', 'expense')
      ON CONFLICT DO NOTHING;

    INSERT INTO public.pops (company_id, title, category) VALUES
      (NEW.id, 'Atendimento ao Cliente', 'Atendimento'),
      (NEW.id, 'Limpeza dos Freezers', 'Higiene'),
      (NEW.id, 'Armazenamento de Produtos', 'Estoque'),
      (NEW.id, 'Controle de Temperatura', 'Qualidade'),
      (NEW.id, 'Fechamento da Loja', 'Operação')
      ON CONFLICT DO NOTHING;
  END IF;

  INSERT INTO public.checklists (company_id, title, category, is_critical) VALUES
    (NEW.id, 'Abertura', 'Operação', FALSE) RETURNING id INTO v_id;
  INSERT INTO public.checklist_items (checklist_id, question, required, response_type) VALUES
    (v_id, 'Abrir os PDVs', FALSE, 'pdv_opening'),
    (v_id, 'Ligar as luzes', FALSE, 'boolean');

  INSERT INTO public.checklists (company_id, title, category, is_critical) VALUES
    (NEW.id, 'Cuidados com o Freezers', 'Qualidade', TRUE) RETURNING id INTO v_id;
  INSERT INTO public.checklist_items (checklist_id, question, required, response_type) VALUES
    (v_id, 'Conferir temperaturas', FALSE, 'freezer_temperatures'),
    (v_id, 'Raspagem dos freezers', FALSE, 'boolean'),
    (v_id, 'Secagem dos freezers', FALSE, 'boolean');

  INSERT INTO public.checklists (company_id, title, category, is_critical) VALUES
    (NEW.id, 'Limpeza', 'Higiene', FALSE) RETURNING id INTO v_id;
  INSERT INTO public.checklist_items (checklist_id, question, required, response_type) VALUES
    (v_id, 'Limpeza de frente de loja', FALSE, 'boolean'),
    (v_id, 'Limpeza de loja', FALSE, 'boolean'),
    (v_id, 'Limpeza de PDVs', FALSE, 'boolean'),
    (v_id, 'Limpeza de estoque', FALSE, 'boolean');

  INSERT INTO public.checklists (company_id, title, category, is_critical) VALUES
    (NEW.id, 'Recebimento de Mercadoria', 'Estoque', FALSE) RETURNING id INTO v_id;
  INSERT INTO public.checklist_items (checklist_id, question, required, response_type) VALUES
    (v_id, 'Foto do canhoto', FALSE, 'photo_upload');

  INSERT INTO public.checklists (company_id, title, category, is_critical) VALUES
    (NEW.id, 'Fechamento', 'Operação', FALSE) RETURNING id INTO v_id;
  INSERT INTO public.checklist_items (checklist_id, question, required, response_type) VALUES
    (v_id, 'Fechar Caixas', FALSE, 'pdv_closing'),
    (v_id, 'Desligar computadores e eletronicos', FALSE, 'boolean'),
    (v_id, 'Desligar luzes', FALSE, 'boolean');

  RETURN NEW;
END;
$function$;
