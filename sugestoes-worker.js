// Isola a releitura posicional usada pelo botão "Preencher pelo texto".
const fs = require('node:fs/promises');
process.on('message', async ({ caminho, texto, modelo }) => {
  try {
    let extracao;
    if (['generico', 'generico_posicional'].includes(modelo) && caminho) {
      try {
        const posicional = require('./extrator-posicional');
        const posicoes = await posicional.lerPosicoes(await fs.readFile(caminho));
        extracao = posicional.combinarPosicoes(posicoes, require('./extrator-generico').extrairGenerico(texto));
      } catch { /* Texto armazenado continua disponível se a posição falhar. */ }
    }
    const dados = require('./processamento').interpretar(texto, extracao);
    process.send({ ok: true, dados }, () => process.disconnect());
  } catch (erro) {
    process.send({ ok: false, erro: erro.message }, () => process.disconnect());
  }
});
