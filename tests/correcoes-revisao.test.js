const {test,before,after}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const pasta=fs.mkdtempSync(path.join(os.tmpdir(),'conversor-correcoes-'));
process.env.CONVERSOR_DATA_DIR=path.join(pasta,'data');
process.env.CONVERSOR_UPLOAD_DIR=path.join(pasta,'uploads');
const db=require('../database');
const app=require('../server');
const {avisosValidacao}=require('../validacao-extracao');
let server,base;
before(async()=>{server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));base=`http://127.0.0.1:${server.address().port}/api/documentos`;});
after(async()=>{await new Promise(r=>server.close(r));db.close();fs.rmSync(pasta,{recursive:true,force:true});});
const dadosBase=()=>({numero_nota:'42',codigo_verificacao:'ABCD1234',data_emissao:'2026-10-01',competencia_xml:'2026-10-01',cnpj_prestador:'11222333000181',nome_prestador:'Prestador sintético',cnpj_tomador:'12345678909',nome_tomador:'Tomador sintético',valor_servicos_centavos:10000,item_lista_servico:'01.05',incentivo_fiscal_xml:'2',iss_retido:'nao',revisado_em:'2026-10-01T00:00:00Z'});
function inserir(processamento='pronto',dados=dadosBase()){
  return Number(db.prepare('INSERT INTO documentos(nome_arquivo,processamento,erro_processamento,dados_json) VALUES (?,?,?,?)').run('sintetico.pdf',processamento,processamento==='erro'?'Falha original de OCR':null,JSON.stringify(dados)).lastInsertRowid);
}
const abrir=id=>fetch(`${base}/${id}/revisao`).then(r=>r.json());
const acao=(id,rota,corpo={})=>fetch(`${base}/${id}/${rota}`,{method:rota==='revisao'?'PUT':'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(corpo)});
async function salvar(id,campos){const doc=await abrir(id);return acao(id,'revisao',{versao:doc.versao,campos});}
async function atual(id,rota){const doc=await abrir(id);return acao(id,rota,{versao:doc.versao});}

test('Aprovação rejeita versão ausente ou antiga e aprova somente o que foi conferido',async()=>{
  const id=inserir(),antigo=await abrir(id);
  assert.equal((await salvar(id,{valor_servicos_centavos:'900,00'})).status,200);
  assert.equal((await acao(id,'aprovar')).status,409);
  assert.equal((await acao(id,'aprovar',{versao:antigo.versao})).status,409);
  assert.equal((await fetch(`${base}/${id}/xml`)).status,409);
  assert.equal((await atual(id,'aprovar')).status,200);
  const aprovado=await abrir(id);
  assert.equal(aprovado.dados.valor_servicos_centavos,90000);
  assert.equal((await acao(id,'reabrir',{versao:antigo.versao})).status,409);
  assert.equal((await salvar(id,{nome_tomador:'Alteração bloqueada'})).status,409);
  assert.equal((await atual(id,'reabrir')).status,200);
  assert.equal((await fetch(`${base}/${id}/xml`)).status,409);
});

test('Falha de leitura pode ser concluída manualmente sem apagar o erro e exige aprovação posterior',async()=>{
  const id=inserir('erro');
  assert.equal((await salvar(id,{nome_prestador:'Prestador conferido'})).status,200);
  assert.equal((await atual(id,'aprovar')).status,409);
  assert.equal((await fetch(`${base}/${id}/xml?rascunho=1`)).status,409);
  assert.equal((await atual(id,'concluir-manual')).status,200);
  const doc=db.prepare('SELECT * FROM documentos WHERE id=?').get(id);
  assert.equal(doc.processamento,'erro');
  assert.equal(doc.erro_processamento,'Falha original de OCR');
  assert.ok(JSON.parse(doc.dados_json).concluido_manual_em);
  assert.equal((await fetch(`${base}/${id}/xml?rascunho=1`)).status,200);
  assert.equal((await fetch(`${base}/${id}/xml`)).status,409);
  assert.equal((await atual(id,'aprovar')).status,200);
  assert.equal((await fetch(`${base}/${id}/xml`)).status,200);
  const zip=await fetch(`${base}/xml-lote`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({ids:[id]})});
  assert.equal(zip.status,200);await zip.arrayBuffer();
  const eventos=await(await fetch(`${base}/${id}/historico`)).json();
  assert.ok(eventos.some(e=>e.acao==='concluido_manualmente'&&e.detalhes.erro_leitura==='Falha original de OCR'));
  assert.equal((await atual(id,'reabrir')).status,200);
  assert.equal((await salvar(id,{valor_servicos_centavos:'200,00'})).status,200);
  assert.equal((await abrir(id)).dados.concluido_manual_em,undefined);
  assert.equal((await atual(id,'aprovar')).status,409);
});

test('Conclusão manual rejeita pendências, versão antiga, leitura ativa e documentos na lixeira',async()=>{
  const incompleto=inserir('erro',{});
  assert.equal((await atual(incompleto,'concluir-manual')).status,409);
  assert.equal((await salvar(incompleto,{numero_nota:'55'})).status,200);
  assert.equal((await atual(incompleto,'concluir-manual')).status,409);
  assert.equal((await abrir(incompleto)).dados.concluido_manual_em,undefined);
  const id=inserir('erro'),anterior=await abrir(id);
  await salvar(id,{nome_prestador:'Outro nome'});
  assert.equal((await acao(id,'concluir-manual',{versao:anterior.versao})).status,409);
  const ativo=inserir('processando');
  assert.equal((await atual(ativo,'concluir-manual')).status,409);
  assert.equal((await fetch(`${base}/${ativo}/xml?rascunho=1`)).status,409);
  assert.equal((await fetch(`${base}/${id}`,{method:'DELETE'})).status,200);
  assert.equal((await acao(id,'concluir-manual',{versao:anterior.versao})).status,404);
});

test('Avisos legados são atualizados após correção e alertas de OCR continuam preservados',async()=>{
  const dados={...dadosBase(),cnpj_prestador:'11111111111111',base_calculo_centavos:10000,aliquota_percentual:5,valor_iss_centavos:9900};
  dados.avisos=[...avisosValidacao(dados),'OCR de baixa confiança.'];
  const id=inserir('pronto',dados);
  assert.equal((await salvar(id,{cnpj_prestador:'11222333000181',valor_iss_centavos:'5,00'})).status,200);
  const salvo=JSON.parse(db.prepare('SELECT dados_json FROM documentos WHERE id=?').get(id).dados_json);
  assert.deepEqual(salvo.avisos,['OCR de baixa confiança.']);
  assert.deepEqual(salvo.avisos_validacao,[]);
});
