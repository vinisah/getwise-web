# Evidências da implementação de CEP

Entrega de Código Geral ao supervisor Busca de Bugs, 26/11/2026. Sem publicação e sem dados reais.

## Versões e isolamento

- Base: `b388865` (acesso à pré-matrícula por e-mail e senha).
- Implementação: `8fced17b67919031fd9efed4f5f22f52643991ab`.
- Correções e testes ampliados: `529c5dc8bfa93c5f888547cba08d954a349d51c7`.
- Worktree: `enrollment-cep`; branch: `codex/enrollment-cep`.
- Banco exclusivo: `getwise_cep_test`, em `127.0.0.1:55432`. Runtime de revisão: `http://127.0.0.1:3006`.
- O diff final de schema contra a base tem 27 adições e 2 remoções, sem reformatação geral.
- O trabalho anterior de desempenho continua preservado em `performance-fixes`; não integra estes commits.

## Verificações concluídas

| Verificação                                                                                        | Resultado observado                                                                                                                                                  |
| -------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Consulta real de CEP e regras iniciais em PostgreSQL                                               | 15 testes passaram: 9 de consulta e 6 de fluxo inicial.                                                                                                              |
| Formulário, falhas de consulta, autenticação e APIs existentes                                     | 23 testes passaram em 4 arquivos.                                                                                                                                    |
| Matriz ampliada de CEP/legado/decisão, mais interface da regularização                             | 13 testes passaram em 2 arquivos: 11 em PostgreSQL e 2 de interface.                                                                                                 |
| Origem da autenticação, incluindo administrador escolhido pelo modo demo já designado como diretor | 6 testes passaram; a origem demo permanece no JWT e na sessão.                                                                                                       |
| Migração aplicada duas vezes em schema transacional isolado                                        | Ficha antiga, curso, dados e matrícula preservados; direção inicia falsa; campos novos são aditivos.                                                                 |
| Typecheck                                                                                          | Passou, inclusive durante o build estável.                                                                                                                           |
| Build estável local                                                                                | Passou: webpack, TypeScript e 96 páginas estáticas. Usou as fontes reais em cache, conforme ressalva abaixo.                                                         |
| Chrome instalado, em runtime estável                                                               | 13 verificações passaram; 9 capturas, desktop 1366 px e celular 320 px, sem exceção JavaScript da página e sem overflow horizontal.                                  |
| Lint dos arquivos alterados                                                                        | Nenhum erro novo. Restam os mesmos 10 `no-explicit-any` de `auth.ts` existentes na base; demais arquivos alterados sem erro. Comparação em `cep-lint-baseline.json`. |

As rodadas acima se sobrepõem; seus totais não devem ser somados como casos únicos. A suíte geral adicional foi iniciada, mas encerrada sem resultado completo depois da conferência específica e da integração pelo supervisor. **Não é declarada aprovada.**

A matriz de PostgreSQL verifica os dois sentidos Marechal/Toledo, unidades locais múltiplas, menor com conta do responsável, pendência sem matrícula, isolamento da família, justificativa obrigatória, secretaria/dono/professor/diretor restrito sem decisão, demo sem decisão, concorrência, recusa e edição, alteração de CEP, autorização sem extensão ao irmão ou outra pré-matrícula, retorno local com invalidação, retomada, vínculo único da efetivação e unidade fechada. O legado cobre PENDING e APPROVED com CEP inválido, além de APPROVED com município incompatível; a mensagem da secretaria é obrigatória e os dados são preservados.

## Chrome e reprodução

Evidências em `cep-browser/result.json` e `cep-browser/*.png`. A consulta no roteiro do navegador foi real, pelo servidor, ao ViaCEP. O script testa teclado, pedido para outra cidade, acompanhamento, contas distintas de secretaria/direção, confirmação sem promessa de matrícula e retomada com o e-mail do responsável preservado.

```powershell
node scripts/seed-cep-review.mjs
node scripts/designate-school-director.mjs grant direcao.cep@example.invalid --confirm=direcao.cep@example.invalid
node scripts/verify-cep-browser.mjs
```

Contas **fictícias e exclusivas do banco de revisão**: `direcao.cep@example.invalid`, `secretaria.cep@example.invalid` e `operador.cep@example.invalid`. Senha local: `RevisaoLocal!2026`. Somente a primeira recebe a designação operacional explícita. O seed recusa qualquer outro banco.

O formulário da família gerado pelo roteiro permanece no banco de revisão, identificado em `cep-browser/result.json`, para inspeção. Nenhum e-mail real ou provedor de cobrança foi utilizado.

## Limites e encaminhamento

O build comum ficou retido no download do Google Fonts (`connect ETIMEDOUT`). Para a verificação local, um adaptador temporário não versionado usou **bytes reais** de Hanken Grotesk e Spline Sans Mono de um build local existente. O adaptador `NEXT_FONT_GOOGLE_MOCKED_RESPONSES` foi aplicado somente ao processo de revisão. Layout, `.env` e `vercel-build` não foram modificados para usar esse adaptador. A compilação da aplicação passou; o download externo das fontes não foi validado nesta rodada.

O auditor estático da skill retorna 11 ocorrências de “botão sem ação”. Todas foram inspecionadas: são `Button asChild` com `Link`, portanto links funcionais, inclusive os usados no roteiro Chrome. Não é apresentado como auditoria estrita com zero apontamentos. Os logs, o adaptador temporário e os JSON brutos de auditoria/lint ficaram somente no ambiente local, em `%LOCALAPPDATA%/GetWise/cep-code-evidence-529c5dc`.

Durante HMR houve falha transitória de JSON/manifesto na rota de autenticação. O problema não se repetiu no runtime estável: login, autorização e retomada concluíram. As capturas finais são desse runtime.

Busca de Bugs assumiu e integrou em `codex/cep-supervisao` os estados complementares do histórico/ausência de alternativa e a proteção da efetivação manual durante regularização aberta. Esses ajustes pertencem à entrega consolidada do supervisor, não a esta worktree. Ele informou aprovação do build, de 29 testes específicos e dos roteiros independentes no Chrome. A versão consolidada é a referência para a aprovação final; os registros locais acima documentam somente as verificações executadas por Código Geral.
