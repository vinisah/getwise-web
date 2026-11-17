# Pré-matrícula — entrega para avaliação local

Data: 17/11/2026. Branch `codex/online-enrollment-planning`, na pasta `student-settings`. Produção e GitHub não foram atualizados nesta etapa, conforme pedido de avaliar antes de publicar.

## Acesso

- Formulário: http://127.0.0.1:3001/register
- Login: http://127.0.0.1:3001/login
- Acompanhamento da família: http://127.0.0.1:3001/pre-enrollments
- Secretaria: http://127.0.0.1:3001/admin/pre-enrollments
- Unidades: http://127.0.0.1:3001/admin/school-units
- Cursos: http://127.0.0.1:3001/admin/courses

O arquivo BAT existente continua usando o iniciador desta pasta. Ele prepara as migrações locais e agora abre o formulário de matrícula. Para avaliar a secretaria, o login local oferece “Abrir painel administrativo”. Esse atalho depende de uma flag definida pelo iniciador, banco local, host loopback e ausência da Vercel. O acesso de produção passa a usar e-mail e senha individuais.

## Funcionalidades implementadas

- Unidade e dados iniciais do aluno → ficha completa → revisão e acesso → comprovante com protocolo.
- Unidades e cursos obtidos do cadastro administrativo. Ao trocar de unidade, o curso é limpo; disponibilidade também é validada no servidor.
- Marechal, código 15, com dados dos prints. English Foundations (A1) e Elementary English (A2), já existentes e ativos no banco local, foram vinculados na primeira migração. O administrador pode mudar os vínculos. Reexecutar a migração preserva escolhas posteriores.
- Responsável obrigatório para menor, com conta no e-mail do responsável e várias solicitações na mesma conta. Saúde e aprendizagem somente do aluno.
- Validação de CPF, data real de nascimento, idade, telefone, CEP, e-mail, alergia condicional e revisão. Dados preservados entre etapas; sem armazenamento persistente de CPF/saúde no navegador.
- Conta de pré-matrícula restrita ao próprio acompanhamento. Envio não cria matrícula, turma ou cobrança. Repetições não duplicam a solicitação.
- Fila administrativa com paginação, busca, situação, unidade, curso e período. Filtros de data seguem o dia civil de America/Sao_Paulo.
- Pedido de correção com mensagem, reenvio pela família, aprovação com e-mail confirmado e não aprovação com justificativa. Versão protege contra alteração concorrente.
- Aprovação prepara a ficha acadêmica; efetivação reutiliza a tela de matrícula existente, com confirmação de plano/data e primeira mensalidade. Efetivação repetida é bloqueada.
- Listagem, detalhe, cadastro e edição de unidades; vínculos também editáveis no curso. Situação e disponibilidade para matrícula são independentes.
- Novas seções de permissão `pre-enrollments` e `school-units`. Usuários sem essas permissões não recebem as fichas completas.
- Layout com uma coluna no celular, campos rotulados, validação própria, foco no erro, senha ocultável, feedback persistente e proteção contra perda do formulário.

## Decisões adotadas

Consultor usa escolha única por unidade, com Secretaria e Outro; lista editável no cadastro da unidade. Campos pessoais aceitam “Não se aplica” quando pertinente. Necessidades de aprendizagem são opcionais. Os dados administrativos de sócios ficam restritos à gestão de unidades.

O registro acadêmico de criança é separado da conta de acompanhamento do responsável. Um identificador de e-mail interno `.invalid` atende à estrutura legada do banco; ele não é apresentado como contato na ficha e não é destino de cobrança. A conta do responsável continua sendo o acesso de acompanhamento. A navegação do responsável pelo portal acadêmico de cada filho é uma expansão posterior, fora do fluxo de pré-matrícula.

## Verificações

- Compilação de produção local e TypeScript executados.
- Suíte automatizada completa: 434 testes aprovados e 10 testes de banco preexistentes ignorados por configuração. Mais 28 testes focados passaram após os ajustes finais de API. A execução não depende dos testes ignorados para validar a nova funcionalidade: o fluxo novo também foi exercitado via HTTP com PostgreSQL local.
- Teste HTTP com PostgreSQL local: catálogo mínimo, envio idempotente, conta restrita, responsável com dois filhos, isolamento de famílias, correção/reenvio, conflito de versão, confirmação de e-mail, aprovação, efetivação, recusa de curso não vinculado, cadastro/edição/fechamento de unidade, alteração dos vínculos pelo curso e filtros de período. Todos passaram. Dados fictícios dessa execução removidos ao final.
- ESLint das novas telas, serviços e APIs: sem erros.
- Auditoria estática de UI: mapa canônico resolvido. Seis alertas do analisador tratam `Button asChild` como botão literal sem ação; nesses pontos o componente compartilhado usa Radix Slot sobre `Link`, com destino definido. O resultado bruto está em `pre-enrollment-ui-audit.json`. Isso não substitui conferência visual.
- A tentativa de atualizar o formulário no Chrome foi interrompida pela ferramenta de controle por não conseguir confirmar o endereço atual da aba. A conferência visual em desktop/celular e sua avaliação continuam pendentes. Nenhuma tentativa de contornar esse bloqueio foi feita.

## Pendências antes de publicar

1. Avaliação visual no Chrome, incluindo celular. Atualizar a aba local para carregar a versão compilada.
2. Configurar SMTP para envio real da confirmação e recuperação de senha. Sem SMTP, a inscrição é salva e a falha de envio é mostrada. O teste local confirmou tokens apenas de contas fictícias, sem simular entrega de e-mail.
3. Garantir credenciais individuais para a equipe na produção e atribuir as novas seções aos perfis apropriados. Não publicar esperando que o antigo acesso público de demonstração continue funcionando.
4. Logo/fotos da unidade e fotos de sócios aceitam endereços HTTPS já hospedados. Upload direto de arquivos não foi incluído nesta entrega.

Decisões da secretaria aparecem no acompanhamento; avisos automáticos de decisão por WhatsApp/e-mail não fazem parte desta etapa. Não houve publicação na Vercel, push para GitHub ou uso de dados reais de alunos nos testes novos.
