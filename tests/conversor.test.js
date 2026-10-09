const {test,before,after}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const pasta=fs.mkdtempSync(path.join(os.tmpdir(),'conversor-test-'));
process.env.CONVERSOR_DATA_DIR=path.join(pasta,'data');
process.env.CONVERSOR_UPLOAD_DIR=path.join(pasta,'uploads');
const app=require('../server');
const db=require('../database');
const {interpretar,lerPdf}=require('../processamento');
const {gerarXml}=require('../exportacao');
let server,base;
before(async()=>{server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));base=`http://127.0.0.1:${server.address().port}`;});
after(async()=>{await new Promise(r=>server.close(r));db.close();fs.rmSync(pasta,{recursive:true,force:true});});
async function enviar(nome,buffer){const f=new FormData();f.append('pdf',new Blob([buffer],{type:'application/pdf'}),nome);const r=await fetch(base+'/api/documentos/upload',{method:'POST',body:f});return {status:r.status,dados:await r.json()};}
async function esperar(id){for(let i=0;i<400;i++){const d=db.prepare('SELECT * FROM documentos WHERE id=?').get(id);if(!['fila','processando'].includes(d.processamento))return d;await new Promise(r=>setTimeout(r,100));}throw Error('Processamento não terminou');}
test('Extração conservadora não escolhe números conflitantes nem presume valores',()=>{
 const dados=interpretar('Numero da Nota: 123\nNumero da Nota: 456\nValor dos Servicos: 0,00');
 assert.equal(dados.numero_nota,undefined);assert.equal(dados.valor_servicos_centavos,0);assert.ok(dados.avisos.some(v=>v.includes('diferentes')));
 const xml=gerarXml({});assert.ok(!xml.includes('<IssRetido>'));assert.ok(!xml.includes('<Aliquota>'));assert.ok(!xml.includes('NaN'));
 assert.ok(gerarXml({cnpj_tomador:'12345678909',nome_tomador:'A & B <C>',valor_servicos_centavos:0}).includes('<Cpf>12345678909</Cpf>'));
 assert.ok(gerarXml({nome_tomador:'A & B <C>'}).includes('A &amp; B &lt;C&gt;'));
});
test('PDF digitalizado passa pelo OCR local', {timeout:60000},async()=>{
 const r=await lerPdf(path.join(__dirname,'fixtures/digitalizado.pdf'));
 assert.equal(r.metodo,'ocr');assert.ok(r.texto.includes('998877'));
 const d=interpretar(r.texto);assert.equal(d.numero_nota,'998877');assert.equal(d.valor_servicos_centavos,123456);assert.equal(d.valor_iss_centavos,6173);
});
test('Upload, duplicidade, falha isolada, revisão concorrente e ZIP', {timeout:60000},async()=>{
 const buffer=fs.readFileSync(path.join(__dirname,'fixtures/layout-generico.pdf'));
 assert.equal((await enviar('nao-pdf.pdf',Buffer.from('texto'))).status,400);
 const ok=await enviar('layout-generico.pdf',buffer);assert.equal(ok.status,201);const id=ok.dados.id;
 const d=await esperar(id);assert.equal(d.processamento,'pronto');assert.equal(d.numero_nota,'998877');
 const duplicado=await enviar('outro-nome.pdf',buffer);assert.equal(duplicado.status,200);assert.equal(duplicado.dados.id,id);assert.equal(duplicado.dados.duplicado,true);
 const invalido=await enviar('invalido.pdf',Buffer.from('%PDF-invalido'));assert.equal(invalido.status,201);assert.equal((await esperar(invalido.dados.id)).processamento,'erro');
 assert.equal((await fetch(base+'/api/status')).status,200);
 const antes=await (await fetch(base+`/api/documentos/${id}/revisao`)).json();
 const body={campos:{nome_tomador:'Cliente revisado',valor_servicos_centavos:'0,00'},versao:antes.versao};
 const options={method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)};
 assert.equal((await fetch(base+`/api/documentos/${id}/revisao`,options)).status,200);
 assert.equal((await fetch(base+`/api/documentos/${id}/revisao`,options)).status,409);
 assert.equal((await fetch(base+`/api/documentos/${id}/processar`,{method:'POST'})).status,409);
 const xml=await (await fetch(base+`/api/documentos/${id}/xml`)).text();assert.ok(xml.includes('<ValorServicos>0.00</ValorServicos>'));assert.ok(xml.includes('Cliente revisado'));
 assert.equal((await fetch(base+`/api/documentos/${invalido.dados.id}/xml`)).status,200);
 const zip=await fetch(base+'/api/documentos/xml-lote',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({ids:[id,invalido.dados.id]})});
 assert.equal(zip.status,200);const bytes=Buffer.from(await zip.arrayBuffer());assert.equal(bytes.subarray(0,2).toString(),'PK');assert.ok(bytes.includes(Buffer.from('relatorio-exportacao.txt')));assert.ok(bytes.includes(Buffer.from(`documento-${id}-abrasf.xml`)));
 assert.equal((await fetch(base+'/api/documentos/xml-lote',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({ids:[9999]})})).status,404);
 const manual=await(await fetch(base+`/api/documentos/${invalido.dados.id}/revisao`)).json();
 const salvarManual=await fetch(base+`/api/documentos/${invalido.dados.id}/revisao`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({versao:manual.versao,campos:{numero_nota:'123'}})});
 assert.equal(salvarManual.status,200);
});
