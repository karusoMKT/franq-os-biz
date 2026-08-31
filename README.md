# FranqOS Control Panel

Estou desenvolvendo o SaaS FranqOS.

Utilize o banco Supabase já conectado.

Analise todas as tabelas existentes e utilize o schema atual.

Tabelas:

companies
units
profiles
financial_categories
revenues
expenses
goals
checklists
checklist_items
checklist_executions
pops
operational_scores

Crie autenticação com Supabase Auth.

Fluxo:

1. Login por email e senha.

2. Após login identificar o role do usuário:

owner
manager
employee

3. Redirecionamento:

owner → Dashboard Proprietário

manager → Dashboard Gerente

employee → Dashboard Funcionário

Permissões:

Owner:
- acesso total
- financeiro
- unidades
- metas
- checklists
- pops
- relatórios

Manager:
- checklists
- pops
- equipe
- indicadores operacionais

Employee:
- executar checklists
- visualizar POPs
- receber avisos

Utilizar RLS existente.

Não criar novas tabelas.

Utilizar exclusivamente o schema existente.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/d873a55c-cda8-4435-b319-3d411cdc0f43).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
