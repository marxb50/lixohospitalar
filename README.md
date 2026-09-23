# SELIM — Coleta Hospitalar

Interface web do controle de coleta hospitalar da Secretaria Municipal de Limpeza Urbana de Parnamirim.

## Estrutura

- `index.html`, `styles.css` e `app.js`: site publicado no GitHub Pages.
- `assets/`: identidade visual da Prefeitura de Parnamirim.
- `backend/`: código do Google Apps Script usado somente como conexão com a cópia da planilha do `marxb50`.

## Segurança dos dados

O backend aceita chamadas somente do domínio `https://marxb50.github.io` e grava na cópia da planilha do `marxb50`. O Apps Script e a planilha originais do `brasilbrazil` não são modificados.

Os relatórios visual, geral, PDF e DOC são protegidos por senha. Na primeira configuração,
o proprietário deve criar nas propriedades privadas do Apps Script a propriedade
`REPORT_PASSWORD_INITIAL`; no primeiro acesso correto ela é convertida automaticamente
em hash com salt e a senha em texto é apagada. A senha nunca fica no GitHub.

## Significado dos registros

`S` confirma uma coleta naquela unidade e data. `N` significa apenas que não houve coleta naquela data; unidades como cemitérios podem ser atendidas em outra segunda, quarta ou sexta. Por isso, os relatórios não calculam taxa de sucesso usando `S / (S + N)`. Eles mostram coletas confirmadas, unidades atendidas, dias com coleta, a média por dia de roteiro e as marcações `N` separadamente.

O principal indicador do relatório é o peso líquido do caminhão, lido das observações por data. Ele não é atribuído a uma unidade específica. O total soma somente os dias em que um peso foi identificado. Grafias antigas como `gk` ou `km` em uma anotação de peso são interpretadas como kg e sinalizadas para conferência. O backend também lê observações legadas sem ano de outubro a dezembro de 2025 e de janeiro a fevereiro de 2026.

## Teste visual local

Abra `index.html?demo=1` por um servidor HTTP local. O modo de demonstração usa dados fictícios e não salva nada.
