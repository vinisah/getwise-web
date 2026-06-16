# Como verificar antes de subir uma mudança

**Regra de ouro:** antes de publicar qualquer mudança, rode o verificador. Se ele disser FALHOU, o código tem problema — não suba.

1. **Dê 2 cliques em `verificar.bat`** (está na pasta `web`). Ele checa, em ordem: erros de tipo, testes automáticos, estilo (lint) e formatação.
2. Se aparecer **"TUDO OK"** no final, pode subir com tranquilidade — a máquina não achou bug do tipo que ela pega.
3. Se aparecer **"FALHOU em: TIPOS"** ou **"FALHOU em: TESTES"**, tem bug de verdade: **não suba** e mostre a mensagem ao Claude/dev.
4. Os **"AVISO"** de lint/formatação **não travam** — são melhorias de estilo, dá pra subir mesmo assim (vamos limpando aos poucos).
5. Quando for fazer um commit no Git, um verificador automático (husky) ainda formata os arquivos alterados e bloqueia segredos/arquivos gigantes por engano.
