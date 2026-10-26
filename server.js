// Entrada HTTP: configura Express e conecta rotas de upload, revisao e exportacao.
const express = require('express');
const path = require('node:path');
const crypto = require('node:crypto');
const db = require('./database');
const { retomar, enfileirar, caminhoPdf } = require('./processamento');
const {registrar}=require('./auditoria');
const app = express();
app.disable('x-powered-by');
// Acesso por senha opcional no uso local e obrigatório quando exposto na rede.
const senha = process.env.CONVERSOR_PASSWORD;
if (senha) app.use((req,res,next)=>{
  const autorizacao=req.headers.authorization||'';
  const credenciais=/^Basic (.+)$/i.exec(autorizacao);
  let recebida='';
  if(credenciais){try{recebida=Buffer.from(credenciais[1],'base64').toString('utf8').split(':').slice(1).join(':');}catch{}}
  const a=crypto.createHash('sha256').update(recebida).digest();
  const b=crypto.createHash('sha256').update(senha).digest();
  if(!crypto.timingSafeEqual(a,b)){
    res.setHeader('WWW-Authenticate','Basic realm="Conversor PDF", charset="UTF-8"');
    return res.status(401).send('Acesso restrito.');
  }
  next();
});
app.use(express.json({ limit: '1mb' }));
// This local app is intended for a trusted LAN. Reject cross-site browser writes.
app.use('/api', (req, res, next) => {
  if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) && req.headers.origin) {
    let host; try { host = new URL(req.headers.origin).host } catch { return res.status(403).json({ erro: 'Origem inválida.' }) }
    if (host !== req.headers.host) return res.status(403).json({ erro: 'Abra o sistema pelo endereço do servidor.' });
  }
  res.setHeader('Cache-Control', 'no-store'); next();
});
app.get('/api/status', (req, res) => { db.prepare('SELECT 1').get(); res.json({ funcionando: true, sistema: 'Conversor PDF para XML', versao: require('./package.json').version, banco: 'conectado' }); });
app.use('/api/tomadores', require('./tomadores'));
app.get('/api/documentos', (req, res) => {
  if (req.query.pagina !== undefined) {
    const pagina = Number(req.query.pagina);
    if (!Number.isSafeInteger(pagina) || pagina < 1) return res.status(400).json({ erro: 'Página inválida.' });
    const filtro = String(req.query.filtro || 'todos');
    if (!['todos','revisados','pendentes','fila','erro','aprovados','lixeira'].includes(filtro)) return res.status(400).json({ erro: 'Filtro inválido.' });
    const busca = String(req.query.busca || '').trim().slice(0, 100);
    const condicoes = [filtro==='lixeira'?'excluido_em IS NOT NULL':'excluido_em IS NULL'], parametros = {};
    if (busca) {
      condicoes.push('(nome_arquivo LIKE @busca OR numero_nota LIKE @busca OR nome_prestador LIKE @busca OR nome_tomador LIKE @busca)');
      parametros.busca = `%${busca}%`;
    }
    if (filtro === 'revisados') condicoes.push("json_extract(dados_json,'$.revisado_em') IS NOT NULL");
    if (filtro === 'pendentes') condicoes.push("json_extract(dados_json,'$.revisado_em') IS NULL AND processamento NOT IN ('fila','processando')");
    if (filtro === 'fila') condicoes.push("processamento IN ('fila','processando')");
    if (filtro === 'erro') condicoes.push("processamento='erro'");
    if (filtro === 'aprovados') condicoes.push("status='conferido'");
    const onde = condicoes.length ? `WHERE ${condicoes.join(' AND ')}` : '';
    const total = db.prepare(`SELECT count(*) AS n FROM documentos ${onde}`).get(parametros).n;
    const limite = 25, paginas = Math.max(1, Math.ceil(total / limite));
    const atual = Math.min(pagina, paginas);
    const registros = db.prepare(`SELECT id,nome_arquivo,modelo,numero_nota,nome_prestador,nome_tomador,valor_servicos_centavos,status,criado_em,processamento,erro_processamento,excluido_em,dados_json FROM documentos ${onde} ORDER BY id DESC LIMIT @limite OFFSET @offset`).all({...parametros,limite,offset:(atual-1)*limite});
    const resumo = db.prepare("SELECT count(*) total, sum(processamento IN ('fila','processando')) fila, sum(json_extract(dados_json,'$.revisado_em') IS NULL AND processamento NOT IN ('fila','processando')) pendentes, sum(json_extract(dados_json,'$.revisado_em') IS NOT NULL) revisados FROM documentos WHERE excluido_em IS NULL").get();
    return res.json({ documentos: registros.map(({dados_json,...doc})=>{const d=JSON.parse(dados_json||'{}');return {...doc,revisado_em:d.revisado_em||null,aprovado_em:d.aprovado_em||null,concluido_manual_em:d.concluido_manual_em||null,avisos:d.avisos||[],metodo_leitura:d.metodo_leitura||null};}), pagina:atual, paginas, total, resumo });
  }
  const documentos = db.prepare(`SELECT id,nome_arquivo,modelo,numero_nota,nome_prestador,nome_tomador,valor_servicos_centavos,status,criado_em,processamento,erro_processamento,dados_json FROM documentos WHERE excluido_em IS NULL ORDER BY id DESC`).all();
  res.json(documentos.map(({ dados_json, ...doc }) => { const d = JSON.parse(dados_json || '{}'); return { ...doc, revisado_em: d.revisado_em || null, avisos: d.avisos || [], metodo_leitura: d.metodo_leitura || null }; }));
});
// Rotas da biblioteca: envio, exclusão, nova leitura e acesso ao PDF original.
app.use('/api/documentos/upload', require('./upload'));
app.delete('/api/documentos/:id', (req, res, next) => {
  if(process.env.CONVERSOR_DELETE_PASSWORD){
    const fornecida=String(req.headers['x-delete-password']||'');
    const esperada=process.env.CONVERSOR_DELETE_PASSWORD;
    const a=crypto.createHash('sha256').update(fornecida).digest();
    const b=crypto.createHash('sha256').update(esperada).digest();
    if(!crypto.timingSafeEqual(a,b))return res.status(403).json({erro:'Senha de exclusão necessária.'});
  }
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id < 1) return res.status(400).json({ erro: 'ID inválido.' });
  try {
    const doc = db.prepare('SELECT * FROM documentos WHERE id=?').get(id);
    if (!doc || doc.excluido_em) return res.status(404).json({ erro: 'Documento não encontrado.' });
    if (['fila', 'processando'].includes(doc.processamento)) return res.status(409).json({ erro: 'Aguarde a leitura terminar antes de excluir este documento.' });
    db.prepare("UPDATE documentos SET excluido_em=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=? AND excluido_em IS NULL").run(id);
    registrar(req,id,'movido_lixeira',{nome_arquivo:doc.nome_arquivo});
    res.json({ mensagem: 'Documento movido para a lixeira.', id });
  } catch (erro) { next(erro); }
});
app.post('/api/documentos/:id/restaurar', (req,res)=>{
  const id=Number(req.params.id);
  if(!Number.isSafeInteger(id)||id<1)return res.status(400).json({erro:'ID inválido.'});
  const doc=db.prepare('SELECT * FROM documentos WHERE id=?').get(id);
  if(!doc||!doc.excluido_em)return res.status(404).json({erro:'Documento não está na lixeira.'});
  db.prepare('UPDATE documentos SET excluido_em=NULL WHERE id=?').run(id);
  registrar(req,id,'restaurado');
  res.json({mensagem:'Documento restaurado.',id});
});
app.post('/api/documentos/:id/processar', (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id < 1) return res.status(400).json({ erro: 'ID inválido.' });
  const doc = db.prepare('SELECT * FROM documentos WHERE id=?').get(id);
  if (!doc || doc.excluido_em) return res.status(404).json({ erro: 'Documento não encontrado.' });
  if (JSON.parse(doc.dados_json || '{}').revisado_em || doc.status === 'conferido') return res.status(409).json({ erro: 'Este documento já foi revisado. A edição manual foi preservada.' });
  enfileirar(id); res.status(202).json({ mensagem: 'Documento adicionado à fila.' });
});
app.get('/api/documentos/:id/pdf', (req, res, next) => {
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id < 1) return res.status(400).json({ erro: 'ID inválido.' });
  const doc = db.prepare('SELECT * FROM documentos WHERE id=?').get(id);
  if (!doc || doc.excluido_em) return res.status(404).json({ erro: 'Documento não encontrado.' });
  res.type('pdf'); res.setHeader('Content-Disposition', `inline; filename="documento-${id}.pdf"`);
  res.sendFile(caminhoPdf(doc), erro => { if (erro) next(erro) });
});
// Revisão e exportação têm rotas próprias para manter o servidor principal curto.
app.use('/api/documentos', require('./revisao'));
app.use('/api/documentos', require('./exportacao'));
app.use('/api', (req, res) => res.status(404).json({ erro: 'Operação não encontrada. Atualize a página com Ctrl+F5.' }));
// Arquivos do navegador e bibliotecas usadas apenas pela prévia local do PDF.
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
  const host = process.env.CONVERSOR_HOST || '127.0.0.1';
  if (!['127.0.0.1','localhost','::1'].includes(host) && (!senha||!process.env.CONVERSOR_DELETE_PASSWORD)) { console.error('Defina CONVERSOR_PASSWORD e CONVERSOR_DELETE_PASSWORD para permitir acesso pela rede.'); process.exit(1); }
  const server = app.listen(porta, host, () => { console.log(`Sistema disponível em http://${host}:${porta}`); retomar(); });
  server.on('error', erro => { console.error(erro.code === 'EADDRINUSE' ? `A porta ${porta} já está em uso. Feche a outra instância do servidor.` : erro.message); process.exitCode = 1; });
}
module.exports = app;
