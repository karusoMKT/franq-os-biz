
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

  -- Canonical 5 rotinas
  INSERT INTO public.checklists (company_id, title, category, is_critical) VALUES
    (NEW.id, 'Abertura', 'Operação', FALSE)
    RETURNING id INTO v_id;
  INSERT INTO public.checklist_items (checklist_id, question, required, response_type) VALUES
    (v_id, 'Abrir os PDVs', FALSE, 'pdv_opening'),
    (v_id, 'Ligar as luzes', FALSE, 'boolean');

  INSERT INTO public.checklists (company_id, title, category, is_critical) VALUES
    (NEW.id, 'Cuidados com o Freezers', 'Qualidade', TRUE)
    RETURNING id INTO v_id;
  INSERT INTO public.checklist_items (checklist_id, question, required, response_type) VALUES
    (v_id, 'Conferir temperaturas', FALSE, 'freezer_temperatures'),
    (v_id, 'Raspagem dos freezers', FALSE, 'boolean'),
    (v_id, 'Secagem dos freezers', FALSE, 'boolean');

  INSERT INTO public.checklists (company_id, title, category, is_critical) VALUES
    (NEW.id, 'Limpeza', 'Higiene', FALSE)
    RETURNING id INTO v_id;
  INSERT INTO public.checklist_items (checklist_id, question, required, response_type) VALUES
    (v_id, 'Limpeza de frente de loja', FALSE, 'boolean'),
    (v_id, 'Limpeza de loja', FALSE, 'boolean'),
    (v_id, 'Limpeza de PDVs', FALSE, 'boolean'),
    (v_id, 'Limpeza de estoque', FALSE, 'boolean');

  INSERT INTO public.checklists (company_id, title, category, is_critical) VALUES
    (NEW.id, 'Recebimento de Mercadoria', 'Estoque', FALSE)
    RETURNING id INTO v_id;
  INSERT INTO public.checklist_items (checklist_id, question, required, response_type) VALUES
    (v_id, 'Conferencia de nota', FALSE, 'photo_upload'),
    (v_id, 'Organização de produtos no estoque', FALSE, 'boolean'),
    (v_id, 'Abertura de produtos novos', FALSE, 'boolean');

  INSERT INTO public.checklists (company_id, title, category, is_critical) VALUES
    (NEW.id, 'Fechamento', 'Operação', FALSE)
    RETURNING id INTO v_id;
  INSERT INTO public.checklist_items (checklist_id, question, required, response_type) VALUES
    (v_id, 'Fechar Caixas', FALSE, 'pdv_closing'),
    (v_id, 'Desligar computadores e eletronicos', FALSE, 'boolean'),
    (v_id, 'Desligar luzes', FALSE, 'boolean');

  RETURN NEW;
END;
$function$;
