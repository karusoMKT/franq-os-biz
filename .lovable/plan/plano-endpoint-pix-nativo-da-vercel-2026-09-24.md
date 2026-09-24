# Plano: endpoint Pix nativo da Vercel

## Objetivo
Fazer o checkout chamar uma função Serverless reconhecida diretamente pela Vercel em `/api/public/efi-create-charge`, sem perder o funcionamento da pré-visualização do Lovable.

## Alterações
- Criar `api/public/efi-create-charge.ts` no formato padrão da Vercel, exportando um handler padrão que aceita somente `POST` e responde `405` aos demais métodos.
- Manter no handler as validações de nome, e-mail e CPF/CNPJ, a criação da cobrança Pix pela Efí e a atualização opcional do perfil autenticado para `pending_payment`.
- Reutilizar a integração Efí existente, que já executa OAuth por `POST`, cobrança por `POST` e consulta do QR Code por `GET` usando `loc.id`.
- Manter a rota TanStack atual como compatibilidade para a pré-visualização Lovable, onde a pasta raiz `api/` não é executada pela Vercel.
- Confirmar que `/checkout` continua enviando `POST` para `/api/public/efi-create-charge`, com JSON no corpo e Bearer somente quando houver sessão.
- Adicionar apenas os tipos necessários da Vercel para o novo handler.

## Validação
- Confirmar compilação sem erros.
- Testar localmente que o checkout envia `POST` para a URL relativa correta e que a rota de compatibilidade responde JSON.
- Verificar que métodos diferentes de `POST` recebem `405` no novo handler por inspeção/teste isolado.

## Observação técnica
A função nativa da Vercel será usada no deploy feito diretamente pela Vercel; a rota TanStack continuará atendendo a pré-visualização e a publicação pelo Lovable.
