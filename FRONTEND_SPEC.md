# Get Wise — Especificação de Front-end (estado atual do sistema)

Documento para alimentar o design da interface. Descreve **tudo que existe hoje**: telas por papel
(Admin, Aluno, Professor), IA, fluxos de autenticação, design system e dados. Escola de inglês
(single-tenant). Stack atual: Next.js 16 (App Router) + React 19 + TypeScript + Prisma 7 + Postgres
(Neon) + NextAuth (JWT) + Groq (tutor IA) + Asaas (boleto) + Vercel Blob (upload de vídeo).

URL produção: https://getwise-web.vercel.app

---

## 1. Papéis e credenciais demo

| Papel               | Home       | Acesso                                            |
| ------------------- | ---------- | ------------------------------------------------- |
| ADMIN (dono/equipe) | `/admin`   | tudo: gestão, financeiro, folha, cursos, usuários |
| STUDENT (aluno)     | `/student` | cursos, aulas, exercícios, tutor IA, certificados |
| TEACHER (professor) | `/teacher` | dashboard + catálogo de cursos (UI ainda parcial) |

Demo: admin@getwise.com.br / admin123 · professor@getwise.com.br / teacher123 · aluno@getwise.com.br / student123.

Roteamento: ao logar, vai direto pra home do papel. Papel errado numa rota → redireciona pra própria home.
Desativação/rebaixamento de usuário vale em tempo real (JWT revalida a cada request).

---

## 2. Design system (tokens atuais — manter identidade)

**Cores (CSS vars):**

- Marca: `--brand #16204E`, `--brand-2 #27336E`, `--accent #2A5CD6`, `--accent-soft #2A5CD61A`
- Sidebar: gradiente `linear-gradient(190deg,#1A2660,#141C46)`
- Superfícies: `--bg #F2F4FB`, `--panel #FBFCFE`, `--card #fff`, `--line #E6E9F5`
- Texto: `--ink #131A38`, `--ink-2 #49527A`, `--muted #646D96` (contraste WCAG AA)
- Status: `--success #1C9C6B` (+soft), `--danger #D2382B` (+soft), `--amber #C98A12` (+soft), `--violet #6A53CC` (+soft)
- Raio/espaço: `--card-pad 24px`, cantos arredondados, pílulas (border-radius 999) p/ filtros/chips.

**Componentes base existentes** (`src/components`):

- `ui/`: `button` (variants: default/outline/ghost; sizes sm), `card`, `input`, `label`, `badge`, `avatar`.
- `gw/`: `primitives` (Card etc.), `charts` (gráficos do dashboard), `interactive`, `logo`.
- `dashboard/`: `sidebar`, `topbar`, `mobile-nav` (drawer), `stat-card` (KPI).
- Classe utilitária `.gw-*` (ex.: `.gw-table`, `.gw-sidebar`). Tabelas com header, linhas, subtotais.

**Shell do dashboard** (`(dashboard)/layout.tsx`):

- **Sidebar** fixa (desktop) com gradiente da marca, logo, seções por papel (ver navegação abaixo), item ativo destacado, badge "AI" no Tutor. Mobile = **drawer** (`role=dialog`, fecha no Esc), aberto pelo botão "Abrir menu" da topbar.
- **Topbar**: eyebrow ("PAINEL ADMINISTRATIVO"), título + subtítulo por rota (mapa de títulos), sino de notificações, botão "Sair", avatar + nome + papel no rodapé da sidebar.
- a11y: `:focus-visible` global, aria-labels, contraste AA.

**Navegação (sidebar) por papel:**

- ADMIN — _Gestão:_ Dashboard, Alunos, Cursos, Matrículas, Planos, Aulas · _Operação:_ Financeiro, Cobranças, Folha, Funcionários · _Controle:_ DRE, Auditoria, Usuários.
- STUDENT — Dashboard, Cursos, Aulas, Exercícios, **Tutor IA** (badge AI), Certificados.
- TEACHER — Dashboard, Catálogo (reusa telas de curso). _(módulo professor incompleto — ver §9)_

**Estados transversais (todas as telas devem ter):**

- _Empty state_: ícone + título + texto orientando a ação (ex.: "Sem lançamentos em Junho").
- _Loading_: skeletons/spinner.
- _Erro_: mensagens em PT com o nome do campo (validação Zod → `zodMessage`); toast/alert.
- _Confirmação_: ações destrutivas pedem confirmação.

---

## 3. Autenticação (`(auth)/`)

- **Login** (`/login`): logo, "Bem-vindo de volta", campos E-mail + Senha (mostrar/ocultar), "Manter conectado", link "Esqueceu a senha?", botão **Entrar no portal**, separador "ou", botão **Entrar com Google Workspace**, link "Novo na escola? Fazer matrícula online". Rate-limit por e-mail.
- **Cadastro/Matrícula online** (`/register`): formulário de auto-cadastro do aluno (nome, e-mail, senha, dados). Dispara e-mail de verificação (em dev, link logado no console).
- **Esqueci a senha** (`/forgot-password`): pede e-mail → envia link de reset (token uso único + expiry).
- **Resetar senha** (`/reset-password?token=`): nova senha + confirmação.
- **Verificar e-mail** (`/verify-email?token=`): confirma cadastro.

---

## 4. ADMIN — telas e funcionalidades

### 4.1 Dashboard (`/admin`)

KPIs (cards): **MRR** (mensalidades ativas), **Inadimplência** (nº vencidos), **Folha** (custo real/mês),
**Margem** (MRR − folha) + contadores (cadastrados, matriculados, entradas confirmadas, saldo).
Gráficos: **Receita × Despesa** (barras, últimos 6 meses, em milhares R$, com empty state) e
**Matrículas por plano** (donut). Listas: **Próximas aulas** (link agenda) e **Pagamentos recentes** (link financeiro).

### 4.2 Alunos (`/admin/students`, `/new`, `/[id]`)

- Lista com busca; criar aluno (`/new`); **detalhe** (`/[id]`): dados + matrículas + pagamentos + progresso.
- Dados do aluno (StudentProfile): nome, e-mail, telefone, **CPF**, data nascimento, endereço (rua/cidade/estado/CEP), contato de emergência, observações.

### 4.3 Cursos (`/admin/courses`, `/new`, `/[id]`)

- Lista de cursos (nível, ativo/arquivado); criar; **editor** (`/[id]`): hierarquia **Módulos → Unidades**.
- Unidade: título, descrição, ordem, **vídeo** (link YouTube/Vimeo → embed; .mp4/Blob → player com tracking 90%; ou **upload** de arquivo até 500MB via Vercel Blob), **materiais** (download), **exercícios**, **pré-requisitos** (curso depende de outro).
- **Arquivar curso** (soft-delete, preserva histórico) + restaurar. Módulo bloqueia exclusão (409) se há histórico de aluno. _(Unidade ainda exclui sem esse guard — ver §9.)_

### 4.4 Matrículas (`/admin/enrollments`, `/new`)

- Lista por status (ATIVA/SUSPENSA/CANCELADA/CONCLUÍDA); **nova**: aluno + plano + desconto + data de início.
- Ao matricular: cria a 1ª **mensalidade PENDENTE** e gera o **boleto** automaticamente (em background).

### 4.5 Planos (`/admin/plans`)

- Lista de planos (nome, preço em centavos, nível). **Ajuste em massa** de preço (`plans/adjust`).

### 4.6 Aulas (`/admin/lessons`, `/new`, `/[id]/edit`)

- Lista (data, professor, capacidade, nº de bookings/maxStudents); criar (professor, data/hora, capacidade até 30, alunos); **editar**; **concluir**/**cancelar** (cascateia bookings). Fuso Brasília.

### 4.7 Financeiro (`/admin/financial`, `/new`, `/[id]/edit`)

- Lançamentos **receita/despesa** (valor em centavos, data, vencimento, categoria, pago?, método, recorrente, observações).
- Criar/editar/excluir; **categorias** (plano de contas com classificação DRE: grupo, fixo/variável, é-DAS);
  **recorrentes** (geram lançamento mensal idempotente); **exportar CSV** (mês/ano, fórmula neutralizada).

### 4.8 Cobranças / Contas a receber (`/admin/receivables`)

- Mensalidades pendentes/pagas; **marcar como paga** (calcula **multa 2% + juros 1%/mês** se atrasado);
  gerar/reenviar **boleto** (Asaas, notifica aluno por WhatsApp/e-mail); **recibo** de pagamento em PDF.

### 4.9 Folha (`/admin/payroll`) + Funcionários (`/admin/employees`, `/new`)

- Funcionário: nome, função, **CPF**, salário (centavos), dependentes, tipo de contrato (CLT/…).
- Folha: cálculo automático **INSS (progressivo) + IRRF + FGTS 8%**, regras 2025, Simples Nacional (INSS patronal 0).
  Pagar salário (líquido + encargos viram despesas no financeiro), **holerite/recibo PDF** (estimativa gerencial).

### 4.10 DRE (`/admin/dre`)

- **Demonstração do Resultado** em cascata: Receita Bruta − Deduções (DAS) = Líquida − CSP = Lucro Bruto
  − Despesas Operacionais = EBIT; **EBITDA** (memo); ± Resultado Financeiro = LAIR − IR/CSLL (0 no Simples) = **Resultado Líquido**.
- Colunas: valor R$ + **AV%** (mês e acumulado do ano); folhas (categorias) indentadas; **margens** (bruta/operacional/EBITDA/líquida).
- **Seletor de regime**: Competência (data do fato gerador) / Caixa (pago). Navegação por mês. Avisos (dupla contagem) + banner de "não classificado". Botões CSV mês/ano. Perfil Simples Nacional.

### 4.11 Auditoria (`/admin/audit`)

- Log de ações sensíveis (quem/ação/entidade/quando): criar/editar/excluir, login, pagamentos, etc.

### 4.12 Usuários (`/admin/users`)

- Lista; alterar **papel**, **ativar/desativar** (revogação em tempo real), **reset de senha**.

---

## 5. ALUNO (STUDENT) — telas e funcionalidades

### 5.1 Dashboard (`/student`)

Visão do aluno: progresso, próximas aulas, situação da mensalidade.

### 5.2 Cursos (`/student/courses`, `/[id]`, `/[id]/units/[unitId]`)

- **Catálogo** (só cursos ativos a que tem acesso). **Curso**: módulos/unidades com **trava sequencial**
  (só libera a próxima unidade após concluir a anterior) e barra de progresso.
- **Unidade**: **player de vídeo** (YouTube/Vimeo embed com botão "Marquei que assisti"; arquivo/Blob com
  auto-liberação aos 90%), **materiais** para download, **exercícios** da unidade. Concluir unidade → atualiza progresso → 100% emite certificado.

### 5.3 Aulas (`/student/lessons`)

- Agenda das próprias aulas (professor, data); booking.

### 5.4 Exercícios (`/student/exercises`)

- Lista de exercícios; **runner** (múltipla escolha, escrita/WRITING, áudio/LISTENING); registra **tentativas**
  e melhor nota; correção automática por IA para WRITING/LISTENING (ver §7); gabarito não vaza antes da tentativa.

### 5.5 Tutor IA (`/student/tutor`) — badge "AI"

- **Chat** com tutor de inglês (Groq). Sessões salvas + histórico de mensagens. Rate-limited; resiliente
  (timeout/retry, 503 sem mensagem órfã se a IA falhar). Estado de "digitando", lista de conversas.

### 5.6 Certificados (`/student/certificates`)

- Lista de certificados emitidos (curso, data); **PDF** (snapshot: nome do aluno, curso, data, id do certificado). Emitido ao concluir 100% do curso (idempotente).

---

## 6. PROFESSOR (TEACHER)

- **Dashboard** (`/teacher`) + **Catálogo** (reusa telas de curso). Backend suporta professor (aulas têm
  `teacherId`, grading), mas a **UI dedicada do professor é incompleta** — oportunidade de design (ver §9):
  agenda das próprias aulas, turmas/alunos, correção de exercícios, materiais.

---

## 7. Inteligência Artificial

1. **Tutor de inglês** (`/student/tutor`, Groq via SDK OpenAI-compatível): conversa livre, sessões persistidas,
   rate-limit, resiliência (timeout 20s/retry/maxDuration). Modelo `llama-3.3-70b-versatile`.
2. **Correção automática de exercícios** (serviço `grading`): avalia respostas WRITING/LISTENING (texto aberto)
   além de múltipla escolha automática; alimenta nota/tentativa.

---

## 8. Entidades de dados (campos que as telas exibem/editam)

- **User**: name, email, phone, image, role (ADMIN/TEACHER/STUDENT), isActive. (senha nunca sai na API.)
- **StudentProfile**: cpf, birthDate, address, city, state, zipCode, emergencyContact, notes.
- **TeacherProfile**: bio, cpf, hourlyRate.
- **Plan**: name, price (centavos), nível/descrição.
- **Enrollment**: student, plan, startDate, discount, status, notes.
- **Payment** (mensalidade): amount, amountPaid, status (PENDING/PAID/FAILED/REFUNDED), method (PIX/CARTÃO/BOLETO),
  dueDate, paidAt, month/year, chargeId/boletoUrl/boletoLine (Asaas).
- **Course → Module → Unit**: title, description, order, isActive; Unit tem vídeo, materiais, exercícios.
- **Exercise**: type (MULTIPLE_CHOICE/WRITING/LISTENING), level, content (JSON); **ExerciseAttempt**: score, respostas.
- **Lesson** + **LessonBooking**: data, status (SCHEDULED/IN_PROGRESS/COMPLETED/CANCELLED), maxStudents, teacher, alunos.
- **FinancialTransaction**: type (INCOME/EXPENSE), amount (centavos), date, dueDate, isPaid, paidAt, category, recorrente, reference.
- **FinancialCategory**: name, type, color, icon, dreGroup, dreNature (fixa/variável), isDas.
- **Employee** + **SalaryPayment**: salário, dependentes, contrato; INSS/IRRF/FGTS, líquido, encargos.
- **Certificate**: studentName, courseName, completionDate, certificateId (snapshot).
- **AuditLog**: userId, action, entity, entityId, payload, ip, timestamp.
- **ChatSession/ChatMessage**: tutor IA.

**Convenção de dinheiro:** sempre **centavos (Int)**; exibir como `R$ 1.234,56` (`fmtCents`).

---

## 9. O que NÃO existe ainda (não inventar — são gaps/oportunidades)

- **UI completa do PROFESSOR** (agenda, turmas, correção, materiais) — só dashboard básico hoje.
- **Pagamento online cartão/PIX**: hoje só **boleto** (Asaas). Sem checkout de cartão.
- **DRE**: falta Análise Horizontal (comparação de período), drill-down por lançamento, por curso/centro de custo, margem de contribuição/break-even.
- Notificações reais (o sino é decorativo), busca global.
- Mensalidade exibe categoria/competência pela data de pagamento (não por mês de referência).

---

## 10. Notas de UX/produto para o design

- **Responsivo**: sidebar vira drawer no mobile; tabelas com scroll; KPIs compactos no mobile.
- **PWA/favicons** multi-dispositivo + manifest; theme-color da marca.
- **Boleto → WhatsApp**: aluno recebe o boleto pelo WhatsApp/e-mail (o gateway Asaas envia) — refletir isso na
  comunicação ao aluno (tela de "sua mensalidade", link do boleto + linha digitável).
- **Trava de conteúdo**: aluno só vê curso ativo e unidade liberada (sequencial); deixar claro o que está bloqueado e por quê.
- **Idempotência/segurança** são invisíveis ao usuário, mas refletem em: nada de cobrança duplicada, baixa única, gabarito não vaza.
