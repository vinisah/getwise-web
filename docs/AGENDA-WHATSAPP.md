# Turmas, agenda e WhatsApp

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
