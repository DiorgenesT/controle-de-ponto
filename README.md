# Controle de Ponto — Alexandre Motos

Sistema web de controle de ponto desenvolvido sob demanda para a **Alexandre Motos**, substituindo o processo manual em planilha XLSX por uma solução moderna, segura e com geração de folha de ponto em PDF.

---

## Contexto

A empresa realizava o controle de ponto dos funcionários manualmente em planilhas Excel. O processo era suscetível a erros de cálculo, difícil de auditar e não gerava documentos padronizados para assinatura. Este sistema foi criado para resolver exatamente essa dor: entrada de dados simples, cálculos automáticos e geração da folha de ponto com um clique.

---

## Funcionalidades

- **Autenticação segura** — login com JWT, bcrypt e rate limiting por IP
- **Gestão de funcionários** — cadastro com horário individual, tolerância e jornada esperada
- **Lançamento de ponto** — entrada manual diária (Entrada / Saída Almoço / Retorno / Saída)
- **Cálculo automático** — horas trabalhadas, extras e faltas com tolerância configurável
- **Tipos de dia** — Trabalhado, Empresa Fechada, Feriado, Falta, Férias, Atestado
- **Banco de horas** — saldo mensal e acumulado mês a mês
- **Geração de PDF** — folha de ponto completa, pronta para assinatura do funcionário
- **Deploy contínuo** — pipeline CI/CD automático via GitHub Actions

### Regras de negócio implementadas

| Situação | Comportamento |
|----------|---------------|
| Dentro da tolerância (±10 min) | Sem extra, sem falta |
| Acima da tolerância | Minutos excedentes → hora extra |
| Abaixo da tolerância | Minutos faltantes → hora devedora |
| Feriado com horas registradas | Todas as horas = extra (expected = 0) |
| Falta | Débita horas esperadas do dia inteiro |
| Atestado | Sem débito, sem crédito — preenche horário padrão automaticamente |
| Empresa Fechada / Férias | Neutro — sem débito nem crédito |
| Domingo | Folga — ignorado nos cálculos |

---

## Stack

### Frontend — `apps/web`

| Tecnologia | Versão | Uso |
|-----------|--------|-----|
| React | 19 | UI framework |
| Vite | 8 | Build tool e dev server |
| TypeScript | 5 (strict) | Tipagem estática |
| Tailwind CSS | v4 | Estilização utility-first |
| shadcn/ui + Radix UI | latest | Componentes acessíveis |
| TanStack Query | v5 | Cache e data fetching |
| React Hook Form + Zod | latest | Formulários e validação |
| @react-pdf/renderer | v4 | Geração de PDF client-side |
| date-fns | v4 | Manipulação de datas (PT-BR) |
| React Router | v7 | Roteamento SPA |
| Zustand | v5 | Estado global mínimo |
| Lucide React | latest | Ícones |

### Backend — `apps/api`

| Tecnologia | Versão | Uso |
|-----------|--------|-----|
| Cloudflare Workers | — | Edge runtime (zero cold-start) |
| Hono | v4 | Framework HTTP leve |
| Cloudflare D1 | — | Banco SQLite gerenciado |
| Zod | latest | Validação de entrada server-side |
| bcryptjs | latest | Hash de senhas (cost = 12) |
| Web Crypto API | nativa | JWT HS256 sem dependência externa |

### Infraestrutura

| Serviço | Função |
|---------|--------|
| Cloudflare Pages | Hospedagem do frontend |
| Cloudflare Workers | API edge serverless |
| Cloudflare D1 | Banco de dados SQLite na edge |
| GitHub Actions | CI/CD automático no push para `main` |

---

## Arquitetura

```
controle-de-ponto/
├── apps/
│   ├── web/                  # React SPA (Cloudflare Pages)
│   │   └── src/
│   │       ├── components/   # UI reutilizável (shadcn/ui + PDF)
│   │       ├── pages/        # Rotas: auth, dashboard, funcionários, ponto, relatórios
│   │       ├── hooks/        # Custom hooks
│   │       └── lib/          # Cliente HTTP, utilitários
│   └── api/                  # Cloudflare Worker (Hono)
│       └── src/
│           ├── routes/       # auth, employees, timeEntries, reports, company
│           ├── middleware/   # JWT auth, rate limiting
│           └── db/           # Schema D1 e query helpers tipados
└── packages/
    └── shared/               # Tipos TypeScript e lógica de cálculo compartilhados
        └── src/
            ├── types.ts      # Interfaces de domínio
            ├── schemas.ts    # Zod schemas (web + api)
            └── calculations.ts  # Lógica de horas (pura, testável)
```

A lógica de cálculo de horas reside em `packages/shared`, sendo consumida tanto pelo frontend (preview em tempo real ao editar) quanto pela API (persistência de valores calculados no D1).

---

## API

Todas as rotas (exceto `/auth/login`) exigem `Authorization: Bearer <token>`.

```
POST   /auth/login
GET    /auth/me

GET    /employees
POST   /employees
GET    /employees/:id
PUT    /employees/:id
DELETE /employees/:id

GET    /timeentries?employeeId=&year=&month=
POST   /timeentries                          # upsert por employee_id + entry_date
DELETE /timeentries/:id

GET    /reports/monthly?employeeId=&year=&month=
GET    /reports/hourbank?employeeId=

GET    /company
PUT    /company
```

---

## Segurança

- Senhas: **bcrypt** com cost = 12
- Tokens: **JWT HS256** via Web Crypto API, expiração em 8h
- Rate limiting: 5 tentativas de login por IP por minuto
- Queries D1: **sempre parametrizadas** — sem interpolação de strings
- CORS: restrito ao domínio do frontend
- Headers de segurança: `X-Content-Type-Options`, `X-Frame-Options`, `Strict-Transport-Security`
- Validação Zod em todas as entradas (frontend + backend independentemente)

---

## Desenvolvimento local

### Pré-requisitos

- Node.js 20+
- pnpm 10+
- Conta Cloudflare com D1 habilitado
- Wrangler CLI (`pnpm add -g wrangler`)

### Setup

```bash
# Clonar e instalar
git clone https://github.com/DiorgenesT/controle-de-ponto.git
cd controle-de-ponto
pnpm install

# Criar banco D1 local
wrangler d1 create controle-ponto-db
wrangler d1 execute controle-ponto-db --file=apps/api/src/db/schema.sql

# Variáveis de ambiente (frontend)
echo "VITE_API_URL=http://localhost:8787" > apps/web/.env.local

# Iniciar em paralelo
pnpm dev
```

O frontend sobe em `http://localhost:5173` e a API em `http://localhost:8787`.

---

## Deploy

### Configurar secrets no GitHub

| Secret | Valor |
|--------|-------|
| `CLOUDFLARE_API_TOKEN` | Token com permissão Workers + Pages + D1 |
| `CLOUDFLARE_ACCOUNT_ID` | ID da conta Cloudflare |
| `VITE_API_URL` | URL pública do Worker |

### Pipeline automático

O arquivo `.github/workflows/deploy.yml` executa a cada push em `main`:

1. **`deploy-api`** — compila e publica o Worker via Wrangler
2. **`deploy-web`** — faz o build do React com `VITE_API_URL` injetado e publica no Pages

O deploy do frontend aguarda o deploy da API (`needs: deploy-api`), garantindo que a API esteja disponível antes dos assets serem entregues.

### Deploy manual

```bash
# API
cd apps/api
CLOUDFLARE_API_TOKEN=<token> npx wrangler deploy

# Frontend
cd apps/web
VITE_API_URL=https://<worker>.workers.dev pnpm build
CLOUDFLARE_API_TOKEN=<token> npx wrangler pages deploy dist --project-name controle-ponto
```

---

## Schema do banco

```sql
companies       -- dados da empresa (CNPJ, endereço)
users           -- usuários do sistema (admin / manager / viewer)
employees       -- funcionários com jornada e tolerância individuais
time_entries    -- registros diários (entrada, almoço, saída, cálculos)
hour_bank       -- snapshot mensal do banco de horas por competência
```

O schema completo está em `apps/api/src/db/schema.sql`.

---

## Empresa

**Alexandre Motos**  
CNPJ: 21.693.712/0001-03  
Av. Colet. Artur Trindade, 1488, Jd. Alterosa — Betim / MG
