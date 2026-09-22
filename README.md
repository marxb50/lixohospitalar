# SELIM — Coleta Hospitalar

Interface web do controle de coleta hospitalar da Secretaria Municipal de Limpeza Urbana de Parnamirim.

## Estrutura

- `index.html`, `styles.css` e `app.js`: site publicado no GitHub Pages.
- `assets/`: identidade visual da Prefeitura de Parnamirim.
- `backend/`: código do Google Apps Script usado somente como conexão com a cópia da planilha do `marxb50`.

## Segurança dos dados

O backend aceita chamadas somente do domínio `https://marxb50.github.io` e grava na cópia da planilha do `marxb50`. O Apps Script e a planilha originais do `brasilbrazil` não são modificados.

## Teste visual local

Abra `index.html?demo=1` por um servidor HTTP local. O modo de demonstração usa dados fictícios e não salva nada.
