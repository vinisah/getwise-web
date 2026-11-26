# UX Contract

Pré-matrícula por CEP: o contrato de negócio e permissões está em `docs/CEP-PRE-MATRICULA.md`. `enrollment/LocationPicker` reutiliza Field, Button e o CSS de matrícula para a etapa de residência/unidade; opções de unidade usam rádio nativo e cidade usa select nativo. Consulta inválida, ausente ou indisponível impede avançar, preserva os dados e oferece nova tentativa. Respostas antigas são descartadas após alteração do CEP. Pedido pendente, recusa e autorização aparecem no acompanhamento existente; a decisão só fica disponível para direção autenticada por senha. Aprovação da exceção não é apresentada como matrícula concluída.

Escopo inicial: preferências pessoais e os componentes compartilhados que as aplicam. Outros fluxos legados estão descritos em `FRONTEND_SPEC.md`; esta entrega não declara conformidade de todas as telas antigas.

## Product context

Portal de escola de inglês brasileira, português do Brasil, uso em computador e celular. Datas acadêmicas mantêm o fuso America/Sao_Paulo. Meta de acessibilidade WCAG 2.2 AA.

## Business-context sources

| Domínio               | Fonte                                                  | Consequência na interface                                                                 |
| --------------------- | ------------------------------------------------------ | ----------------------------------------------------------------------------------------- |
| Conta autenticada     | `src/lib/api-auth.ts`, `src/app/api/me/prefs/route.ts` | Somente preferências da própria conta; nunca aceitar id de usuário no formulário          |
| Visualizar como       | `src/lib/effective-user.ts`                            | Preferências são da conta real; mostrar aviso quando há prévia de outro papel             |
| Dados acadêmicos      | `prisma/schema.prisma`, `FRONTEND_SPEC.md`             | Apelido fica em `User.uiPrefs`; não altera `User.name` nem dados de matrícula/certificado |
| Proteção das escritas | `src/lib/api-error.ts`, `src/lib/request-security.ts`  | Sessão e mesma origem continuam obrigatórias                                              |

## Visual contract

Ver `DESIGN.md`. Fonte canônica: `src/lib/theme.ts` e `src/app/globals.css`. Sem mudança de identidade. CSS e `PreferencesProvider` adaptam os tokens ao shell; `themeVars` também alimenta a prévia.

## Canonical UI Map

| Capability     | Canonical owner                                                   | Source of truth                       | Allowed variants                         | Verification                                          |
| -------------- | ----------------------------------------------------------------- | ------------------------------------- | ---------------------------------------- | ----------------------------------------------------- |
| Form           | `ui/Input`, `ui/Button`, `preferencesSchema`, `PreferencesEditor` | API e este contrato                   | edição pessoal com prévia                | `preferences-editor.test.tsx` e Chrome                |
| Scrollbar      | `src/app/globals.css`                                             | `DESIGN.md`                           | somente geometria específica             | inspeção de CSS e Chrome                              |
| CRUD           | `/api/me/prefs` e `PreferencesEditor`                             | conta real autenticada                | leitura/edição/restauração reversível    | `preferences.test.ts` e `preferences-editor.test.tsx` |
| Select/Listbox | `enrollment/fields.tsx` Field                                     | catálogo e administrador              | select nativo com popup da plataforma    | testes de formulário e Chrome                         |
| Date           | `enrollment/fields.tsx` Field                                     | data ISO e idade em America/Sao_Paulo | date nativo com calendário da plataforma | testes de aniversário e Chrome                        |

Escolhas curtas usam rádio nativo em `PreferenceChoices`. Não há Select/Listbox, seletor de data, tabela selecionável ou toast nesta tela. Validação é do aplicativo (`noValidate`); erros têm associação por `aria-describedby` e foco no campo inválido.

## Flow ledger

| Operação      | Disparo               | Pendente                                          | Sucesso                                         | Falha / recuperação                         | Fonte                                          |
| ------------- | --------------------- | ------------------------------------------------- | ----------------------------------------------- | ------------------------------------------- | ---------------------------------------------- |
| Carregar      | Entrada na tela       | Campos desabilitados e texto estável              | Carregar conta e versão                         | Erro visível, tentar novamente              | GET `/api/me/prefs`                            |
| Editar        | Campo ou rádio        | Prévia local, aviso de alteração                  | Aguardar Salvar                                 | Valores preservados                         | `PreferencesEditor`                            |
| Salvar        | Salvar preferências   | Sem envio duplicado; campos e botão desabilitados | Permanecer na tela, atualizar shell e confirmar | Preservar escolhas, permitir nova tentativa | POST `/api/me/prefs`                           |
| Conflito      | Outra aba salvou      | Não sobrescrever                                  | Carregar preferências salvas por ação explícita | Explicar conflito e preservar rascunho      | Comparação de versão + atualização condicional |
| Restaurar     | Restaurar padrão      | Prévia do padrão                                  | Salvar para efetivar                            | Descartar restaura o salvo                  | `DEFAULT_PREFS`                                |
| Sair por link | Alterações não salvas | Diálogo do app                                    | Sair ou continuar editando                      | Foco retorna; Escape mantém edição          | `UnsavedPreferences`                           |

Solicitações expiram em 15 segundos. Repetir uma gravação já aplicada é idempotente. Respostas atrasadas de tela desmontada não mudam o estado. O cookie de apresentação guarda somente aparência e movimento, sem apelido ou identidade; o banco é a fonte da conta entre dispositivos.

## Verification

## Pré-matrícula e unidades (17/11/2026)

Acabamento administrativo: `enrollment/ReviewSection` é o componente de seções recolhíveis; os campos permanecem montados e os valores não são descartados ao fechar. `revealField` abre os ancestrais antes de focar um erro de validação. Busca e situação da lista de unidades são combinadas, reiniciam a paginação e podem ser limpas. A fila administrativa mantém os filtros na URL e paginação do servidor; a tabela vira blocos rotulados até 800 px, preservando status, observações e link de análise. As datas e ações de decisão existentes são mantidas. Nenhuma preferência de tema é gravada por essas telas. Regressões de filtro, erro em seção fechada e falha de salvamento são cobertas por `src/test/unit/enrollment-admin-design.test.tsx`.

Fonte de negócio: `docs/MATRICULA-ONLINE-DESIGN.md` e aprovação do usuário para implementação local. O envio cria pré-matrícula PENDING; somente a secretaria com a seção `pre-enrollments` pode consultar a ficha completa e decidir. A conta APPLICANT fica restrita às próprias solicitações. Saúde e aprendizagem são exclusivamente do aluno. Dados sensíveis ficam no banco e no estado da tela, sem localStorage ou query string. O e-mail do responsável identifica a conta de acompanhamento de menores e pode ser compartilhado entre solicitações de irmãos.

| Capability     | Canonical owner                                                             | Source of truth                                  | Allowed variants                                                          | Verification                   |
| -------------- | --------------------------------------------------------------------------- | ------------------------------------------------ | ------------------------------------------------------------------------- | ------------------------------ |
| Form           | `enrollment/fields.tsx`, `ui/Input`, `ui/Button` e schemas de pré-matrícula | `pre-enrollment/schema.ts`                       | aluno, responsável, unidade                                               | testes de formulário e API     |
| Select/Listbox | `enrollment/fields.tsx` Field                                               | catálogo/administrador                           | select nativo; popup de plataforma aceito                                 | teclado e Chrome               |
| Date           | `enrollment/fields.tsx` Field                                               | data ISO sem horário; idade em America/Sao_Paulo | input date nativo, apresentação de plataforma                             | testes de aniversário e Chrome |
| CRUD           | APIs de unidades e pré-matrículas; `fetchJson`                              | validação no servidor + versão                   | criar volta à lista; revisar mantém detalhe; inscrição mostra comprovante | teste HTTP local completo      |

Associação curso/unidade usa o mesmo vínculo nas duas telas. Cursos inativos e unidades fechadas não recebem inscrições. Trocar de unidade limpa o curso. O servidor revalida disponibilidade e impede duplicação por aluno, curso e unidade. Correção é permitida somente no estado CORRECTION e preserva a conta de acesso. Aprovação exige e-mail confirmado, prepara ficha acadêmica e não gera cobrança; efetivação é uma ação explícita na tela de matrícula, com plano, data e mensalidade. Atualizações concorrentes da ficha e dos vínculos retornam conflito.

Listas de pré-matrículas têm paginação de 20 itens e filtros na URL; nomes digitados na busca são a única informação pessoal em filtro, nunca CPF/saúde. Cadastro de unidades usa lista limitada a 200 e páginas locais de 12. Criação/edição usa validação própria, erros associados e foco no primeiro erro. Formulário público preserva os dados entre etapas, bloqueia envio duplo e avisa ao sair com dados não enviados. Falha de SMTP mantém o protocolo e informa que a confirmação não foi entregue. Não há notificação de decisão por WhatsApp/e-mail nesta etapa; a decisão aparece no acompanhamento.

Visual: identidade existente, etapas reais acima do formulário, seções claras e uma coluna no celular. O acabamento aprovado usa cards compactos com cantos de 22 px, limitado ao módulo de matrícula. Ações longas quebram sem sair dos cards ou dos diálogos; campos em até 800 px usam 16 px e botões têm alvo mínimo de 44 px. Sem tokens novos de cor ou fonte; CSS usa `theme.ts`/`globals.css`. Controles nativos preservam teclado e acessibilidade de plataforma.

Login usa e-mail e senha individuais. O botão de demonstração só existe quando `GETWISE_LOCAL_DEMO=1`, sem Vercel, em banco local `getwise_feature` e host loopback. O iniciador local configura essa condição para avaliação; produção não oferece esse acesso.

Conforme escolha do usuário em 26/11/2026, o botão **Acompanhar pré-matrícula** do login e do comprovante de envio abre `/login?mode=pre-enrollment`, usando o e-mail e a senha criados no cadastro. Para menores, o e-mail é o do responsável. Após autenticar, o destino é `/pre-enrollments` ou o detalhe solicitado; o formulário de nova inscrição nunca é um destino automático desse acesso. Links anteriores com `callbackUrl=/pre-enrollments` continuam válidos. O login comum preserva o destino interno do portal.

A lista identifica o e-mail da sessão e mostra todas as solicitações vinculadas àquela conta. A API filtra por `applicantId` autenticado, sem consulta pública por e-mail. **Entrar com outro e-mail** encerra a sessão e retorna ao acesso de acompanhamento. Uma conta sem solicitações recebe orientação para conferir o e-mail do cadastro; filtros sem resultado mantêm mensagem distinta. Erros preservam os campos, permitem nova tentativa e não levam à inscrição. Testes: `pre-enrollment-access.test.tsx`, `pre-enrollment.test.ts`, `proxy.test.ts` e `scripts/test-pre-enrollment-access-local.mjs`.

Apresentação aprovada do login: card de 22 px, faixa móvel da marca, campos de 50 px com fonte de 16 px e ações de pelo menos 44 px. Mostrar/ocultar senha é um botão com nome acessível e estado pressionado; não envia o formulário. Recuperação de senha, matrícula, verificação de e-mail, mensagens de erro, bloqueio durante envio e destino interno após autenticação preservam seus fluxos. O tema público é restrito ao login e não grava preferências da conta.

Verificação adicional: `src/test/unit/pre-enrollment-schema.test.ts`, `src/test/unit/pre-enrollment-form.test.tsx`, `src/test/integration/pre-enrollment.test.ts` e `scripts/test-pre-enrollment-local.mjs`. O script HTTP usa dados fictícios exclusivos por execução e remove seus registros ao final.

Testes de autenticação, isolamento de conta, validação, corrida/versão, repetição, salvamento, erro, prévia e movimento em `src/test/integration/preferences.test.ts` e `src/test/unit/preferences-editor.test.tsx`. Revisar no Chrome desktop e largura móvel, teclado e temas. Auditoria estática restrita à funcionalidade; não substitui teste no navegador.
