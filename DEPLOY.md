# Deploy de teste — Vercel + Neon

Guia passo-a-passo para colocar o Get Wise online (acesso do cliente). Custo US$0.
A raiz deste repositório é a pasta `web/` do projeto.

---

## 0. Segurança antes de tudo

- ⚠️ **Rotacione a chave Groq** em https://console.groq.com/keys (a antiga foi exposta em texto plano).
  Só a chave **nova** vai para o painel da Vercel. NUNCA cole chave em código.
- O arquivo `.env` está no `.gitignore` e **não** foi commitado — confirmado. Não force `git add .env`.

`NEXTAUTH_SECRET` já gerado para este deploy (use este, ou gere outro com
`node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`):

```
iCTfYdODamJijdjvIXqU1b2pdOJDaRLo/Lxl9KGL4qc=
```

---

## 1. Banco — Neon

1. Crie conta em https://neon.tech → **New Project**. Região: AWS `sa-east-1` (São Paulo).
2. Em **Connection string**, copie as DUAS variações:
   - **Pooled** — host contém `-pooler` → usar como `DATABASE_URL` na Vercel (runtime).
   - **Direct** (toggle "Connection pooling: off") → usar só para popular o banco (passo 4).
   - Ambas já vêm com `?sslmode=require`.

---

## 2. GitHub

1. Crie um repositório **privado** (ex.: `getwise-web`). Não inicialize com README.
2. No terminal, dentro de `web/`:

```bash
git remote add origin https://github.com/<seu-usuario>/getwise-web.git
git push -u origin main
```

---

## 3. Vercel

1. https://vercel.com → **Add New → Project** → importe o repo do GitHub.
2. **Root Directory**: deixe a raiz do repo (já é a pasta `web`). Framework: **Next.js** (auto).
   Build e Install command: **padrão** (o `postinstall` roda `prisma generate`).
3. **Environment Variables** (aba Settings → Environment Variables, marque Production + Preview):

   | Variável              | Valor                                                    |
   | --------------------- | -------------------------------------------------------- |
   | `DATABASE_URL`        | connection string **pooled** do Neon                     |
   | `NEXTAUTH_SECRET`     | o segredo do topo deste arquivo                          |
   | `NEXTAUTH_URL`        | `https://<projeto>.vercel.app` (preencha após o passo 5) |
   | `NEXT_PUBLIC_APP_URL` | mesma URL acima                                          |
   | `GROQ_API_KEY`        | chave **nova** rotacionada                               |
   | `GROQ_MODEL`          | `llama-3.3-70b-versatile`                                |
   | `BILLING_PROVIDER`    | `stub` (sem cobrança real) ou `asaas`                    |
   | `ASAAS_API_KEY`       | chave do Asaas — só se `BILLING_PROVIDER=asaas`          |
   | `ASAAS_ENV`           | `sandbox` ou `production`                                |
   | `ASAAS_WEBHOOK_TOKEN` | token do webhook (header `asaas-access-token`)           |
   | `CRON_SECRET`         | segredo do Vercel Cron que dispara a geração de boletos  |

   SMTP fica vazio (contas demo já vêm verificadas). Cobrança: deixe `BILLING_PROVIDER=stub`
   (nada é emitido) até configurar o Asaas — ver seção **Cobrança / boleto (Asaas)** abaixo.

4. **Deploy**.

---

## 4. Popular o banco (schema + dados demo)

No terminal local, dentro de `web/`, apontando para o Neon **direct**:

```bash
DATABASE_URL="<neon-direct>" npx prisma db push
DATABASE_URL="<neon-direct>" npm run db:seed
```

Confira (opcional): `plans.price` deve ser `39700 / 54700 / 79700` (valores em centavos).

---

## 5. Ativar

1. Pegue a URL final na Vercel: `https://<projeto>.vercel.app`.
2. Volte em Environment Variables → ajuste `NEXTAUTH_URL` e `NEXT_PUBLIC_APP_URL` com essa URL.
3. **Redeploy** (Deployments → ... → Redeploy). NextAuth quebra se a URL não bater com o domínio.

---

## 6. Smoke test

- `/login` → `admin@getwise.com.br / admin123` → dashboard `/admin` com KPIs.
- `aluno@getwise.com.br / student123` → área do aluno.
- `/admin/payroll`, `/admin/receivables`, `/admin/dre` → renderizam.
- `/student/tutor` → manda mensagem, espera resposta (valida a chave Groq nova).

---

## Contas demo

| Perfil    | E-mail                   | Senha      |
| --------- | ------------------------ | ---------- |
| Admin     | admin@getwise.com.br     | admin123   |
| Professor | professor@getwise.com.br | teacher123 |
| Aluno     | aluno@getwise.com.br     | student123 |

---

## Limitações deste deploy de teste

- Rate-limit em memória **zera entre invocações** no serverless da Vercel (proteção de brute-force
  enfraquecida — aceitável só para teste).
- Sem SMTP: cadastro novo não confirma e-mail e reset de senha não chega (use contas demo).
- Banco usa `prisma db push` (não migrations versionadas) — migrar para `prisma migrate` antes de
  produção real.
- Neon free tier suspende por inatividade → 1º acesso após pausa tem cold start (alguns segundos).
- Cobrança online: boleto via **Asaas** (provedor plugável). Com `BILLING_PROVIDER=stub` nada é
  emitido; ao ativar, o Asaas gera o boleto e notifica o aluno por WhatsApp/e-mail. Mercado Pago descartado.

---

## 7. Cobrança / boleto (Asaas) — ativar quando quiser cobrar de verdade

Por padrão `BILLING_PROVIDER=stub`: a matrícula cria a mensalidade PENDENTE mas **nenhum boleto é
emitido** (apenas logado). Para ligar a cobrança real:

1. Crie conta no **Asaas** (sandbox p/ testar) e pegue a **API key**.
2. No painel Asaas, ative as **notificações por WhatsApp/e-mail** (é o Asaas que avisa o aluno).
3. Cadastre o **webhook** apontando para `https://<projeto>.vercel.app/api/webhooks/asaas`,
   definindo um token de acesso; coloque o mesmo valor em `ASAAS_WEBHOOK_TOKEN`.
4. Na Vercel, sete `BILLING_PROVIDER=asaas`, `ASAAS_API_KEY`, `ASAAS_ENV`, `ASAAS_WEBHOOK_TOKEN`,
   `CRON_SECRET` (Production + Preview) e **redeploy**.
5. Alunos precisam ter **CPF** (`StudentProfile.cpf`) e **telefone** (`User.phone`) cadastrados —
   o Asaas exige CPF para emitir boleto e usa o telefone p/ notificar no WhatsApp.

**Geração automática:** o Vercel Cron chama `GET /api/billing/generate-due` 1×/dia (ver `vercel.json`)
e emite boleto das mensalidades que vencem nos próximos 7 dias. Disparo manual (admin): `POST` na
mesma rota. **Baixa automática:** o webhook `POST /api/webhooks/asaas` marca a mensalidade como paga
(receita idempotente) quando o Asaas confirma o pagamento — ele **re-consulta o Asaas** antes de gravar
(não confia no corpo do POST). Boleto pago em atraso já vem com multa 2% + juros 1%/mês (configurado na cobrança).

**Notas:**

- **`CRON_SECRET` é obrigatório** se quiser geração automática: sem ele o Vercel Cron recebe 401 e
  **falha em silêncio** (nenhum boleto é gerado, sem alerta). Defina-o na Vercel.
- A receita lançada é o **valor cheio** da mensalidade (o que o aluno paga). A **tarifa do Asaas**
  por boleto **não** é lançada como despesa automaticamente — concilie pelo painel/extrato do Asaas.
- Pagamento **parcial** não marca a mensalidade como paga (fica PENDENTE para revisão manual).
