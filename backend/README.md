# Backend API — Clínica Escola UNINASSAU

API REST em **Node.js + Express** conectada ao **Supabase (PostgreSQL)**.

## Estrutura Modular (`backend/`)
- `config/supabase.js` — Cliente Supabase configurado via variáveis de ambiente (`SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` / `SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY`).
- `middleware/auth.js` — Hash de senha (`scrypt`), tokens Bearer HMAC-SHA256 e controle de acesso (`requireAuth`, `requireRole`).
- `services/store.js` — Camada de acesso ao banco Supabase para **qualquer tabela** (`list`, `getById`, `findByField`, `insert`, `update`, `remove`), com fallback persistente local (`backend/data/db.json`) caso as tabelas do Supabase ainda não tenham sido criadas.
- `routes/`:
  - `collections.js` — **Coletas** (`/api/collections`) — módulo completo e validado.
  - `appointments.js` — **Consultas** (`/api/appointments`) — módulo completo com verificação de disponibilidade e conflitos.
  - `animals.js` — Animais (`/api/animals`) — módulo base para a equipe.
  - `clinics.js` — Clínicas Parceiras (`/api/clinics`) — módulo base para a equipe.
  - `clinicContacts.js` — Requisições de Doadores (`/api/clinic-contacts`) — módulo base para a equipe.
  - `auth.js` — Cadastro e login (`/api/auth`).
  - `health.js` — Diagnóstico e contadores (`/api/health`, `/api/stats`).

## Como adicionar novos módulos na equipe
1. Crie um arquivo em `backend/routes/<nome-do-modulo>.js` exportando um `express.Router()`:
   ```js
   const express = require('express');
   const store = require('../services/store');
   const { requireAuth } = require('../middleware/auth');

   const router = express.Router();

   router.get('/', requireAuth, async (_req, res, next) => {
     try {
       const items = await store.list('minha_tabela');
       res.json({ items });
     } catch (err) {
       next(err);
     }
   });

   module.exports = router;
   ```
2. O arquivo `backend/routes/index.js` registra automaticamente o novo endpoint em `/api/<nome-do-modulo>`.
3. Se criar novas tabelas no Supabase, adicione a migration em `supabase/migrations/`.

## Como conectar ao Supabase
1. No **SQL Editor** do Supabase, execute `supabase/migrations/001_initial_schema.sql` e `supabase/policies.sql`.
2. Defina `SUPABASE_URL` e `SUPABASE_PUBLISHABLE_KEY` (ou `SUPABASE_SERVICE_ROLE_KEY`) no `.env` ou nas variáveis de ambiente do servidor.
3. Inicie com `npm run dev` e confira `/api/health` (`"storageMode": "supabase"`, `"tablesReady": true`).
