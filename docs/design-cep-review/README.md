# Conferência visual — CEP e acompanhamento

Base: `563ca38`, branch `codex/cep-design-review`, worktree isolada `cep-design-review`. Comparação com as propostas aprovadas `get-wise-cep-proposta.html` e `get-wise-revisao-celular.html` deste chat. Sem publicação por Design.

## Ajustes

- Formulário: resumo de aluno, conta de acesso, residência consultada, unidade e curso ao lado do formulário no computador e abaixo no celular. Usa os dados do formulário, sem nova consulta ou armazenamento. CEP alterado mostra consulta pendente no resumo.
- CEP: campo e consulta lado a lado no computador, empilhados no celular; opção de outra cidade com o botão outline existente; espaçamento consistente dos resultados.
- Acompanhamento da família: filtros agrupados em card, rótulo da conta separado do e-mail, nome e situação em blocos, protocolo e data rotulados, orientação identificada e acesso à solicitação com área de toque maior. O card inteiro continua sendo um único link, sem interação aninhada.
- Direção/família: espaçamento uniforme no card da exceção e ações empilhadas no celular. A justificativa, confirmação, permissões e estados permanecem os implementados pelo Código Geral.
- Mantidos o login por senha, tema da conta, campos obrigatórios, endpoints, validações, regras de localização e autorização, tabela administrativa e demais telas. O título institucional e a coleta de identidade na etapa inicial foram preservados conforme o fluxo existente, embora o protótipo apresente uma versão resumida dessas informações.

## Verificação

- TypeScript (`tsc --noEmit --incremental false`): passou.
- ESLint dos quatro componentes alterados e teste de acesso: passou.
- 33 testes em quatro arquivos: formulário de CEP, formulário de pré-matrícula, design administrativo e acesso. Primeira rodada: 32 passaram e a busca textual da conta falhou porque o rótulo e o e-mail foram separados em elementos. O teste foi adaptado para conferir ambos; os 20 testes do arquivo de acesso passaram na repetição. O roteiro de acesso local recebeu a mesma adaptação.
- Chrome: larguras de 320, 390 e 1280 px, sem overflow nas 12 capturas. Consulta real de CEP, unidades locais, pedido de outra cidade, login de família fictícia e acompanhamento autorizado usaram o banco de revisão da supervisão, somente para leitura e autenticação.
- Pendência, recusa, formulário da direção e falha de consulta foram conferidos com respostas interceptadas no navegador, reaproveitando dados fictícios. Nenhuma decisão foi gravada e nenhum e-mail foi enviado. O diálogo de confirmação foi aberto sem confirmar. Essas capturas validam apresentação; a validação de autorização no servidor pertence à supervisão.
- Nome preenchido foi preservado após indisponibilidade simulada da consulta. Nenhuma exceção JavaScript foi observada durante as conferências registradas em `checks.json`.
- Auditor estático da skill: 11 apontamentos `affordance.actionless-button`. Todos foram inspecionados: são `Button asChild` com `Link href` real, padrão existente que o scanner não reconhece. Resultado bruto em `static-audit.json`; não se declara auditoria estrita sem apontamentos.
- Build otimizado (`next build --webpack`): passou, incluindo TypeScript e 96 páginas estáticas. Executado na worktree isolada, sem migrações e sem adaptador de fontes. O primeiro processo foi interrompido durante a checagem de tipos; a repetição concluiu com exit 0.
- Prettier dos componentes, CSS, teste e roteiro alterados: conferidos e formatados. `git diff --check`: passou. A base da supervisão permaneceu em `563ca38` ao fechar esta entrega.

## Capturas

- [CEP no computador](cep-local-1280.png) e [celular de 320 px](cep-local-320.png).
- [Pedido de outra cidade](outra-cidade-390.png).
- [Acompanhamento no computador](acompanhamento-1280.png) e [celular](acompanhamento-390.png).
- [Autorização da família](autorizada-320.png).
- [Pendência simulada](pendente-simulado-320.png) e [recusa simulada](recusa-simulada-390.png).
- [Direção no computador](direcao-simulada-1280.png), [celular](direcao-simulada-320.png) e [confirmação](confirmacao-direcao-simulada-320.png).
- [Indisponibilidade simulada](erro-consulta-simulado-320.png).

## Encaminhamento

Integrar o commit de Design sobre a base consolidada e publicar apenas pela supervisão. A conta real de direção será definida separadamente. Não houve migração, dependência nova ou alteração de regra de negócio nesta revisão.
