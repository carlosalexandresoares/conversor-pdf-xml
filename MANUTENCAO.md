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
- [perfil-exportacao.js](./perfil-exportacao.js) concentra as pendências impeditivas de aprovação. Ao alterar o perfil do XML, atualize essa lista e os testes. A aceitação pelo G5 só pode ser afirmada depois de homologação com arquivos aceitos pelo sistema.
- [auditoria.js](./auditoria.js) grava eventos de revisão, aprovação, exportação e exclusão na tabela `eventos_documento`. Em uso sem senha, o ator aparece como usuário local.
- [sugestoes-worker.js](./sugestoes-worker.js) isola a releitura feita pelo botão **Preencher pelo texto** e é encerrado após 30 segundos.
- A lista da biblioteca usa busca, filtros e paginação no servidor. O navegador consulta a cada 2,5 segundos apenas enquanto há documentos em processamento e faz uma atualização geral a cada 30 segundos.
- [gerar-pacote.cjs](./scripts/gerar-pacote.cjs), [backup.cjs](./scripts/backup.cjs) e [verificar-backup.cjs](./scripts/verificar-backup.cjs) separam distribuição de código, cópia de dados e prova de restauração. [avaliar-extracao.cjs](./scripts/avaliar-extracao.cjs) mede acertos e lacunas sobre uma amostra com gabarito.

## Extração de dados

- [rotulos.json](./rotulos.json) lista nomes equivalentes de campos; [catalogo-rotulos.js](./catalogo-rotulos.js) normaliza abreviações apenas nos rótulos e fornece padrões para os extratores de texto, contexto e posição. Novos sinônimos comuns entram no catálogo; regras de valor e de contexto permanecem em JavaScript.
- [validacao-extracao.js](./validacao-extracao.js) confere dígitos de CPF/CNPJ e compara ISS com base × alíquota. Inconsistências geram avisos na revisão; o módulo não altera os valores extraídos.
- [layout-documento.js](./layout-documento.js) normaliza fragmentos de PDF e palavras de OCR no mesmo formato e calcula a área de origem para a prévia.
- [extrator-posicional.js](./extrator-posicional.js) associa rótulos, valores e blocos por posição na página. As regras genéricas ficam na lista `regras`; adicione variações de rótulo ali apenas quando houver validação confiável do valor.
- Cabeçalhos em colunas usam o centro de cada rótulo para delimitar a célula de baixo. Quando o título "Prestador" não aparece, a associação com a empresa anterior ao tomador exige um único nome empresarial e um CNPJ rotulado próximo; endereço sem rótulo exige rua, número e linha de cidade/UF/CEP no mesmo bloco.
- [extrator-generico.js](./extrator-generico.js) e [extrator-contexto.js](./extrator-contexto.js) tentam recuperar dados a partir do texto completo sem inventar valores ausentes.
- [layout-texto.js](./layout-texto.js) prepara trechos de texto cuja ordem foi embaralhada pelo PDF.
- [extrator.js](./extrator.js), [extrator-complementos.js](./extrator-complementos.js), [extrator-campinas.js](./extrator-campinas.js), [extrator-danfse.js](./extrator-danfse.js) e [extrator-qive.js](./extrator-qive.js) contêm regras de formatos conhecidos.
- [municipios.js](./municipios.js) consulta [municipios-ibge.json](./municipios-ibge.json) para códigos municipais locais.

As sugestões automáticas exigem conferência antes da exportação. Quando o PDF tem campos conflitantes ou ilegíveis, o campo deve permanecer vazio e o texto completo pode ser consultado na revisão.

## Arquivos antigos e testes

`campos.js`, `complementos.js`, `leitura.js` e `pendencias.js` são módulos antigos que não acompanham o pacote corrigido. Eles podem permanecer em instalações anteriores, mas o servidor não os monta.

Os testes ficam em [tests/](./tests). Execute `npm test` após mudanças. Para uma alteração de layout, acrescente um caso ao teste do extrator correspondente e verifique a leitura completa até a revisão quando o comportamento envolver o worker. Os testes usam arquivos temporários e não alteram o banco real.

## Regras da correção 2.0.1

- `perfil-exportacao.js` centraliza `leituraConcluida`, usada nas pendências e na exportação individual e em lote. Uma falha só é considerada resolvida para exportar após conclusão manual explícita; o estado técnico de erro é preservado.
- `revisao.js` valida a versão recebida em aprovar, reabrir e concluir manualmente. Alterações após conclusão manual removem sua marcação.
- `validacao-extracao.js` remove mensagens conhecidas de validação legada e as recompõe com os valores atuais, preservando avisos de outras origens.
- Execute `npm test` e, depois da última edição, `npm run pacote`. O ZIP em `dist/conversor-codigo.zip` é a entrega de código; não compacte a pasta operacional inteira.
