---
version: alpha
name: Get Wise
description: Portal de uma escola de inglês, com navegação marinho e superfícies claras para estudar com calma.
colors:
  primary: "#16204E"
  accent: "#2A5CD6"
  background: "#F2F4FB"
  surface: "#FFFFFF"
  text: "#131A38"
  muted: "#646D96"
  border: "#E6E9F5"
  danger: "#D2382B"
typography:
  sans:
    fontFamily: "Hanken Grotesk, system-ui, sans-serif"
  mono:
    fontFamily: "Spline Sans Mono, ui-monospace, monospace"
rounded:
  sm: "10px"
  md: "16px"
  lg: "22px"
spacing:
  page: "32px"
  gap: "22px"
  card: "24px"
components:
  button: {}
  card: {}
  input: {}
  choices: {}
---

# Get Wise Design System

## Overview

O produto deve lembrar um caderno de estudo organizado: hierarquia clara, identidade marinho constante e espaço para leitura. O público é formado pelos alunos, professores e equipe de uma escola de inglês brasileira. A interface usa português do Brasil; exercícios e conversas podem usar inglês. O uso acontece tanto no computador quanto no celular.

O registro é de aplicativo. A assinatura das preferências é uma miniatura do próprio portal que mostra as escolhas do aluno. Evitar uma galeria de temas sem contexto, rebranding por tela, cores livres que prejudiquem a leitura e controles decorativos que aparentem funcionar.

**Propriedade dos tokens (modelo B):** `src/lib/theme.ts` é a fonte canônica dos temas e de `themeVars`. `src/app/globals.css` mantém os tokens de base e componentes `.gw-*`. Este documento espelha os valores padrão, sem gerar outra paleta. Contexto anterior: `FRONTEND_SPEC.md`, seção 2.

## Colors

O tema padrão usa os valores do frontmatter. Marinho Clássico, Azul Royal e Premium são definidos integralmente em `THEMES`. A cor de destaque aceita apenas `ACCENT_CHOICES`, evitando combinações arbitrárias com botões de texto branco. Cores semânticas de erro e sucesso não mudam com a escolha pessoal.

| Papel               | Fonte canônica              | Destino                                                      | Consumidores                |
| ------------------- | --------------------------- | ------------------------------------------------------------ | --------------------------- |
| Marca e superfícies | `THEMES` em `theme.ts`      | `themeVars` → variáveis `--brand`, `--bg`, `--card`, `--ink` | Shell, cards, Button        |
| Destaque            | `ACCENT_CHOICES`            | `--accent`, `--accent-soft`                                  | Botões, links, rádios, foco |
| Geometria           | `DENSITY`, `RADIUS_CHOICES` | `--pad`, `--gap`, `--card-pad`, `--r*`                       | Shell, formulário, prévia   |
| Rolagem             | `globals.css`               | `--scroll-thumb*`, `--scroll-track`                          | Todas as regiões roláveis   |

Contraste das opções de destaque é verificado nos testes de preferências. Tokens não são copiados para estilos independentes: a prévia também consome `themeVars`.

## Typography

Hanken Grotesk é a família de títulos e corpo já adotada no produto; Spline Sans Mono identifica legendas pequenas. Títulos usam pesos 700/800 e espaçamento ligeiramente fechado. Campos e explicações usam 12–14 px com entrelinha confortável; nomes longos quebram sem expandir a página. A interface não introduz uma segunda família de títulos para uma única função.

## Layout

Unidades e pré-matrículas administrativas seguem a organização da proposta aprovada: filtros dentro de card, identificação e contatos lado a lado no detalhe da unidade, tabela de solicitações no desktop e linhas empilhadas com rótulos no celular. `ReviewSection` mantém seções recolhíveis nativas; identificação, contatos e cursos começam abertos, informações complementares fechadas. Cores continuam herdadas do tema da conta. As alterações ficam restritas às novas áreas administrativas, preservando a apresentação pública e as demais telas.

Pré-matrícula, unidades e análise: acabamento aprovado com espaçamento compacto (20 px nos cards) e cantos de 22 px, restrito a `components/enrollment/enrollment.module.css`. As etapas ficam acima do formulário e os campos passam a uma coluna no celular. Até 800 px, campos usam 16 px e ações têm área de toque mínima de 44 px; rótulos longos quebram dentro do botão, inclusive nos diálogos. Os tokens de cor e fonte e as demais telas continuam compartilhados, sem alteração.

Preferências: formulário de largura flexível com prévia lateral; abaixo de 850 px, uma coluna com rolagem natural do documento. Não impor altura de viewport ao formulário. O shell e seu menu móvel continuam sendo compartilhados. As ações ficam no final do formulário, sem encobrir campos ou teclado.

## Elevation & Depth

Cards brancos, bordas suaves e separação por espaçamento. Manter a elevação sutil já existente em botões. A prévia usa o fundo do tema escolhido. O diálogo de saída usa o componente compartilhado `ui/AppDialog`, que gerencia foco, rolagem e limites da área visível.

## Shapes

Cantos padrão de 16 px, controles de 10 px e agrupamentos de 22 px. O aluno pode selecionar 10, 16 ou 22 px; os derivados vêm de `themeVars`. Amostras de cor são círculos; controles permanecem reconhecíveis como rádio, botão ou campo.

## Components

Login público: proposta aprovada com espaçamento confortável (30 px), card de 22 px e paleta Marinho de `themeVars(DEFAULT_PREFS)` aplicada apenas à superfície de login. Desktop tem painel institucional; até 700 px usa faixa compacta com a marca e formulário em uma coluna. Até 360 px o card reduz seu preenchimento para 22 × 18 px. Estilos pertencem a `app/(auth)/login/login.module.css`; não alteram preferências pessoais ou demais telas. Campos e botões continuam nos componentes compartilhados, com ícones e senha compacta opcionais.

`ui/Button` e `ui/Input` são os donos dos controles básicos. `PreferenceChoices` é o grupo de rádios para opções curtas, com rótulos visíveis e navegação nativa por teclado. O componente não é um dropdown. Feedback de salvamento é persistente na tela, com região viva; erros não dependem de toast.

Estados selecionado, hover, foco, desabilitado e ocupado são distinguíveis por texto/forma além da cor. Salvar não muda o tamanho do botão. Uma prévia visual não altera o aplicativo até o salvamento ser confirmado.

**Ícones:** Lucide, tamanho 18–24 px, sempre com nome acessível ou texto quando acionáveis.

**Movimento:** animações discretas. `data-motion=reduced` reduz movimento em todo o aplicativo. A Wise respeita a configuração do dispositivo e da conta; os ritmos são suave, ágil e imediato, definidos no componente compartilhado `TutorMessage`.

**Conteúdo:** português direto e acolhedor, com “Salvar preferências”, “Descartar alterações” e “Restaurar padrão”. Nenhuma escolha pessoal altera nível, presença, matrícula ou certificado.

## Do's and Don'ts

- Reusar os tokens, fontes e componentes existentes; preservar a identidade da escola.
- Nomear escolhas com palavras familiares e mostrar o estado salvo com clareza.
- Não oferecer uma opção que não tenha efeito real, nem esconder falhas de persistência.
- Não substituir o nome acadêmico pelo apelido nos registros oficiais.
