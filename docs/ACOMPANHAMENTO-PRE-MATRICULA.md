# Acompanhamento de pré-matrícula — 26/11/2026

O login oferece **Acompanhar pré-matrícula**, separado de **Fazer matrícula online**. O acompanhamento usa o e-mail e a senha criados no cadastro, conforme a escolha do usuário. Para menores de 18 anos, a conta é identificada pelo e-mail do responsável.

## Comportamento

- `/login?mode=pre-enrollment` apresenta o acesso específico e o botão **Consultar situação**.
- Após autenticar, a pessoa abre `/pre-enrollments`, ou o detalhe que tentou acessar antes do login. Nunca é encaminhada automaticamente ao formulário de inscrição.
- O comprovante de envio usa o mesmo acesso. Links antigos com `callbackUrl=/pre-enrollments` continuam funcionando.
- A lista mostra o e-mail da conta, as solicitações dos alunos vinculados, protocolos, situações e orientações da secretaria.
- **Entrar com outro e-mail** encerra a sessão e retorna ao acompanhamento. Uma conta sem solicitações recebe orientação para conferir o e-mail usado no cadastro, sem abrir uma nova inscrição automaticamente.
- O login comum continua atendendo às áreas de aluno, professor e administração. O acesso de avaliação administrativa permanece restrito ao ambiente local.

## Proteção dos dados

A consulta exige autenticação e usa o identificador da conta na sessão. Informar outro e-mail ou identificador na URL não permite consultar outra família. E-mail e senha de login não são colocados na URL ou no armazenamento local. Destinos externos, o formulário de inscrição e caminhos que não pertencem ao portal não são aceitos como retorno de login.

Não há novas dependências, migrações ou consultas ao banco nesse acesso. A API de listagem reaproveita a sessão existente para acrescentar `accountEmail` à resposta da própria conta; a listagem administrativa mantém seu formato. O visual compartilhado do login permanece em `AccessShell`, com os mesmos tokens e componentes de campos e botões.

## Verificação

- 71 testes passaram nos sete arquivos: `pre-enrollment-access.test.tsx`, `pre-enrollment.test.ts`, `proxy.test.ts`, `pre-enrollment-auth.test.ts`, `preferences.test.ts`, `preferences-editor.test.tsx` e `pre-enrollment-form.test.tsx`.
- TypeScript, ESLint dos arquivos centrais alterados e compilação otimizada local passaram.
- `scripts/test-local-pages.mjs`: 12 páginas e 39 recursos estáticos responderam corretamente, incluindo a área do aluno.
- `scripts/test-pre-enrollment-access-local.mjs`: Chrome instalado, conta com irmãos, senha incorreta e nova tentativa, consulta e detalhe de outra família bloqueados, recarga de detalhe, troca de conta, estado vazio e falha de consulta com recuperação. Visualização em 1280, 390 e 320 px, sem rolagem horizontal ou erros JavaScript da página.
- O teste de navegador usa dados fictícios exclusivos no banco local `getwise_feature` e remove as contas, solicitações e registros de auditoria criados por ele. Não envia e-mails.
- A auditoria estática da interface foi executada. Seus apontamentos de botões sem ação correspondem a `Button asChild` com `Link` real; essa composição foi conferida no componente e no DOM. O auditor não reconhece a delegação do elemento pelo Radix Slot. Nenhum botão sem destino foi introduzido.

Capturas e resultados locais ficam em `%LOCALAPPDATA%/GetWise/reports/pre-enrollment-access`.

## Estado da entrega

Implementação disponível localmente para avaliação pelo login em `http://127.0.0.1:3001/login`. Publicação em produção e envio ao GitHub permanecem pendentes da avaliação desta versão. Este acompanhamento não depende de envio de link por e-mail; recuperação de senha e confirmação de e-mail mantêm suas configurações existentes.
