const express = require('express');
const path = require('node:path');
const db = require('./database');
const { retomar, enfileirar, caminhoPdf } = require('./processamento');
const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '1mb' }));
// This local app is intended for a trusted LAN. Reject cross-site browser writes.
app.use('/api', (req, res, next) => {
  if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) && req.headers.origin) {
    let host; try { host = new URL(req.headers.origin).host } catch { return res.status(403).json({ erro: 'Origem inválida.' }) }
    if (host !== req.headers.host) return res.status(403).json({ erro: 'Abra o sistema pelo endereço do servidor.' });
  }
  res.setHeader('Cache-Control', 'no-store'); next();
});
app.get('/api/status', (req, res) => { db.prepare('SELECT 1').get(); res.json({ funcionando: true, sistema: 'Conversor PDF para XML', versao: '2.0.0', banco: 'conectado' }); });
app.get('/api/documentos', (req, res) => {
  const documentos = db.prepare(`SELECT id,nome_arquivo,modelo,numero_nota,nome_prestador,nome_tomador,valor_servicos_centavos,status,criado_em,processamento,erro_processamento,dados_json FROM documentos ORDER BY id DESC`).all();
  res.json(documentos.map(({ dados_json, ...doc }) => { const d = JSON.parse(dados_json || '{}'); return { ...doc, revisado_em: d.revisado_em || null, avisos: d.avisos || [], metodo_leitura: d.metodo_leitura || null }; }));
});
app.use('/api/documentos/upload', require('./upload'));
app.post('/api/documentos/:id/processar', (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id < 1) return res.status(400).json({ erro: 'ID inválido.' });
  const doc = db.prepare('SELECT * FROM documentos WHERE id=?').get(id);
  if (!doc) return res.status(404).json({ erro: 'Documento não encontrado.' });
  if (JSON.parse(doc.dados_json || '{}').revisado_em || doc.status === 'conferido') return res.status(409).json({ erro: 'Este documento já foi revisado. A edição manual foi preservada.' });
  enfileirar(id); res.status(202).json({ mensagem: 'Documento adicionado à fila.' });
});
app.get('/api/documentos/:id/pdf', (req, res, next) => {
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id < 1) return res.status(400).json({ erro: 'ID inválido.' });
  const doc = db.prepare('SELECT * FROM documentos WHERE id=?').get(id);
  if (!doc) return res.status(404).json({ erro: 'Documento não encontrado.' });
  res.type('pdf'); res.setHeader('Content-Disposition', `inline; filename="documento-${id}.pdf"`);
  res.sendFile(caminhoPdf(doc), erro => { if (erro) next(erro) });
});
app.use('/api/documentos', require('./revisao'));
app.use('/api/documentos', require('./exportacao'));
app.use('/api', (req, res) => res.status(404).json({ erro: 'Operação não encontrada. Atualize a página com Ctrl+F5.' }));
app.use('/vendor/pdfjs', express.static(path.dirname(require.resolve('pdfjs-dist/package.json'))));
app.use(express.static(path.join(__dirname, 'public'), { etag: false, maxAge: 0 }));
app.use((erro, req, res, next) => {
  console.error(erro.message);
  if (res.headersSent) return next(erro);
  const status = erro.status >= 400 && erro.status < 600 ? erro.status : 500;
  res.status(status).json({ erro: status === 400 ? 'Requisição inválida.' : status === 404 ? 'Arquivo não encontrado.' : 'Não foi possível concluir a operação. Consulte o terminal do servidor.' });
});
if (require.main === module) {
  const porta = Number(process.env.PORT || 3000);
  const server = app.listen(porta, '0.0.0.0', () => { console.log(`Sistema disponível em http://localhost:${porta}`); retomar(); });
  server.on('error', erro => { console.error(erro.code === 'EADDRINUSE' ? `A porta ${porta} já está em uso. Feche a outra instância do servidor.` : erro.message); process.exitCode = 1; });
}
module.exports = app;
