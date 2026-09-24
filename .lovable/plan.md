# Plano: endpoint Pix direto em `/api/efi`

## Alterações
- Remover a função antiga em `api/public/efi-create-charge.ts`.
- Criar `api/efi.ts` na raiz do projeto, mantendo toda a integração Efí no próprio arquivo.
- Preservar a sequência mTLS: POST do token, POST da cobrança e GET do QR Code em `pix.gerencianet.com.br`.
- Atualizar o checkout para enviar o pagamento por POST para `/api/efi`.

## Validação
- Confirmar que não restou referência ao endpoint antigo.
- Confirmar que a função nova exporta o manipulador padrão da Vercel.
- Confirmar compilação sem erros.
