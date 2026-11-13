# UX Contract

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

| Capability | Canonical owner                                                   | Source of truth        | Allowed variants                      | Verification                                          |
| ---------- | ----------------------------------------------------------------- | ---------------------- | ------------------------------------- | ----------------------------------------------------- |
| Form       | `ui/Input`, `ui/Button`, `preferencesSchema`, `PreferencesEditor` | API e este contrato    | edição pessoal com prévia             | `preferences-editor.test.tsx` e Chrome                |
| Scrollbar  | `src/app/globals.css`                                             | `DESIGN.md`            | somente geometria específica          | inspeção de CSS e Chrome                              |
| CRUD       | `/api/me/prefs` e `PreferencesEditor`                             | conta real autenticada | leitura/edição/restauração reversível | `preferences.test.ts` e `preferences-editor.test.tsx` |

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

Testes de autenticação, isolamento de conta, validação, corrida/versão, repetição, salvamento, erro, prévia e movimento em `src/test/integration/preferences.test.ts` e `src/test/unit/preferences-editor.test.tsx`. Revisar no Chrome desktop e largura móvel, teclado e temas. Auditoria estática restrita à funcionalidade; não substitui teste no navegador.
