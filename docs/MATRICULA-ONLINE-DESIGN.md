# Matrícula online e gestão de unidades

Roteiro funcional para frontend e design. Decisões confirmadas em 17/11/2026. As rotas novas e a organização das telas abaixo são propostas de implementação; este documento não representa funcionalidades já publicadas.

## Regras confirmadas

- O link **Fazer matrícula online** parte da tela de login.
- O envio completo gera uma **pré-matrícula para análise da secretaria**.
- A unidade é selecionada entre as unidades disponíveis cadastradas pelo administrador.
- A unidade inicial será **Get Wise Marechal**, usando os dados dos prints.
- O campo **Cidade** do formulário do aluno será substituído por **Curso**.
- Os cursos vêm do cadastro administrativo de cursos e são filtrados pela unidade escolhida.
- Para menores de 18 anos, o acesso usa o e-mail do responsável.
- O responsável informa os mesmos dados cadastrais do formulário, identificados como dados do responsável.
- As perguntas sobre alergias, saúde e necessidades de aprendizagem são respondidas **somente sobre o aluno**.

A substituição de Cidade por Curso se aplica ao formulário público do aluno. O cadastro administrativo da unidade mantém cidade e estado, como nos prints. Curso, unidade física, nível pedagógico, turma e plano financeiro continuam sendo conceitos separados.

## Fluxo proposto

Login → Início da matrícula → Ficha do aluno e responsável quando necessário → Revisão e acesso → Envio da pré-matrícula → Análise da secretaria → Efetivação pelo fluxo administrativo de matrícula.

O envio não deve declarar a matrícula efetivada nem disparar cobrança. A aprovação dos dados encaminha a secretaria para o fluxo existente de efetivação, onde a equipe define o plano e confirma as condições da matrícula. A alocação em nível e turma continua sob as regras pedagógicas do sistema.

## Mapa de telas para o frontend

São 15 frentes de interface, incluindo adaptações de telas existentes. Criar e editar podem compartilhar o mesmo formulário. As etapas do formulário público podem permanecer na rota `/register`; não precisam ser páginas independentes.

| ID  | Tela ou estado de desenho                     | Rota atual ou proposta                                                 | Conteúdo e ações                                                                                                                                                                                                                   |
| --- | --------------------------------------------- | ---------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P01 | Login                                         | `/login`, existente                                                    | Entrada individual, recuperação de senha e link Fazer matrícula online. Prever estados de e-mail ainda não confirmado e acesso limitado ao acompanhamento da pré-matrícula.                                                        |
| P02 | Matrícula, etapa 1: início                    | `/register`, existente, a ampliar                                      | Seleção de unidade, nome completo e nascimento do aluno. Explicar o fluxo e identificar quando será necessário o responsável. Continuar e Já tenho conta.                                                                          |
| P03 | Matrícula, etapa 2: ficha completa            | `/register`, novo estado                                               | Campos dos prints, curso disponível na unidade e seções condicionais. Desenhar as variantes maior de idade e menor com responsável. Voltar preserva os dados.                                                                      |
| P04 | Revisão e dados de acesso                     | `/register`, novo estado                                               | Resumo editável por seção, unidade e curso escolhidos. E-mail e senha do aluno adulto ou do responsável pelo menor; reaproveitar o e-mail informado. Conta existente deve conseguir prosseguir autenticada.                        |
| P05 | Pré-matrícula enviada e confirmação de e-mail | `/register` e retorno da verificação, novos estados                    | Comprovante/protocolo, identificação da unidade, próxima etapa e orientação para confirmar o e-mail. Variantes de envio do e-mail, falha de envio, link expirado e reenvio. Nunca mostrar sucesso de e-mail quando o envio falhar. |
| P06 | Acompanhamento das próprias pré-matrículas    | `/pre-enrollments`, proposta                                           | Status e instruções da secretaria. Prever cartões identificando cada aluno quando o mesmo responsável representar irmãos. Sem acesso a solicitações de outras famílias.                                                            |
| A01 | Lista de unidades                             | `/admin/school-units`, proposta                                        | Busca, situação, nome, cidade/UF, contato, cadastro, detalhe e edição.                                                                                                                                                             |
| A02 | Cadastrar e editar unidade                    | `/admin/school-units/new` e `/admin/school-units/[id]/edit`, propostas | Formulário baseado no print de edição: identificação, endereço, contatos, situação, imagens, sócios e informações complementares. Salvar e cancelar.                                                                               |
| A03 | Detalhe da unidade                            | `/admin/school-units/[id]`, proposta                                   | Visão de leitura baseada no primeiro print, cursos oferecidos, contatos, imagens e dados administrativos. Editar e controlar disponibilidade.                                                                                      |
| A04 | Lista de cursos                               | `/admin/courses`, existente                                            | Acrescentar identificação das unidades em que cada curso é oferecido e sua disponibilidade para matrícula online.                                                                                                                  |
| A05 | Cadastro e edição de curso                    | `/admin/courses/new` e `/admin/courses/[id]`, existentes               | Acrescentar vínculo com uma ou mais unidades e disponibilidade para matrícula online. Preservar a gestão atual de módulos e conteúdos.                                                                                             |
| A06 | Fila de pré-matrículas                        | `/admin/pre-enrollments`, proposta                                     | Busca e filtros por unidade, curso, status e período. Identificar aluno, responsável quando houver e data de envio. Abrir solicitação.                                                                                             |
| A07 | Análise de uma pré-matrícula                  | `/admin/pre-enrollments/[id]`, proposta                                | Seções Aluno, Responsável, Unidade/curso e informações complementares. Saúde/aprendizagem separadas dos dados do responsável. Prever retorno para correção, decisão e encaminhamento à efetivação.                                 |
| A08 | Ficha administrativa do aluno                 | `/admin/students/[id]`, existente                                      | Incorporar os dados aprovados e o vínculo com responsável e unidade. Preservar histórico, progresso e nome acadêmico.                                                                                                              |
| A09 | Efetivação da matrícula                       | `/admin/enrollments/new`, existente                                    | Receber o aluno e a origem da pré-matrícula, exibir unidade/curso e manter a confirmação administrativa de plano e condições financeiras.                                                                                          |

O bloco de responsável em P03 é uma variante condicional da mesma etapa, não uma nova tela administrativa. Acompanhamento de vários filhos é uma proposta para suportar o uso do e-mail do responsável sem exigir e-mails artificiais para as crianças; o vínculo e a autorização precisam ser implementados explicitamente.

## Campos da ficha do aluno

| Grupo                  | Campos                                                                                                                                                                          |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Identificação          | Nome completo, CPF, nascimento, gênero e estado civil. Nome e nascimento informados na primeira etapa são reaproveitados e podem ser corrigidos.                                |
| Contexto pessoal       | Profissão e local de trabalho, escola ou universidade. Prever respostas compatíveis com crianças e estudantes.                                                                  |
| Matrícula              | Unidade escolhida, consultor que atendeu e curso. A seleção de curso ocupa a função solicitada no lugar do antigo campo Cidade.                                                 |
| Contato e endereço     | Telefone, e-mail, CEP, endereço, número e bairro. Endereço e número podem ter campos separados para facilitar a leitura.                                                        |
| Saúde e aprendizagem   | Tem alergia? Quando Sim, informar qual. Condição ou necessidade específica de aprendizagem/desenvolvimento, com descrição quando aplicável. Estas respostas pertencem ao aluno. |
| Conhecimento da escola | Como conheceu a escola e o que mais gostou até agora.                                                                                                                           |

O formulário deve identificar com clareza a quem pertence cada e-mail. Para menores, o e-mail usado na autenticação e nas instruções de acesso pertence ao responsável.

## Bloco de responsável

Exibir quando a data de nascimento indicar aluno menor de 18 anos. Repetir os campos pessoais, de contato e de endereço: nome completo, CPF, nascimento, gênero, estado civil, profissão, local de trabalho/escola/universidade, telefone, e-mail, CEP, endereço, número e bairro.

Unidade, curso e consultor pertencem à mesma solicitação de matrícula e aparecem em seu resumo; não criar escolhas independentes para o responsável. Não repetir alergias, diagnósticos ou necessidades de aprendizagem para o responsável. Como melhoria de clareza, prever indicação do vínculo com o aluno e a possibilidade de informar que o endereço é o mesmo.

Os campos de origem e opinião sobre a escola pertencem à solicitação e podem ser preenchidos pelo adulto que está realizando o cadastro. Não exigir respostas duplicadas sobre a mesma matrícula.

## Cadastro administrativo da unidade

- Identificação: código, CNPJ, razão social, nome fantasia, enquadramento e situação.
- Endereço: CEP, logradouro, número, complemento, bairro, estado e cidade.
- Contatos: telefone fixo, celular e e-mail.
- Imagens: logo e fotos da unidade.
- Sócios, como grupo repetível: nome, nascimento, documento e foto, conforme o print.
- Informações complementares.
- Cursos oferecidos, provenientes do cadastro de cursos. A associação deve ser a mesma exibida na edição do curso.

Situação e disponibilidade para novas matrículas precisam ser distinguíveis. Uma unidade ou curso indisponível não aparece como opção selecionável no formulário público. O histórico de solicitações antigas deve continuar identificando sua unidade e seu curso.

### Dados iniciais de Marechal

Transcrição dos prints fornecidos, para preparar o cadastro administrativo:

| Campo                  | Valor                        |
| ---------------------- | ---------------------------- |
| Código                 | 15                           |
| Nome fantasia          | GET WISE MARECHAL            |
| Razão social           | JM LANGE & CIA LTDA          |
| CNPJ                   | 17.378.062/0001-34           |
| CEP                    | 85960-000                    |
| Logradouro             | Rua Independência            |
| Número                 | 1460                         |
| Bairro                 | Centro                       |
| Cidade/UF              | Marechal Cândido Rondon / PR |
| Telefone fixo          | (45) 3254-0789               |
| E-mail                 | mcr@getwise.com.br           |
| Situação no print      | Ativo                        |
| Enquadramento no print | MEI                          |

Complemento, celular, sócios, logo e fotos não têm valores preenchidos nos prints. Não inventar esses dados. Os cursos oferecidos em Marechal serão associados pelo administrador.

## Estados e comportamento a desenhar

- Carregamento, lista vazia e erro recuperável para unidades e cursos. Se a unidade não tiver cursos disponíveis, explicar e permitir voltar à escolha da unidade.
- Alterar a unidade invalida um curso que não seja oferecido nela, com explicação visível.
- Unidade ou curso indisponível entre o início e o envio: preservar o formulário e pedir nova escolha.
- Validação junto aos campos; preservar dados ao voltar; foco no primeiro erro; impedir envio repetido.
- Variantes de adulto, menor com responsável, conta já existente e responsável com mais de um aluno.
- CPF já informado e pré-matrícula já enviada: tratar a duplicação sem criar outro registro silenciosamente.
- Alergia negativa não exige descrição; perguntas condicionais não bloqueiam quando não se aplicam.
- Revisão permite corrigir cada seção. Avisar antes de abandonar alterações não enviadas.
- Saúde e dados de documentos não devem aparecer em listagens públicas, URLs, mensagens de erro, logs ou confirmação por e-mail.
- Desktop e celular, teclado, foco visível, estados de envio e retorno de falha. No celular, formulário em uma coluna e ações acessíveis com o teclado aberto.

## Direção visual

Usar os prints como referência de informação e organização. Manter a identidade já documentada em `DESIGN.md`: Get Wise em marinho, superfícies claras, tipografia e componentes existentes. O formulário deve ter etapas identificáveis, seções curtas e explicações tranquilas, sem rebranding nem reprodução da interface do Google Forms.

Reusar `ui/Button`, `ui/Input`, os componentes de seleção escolhidos para o projeto e `ui/AppDialog`. As telas administrativas seguem os padrões de busca, listagem, detalhe, criação e edição já adotados no sistema.

## Dependências identificadas no código

- `/register` e sua API recebem hoje somente nome, e-mail e senha. A API atual cria o usuário e faz alocação A1; esse efeito precisa sair do envio inicial de pré-matrícula e ser conciliado com a efetivação pela equipe.
- `Unit` no banco significa unidade de conteúdo didático. O cadastro de unidade física deve ter entidade própria, sem reutilizar esse modelo.
- `Course` já existe e precisa de associação com unidades físicas. O catálogo público deve expor somente dados necessários à seleção, sem tornar pública a API administrativa existente.
- `Enrollment` atualmente vincula aluno a plano. A pré-matrícula precisa de registro próprio para representar análise e dados ainda não aprovados.
- O login ainda funciona em modo de demonstração e autentica como administrador. O fluxo real precisa de autenticação individual e acesso próprio para aluno/responsável antes de receber inscrições reais.
- O e-mail é único em `User`. Vários filhos não podem ser representados criando contas duplicadas com o e-mail do responsável. É necessário um vínculo explícito entre conta e alunos representados.
- A gestão das novas seções e o acesso às informações de saúde devem entrar na matriz de permissões. A lista pública de unidades não deve expor dados de sócios ou documentos administrativos.

## Detalhes para fechar antes da implementação

- Origem da lista de consultores e se há uma ou várias pessoas por atendimento. O print usa caixas de seleção; a pergunta está no singular. Proposta: escolha única, com Secretaria, consultor configurado e Outro.
- Confirmar a obrigatoriedade dos campos complementares e as respostas Não se aplica para alunos pequenos. O mapa de telas não depende dessa decisão.
- Confirmar a abrangência de sócios e fotos no primeiro cadastro de unidades; a estrutura está prevista porque consta do print administrativo.
- Definir quais perfis internos podem consultar as respostas de saúde e quais decisões da secretaria exigem justificativa.

## Evidência e entrega desta etapa

Análise dos sete prints, do formulário e da API de cadastro, dos modelos de aluno, curso, conteúdo e matrícula, das telas administrativas e dos contratos visuais existentes. As decisões de pré-matrícula, filtro de cursos por unidade, acesso pelo responsável e saúde somente do aluno foram confirmadas pelo usuário.

Este roteiro foi aprovado e implementado localmente em 17/11/2026. Marechal foi cadastrada no banco local e associada aos cursos ativos existentes. A produção permanece sem publicação desta funcionalidade. A entrega e as verificações estão em `PRE-MATRICULA-ENTREGA-LOCAL.md`.
