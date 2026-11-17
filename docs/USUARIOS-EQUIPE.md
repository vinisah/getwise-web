# Usuários da equipe interna

Decisão do usuário em 17/11/2026: a área **Usuários** gerencia somente acessos internos. Alunos e responsáveis têm cadastros separados.

## Regra e comportamento

- `ADMIN` e `TEACHER` compõem a equipe. Secretaria, Comercial, Coordenação e Financeiro continuam como perfis de acesso de contas administrativas. Não foi criado um novo papel nem alterado o vínculo de funcionários na folha de pagamento.
- `STUDENT` permanece em **Alunos**. `APPLICANT`, usado por candidatos e responsáveis, permanece no acompanhamento e na análise de **Pré-matrículas**.
- Nenhum cadastro é excluído, migrado ou desativado por esta separação.
- Tela e API compartilham a consulta em `src/lib/staff-users.ts`. Totais e desativados contam somente a equipe. Páginas de 20 registros, ordenação estável e página na URL; valores inválidos voltam à primeira e valores além do fim são limitados à última.
- `GET /api/users?page=1` preserva a resposta em array. Headers `X-Total-Count`, `X-Page` e `X-Page-Size` informam a paginação.
- `PATCH /api/users/[id]` aceita somente contas e papéis internos. Não converte alunos/responsáveis em funcionários nem funcionários em alunos. Os fluxos acadêmicos permanecem nas áreas próprias.
- A permissão existente é mantida: a seção `users` permite consulta; somente o dono pode alterar privilégios, situação ou senha. Controles de edição ficam ausentes na consulta delegada.
- Alterações continuam na lista e atualizam o estado salvo. Em erro, o papel salvo permanece selecionado e a tentativa pode ser repetida. A senha temporária é oculta por padrão, com opção de mostrar e validação própria.

## Mapa de interface

Português do Brasil, identidade e tokens de `DESIGN.md`, `theme.ts` e `globals.css`. A lista conserva `gw-table`, `Card`, `Badge`, `Avatar` e `ui/Button`. Sem mudança de tema, tipografia ou shell. A rolagem horizontal pertence à tabela, acessível por teclado; a página mantém altura natural.

| Capability     | Canonical owner                                         | Source of truth                            | Allowed variants                     | Verification                       |
| -------------- | ------------------------------------------------------- | ------------------------------------------ | ------------------------------------ | ---------------------------------- |
| Form           | `ui/Input`, `ui/Label`, `ui/Button`, `UpdateUserSchema` | Schema e API                               | senha temporária inline              | testes de ações                    |
| Select/Listbox | Controles nativos de `UserActions`                      | `STAFF_ROLES`, perfis cadastrados          | popup da plataforma; edição imediata | testes de opções, falha e gravação |
| Scrollbar      | `src/app/globals.css`                                   | `DESIGN.md`                                | região horizontal da tabela          | inspeção da página                 |
| CRUD           | `listStaffUsers`, APIs de usuários, `UserActions`       | decisão do usuário e permissões existentes | consulta delegada; edição do dono    | testes de isolamento e API         |

Não há seleção múltipla, data editável ou toast neste fluxo. Datas são somente leitura no formato já usado pela aplicação.

## Verificação

Testes de isolamento da listagem, contadores, paginação, perfis internos, permissões, tentativas de edição de alunos/responsáveis, opções do seletor, falha de rede, senha e estado de gravação em `staff-users.test.tsx`, `staff-user-actions.test.tsx` e `admin-controls.test.ts`.

Resultados da entrega local:

- Suíte completa: 462 testes aprovados; 10 testes de banco preexistentes ignorados pela configuração (59 arquivos aprovados e 2 ignorados).
- TypeScript, ESLint dos arquivos de execução alterados, formatação e compilação otimizada aprovados.
- Consulta HTTP confrontada com PostgreSQL local: somente as 2 contas internas foram listadas. As 3 contas externas continuaram no banco e fora da listagem da equipe.
- Chrome instalado nesta máquina, em sessão automatizada separada: larguras 1280, 390 e 320 px, sem transbordamento da página; tabela com rolagem horizontal própria. Seletor de papel, navegação para Alunos e para Pré-matrículas, capturas desktop/celular e ausência de erros JavaScript conferidos. Capturas em `%LOCALAPPDATA%/GetWise/reports/users-team`.
- Após o encerramento de uma compilação concorrente e a recuperação da instância, o teste HTTP de regressão passou nas 12 páginas de login, matrícula, aluno e administração, incluindo 38 arquivos estáticos.
- Auditoria estática com `docs/users-ui.json`: nenhum responsável canônico não resolvido. O analisador marcou quatro `Button asChild` como botões sem ação; o componente usa Radix Slot e renderiza links reais com destino. Os links de separação foram exercitados no Chrome. A auditoria padrão também mantém seis ocorrências equivalentes nas telas anteriores; esses resultados não são tratados como conformidade geral do produto.

Versão disponível somente no ambiente local para avaliação. Nenhuma publicação na Vercel, push para GitHub ou exclusão de contas foi realizada nesta entrega.
