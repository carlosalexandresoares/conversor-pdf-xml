# Atualização para 2.0.1

## Instalar a correção no Windows

1. Pare o servidor com Ctrl+C e faça uma cópia de segurança da pasta atual, incluindo `data` e `uploads`.
2. Extraia este ZIP em uma pasta temporária. Copie os arquivos e diretórios dele para dentro da pasta do projeto existente, onde está `server.js`, aceitando substituir os arquivos de código.
3. Preserve as pastas `data` e `uploads` da instalação atual. O pacote não contém banco nem PDFs de clientes e não exige apagar o banco.
4. Abra `INICIAR.bat`. Alternativamente, execute `npm ci`, `npm test` e `npm start` pelo terminal na pasta do projeto.
5. No navegador, pressione Ctrl+F5. Reabra revisões que estavam abertas antes da atualização.

Uma instalação nova também funciona: extraia em uma pasta gravável, instale o Node.js conforme `LEIA-ME.md` e execute `INICIAR.bat`.

## Correções incluídas

- Aprovação e reabertura rejeitam dados diferentes daqueles que a pessoa conferiu.
- Documentos com falha de leitura podem ser concluídos por conferência manual explícita, com validação, histórico e aprovação separada.
- Alterações posteriores invalidam a conclusão manual; a falha original de leitura permanece registrada.
- Avisos legados de CPF/CNPJ e ISS são atualizados após correções; avisos de OCR e layout são preservados.
- A tela recarrega os avisos e campos normalizados após salvar e apresenta as pendências retornadas pela API.
- A restauração de teste rejeita manifestos incompletos ou duplicados, PDFs alterados e associações incorretas entre documento e arquivo.
- HTML corrigido e pacote gerado após as alterações, sem dados operacionais, dependências ou backups.

## Verificação

Os 51 testes automáticos passaram no ambiente de execução, incluindo os testes de regressão para aprovação desatualizada, conclusão manual, avisos legados, atualização da interface e backup incompleto.

A compatibilidade com o G5 ainda precisa ser homologada no sistema de destino. Esta entrega não inclui integração com IA, contas individuais nem configuração de HTTPS. O controle de acesso local e as duas senhas para uso em rede permanecem conforme o manual.
