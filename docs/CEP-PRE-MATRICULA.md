# Pré-matrícula por CEP — contrato de revisão

Base: `b388865`. Frente isolada `codex/enrollment-cep`, sem publicação. Proposta aprovada: `get-wise-cep-proposta.html`, encaminhada pelo supervisor em 26/11/2026.

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
