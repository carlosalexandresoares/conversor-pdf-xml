# Teste isolado de `pdf-table-extractor`

**Data:** 15/10/2026

**Ambiente:** Node.js 24.21.0, Windows; pacote npm `pdf-table-extractor` 1.0.3, instalado separadamente do projeto.

**Objetivo:** verificar se a reconstrução de tabelas melhora a leitura de NFS-e com layouts diferentes, sem mudar o processamento em produção.

## Como foi testado

O pacote foi executado separadamente com a API descrita no [README oficial](https://www.npmjs.com/package/pdf-table-extractor). Foram usados dois PDFs sintéticos de teste e quatro PDFs já armazenados localmente. A comparação com o leitor atual foi somente leitura: nenhum documento do banco foi reprocessado ou modificado.

| PDF | Resultado do pacote | Leitor atual |
| --- | --- | --- |
| `layout-generico.pdf` (teste) | Nenhuma tabela detectada. | O teste automatizado existente verifica a extração genérica. |
| `digitalizado.pdf` (teste) | Nenhuma tabela detectada; o pacote não fez OCR. | O teste automatizado existente verifica o OCR local. |
| `sa.pdf` (Santo André) | 1 tabela; 91 células preenchidas. Separou alguns rótulos e valores, mas também juntou título, campo e valor na mesma célula. | 36 campos do formulário preenchidos; número, prestador, tomador e valor dos serviços presentes. |
| `os.pdf` (Osasco) | 1 tabela; 26 células preenchidas. Juntou vários campos em células únicas e encerrou com erro interno `canvas.getContext is not a function`. | 24 campos preenchidos; faltou o número da nota. |
| `gu.pdf` (Guarulhos) | 1 tabela; apenas 2 células preenchidas, ambas com blocos extensos de texto misturado; mesmo erro interno de canvas. | 31 campos preenchidos após OCR; faltou o valor dos serviços. |
| `rb.pdf` | Falhou com `ReferenceError: lineWidth is not defined` e erro interno de canvas. | 26 campos preenchidos; faltou o valor dos serviços. |

O número de células do pacote **não equivale** a campos fiscais extraídos corretamente. Ele reconstrói uma grade a partir das linhas do PDF, mas ainda seria necessário identificar o papel de cada célula e validar seus valores.

## Avaliação

O pacote pode servir para inspecionar PDFs com tabelas desenhadas, mas **não melhorou de forma demonstrável os campos fiscais faltantes neste conjunto**. Ele não identifica sozinho prestador, tomador, tributos e totais; PDFs sem linhas de tabela ou digitalizados continuam dependendo das estratégias atuais. A versão testada depende de `pdfjs-dist` antigo e apresentou falhas no Node.js usado pelo projeto.

**Decisão do teste:** não adicionar `pdf-table-extractor` às dependências nem ao fluxo de produção. Para investigar um PDF específico com grade, a saída tabular pode ajudar como ferramenta de diagnóstico isolada; qualquer integração futura precisaria de testes por campo e tratamento explícito das falhas observadas.
