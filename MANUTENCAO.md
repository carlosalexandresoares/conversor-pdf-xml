# Guia de manutenção

Este documento mostra onde alterar cada parte do sistema. Os comentários no código identificam os blocos principais; este mapa explica como eles se relacionam. A aplicação é local e usa Node.js, Express, SQLite e JavaScript no navegador.

## Caminho de um PDF

1. [index.html](./public/index.html) mostra o formulário e [app.js](./public/app.js) envia os arquivos, um por vez, para a API.
2. [upload.js](./upload.js) valida e armazena o PDF. [database.js](./database.js) mantém o registro e seus dados.
3. [processamento.js](./processamento.js) controla a fila e executa [leitor-worker.js](./leitor-worker.js) em outro processo, para uma leitura demorada não travar o servidor.
4. O leitor extrai o texto e monta, com [layout-documento.js](./layout-documento.js), um modelo de páginas e trechos com coordenadas tanto para PDF nativo quanto para OCR. [extrator-posicional.js](./extrator-posicional.js) associa rótulos e valores; nos layouts conhecidos, os adaptadores mantêm prioridade e as coordenadas confirmam a origem quando o valor coincide. [extrator-generico.js](./extrator-generico.js), [extrator-contexto.js](./extrator-contexto.js) e [layout-texto.js](./layout-texto.js) complementam a leitura por texto.
5. [revisao.js](./revisao.js) entrega os dados e recebe as alterações feitas na tela. [visualizar.js](./public/visualizar.js) desenha o PDF original na prévia.
6. [exportacao.js](./exportacao.js) monta o XML individual ou o ZIP a partir dos dados salvos.

## Interface

- [index.html](./public/index.html) define a estrutura da página. Os IDs são usados por [app.js](./public/app.js); antes de renomeá-los, atualize os seletores correspondentes.
- [app.js](./public/app.js) está dividido em blocos comentados: utilitários, biblioteca, importação, ações e revisão. Os campos da revisão vêm de [campos.json](./public/campos.json), não do HTML.
- [style.css](./public/style/style.css) reúne estilos globais, navegação, importação, biblioteca, revisão e regras responsivas, nessa ordem. Regras posteriores podem sobrescrever anteriores; confira os blocos `@media` ao alterar um seletor.
- [visualizar.html](./public/visualizar.html) e [visualizar.js](./public/visualizar.js) compõem a prévia do PDF e destacam a área de origem pedida pela revisão. A aba **Dados organizados** mostra os valores atuais da tela em JSON, inclusive alterações ainda não salvas.

## Servidor e dados

- [server.js](./server.js) configura as rotas HTTP e publica a pasta `public`.
- [database.js](./database.js) cria e migra a tabela `documentos`. As pastas `data` e `uploads` são dados do usuário; não são parte do código e devem ser copiadas juntas em um backup.
- [upload.js](./upload.js) cuida do recebimento e da detecção de duplicatas.
- [processamento.js](./processamento.js) controla a fila, chama o worker e salva o resultado. Novas regras de interpretação precisam preservar revisões já salvas.
- [revisao.js](./revisao.js) valida o que o usuário digitou e protege contra salvamento de uma versão desatualizada.
- [exportacao.js](./exportacao.js) mapeia os dados revisados para o XML; a inclusão de um novo campo requer conferir também [campos.json](./public/campos.json) e os testes de exportação.

## Extração de dados

- [layout-documento.js](./layout-documento.js) normaliza fragmentos de PDF e palavras de OCR no mesmo formato e calcula a área de origem para a prévia.
- [extrator-posicional.js](./extrator-posicional.js) associa rótulos, valores e blocos por posição na página. As regras genéricas ficam na lista `regras`; adicione variações de rótulo ali apenas quando houver validação confiável do valor.
- Cabeçalhos em colunas usam o centro de cada rótulo para delimitar a célula de baixo. Quando o título "Prestador" não aparece, a associação com a empresa anterior ao tomador exige um único nome empresarial e um CNPJ rotulado próximo; endereço sem rótulo exige rua, número e linha de cidade/UF/CEP no mesmo bloco.
- [extrator-generico.js](./extrator-generico.js) e [extrator-contexto.js](./extrator-contexto.js) tentam recuperar dados a partir do texto completo sem inventar valores ausentes.
- [layout-texto.js](./layout-texto.js) prepara trechos de texto cuja ordem foi embaralhada pelo PDF.
- [extrator.js](./extrator.js), [extrator-complementos.js](./extrator-complementos.js), [extrator-campinas.js](./extrator-campinas.js), [extrator-danfse.js](./extrator-danfse.js) e [extrator-qive.js](./extrator-qive.js) contêm regras de formatos conhecidos.
- [municipios.js](./municipios.js) consulta [municipios-ibge.json](./municipios-ibge.json) para códigos municipais locais.

As sugestões automáticas exigem conferência antes da exportação. Quando o PDF tem campos conflitantes ou ilegíveis, o campo deve permanecer vazio e o texto completo pode ser consultado na revisão.

## Arquivos antigos e testes

[campos.js](./campos.js), [complementos.js](./complementos.js), [leitura.js](./leitura.js) e [pendencias.js](./pendencias.js) são módulos antigos mantidos no repositório; [server.js](./server.js) não os monta. Não use esses arquivos como ponto de entrada para novas funcionalidades.

Os testes ficam em [tests/](./tests). Execute `npm test` após mudanças. Para uma alteração de layout, acrescente um caso ao teste do extrator correspondente e verifique a leitura completa até a revisão quando o comportamento envolver o worker. Os testes usam arquivos temporários e não alteram o banco real.
