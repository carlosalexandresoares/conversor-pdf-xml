# Folha — Conversor PDF para XML, versão 2.0

Aplicação local para armazenar PDFs de NFS-e, extrair dados, revisar e exportar XML no perfil baseado no exemplo ABRASF enviado para o projeto.

## Atualização no Windows

1. Pare o servidor com Ctrl+C e feche outras instâncias de Node deste projeto.
2. Faça uma cópia da pasta atual, principalmente `data` e `uploads`, com o servidor parado. Não apague o banco nem os PDFs existentes.
3. Extraia o conteúdo deste ZIP dentro da pasta do projeto e aceite substituir os arquivos de código. O pacote não contém banco, PDFs de clientes, `node_modules` nem `.git`.
4. Abra o PowerShell na pasta do projeto e execute:

```powershell
npm install
npm test
npm start
```

5. Acesse `http://localhost:3000` e atualize com Ctrl+F5.

Requisito recomendado: Node.js 24, já usado no projeto. A instalação exige internet para baixar as dependências e o idioma do OCR. Depois de instalado, o processamento e o OCR funcionam localmente. Nenhum PDF é enviado a APIs externas pela aplicação.

## Como usar

- Escolha ou arraste até 50 PDFs de uma vez; clique em **Importar arquivos**.
- O envio ocorre arquivo a arquivo. Um arquivo inválido não cancela os demais. A leitura ocorre em uma fila no servidor.
- PDFs duplicados são reconhecidos pelo conteúdo e não criam outro registro.
- Marque um documento e use **Revisar dados**. O original aparece ao lado do formulário; em telas pequenas, use **Abrir PDF**.
- Marque vários documentos e use **Baixar XMLs**. O ZIP contém um XML por registro e `relatorio-exportacao.txt`.
- A seleção pode abranger várias páginas e permanece ao filtrar; o contador indica o total. A caixa no cabeçalho seleciona somente a página visível. Máximo de 100 documentos por exportação.
- A revisão protege contra sobrescrita por outro computador. Ao receber conflito, feche e reabra a revisão para carregar a versão atual.
- Ao abrir a revisão durante a leitura, os campos aguardam o processamento e são preenchidos automaticamente, sem fechar a janela.
- Dados revisados não são reextraídos automaticamente. O botão **Tentar leitura novamente** fica disponível nos documentos sem revisão salva, inclusive quando uma leitura anterior terminou com campos vazios. A nova leitura substitui a extração anterior.
- Valores inexistentes ficam vazios. Zero só é exportado quando estiver efetivamente armazenado como zero. As datas não recebem dias arbitrários.
- Os valores fictícios preenchidos nos testes antigos continuam no banco: apague-os e salve a revisão antes de usar o XML.

## Cobertura real e limites

Para layouts sem adaptador, o sistema também lê as posições dos textos na página. Reconhece nomes equivalentes de campos, títulos fragmentados, valores à direita ou abaixo e blocos de prestador/emitente/fornecedor e tomador/cliente/destinatário. A revisão mostra a página de origem e o trecho usado em cada campo encontrado dessa forma. Tudo funciona localmente, sem API de IA ou nova dependência. O OCR local existente continua sendo usado quando necessário.

Datas impossíveis, valores de formato inválido, traços e asteriscos não são convertidos em dados. Valores distintos para o mesmo campo entre páginas geram aviso e deixam esse campo vazio. Isso amplia a cobertura, mas não garante qualquer layout: títulos desconhecidos, posições ambíguas e documentos ilegíveis ainda exigem conferência. Cada PDF continua representando uma única nota. Os leitores específicos de Barueri, Santos, DANFSe, Qive e Campinas têm prioridade.

Também há leitura específica para DANFSe nacional v2 e para PDFs exportados pela Qive, incluindo os quadros abreviados de base de cálculo, ISS, valor líquido e IBS/CBS. No layout Qive, o IBS total é a soma das parcelas municipal e estadual, apenas quando ambas estão informadas. Traços continuam vazios; o valor líquido ausente não é calculado automaticamente. Os códigos de serviço são preservados conforme o rótulo do PDF, sem presumir equivalência com a lista de serviços. Use **Tentar leitura novamente** para atualizar extrações antigas ainda não revisadas.

O sistema aceita PDFs independentemente do município ou organização visual, mas isso não significa extração perfeita de todo layout. Há adaptadores específicos para os exemplos de Barueri e Santos e extração por rótulos para os demais, incluindo campos lado a lado, títulos em colunas com valores na linha seguinte e sequências de títulos seguidas dos valores. O extrator reconhece emitente/prestador, tomador e município com UF. O OCR local em português é tentado nas páginas com pouco texto ou sem identificação dos campos principais, inclusive páginas com cabeçalho textual e conteúdo digitalizado. Campos conflitantes ou não identificados precisam de revisão. PDFs com senha devem ser desbloqueados antes do envio. Arquivos ilegíveis ou danificados permanecem cadastrados com a descrição do erro e permitem revisão manual.

Limites por PDF: 20 MB, 50 páginas, até 20 páginas submetidas ao OCR e 180 segundos por leitura. Documentos além desses limites devem ser divididos. O OCR pode errar caracteres e valores. Páginas mistas com texto e imagens podem exigir conferência adicional.

Cada PDF representa **uma nota**. Um PDF com várias notas não é dividido automaticamente. PDFs de outros tipos de documento também podem ser armazenados, mas o perfil de saída é voltado a NFS-e: ele não transforma uma NF-e de mercadoria ou um boleto em nota de serviço válida.

O PDF original e todo o texto extraído ficam armazenados. O XML contém apenas os campos mapeados para o perfil atual; não comporta automaticamente todas as informações visuais do PDF. IBS e CBS ficam no banco e na revisão, mas não são incluídos neste perfil de exportação.

A exportação é liberada mesmo sem dados essenciais e durante o processamento, usando os valores já salvos naquele momento. Isso pode produzir XML incompleto. O programa não emite uma nova nota, não cria assinatura digital e não confirma autorização fiscal. A geração bem formada não equivale a validação XSD ABRASF 2.02, nem garante aceitação pelo G5. A importação dos novos XMLs no G5 ainda deve ser testada pelo responsável fiscal.

## Dois computadores

Execute o servidor em um único computador. No segundo, abra `http://IP-DO-SERVIDOR:3000`. Ambos devem estar na mesma rede e a porta 3000 deve estar permitida no firewall da rede privada. O terminal e o computador servidor precisam permanecer ligados. O banco SQLite deve ficar no disco local do servidor, e não em pasta de rede compartilhada.

Esta versão não tem autenticação e é destinada à rede local confiável. Uma publicação na internet exige adicionar autenticação, HTTPS e uma estratégia de backup antes da exposição.

## Backup e recuperação

Com o servidor parado, copie `data` e `uploads` juntos para outro local. Para restaurar, pare o servidor e recoloque as duas pastas correspondentes ao mesmo backup. A migração da versão 2.0 apenas acrescenta colunas ao banco existente. Não exige apagar dados.

Se aparecer “Sem conexão com o servidor”, veja o terminal, confira `http://localhost:3000/api/status` e verifique se há outra instância ocupando a porta. O código agora apresenta uma mensagem descritiva no lugar de simplesmente “Failed to fetch”; a mensagem anterior sozinha não permitia identificar sua causa original.

## Estrutura

- `server.js`: servidor e rotas da aplicação.
- `upload.js`: validação, deduplicação e armazenamento do PDF.
- `processamento.js`: fila, preservação das revisões e gravação do resultado.
- `leitor-worker.js`: leitura/OCR isolados em um processo filho com limite de tempo.
- `extrator.js` e `extrator-complementos.js`: adaptadores dos exemplos iniciais.
- `extrator-generico.js`: extração conservadora por rótulos.
- `revisao.js`: validação dos campos e controle de concorrência.
- `exportacao.js`: XML individual e ZIP com relatório.
- `municipios-ibge.json`: base local de municípios; atualização independente da leitura de PDFs.
- `public`: interface responsiva, sem CDN ou serviços externos.
- `tests`: testes com documentos sintéticos, sem dados de clientes.

Os arquivos antigos `leitura.js`, `campos.js`, `complementos.js` e `pendencias.js` podem permanecer na pasta após a atualização; não são montados pelo novo servidor. Não é necessário apagá-los para funcionar.

## Verificação realizada nesta entrega

- Leitura dos dois PDFs originais: números das notas, CNPJs e valores dos serviços preservados.
- Layout sintético diferente: extração por rótulos, CPF e CNPJ separados por prestador/tomador.
- PDF sintético digitalizado: leitura por OCR local.
- PDF inválido: erro isolado sem queda do servidor.
- Duplicidade, revisão manual sem extração, rejeição de revisão desatualizada e preservação de campos revisados.
- Exportação parcial, escape de caracteres XML, zeros explícitos e lote ZIP.
- Navegador automatizado: envio de três PDFs, seleção múltipla, download do ZIP, revisão salva e PDF renderizado ao lado dos campos. Nenhum erro JavaScript observado; layout mobile sem transbordamento da página.
- Os três XMLs do ZIP de teste foram abertos por um parser XML. Isso verifica a estrutura sintática, não o esquema ABRASF ou a importação no G5.

`npm test` recria um banco temporário e não modifica os documentos reais.

## Fontes técnicas

- PDF Parse: https://github.com/mehmet-kozan/pdf-parse
- Tesseract.js: https://github.com/naptha/tesseract.js
- Idioma português: https://www.npmjs.com/package/@tesseract.js-data/por
- Municípios: https://servicodados.ibge.gov.br/api/v1/localidades/municipios?orderBy=nome — cópia obtida em 09/10/2026, com 5.571 registros.
