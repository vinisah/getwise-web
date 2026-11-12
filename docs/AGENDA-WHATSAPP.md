# Turmas, agenda e WhatsApp

## Relatório da entrega — 10/11/2026

Publicado em https://getwise-web.vercel.app, com código integrado no GitHub pela PR #2. Inclui as alterações de segurança autorizadas, agenda responsiva, alocação por nível, remarcação com limite de vagas e otimizações de consultas de sessão e feedback durante navegação.

A validação incluiu 355 testes automatizados aprovados na entrega inicial, teste adicional com PostgreSQL real para disputa pela última vaga, build e CI do GitHub. Em produção, uma ausência foi justificada e remarcada, mantendo a turma fixa e confirmando a nova reserva. A revisão também padronizou os horários das telas antigas para Brasília e excluiu reservas canceladas da contagem do painel administrativo.

Foram criadas duas turmas A1 com nomes DEMONSTRAÇÃO, quatro encontros semanais cada, iniciando em 18 e 20 de novembro às 19h. O Aluno de Demonstração não possui telefone nem autorização para mensagens. Acesse Turmas e agenda → Ver agenda do aluno para experimentar.

Pendências: ativar a conta, número e template Meta; validar o envio e recebimento reais; ampliar os lotes de lembretes se houver mais de 50 confirmações por dia e conciliar falhas de envio incertas. O WhatsApp usa comandos estruturados, descritos abaixo. O login continua no modo demonstração existente, sem senha e com acesso administrativo; autenticação individual deve ser ativada antes do uso com dados reais. As melhorias de navegação foram entregues sem uma medição comparativa de latência.

A cópia de trabalho está em Documents/ChatGPT/Sistema Get Wise/student-feature, com banco local separado getwise_feature e porta 3001. A pasta original foi preservada.

## Como usar

Revisão retomada em 12/11/2026 na PR #3: horários dos painéis e listas usam explicitamente America/Sao_Paulo. Tanto o painel administrativo quanto a lista de aulas excluem reservas canceladas da ocupação. Testes de regressão verificam a conversão de UTC na virada do dia e a exibição de uma vaga ocupada quando há uma reserva ativa e outra cancelada.

A equipe acessa Aulas → Turmas e agenda para criar encontros semanais A1, A2 ou A3, indicar o mentor e definir vagas. O cadastro de alunos nesses níveis requer uma turma com vagas e gera as reservas futuras na mesma transação. Alunos anteriores podem ser alocados pela lista de turmas.

O aluno abre Confirmar aulas para confirmar, justificar ausência, escolher outro encontro e reservar aulas adicionais do mesmo nível. A remarcação preserva a turma fixa, respeita o período do curso e impede sobreposição de horários. O professor encontra a lista atualizada em Minhas aulas. A confirmação de intenção é independente da chamada de presença.

## Meta Cloud API

Configurar na Vercel as variáveis META_ACCESS_TOKEN, META_PHONE_NUMBER_ID, META_API_VERSION, META_APP_SECRET, META_VERIFY_TOKEN, META_REMINDER_TEMPLATE e CRON_SECRET.

Cadastrar o webhook público em /api/webhooks/whatsapp, usando o mesmo META_VERIFY_TOKEN, e assinar eventos de mensagens. O POST verifica a assinatura HMAC antes de processar. Telefones devem incluir código do país, por exemplo 5511999999999. O aluno habilita os lembretes na própria agenda.

Criar e aprovar um template em português com quatro parâmetros, nesta ordem, nome, título da aula, data/hora e código da reserva. O texto deve orientar as respostas CONFIRMAR código e FALTAR código justificativa. Após a ausência, o fluxo pede HORARIOS código AAAA-MM-DD e apresenta comandos RESERVAR código identificação-da-aula.

O agendamento da Vercel roda diariamente às 12h UTC e envia lembretes das próximas 24 horas. Cada execução considera até 50 reservas. Para maior volume, será necessário ajustar a frequência e processar lotes. O envio fica inativo enquanto faltarem as variáveis Meta. Falhas de entrega incertas ficam registradas na auditoria como WHATSAPP_DELIVERY_UNCERTAIN e exigem conciliação antes de reenvio.

## Banco e validação

O comando npm run vercel-build aplica uma migração aditiva e idempotente no ambiente Production antes do build. Em Preview, a migração automática é ignorada. O SQL está em prisma/migrations/20261111010000_scheduling/migration.sql. A execução local explícita é npm run db:scheduling.

Os testes de regras fazem parte de npm test. O teste com PostgreSQL real requer RUN_SCHEDULING_DATABASE_TESTS=1 e aceita somente o banco local getwise_feature. Ele verifica concorrência pela última vaga, nível, remarcação, repetição da operação e preservação da turma fixa.

A configuração real da Meta ainda depende da criação da conta empresarial, cadastro do número, aprovação do template e inclusão das credenciais. A navegação e as operações de agenda funcionam pelo portal durante essa configuração.
