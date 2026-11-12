# Revisão funcional da realocação de alunos

Data: 12/11/2026. Base revisada: `d7c3cac`, na cópia `student-feature`.

## Resultado

Foram encontradas e corrigidas falhas no ciclo de confirmação, ausência, seleção de vagas e atualização da agenda do professor. A revisão inicial foi validada localmente. A publicação foi autorizada posteriormente pelo usuário, preservando o login de demonstração e a pendência de ativação do WhatsApp.

O fluxo mantém a turma fixa e permite encontros adicionais do mesmo nível, dentro do período do curso. Justificar uma ausência altera apenas a reserva escolhida. Se não houver alternativa, os demais encontros continuam agendados. A ativação real do WhatsApp ficou fora desta execução, conforme solicitado.

## Falhas e correções

| Prioridade | Situação encontrada                                                                                                                                                                    | Correção                                                                                                                                                                                                       |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Alta       | Depois de recusar uma aula e reservar outra sobreposta, o aluno podia reconfirmar a primeira e ficar com dois compromissos simultâneos.                                                | Confirmação, remarcação e participação adicional verificam reservas ativas, inclusive aulas em andamento. Horários consecutivos continuam permitidos.                                                          |
| Alta       | A criação e a edição manual de aulas não aplicavam as mesmas verificações da realocação. Era possível exceder vagas ou criar conflitos para professor/alunos por essas rotas.          | As operações usam a mesma trava transacional da agenda, validam capacidade, professor ativo, nível dos participantes e conflitos. Alterar horário/duração solicita nova confirmação.                           |
| Alta       | A agenda aberta do professor não acompanhava automaticamente as respostas. A chamada mantinha sua lista inicial, mesmo recebendo uma lista nova.                                       | Atualização periódica a cada 30 segundos enquanto a tela está visível, ao voltar à janela e por botão. A chamada remove quem saiu, inclui quem entrou e preserva marcações ainda não salvas de quem permanece. |
| Média      | Um formulário antigo de presença podia gravar na reserva de um aluno que já havia saído daquela aula.                                                                                  | A gravação verifica reservas ativas dentro da transação. Havendo participante removido, retorna conflito e desfaz o lote para que a lista seja atualizada.                                                     |
| Média      | Reconfirmar uma aula ou voltar pelo botão Participar mantinha a justificativa de ausência antiga.                                                                                      | A confirmação limpa a justificativa incompatível com a participação.                                                                                                                                           |
| Média      | Uma reserva cancelada existente era ignorada na alocação em turma, porque já ocupava a chave única no banco.                                                                           | A alocação reativa a reserva cancelada, redefine confirmação e limpa dados da inscrição anterior.                                                                                                              |
| Média      | A confirmação não verificava alteração do nível do aluno; novas reservas podiam ser feitas com professor inativo.                                                                      | Os caminhos de confirmação e reserva validam nível e disponibilidade do professor. A listagem de alternativas também exclui professores inativos.                                                              |
| Média      | Horários digitados nos formulários antigos podiam ser interpretados no fuso do servidor, deslocando a aula em relação à agenda de Brasília.                                            | Cadastro, edição e preenchimento do formulário usam explicitamente o horário de Brasília. Datas impossíveis são recusadas.                                                                                     |
| Média      | Uma gravação bem-sucedida seguida de falha ao recarregar aparecia como falha da operação inteira, incentivando repetição.                                                              | A tela distingue gravação confirmada de falha de leitura, reflete a resposta salva e orienta atualizar a agenda. Falhas de conexão com resultado incerto são descritas como incertas.                          |
| Média      | Erros de remarcação ficavam atrás da janela aberta; uma vaga ocupada por outra pessoa continuava entre as alternativas.                                                                | Erros aparecem dentro da janela e a lista é consultada novamente após conflito. Há recuperação por Atualizar agenda, limitação de espera e proteção contra envio duplicado na mesma tela.                      |
| Baixa      | Aulas canceladas/concluídas ofereciam ações que a API recusaria; perfis administrativos restritos viam botões sem permissão.                                                           | Ações e mensagens refletem o estado da aula e as permissões retornadas pelo servidor. O filtro de dia é limpo ao abrir outra remarcação.                                                                       |
| Baixa      | Remarcar para uma aula já reservada podia consumir a remarcação sem criar um novo encontro; Participar em uma reserva existente podia retornar sucesso ainda com confirmação pendente. | A remarcação para reserva ativa é recusada. Participar confirma a reserva existente sem duplicar a inscrição nem contar a própria vaga como ocupação extra.                                                    |

## Validação

O formulário manual também ganhou o campo de capacidade que faltava e seleção de alunos do nível escolhido. Ele consulta a lista mínima de participantes autorizada para a agenda, evitando depender da permissão de acesso ao cadastro completo de alunos.

Cinco casos foram reproduzidos com falha antes das correções em PostgreSQL local: reconfirmação sobreposta, justificativa mantida nos dois caminhos de retorno, confirmação em nível incompatível e reserva com professor inativo.

Depois das correções, os 10 testes com PostgreSQL real passaram. Eles cobrem também concorrência pela última vaga, reativação de reserva cancelada na alocação, preservação da turma fixa, repetição da remarcação, aula em andamento e ausência de duplicação. São usados apenas registros sintéticos, removidos ao final, com bloqueio explícito contra conexão a banco remoto.

Os testes de interface exercitam falha inicial de carregamento, gravação seguida de falha de leitura, erro dentro da janela, atualização das alternativas, ações indisponíveis e preservação da chamada durante mudanças de participantes. Testes de API verificam capacidade e conflitos na criação/edição manual, além da rejeição de chamadas desatualizadas.

Foram aprovados 386 testes, executados em três grupos para reduzir o consumo de memória da máquina:

- 367 testes de regras e APIs em ambiente Node; os 10 testes de banco ficam desabilitados nesse comando e são executados separadamente.
- 9 testes de interface em jsdom, incluindo os componentes da agenda, chamada, formulário manual e exibição administrativa.
- 10 testes com PostgreSQL real no banco local `getwise_feature`.

`tsc --noEmit` passou, assim como `git diff --check` nos arquivos desta revisão. As tentativas iniciais de executar toda a suíte em jsdom foram interrompidas por lentidão/limitação de recursos e não são contabilizadas como aprovação. A execução separada acima cobriu todos os arquivos de teste presentes naquele momento.

A compilação final `next build --webpack` também passou na mesma cópia, executada pelo agente do chat Design durante o trabalho visual paralelo. O log foi conferido: compilação, TypeScript, geração das 83 páginas e empacotamento concluídos. Esse agente também executou os 376 testes sem banco real com resultado aprovado. Os 10 testes de banco desta revisão completam o total de 386.

## Limites e entrega

A preparação da publicação parte de `97e1709` (produção atual, incluindo as melhorias do tutor), na cópia isolada `relocation-release`. As mudanças de design e cadastro público em andamento em outros chats não fazem parte deste conjunto. Não há alterações nos arquivos de login/autenticação, configuração da Meta, agendamento do WhatsApp ou variáveis de ambiente.

- Nenhuma alteração no login de demonstração.
- Nenhuma migração de esquema nem alteração no banco de produção.
- A atualização automática depende de conexão e ocorre por consultas periódicas; não é uma transmissão instantânea entre sessões.
- A validação de interface desta revisão usa componentes renderizados em ambiente de teste; não substitui uma homologação visual em produção.
- Não houve envio de WhatsApp. Conta empresarial, número, template aprovado, credenciais e validação do webhook/envio real continuam pendentes; os detalhes já estão em `docs/AGENDA-WHATSAPP.md`.
- As correções previnem novas inconsistências; não foi executada uma alteração retroativa de reservas ou horários em produção.
