# Folha — Conversor PDF para XML, versão 2.0.1

Aplicação local para armazenar PDFs de NFS-e, extrair dados, revisar e exportar XML no perfil baseado no exemplo ABRASF enviado para o projeto.

## Correções da versão 2.0.1

- Aprovar e reabrir uma revisão exigem a mesma versão dos dados que foi aberta na tela. Se outra pessoa salvar uma alteração, a ação será rejeitada até a revisão ser reaberta e conferida.
- Após uma falha de leitura, preencha e salve os campos, confira o PDF e use **Concluir por revisão manual**. A ação exige campos essenciais válidos e não apaga o erro de leitura. Depois, use **Aprovar para exportar**. Alterações posteriores nos campos exigem nova conclusão manual.
- Avisos de CPF/CNPJ e ISS de versões anteriores são recalculados sem remover os alertas de OCR e layout. Os avisos da tela são atualizados após salvar.
- A verificação do backup exige que todos os PDFs referenciados no banco estejam no manifesto, inclusive os da lixeira, e confere a associação e os hashes dos arquivos.
- O pacote de código é gerado com os arquivos atuais e exclui dados operacionais, dependências, histórico Git e backups.

Esta atualização não inclui integração com IA nem homologação do XML no G5. O acesso compartilhado ainda usa a senha HTTP Basic descrita abaixo; nomes informados no login não são identidades verificadas individualmente.

## Atualização no Windows

### Iniciar em outro computador Windows

1. Instale o **Node.js 24 LTS** pelo instalador completo de [nodejs.org](https://nodejs.org/), incluindo npm e a opção de adicionar ao PATH.
2. Copie a pasta completa do código para uma pasta local em que você possa gravar arquivos. Inclua `package.json`, `package-lock.json` e as pastas `public` e demais arquivos do projeto. Não copie `node_modules` entre computadores: as dependências nativas serão instaladas para a máquina de destino.
3. Dê dois cliques em **[INICIAR.bat](./INICIAR.bat)**. Ele verifica o ambiente, instala as dependências quando necessário e abre o navegador depois que o servidor começa a responder. A primeira instalação exige internet; as próximas inicializações podem funcionar offline.
4. Mantenha a janela aberta. Para desligar o servidor, pressione **Ctrl+C**.

O iniciador não é um executável independente: ele precisa do Node.js instalado. Não requer instalar a aplicação globalmente nem copiar programas para pastas do Windows. Pode ser chamado pelo terminal com `.\INICIAR.bat` ou, no PowerShell, `& "C:\caminho\do\projeto\INICIAR.bat"`. Para somente verificar o ambiente, sem instalar dependências, abrir navegador ou iniciar servidor, execute `node iniciar.cjs --verificar`.

Cada instalação usa seu próprio banco e PDFs. Para levar os documentos existentes, copie `data` e `uploads` com o servidor parado. Para compartilhar a mesma biblioteca, rode o servidor em apenas um computador e use o endereço de rede dele nos demais, conforme a seção “Dois computadores”.

1. Pare o servidor com Ctrl+C e feche outras instâncias de Node deste projeto.
2. Faça uma cópia da pasta atual, principalmente `data` e `uploads`, com o servidor parado. Não apague o banco nem os PDFs existentes.
3. Gere o ZIP com `npm run pacote` e extraia o conteúdo de `dist/conversor-codigo.zip` dentro da pasta do projeto. Esse pacote exclui banco, PDFs de clientes, `node_modules` e `.git`.
4. Abra o PowerShell na pasta do projeto e execute:

```powershell
npm install
npm test
npm start
```

5. Acesse `http://localhost:3000` e atualize com Ctrl+F5.

Requisito recomendado: Node.js 24, já usado no projeto. A instalação exige internet para baixar as dependências e o idioma do OCR. Depois de instalado, o processamento e o OCR funcionam localmente. Nenhum PDF é enviado a APIs externas pela aplicação.

## Como usar

- Use **Modo noturno** no canto superior direito para escurecer a interface. O botão alterna de volta para **Modo claro** e lembra sua escolha neste navegador. O documento PDF mantém suas cores originais.

- Na revisão, **Preencher pelo texto** reaproveita o texto completo já armazenado e, para layouts genéricos, consulta novamente a posição dos campos no PDF original. Preenche campos vazios e corrige sugestões automáticas antigas quando o campo ainda não foi editado na tela. Preserva valores digitados manualmente e não salva automaticamente: confira e use **Salvar revisão**. A leitura por contexto reconhece nomes sem rótulo dentro dos blocos das partes e totais com outras denominações. Trechos de OCR corrompidos continuam exigindo conferência no PDF.

- Escolha ou arraste até 50 PDFs de uma vez; clique em **Importar arquivos**.
- O envio ocorre arquivo a arquivo. Um arquivo inválido não cancela os demais. A leitura ocorre em uma fila no servidor.
- PDFs duplicados são reconhecidos pelo conteúdo e não criam outro registro.
- Marque um documento e use **Revisar dados**. O original aparece ao lado do formulário; em telas pequenas, use **Abrir PDF**.
- Salve a revisão e clique em **Aprovar para exportar** depois de conferir os dados. Uma revisão salva ainda não libera a exportação normal.
- Marque vários documentos e use **Baixar XMLs**. O sistema mostra as pendências antes do download. Se faltar aprovação, só permite baixar um **RASCUNHO** identificado no nome; o ZIP contém um XML por registro e `relatorio-exportacao.txt`.
- A seleção pode abranger várias páginas e permanece ao filtrar; o contador indica o total. A caixa no cabeçalho seleciona somente a página visível. Máximo de 100 documentos por exportação.
- A revisão protege contra sobrescrita por outro computador. Ao receber conflito, feche e reabra a revisão para carregar a versão atual.
- O histórico local registra importação, campos alterados na revisão, aprovação, reabertura, exportação e exclusão. A API `/api/documentos/ID/historico` permite consultar até 200 eventos recentes do documento. **Excluir** move o registro para a lixeira sem apagar o PDF; use o filtro **Lixeira** e **Restaurar** para recuperá-lo. Os documentos da lixeira também entram no backup.
- Ao abrir a revisão durante a leitura, os campos aguardam o processamento e são preenchidos automaticamente, sem fechar a janela.
- Dados revisados não são reextraídos automaticamente. O botão **Tentar leitura novamente** fica disponível nos documentos sem revisão salva, inclusive quando uma leitura anterior terminou com campos vazios. A nova leitura substitui a extração anterior.
- Valores inexistentes ficam vazios. Zero só é exportado quando estiver efetivamente armazenado como zero. As datas não recebem dias arbitrários.
- Os valores fictícios preenchidos nos testes antigos continuam no banco: apague-os e salve a revisão antes de usar o XML.

## Cobertura real e limites

O sistema lê as posições dos textos na página em todos os PDFs, inclusive quando usa OCR. Reconhece nomes equivalentes de campos, títulos fragmentados, valores à direita ou abaixo e blocos de prestador/emitente/fornecedor e tomador/cliente/destinatário. Nos formatos conhecidos, os adaptadores continuam prioritários; a posição é anexada quando confirma o mesmo valor. Na revisão, **Ver no PDF** destaca o trecho encontrado e **Dados organizados** mostra um JSON dos campos atuais e suas origens. Tudo funciona localmente, sem API de IA ou nova dependência.

Os sinônimos e abreviações de rótulos compartilhados ficam em [rotulos.json](./rotulos.json). A leitura também avisa quando CPF/CNPJ não passa na conferência dos dígitos verificadores ou quando ISS, base e alíquota divergem; esses avisos não corrigem nem apagam campos automaticamente. A conferência humana continua necessária, pois regras fiscais podem explicar diferenças entre os valores.

Datas impossíveis, valores de formato inválido, traços e asteriscos não são convertidos em dados. Valores distintos para o mesmo campo entre páginas geram aviso e deixam esse campo vazio. Isso amplia a cobertura, mas não garante qualquer layout: títulos desconhecidos, posições ambíguas e documentos ilegíveis ainda exigem conferência. Cada PDF continua representando uma única nota. Os leitores específicos de Barueri, Santos, DANFSe, Qive e Campinas têm prioridade.

Também há leitura específica para DANFSe nacional v2 e para PDFs exportados pela Qive, incluindo os quadros abreviados de base de cálculo, ISS, valor líquido e IBS/CBS. No layout Qive, o IBS total é a soma das parcelas municipal e estadual, apenas quando ambas estão informadas. Traços continuam vazios; o valor líquido ausente não é calculado automaticamente. Os códigos de serviço são preservados conforme o rótulo do PDF, sem presumir equivalência com a lista de serviços. Use **Tentar leitura novamente** para atualizar extrações antigas ainda não revisadas.

O sistema aceita PDFs independentemente do município ou organização visual, mas isso não significa extração perfeita de todo layout. Há adaptadores específicos para os exemplos de Barueri e Santos e extração por rótulos para os demais, incluindo campos lado a lado, títulos em colunas com valores na linha seguinte e sequências de títulos seguidas dos valores. O extrator reconhece emitente/prestador, tomador e município com UF. O OCR local em português é tentado nas páginas com pouco texto ou sem identificação dos campos principais, inclusive páginas com cabeçalho textual e conteúdo digitalizado. Campos conflitantes ou não identificados precisam de revisão. PDFs com senha devem ser desbloqueados antes do envio. Arquivos ilegíveis ou danificados permanecem cadastrados com a descrição do erro e permitem revisão manual.

Limites por PDF: 20 MB, 50 páginas, até 20 páginas submetidas ao OCR e 180 segundos por leitura. Documentos além desses limites devem ser divididos. O OCR pode errar caracteres e valores. Páginas mistas com texto e imagens podem exigir conferência adicional.

Cada PDF representa **uma nota**. Um PDF com várias notas não é dividido automaticamente. PDFs de outros tipos de documento também podem ser armazenados, mas o perfil de saída é voltado a NFS-e: ele não transforma uma NF-e de mercadoria ou um boleto em nota de serviço válida.

O PDF original e todo o texto extraído ficam armazenados. O XML contém apenas os campos mapeados para o perfil atual; não comporta automaticamente todas as informações visuais do PDF. IBS e CBS ficam no banco e na revisão, mas não são incluídos neste perfil de exportação.

A exportação normal exige leitura concluída, revisão salva, aprovação explícita e campos essenciais preenchidos: número, código de verificação, emissão, competência com data completa, identificação das partes, valor dos serviços, item da lista, ISS retido e incentivo fiscal. A exportação em rascunho exige leitura concluída e pode conter dados incompletos. O programa não emite uma nova nota, não cria assinatura digital e não confirma autorização fiscal. A geração bem formada não equivale a validação XSD ABRASF 2.02, nem garante aceitação pelo G5. A importação dos novos XMLs no G5 ainda deve ser testada pelo responsável fiscal.

## Dois computadores

Por padrão o servidor escuta somente neste computador (`127.0.0.1`). Para acesso em uma rede confiável, defina `CONVERSOR_HOST=0.0.0.0`, `CONVERSOR_PASSWORD` e `CONVERSOR_DELETE_PASSWORD` antes de iniciar. Abra `http://IP-DO-SERVIDOR:3000` no segundo computador e use qualquer nome de usuário com a senha de acesso configurada. A senha separada de exclusão será solicitada ao mover documentos para a lixeira. Ambos devem estar na mesma rede e a porta 3000 deve estar permitida no firewall da rede privada. O terminal e o computador servidor precisam permanecer ligados. O banco SQLite deve ficar no disco local do servidor, e não em pasta de rede compartilhada.

No PowerShell do computador servidor, um exemplo é:

```powershell
$env:CONVERSOR_HOST = '0.0.0.0'
$env:CONVERSOR_PASSWORD = 'sua-senha-de-acesso'
$env:CONVERSOR_DELETE_PASSWORD = 'outra-senha-para-excluir'
& .\INICIAR.bat
```

A senha usa autenticação HTTP Basic, adequada somente a uma rede local confiável ou atrás de um proxy com HTTPS, pois HTTP transmite credenciais sem criptografia. Ela não separa permissões por usuário. Não publique a porta diretamente na internet. O histórico de alterações registra o nome informado no login, mas esse nome não é uma identidade verificada individualmente.

## Backup e recuperação

Execute `npm run backup -- CAMINHO_DO_BACKUP` para copiar o banco por snapshot SQLite e os PDFs referenciados. Depois, execute `npm run verificar-backup -- CAMINHO_DO_BACKUP`: o comando abre uma cópia temporária do banco e confere integridade e hashes dos PDFs. Guarde o backup fora da pasta do projeto. Para restaurar, pare o servidor e recoloque `conversor.db` em `data` e os PDFs em `uploads`. A migração da versão 2.0 apenas acrescenta colunas ao banco existente. Não exige apagar dados.

Para medir extração com documentos reais, crie um JSON com entradas `{"pdf":"caminho.pdf","esperado":{"numero_nota":"123","valor_servicos_centavos":10000}}` e execute `npm run avaliar-extracao -- amostra.json`. O relatório mostra acertos, vazios, erros e tempo por campo. O arquivo e os PDFs ficam na máquina local.

Se aparecer “Sem conexão com o servidor”, veja o terminal, confira `http://localhost:3000/api/status` e verifique se há outra instância ocupando a porta. O código agora apresenta uma mensagem descritiva no lugar de simplesmente “Failed to fetch”; a mensagem anterior sozinha não permitia identificar sua causa original.

## Estrutura

Para localizar cada responsabilidade, acompanhar o caminho de um PDF e fazer alterações futuras, consulte o [guia de manutenção](./MANUTENCAO.md).

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
