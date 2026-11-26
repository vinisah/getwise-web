# Pré-matrícula por CEP — contrato de revisão

Base: `b388865`. Frente isolada `codex/enrollment-cep`, sem publicação. Proposta aprovada: `get-wise-cep-proposta.html`, encaminhada pelo supervisor em 26/11/2026.

## Conferência independente da supervisão

A versão integrada em `codex/cep-supervisao` reúne a implementação do Código Geral e as correções de supervisão. A validação ocorreu em uma compilação local otimizada, com dados fictícios, PostgreSQL exclusivo e contas distintas para a família, a secretaria e a direção.

| Cenário conferido | Resultado observado |
| --- | --- |
| CEP e unidade local | Os CEPs 85960-002 e 85905-010 retornaram, respectivamente, Marechal Cândido Rondon e Toledo. Cada cidade ofereceu suas duas unidades abertas do cadastro de teste. O envio do formulário gerou protocolo para análise da secretaria. |
| Outra cidade | Foi possível pedir uma unidade específica com motivo, inclusive partindo de um município sem unidade. O protocolo ficou pendente, vinculado à família. A consulta usou o CEP do aluno menor, inclusive com o responsável residindo em outra cidade. |
| Decisão | A secretaria consultou o pedido. Só a direção designada e autenticada por senha pôde decidir. Tanto a aprovação quanto a recusa exigiram justificativa visível no acompanhamento. |
| Após a decisão | A aprovação permitiu retomar o formulário para o mesmo aluno, CEP e unidade. A recusa permitiu escolher uma unidade local, revisar e enviar a ficha no celular. Nenhuma decisão de exceção criou vaga, matrícula ou cobrança. |
| Alterações e indisponibilidade | A autorização não serviu para um irmão ou outra unidade. A tela preservou os dados após CEP inexistente ou indisponibilidade simulada do provedor. Quando não havia outra unidade aberta, foi possível voltar pelo teclado para as opções locais. |
| Ficha já aprovada antes da regra | A secretaria solicitou correção justificada. A família recuperou os dados e pediu análise para outra cidade. A tela geral de matrícula manteve a ficha vinculada durante a regularização. |
| Histórico | A ficha distinguiu uma recusa e um pedido que perdeu a validade, mesmo depois que a pré-matrícula seguiu pela unidade local. |

Na rodada geral, 505 testes passaram e 16 ficaram desabilitados pela configuração. Após a integração das correções, passaram os 29 testes específicos de CEP, interface, legado e PostgreSQL, além de seis testes de autenticação. Para executá-los no banco exclusivo da supervisão, apenas o nome permitido na trava do teste foi ajustado em uma cópia de revisão. A compilação Next.js de produção passou. Os roteiros independentes em Chrome usaram larguras de 320, 390 e 1280 pixels. A análise estática dos arquivos de aplicação alterados apontou as mesmas dez ocorrências de `any` já presentes em `auth.ts` na base.

A publicação e a designação de uma conta real de direção são etapas operacionais futuras.

## Fluxo e garantias

- O CEP é residencial **do aluno**, inclusive menor. O servidor consulta ViaCEP com limite de 6 segundos, valida a resposta e identifica município/UF e código IBGE; não usa prefixos. As unidades abertas do município aparecem juntas. Nomes de município são comparados sem acentos/espaços redundantes, sempre com UF. Fonte do contrato externo: [ViaCEP](https://viacep.com.br/).
- Outra cidade sempre exige pedido, havendo ou não unidade local. Antes da análise, são coletados identificação do aluno (nome, CPF, nascimento, CEP), unidade, motivo e conta de acesso. O responsável é titular para menores. Os demais dados continuam no formulário existente.
- O pedido pertence a uma pré-matrícula e a uma família; começa `PLACEMENT_PENDING`, sem curso obrigatório, aluno acadêmico, vaga ou matrícula. Recusa (`PLACEMENT_REJECTED`) mantém a justificativa e permite edição. Aprovação (`PLACEMENT_AUTHORIZED`) permite retomar o formulário.
- Autorização é para aquele aluno, CPF/nome/nascimento, CEP/município, unidade/município e solicitação. Não vale para irmão, outra unidade ou outra pré-matrícula. Novo pedido substitui a versão anterior. Decisões e edições usam comparação de versão e transação serializável.
- Envio completo volta a `PENDING` para a secretaria; aprovação acadêmica e efetivação continuam separadas. A efetivação registra `Enrollment.preEnrollmentId` único e revalida a localização/autorização.
- Fichas anteriores não são apagadas ou convertidas pela migração. Se o CEP antigo não puder ser consultado, a secretaria pode **Solicitar ajustes** sem consultar o provedor; a família corrige o endereço e reenvia ou pede exceção, preservando os outros dados. A interface identifica esse caminho nos legados. Não há autorização geográfica implícita para administradores.

## Direção e operação

`User.isSchoolDirector` começa falso para todas as contas, inclusive donos técnicos. Nenhuma API de usuários aceita conceder essa designação. Rebaixar a conta remove a designação.

Um operador autorizado, com credenciais de banco mantidas fora do aplicativo e allowlist explícita, executa:

```powershell
node scripts/designate-school-director.mjs grant DIRETOR_EMAIL --confirm=DIRETOR_EMAIL
node scripts/designate-school-director.mjs revoke DIRETOR_EMAIL --confirm=DIRETOR_EMAIL
```

O alvo precisa ser ADMIN ativo e ter acesso a pré-matrículas. O comando registra auditoria. Na decisão, a API verifica novamente a conta e seu perfil no banco, além de exigir autenticação por senha. Sessão de demonstração, sessão anterior sem origem de autenticação, professor e administrador não designado não decidem. A demonstração de visualização existente permanece intacta.

## Migração e verificação

Migração aditiva em `20261126010000_enrollment_cep`. O runner segue a convenção existente de allowlist, transação, lock e exclusão de previews Vercel. `vercel-build` a executa depois das migrações existentes. Builds de revisão usam apenas `next build --webpack`, sem executar migrações de produção.

Banco de revisão exclusivo: `getwise_cep_test` em loopback:55432. Testes reais exigem `RUN_CEP_DATABASE_TESTS=1`; fixture e cleanup usam identificadores próprios. Nenhum dado real é usado.

Resultados iniciais: 15 testes de consulta/domínio em PostgreSQL e 23 testes de formulário, autenticação e APIs existentes passaram. O fechamento das evidências está em `CEP-EVIDENCIAS.md`.

A regularização também aceita fichas **APPROVED** ainda não efetivadas: a secretaria solicita ajustes com motivo obrigatório, a família edita e o envio retorna à análise. Fichas **ENROLLED** não são reabertas por essa ação.
