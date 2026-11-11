# Segurança e LGPD — Get Wise

Data de referência: 10/11/2026, America/Sao_Paulo.

## Situação

Revisão do código local, esquema Prisma, configurações, testes e dependências. As correções abaixo estão no workspace; não foram publicadas. Não houve teste de invasão no ambiente remoto, leitura de dados de produção, alteração do banco, envio de mensagens ou execução de pagamentos. A tela e o fluxo de login de demonstração ficaram fora do escopo, conforme solicitado.

Esta revisão melhora a proteção técnica, mas não representa certificação de conformidade LGPD. A adequação completa permanece pendente dos itens de negócio e das correções técnicas listadas abaixo.

## Correções aplicadas

| Prioridade | Fragilidade confirmada no código | Correção local |
| --- | --- | --- |
| Alta | Administradores com perfil restrito podiam chamar APIs de outras seções | `requireAdmin` exige a seção autorizada; rotas mistas também verificam seções para administradores. Financeiro, alunos, funcionários, folha, cobranças, cursos, aulas e exportações foram vinculados às respectivas permissões. |
| Alta | Gestão de usuários/perfis permitia ao administrador delegado conceder privilégios maiores, inclusive remover seu próprio perfil | Escritas de usuários/perfis e uso de preview exigem dono. Perfis com a seção `users` podem consultar as listagens, mas não conceder privilégios nem redefinir senhas. |
| Alta | Cookie de preview podia contornar limites de um perfil administrativo | A resolução do usuário efetivo ignora preview em administradores com perfil restrito, mesmo com cookie manual ou antigo. |
| Alta | Páginas confiavam em permissões antigas do JWT | Proxy consulta papel, atividade e perfil atuais no banco antes de liberar páginas protegidas. APIs continuam revalidando a sessão. |
| Alta | Busca global de administrador ignorava limites do perfil | As consultas a alunos, funcionários, aulas, planos e cursos só ocorrem nas seções permitidas. |
| Alta | Listagem de aulas devolvia participantes completos, reservas de colegas e gabaritos | Aluno recebe somente sua reserva; participantes são selecionados por campos mínimos; notas internas, gabaritos e explicações são omitidos para alunos. E-mail foi retirado da listagem de professores. |
| Média | Ausência de defesa explícita de origem em escritas autenticadas por cookie | Wrapper de APIs e upload rejeitam origem externa e escrita por cookie sem origem verificável. Webhooks sem cookie mantêm autenticação própria. GET de geração de cobranças exige credencial do cron; disparo manual usa POST. |
| Média | Erros e modo sem SMTP podiam expor dados/links de recuperação em logs | Respostas inesperadas são genéricas também em desenvolvimento; logs dessas rotas usam somente classe de erro. Sem SMTP, o envio falha sem imprimir destinatário/token; recuperação preserva resposta genérica. |
| Média | Auditoria aceitava conteúdo arbitrário | Lista permitida de metadados escalares descarta credenciais, contatos, objetos e texto livre. Registros antigos não foram apagados nem saneados. |
| Média | Respostas privadas sem política explícita de cache; CSP apenas observacional | APIs recebem `private, no-store`; CSP básica passa a bloquear objetos, alteração da base, enquadramento e formulários externos. Referer é suprimido. CSP completa de scripts permanece em Report-Only. |
| Operacional | Cliente de IA era criado durante importação e impedia build sem chave | Cliente passa a ser criado por requisição; sem chave a rota responde 503, sem simular integração. |

Rotas públicas de certificados continuam públicas. Autenticação do webhook Asaas e cron não foram removidas. Uploads de vídeo permanecem compatíveis com o armazenamento atual.

## Dependências — prioridade técnica urgente

A consulta ao endpoint oficial npm de avisos em lote, usando as versões de produção do `package-lock.json`, retornou **109 avisos em 18 pacotes**: 7 críticos, 36 altos, 58 moderados e 8 baixos. Foram consultados 210 nomes de pacote. Evidência completa: [dependency-advisories.json](dependency-advisories.json).

Esses números representam avisos de dependências, não 109 explorações demonstradas no Get Wise. Algumas condições podem não existir no produto; a triagem deve verificar uso e alcance de cada pacote.

Priorizar `next` 16.2.7, `next-auth` 4.24.14, `@auth/core` 0.41.2, `nodemailer` 7.0.13, `sharp` 0.34.5 e `zod` 4.4.3. O resultado inclui avisos de execução de código e bypass de proxy no framework. As correções desta revisão **não corrigem essas dependências**.

A atualização não foi executada nesta entrega: `node_modules` é uma junction para outra cópia do sistema (`Sistema Get Wise ( não apagar )`). Preparar instalação isolada, atualizar manifesto/lockfile com versões corrigidas e validar compatibilidade, especialmente Next/React/NextAuth/Prisma. Não executar atualização forçada na pasta compartilhada. Reconsultar os avisos após o upgrade e validar o deploy.

## Outras pendências técnicas

1. **Direitos dos titulares:** implementar canal autenticado e protocolado para acesso, correção, oposição e pedidos de eliminação; exportar somente dados da identidade real, com autorização e auditoria. Não eliminar em cascata registros fiscais/contratuais sem análise de retenção.
2. **Retenção:** definir períodos por finalidade e implementar expiração de conversas de IA, tokens vencidos, notificações, logs e backups. Hoje não há rotina abrangente de descarte. Registro de incidente tem regra própria; não confundir com todos os logs do produto.
3. **IA e fornecedores:** o tutor armazena texto livre e envia histórico à Groq. Validar contrato, localização, transferência internacional, retenção e aviso ao usuário. Fazer o mesmo para Vercel/Blob, PostgreSQL hospedado, SMTP, Upstash e Asaas. WhatsApp ainda está sendo desenvolvido em trabalho separado.
4. **Recuperação de senha:** tokens ainda são persistidos em texto recuperável; aplicar hash, consumo atômico e invalidação de sessões depois de troca de senha. Revisar a enumeração no cadastro público. A tela de login foi excluída, mas estes fluxos de conta precisarão de revisão específica.
5. **Limites de requisição:** proxy verifica Content-Length, o que não basta para limitar corpo sem esse header. Implementar leitura limitada de streams e limites de coleções antes de validações caras. Confirmar limiter distribuído em produção; fallback em memória não limita múltiplas instâncias. Validar confiança nos headers de IP do provedor.
6. **Arquivos e conteúdo público:** vídeos/links do Blob são públicos; não armazenar documentos pessoais ou gravações privadas assim. Definir storage privado e URLs temporárias quando necessário. Revisar divulgação do nome completo no verificador público de certificados.
7. **Infraestrutura:** verificar TLS de banco, backups criptografados, restauração, rotação de segredos, MFA nas contas de infraestrutura, acesso mínimo, ambientes separados e monitoramento. Nenhuma dessas condições foi confirmada no painel de produção.
8. **Auditoria e controles de navegador:** definir alertas para falha de auditoria, completar registro de leituras/exportações e revisar logs legados. Implantar CSP de scripts com nonce e testar todos os embeds. Revalidar permissões no ponto de acesso aos dados das páginas para reduzir dependência do proxy.
9. **Validação publicada:** realizar testes com dono, perfis restritos, professor e aluno, incluindo cookies antigos e chamadas diretas. Medir o custo da nova revalidação de páginas. Os testes automatizados desta entrega usam mocks e não substituem essa validação.

## Inventário inicial de dados

| Processo | Dados identificados no código | Acesso/finalidade a confirmar |
| --- | --- | --- |
| Cadastro e ensino | Nome, e-mail, telefone, nascimento, CPF, endereço, contato de emergência, notas, nível e progresso | Secretaria e equipe pedagógica, conforme necessidade; reduzir campos opcionais e texto livre |
| Aulas e avaliações | Agenda, presença, comentários, respostas, notas e certificados | Aluno sobre seus dados; professor nas aulas atribuídas; administradores autorizados |
| Cobrança e contratação | Matrícula, contrato, valores, vencimentos, links de cobrança, comprovantes | Financeiro/cobranças; retenção fiscal/contratual a definir |
| Funcionários e folha | Nome, CPF, contatos, salário, dependentes, contrato e pagamentos | RH/folha, com perfis próprios |
| Tutor de IA | Mensagens e histórico de conversa | Titular e fornecedor de IA; risco de inserção de dados sensíveis em texto livre |
| Segurança | Identificador do usuário, ações, IP, tokens e metadados | Acesso restrito; finalidade, prazo e monitoramento a documentar |

CPF, salário e dados de contato exigem proteção, embora não sejam automaticamente “dados pessoais sensíveis” na classificação legal. Campos livres podem conter saúde ou outras informações que exigem tratamento específico. Não foram inspecionados registros reais.

## Lista numerada para o responsável reunir depois

1. **Razão social, CNPJ e endereço da escola**, identificando a pessoa jurídica responsável pelos dados.
2. **E-mail de privacidade** que efetivamente receberá solicitações e **nome do responsável** por atender e encaminhar os pedidos.
3. **Atendimento a menores de idade:** se haverá menores, faixas etárias, vínculo com responsáveis e como esse vínculo será verificado.
4. **Finalidades e necessidade dos cadastros:** por que são necessários CPF, nascimento, endereço, contato de emergência e observações; quais campos podem ser dispensados.
5. **Prazos de conservação** de cadastros, contratos, cobrança, folha, gravações, conversas de IA e backups, com apoio administrativo/contábil/jurídico quando aplicável.
6. **Fornecedores contratados e respectivos responsáveis:** hospedagem, banco, e-mail, cobrança, IA, WhatsApp, armazenamento e suporte; reunir contratos e informações sobre uso/localização dos dados.
7. **Matriz de acesso:** nomes/cargos e quais áreas cada pessoa precisa consultar ou alterar; identificar quem ficará com acesso de dono.
8. **Resposta a incidentes e atendimento:** quem decide, quem executa, contato alternativo e como acompanhar os pedidos dos titulares.

Não enviar senhas, tokens de API, credenciais de banco ou documentos pessoais nesta lista.

## Referências para a etapa de adequação

A LGPD exige finalidade, necessidade, transparência e segurança; assegura direitos ao titular e contém regras específicas para crianças e adolescentes. A base legal deve corresponder a cada finalidade, sem usar consentimento genérico para todas as operações. Validar aviso de privacidade, atendimento, compartilhamentos e retenção com a operação da escola. [Texto atualizado da LGPD — Câmara dos Deputados](https://www2.camara.leg.br/legin/fed/lei/2018/lei-13709-14-agosto-2018-787077-normaatualizada-pl.html).

Incidentes com risco ou dano relevante exigem avaliação de comunicação. A regra geral de comunicação à ANPD e titulares é de três dias úteis, ressalvadas regras específicas e condições aplicáveis; o registro de incidentes deve ser mantido por pelo menos cinco anos. Confirmar eventual enquadramento de pequeno porte antes de aplicar exceções. [Orientações oficiais da ANPD](https://www.gov.br/anpd/pt-br/canais_atendimento/agente-de-tratamento/comunicado-de-incidente-de-seguranca-cis), [Regulamento de Comunicação de Incidente](https://bibliotecadigital.mj.gov.br/bitstream/1/12879/2/RES_ANPD_2024_15.html).

## Validação local

- 347 testes passaram, incluindo 20 novas verificações de autorização, preview, minimização, CSRF, logs e SMTP.
- Compilação de produção com webpack aprovada, sem chave fictícia de IA. Checagem TypeScript final (`tsc --noEmit`) aprovada.
- Login de demonstração preservado. Nenhuma migration, remoção de dados ou publicação executada.
- Arquivos da integração WhatsApp de outro agente foram preservados.
