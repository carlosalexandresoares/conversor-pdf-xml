const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const pasta=fs.mkdtempSync(path.join(os.tmpdir(),'conversor-auth-'));
process.env.CONVERSOR_DATA_DIR=path.join(pasta,'data');
process.env.CONVERSOR_UPLOAD_DIR=path.join(pasta,'uploads');
process.env.CONVERSOR_PASSWORD='senha-de-teste';
process.env.CONVERSOR_DELETE_PASSWORD='exclusao-de-teste';
const app=require('../server');
const db=require('../database');
test('Acesso com senha protege PDFs e API',async()=>{
  const server=app.listen(0,'127.0.0.1');
  await new Promise(resolve=>server.once('listening',resolve));
  const base=`http://127.0.0.1:${server.address().port}`;
  try{
    assert.equal((await fetch(base+'/api/status')).status,401);
    assert.equal((await fetch(base+'/')).status,401);
    const errada=Buffer.from('usuario:errada').toString('base64');
    assert.equal((await fetch(base+'/api/status',{headers:{Authorization:`Basic ${errada}`}})).status,401);
    const correta=Buffer.from('usuario:senha-de-teste').toString('base64');
    assert.equal((await fetch(base+'/api/status',{headers:{Authorization:`Basic ${correta}`}})).status,200);
    const id=Number(db.prepare("INSERT INTO documentos(nome_arquivo,processamento) VALUES (?,'pronto')").run('teste.pdf').lastInsertRowid);
    assert.equal((await fetch(base+`/api/documentos/${id}`,{method:'DELETE',headers:{Authorization:`Basic ${correta}`}})).status,403);
    assert.equal((await fetch(base+`/api/documentos/${id}`,{method:'DELETE',headers:{Authorization:`Basic ${correta}`,'X-Delete-Password':'exclusao-de-teste'}})).status,200);
  }finally{await new Promise(resolve=>server.close(resolve));db.close();fs.rmSync(pasta,{recursive:true,force:true});}
});
