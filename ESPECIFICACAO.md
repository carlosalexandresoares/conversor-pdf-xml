# Especificação do projeto — Conversor PDF para XML

**Versão documentada:** 2.0.1
**Data:** 16/10/2026
**Situação:** funcionalidades descritas conforme o código atual; este documento não propõe mudanças de comportamento.

## 1. Objetivo

Aplicação local para importar PDFs de notas fiscais de serviços (NFS-e), sugerir dados extraídos, permitir conferência e correção humana e gerar XML individual ou em lote. O PDF original e o texto extraído permanecem acessíveis durante a revisão.

O sistema reduz a digitação, mas **não confirma a validade fiscal da nota nem substitui a conferência**. Cada PDF representa um documento; PDFs com várias notas não são separados automaticamente.

## 2. Usuário e ambiente

- **Usuário principal:** pessoa que organiza, confere e exporta NFS-e para uso em outro sistema.
- **Execução:** servidor Node.js local, acessado pelo navegador em `http://localhost:3000` por padrão. Também pode ser acessado por outros computadores da mesma rede local confiável usando o IP do servidor.
- **Plataforma de inicialização assistida:** Windows, por [INICIAR.bat](./INICIAR.bat) e [iniciar.cjs](./iniciar.cjs). A aplicação também inicia com `npm start` onde as dependências são compatíveis.
- **Requisito de runtime:** Node.js 22.13.0 ou superior; Node.js 24 LTS é a versão recomendada no [manual de uso](./LEIA-ME.md).
- **Dependências principais:** Express, SQLite (`better-sqlite3`), `pdf-parse`, `pdfjs-dist`, Tesseract.js e `archiver`, declaradas em [package.json](./package.json).

## 3. Fluxo de uso

1. O usuário seleciona ou arrasta até **50 PDFs por lote** na interface. O navegador envia um arquivo por requisição.
2. O servidor verifica extensão `.pdf`, assinatura `%PDF-` e limite de **20 MB por arquivo**. Um hash SHA-256 identifica PDFs idênticos já cadastrados.
3. O PDF novo é salvo em `uploads/` com nome interno aleatório, e seu registro é criado no banco SQLite em `data/`.
4. A leitura entra em uma fila. O worker extrai texto do PDF, aplica regras de leitura e tenta OCR local quando a página tem pouco texto ou não apresenta dados principais reconhecíveis.
5. O usuário encontra o documento na biblioteca, visualiza o original e confere os campos sugeridos na janela de revisão. O texto completo também fica disponível nessa janela.
6. O usuário pode editar os campos e salvar a revisão. Pode solicitar sugestões novamente com **Preencher pelo texto**. Em documentos ainda não revisados, pode tentar a leitura novamente.
7. O usuário seleciona um documento para baixar XML ou vários para baixar um ZIP com XMLs e relatório de exportação.

## 4. Requisitos funcionais implementados

| ID | Comportamento |
| --- | --- |
| RF-01 | Importar PDFs individualmente ou em lote, apresentando o resultado de cada envio sem cancelar os demais quando um falhar. |
| RF-02 | Detectar arquivo duplicado pelo conteúdo e retornar o documento existente, sem criar outro registro. |
| RF-03 | Manter biblioteca com busca por nome do arquivo, número da nota ou empresa, filtros por situação, paginação e seleção múltipla. |
| RF-04 | Exibir estados de leitura: na fila, processando, pronto para revisão ou erro. |
| RF-05 | Extrair texto de PDFs nativos e tentar OCR local em páginas que precisem dele. O texto completo é guardado para consulta. |
| RF-06 | Usar adaptadores de layouts conhecidos e leitura genérica por rótulos, contexto e posição para outros layouts. Registrar origem e avisos dos dados sugeridos quando disponíveis. |
| RF-07 | Mostrar PDF original e formulário de revisão lado a lado em telas maiores; oferecer abertura do PDF original em nova aba. |
| RF-08 | Aceitar correções manuais, validar formatos e impedir que uma revisão desatualizada sobrescreva outra. |
| RF-09 | Preservar revisões salvas e impedir reprocessamento automático de documento já conferido. |
| RF-10 | Oferecer nova tentativa de leitura para documento sem revisão salva. |
| RF-11 | Excluir documentos selecionados após confirmação; não excluir documento durante a leitura. A exclusão remove registro e PDF armazenado. |
| RF-12 | Exportar um XML individual ou um ZIP com até **100 XMLs** e `relatorio-exportacao.txt`. |

## 5. Regras de extração e revisão

- A leitura combina texto completo, posição dos trechos na página e regras de layouts conhecidos. Há módulos específicos para formatos nacionais ou de provedores já observados; formatos desconhecidos usam estratégias genéricas. O OCR é local, sem envio do PDF a um serviço externo.
- A interpretação é conservadora: valores ausentes, ilegíveis, com formato inválido ou conflitantes podem permanecer vazios. A presença de texto no PDF não garante associação correta entre campo e valor.
- Os campos incluem identificação da nota, emissão e competência, prestador, tomador, RPS, serviço, município, valores, retenções e tributos. A lista visível está em [campos.json](./public/campos.json).
- Valores monetários são armazenados em **centavos**; a interface usa apresentação em reais. A revisão valida campos como datas, documentos, códigos e valores antes de salvar.
- **Preencher pelo texto** sugere dados novamente a partir do texto armazenado e, para modelos genéricos, pode consultar a posição no PDF original. Não salva automaticamente e preserva valores alterados manualmente na tela.
- O PDF original é a referência final. O usuário deve conferir as sugestões antes de salvar e exportar.

## 6. Exportação XML

O XML usa um perfil **baseado no exemplo ABRASF de referência adotado pelo projeto**. A geração omite campos ausentes, não inventa valores e pode produzir um XML parcial quando faltarem dados. O download continua disponível mesmo sem revisão completa; o relatório do lote aponta ausências relevantes.

A geração de XML bem formado **não equivale** a validação XSD, emissão de uma nova nota, assinatura digital, autorização fiscal ou aceite pelo sistema de destino. IBS e CBS podem constar dos dados revisados, mas não são exportados no perfil XML atual. A aceitação no G5 ou em outro sistema precisa ser verificada pelo responsável fiscal.

## 7. Arquitetura

```text
Navegador (HTML/CSS/JS)
  ├─ Biblioteca, importação e revisão: public/index.html + public/app.js
  └─ Prévia do PDF: public/visualizar.html + public/visualizar.js
          │ HTTP local
Servidor Express: server.js
  ├─ upload.js → arquivos em uploads/ + registro SQLite
  ├─ revisao.js → leitura e salvamento de campos
  ├─ exportacao.js → XML e ZIP
  └─ processamento.js → fila → leitor-worker.js
                         ├─ texto nativo e OCR
                         ├─ extração genérica e posicional
                         └─ adaptadores de layouts conhecidos
Banco SQLite: data/conversor.db
```

O worker roda em processo separado, com limite de tempo e memória, para que uma leitura demorada não bloqueie as rotas do servidor. A fila salva resultados no banco apenas se o registro não mudou durante a leitura; edições manuais são preservadas. O [guia de manutenção](./MANUTENCAO.md) relaciona cada responsabilidade ao arquivo correspondente.

## 8. Modelo de dados

A tabela principal `documentos` contém identificador, nome original, caminho do PDF, hash único, campos frequentemente usados na listagem, texto extraído, estado de processamento, erro e datas. O campo `dados_json` armazena os demais campos extraídos ou revisados, suas origens e avisos. Os arquivos PDF ficam em `uploads/`; o banco fica em `data/conversor.db`. As pastas devem ser copiadas juntas em backups, com o servidor parado.

Os estados técnicos de processamento incluem `novo`, `fila`, `processando`, `pronto` e `erro`. O estado de conferência é separado: `pendente` ou `conferido`. Assim, terminar a leitura não significa que o usuário já revisou os dados.

## 9. Interface HTTP principal

| Método e rota | Finalidade |
| --- | --- |
| `GET /api/status` | Verificar se servidor e banco respondem. |
| `GET /api/documentos` | Listar documentos e informações resumidas para a biblioteca. |
| `POST /api/documentos/upload` | Receber um PDF no campo multipart `pdf`. |
| `GET /api/documentos/:id/pdf` | Acessar o PDF original armazenado. |
| `GET /api/documentos/:id/revisao` | Obter dados, texto e versão da revisão. |
| `PUT /api/documentos/:id/revisao` | Validar e salvar campos revisados, respeitando a versão atual. |
| `GET /api/documentos/:id/sugestoes-texto` | Recalcular sugestões sem salvar a revisão. |
| `POST /api/documentos/:id/processar` | Reenfileirar leitura de documento ainda não conferido. |
| `DELETE /api/documentos/:id` | Excluir documento e PDF após as verificações do servidor. |
| `GET /api/documentos/:id/xml` | Baixar XML individual. |
| `POST /api/documentos/xml-lote` | Baixar ZIP dos IDs informados. |

## 10. Limites e requisitos não funcionais

- **Por PDF:** 20 MB, até 50 páginas, OCR em no máximo 20 páginas e tempo máximo de leitura de 180 segundos. PDFs protegidos por senha precisam ser desbloqueados antes do envio.
- **Por operação na interface:** até 50 PDFs por lote de importação e até 100 documentos por exportação em ZIP.
- **Privacidade:** PDFs, OCR e banco permanecem na instalação local; a aplicação não depende de API de IA para interpretar notas. A instalação inicial de dependências requer internet.
- **Rede:** o servidor pode atender a rede local, mas não oferece autenticação de usuários nem HTTPS. O uso previsto é em rede confiável; publicar diretamente na internet não faz parte desta versão.
- **Resiliência:** falha em um PDF não interrompe os outros da fila. Arquivos inválidos podem permanecer registrados com erro de leitura para permitir inspeção e revisão manual.
- **Precisão:** não há promessa de extração completa para todo layout municipal. OCR, títulos incomuns, texto fora de ordem e ambiguidades ainda podem exigir preenchimento manual.

## 11. Verificação e critérios de aceitação

O comando `npm test` executa os testes automáticos em [tests/](./tests), usando banco e arquivos temporários. Para aceitar uma alteração futura, verificar ao menos: importação e duplicidade; leitura de PDF nativo e digitalizado; preservação da revisão; proteção contra conflito; exclusão; XML individual e ZIP; comportamento em layout conhecido e desconhecido. O usuário deve sempre conferir o XML resultante no sistema fiscal de destino quando essa compatibilidade for necessária.

## 12. Fora do escopo atual

Emissão ou autorização de NFS-e; assinatura digital; validação formal do XML contra XSD ABRASF; integração comprovada com G5; autenticação e permissões por usuário; hospedagem pública; identificação infalível de qualquer PDF; separação automática de várias notas em um PDF. Esses itens exigem requisitos e validações próprios antes de serem tratados como funcionalidades do produto.

## 13. Correções operacionais da versão 2.0.1

Aprovação, reabertura e conclusão manual recebem `versao` no corpo JSON e rejeitam versões desatualizadas com HTTP 409. A conclusão manual é exclusiva de registros com erro, revisão salva e campos essenciais válidos; preserva o estado e a mensagem de erro, armazena `concluido_manual_em` e registra um evento. Ela permite baixar rascunho e solicitar aprovação normal, mas não aprova automaticamente. Edições posteriores invalidam a conclusão manual.

Rota adicional: `POST /api/documentos/:id/concluir-manual`. A exportação individual e em lote usa a mesma regra de conclusão. A interface recarrega os dados e avisos após salvar. A verificação de backup cobre todos os documentos com PDF referenciado, inclusive lixeira, e rejeita manifestos incompletos ou duplicados.
