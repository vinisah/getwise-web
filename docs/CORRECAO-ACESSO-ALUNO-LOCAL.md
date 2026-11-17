# Correção do acesso local ao aluno — 17/11/2026

## Causa

O servidor aberto na porta 3001 usava a pasta `.next` enquanto uma nova compilação substituía seu conteúdo. Os logs registraram ausência do manifesto de referências do cliente de `/student`, módulos de metadados e até da página de erro. O resultado no Chrome foi `Internal Server Error`.

## Correção

- O iniciador usado pelo BAT agora compila e executa em `.next-local`, com `GETWISE_LOCAL_RUNTIME=1`. Compilações comuns e produção continuam em `.next`.
- Um bloqueio de arquivo impede duas inicializações simultâneas pelo iniciador.
- O iniciador reconhece sua instância por pasta, PID e horário de criação, inclusive quando ela não responde. Pode recuperá-la sem encerrar processos desconhecidos.
- A porta é conferida novamente após a compilação. A verificação de disponibilidade exige que o processo iniciado seja o dono da porta, evitando registrar sucesso quando outro servidor ocupou o endereço durante a espera.
- A pasta de compilação local está ignorada pelo Git e seus tipos gerados foram incluídos na configuração do TypeScript.

## Verificação

- Compilação otimizada local e TypeScript concluídos.
- `node scripts/test-local-pages.mjs`: 12 páginas e 38 recursos estáticos com resposta HTTP 200. Inclui login, pré-matrícula, painel do aluno, agenda, aulas, cursos, exercícios, configurações, tutor e três páginas administrativas.
- O teste faz login local, muda para a visão de aluno e encerra sua própria sessão ao terminar. Não altera a sessão do Chrome.
- As mesmas páginas passaram enquanto outra compilação estava ativa em `.next`; o servidor continuou usando `.next-local`.
- Sintaxe do iniciador PowerShell validada.
- Tentativa de uma segunda inicialização com bloqueio já adquirido: impedida corretamente. PID registrado e processo dono da porta conferidos.

Para iniciar nesta máquina, use o BAT existente ou `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/start-local.ps1`. Para uma revisão de compilação, `next build --webpack` pode usar `.next` sem afetar essa instância. Evite iniciar outro servidor manualmente na porta 3001.

Esta correção trata da execução local. Nenhuma publicação na Vercel ou atualização remota do GitHub foi realizada. A avaliação visual e as pendências funcionais da pré-matrícula permanecem descritas no relatório correspondente.
