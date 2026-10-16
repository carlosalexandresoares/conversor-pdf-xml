const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const crypto=require('node:crypto');
const {spawnSync}=require('node:child_process');
const raiz=path.resolve(__dirname,'..');
test('Backup preserva banco e PDFs e passa pela restauração de teste',()=>{
  const pasta=fs.mkdtempSync(path.join(os.tmpdir(),'conversor-operacao-'));
  try{
    const data=path.join(pasta,'data'),uploads=path.join(pasta,'uploads'),backup=path.join(pasta,'backup');
    fs.mkdirSync(uploads);
    const pdf=Buffer.from('%PDF-exemplo'),nome='exemplo.pdf';fs.writeFileSync(path.join(uploads,nome),pdf);
    const ambiente={...process.env,CONVERSOR_DATA_DIR:data,CONVERSOR_UPLOAD_DIR:uploads};
    const preparar=spawnSync(process.execPath,['-e',`const db=require('./database');db.prepare('INSERT INTO documentos(nome_arquivo,caminho_pdf,hash_pdf) VALUES (?,?,?)').run('exemplo.pdf','uploads/exemplo.pdf','${crypto.createHash('sha256').update(pdf).digest('hex')}');db.close()`],{cwd:raiz,env:ambiente,encoding:'utf8'});
    assert.equal(preparar.status,0,preparar.stderr);
    const criar=spawnSync(process.execPath,['scripts/backup.cjs',backup],{cwd:raiz,env:ambiente,encoding:'utf8'});
    assert.equal(criar.status,0,criar.stderr);
    const verificar=spawnSync(process.execPath,['scripts/verificar-backup.cjs',backup],{cwd:raiz,env:ambiente,encoding:'utf8'});
    assert.equal(verificar.status,0,verificar.stderr);
    assert.match(verificar.stdout,/1 documentos, 1 PDFs/);
    const manifestoPath=path.join(backup,'manifesto.json');
    const manifesto=JSON.parse(fs.readFileSync(manifestoPath,'utf8'));
    const conferir=()=>spawnSync(process.execPath,['scripts/verificar-backup.cjs',backup],{cwd:raiz,env:ambiente,encoding:'utf8'});
    fs.writeFileSync(manifestoPath,JSON.stringify({...manifesto,arquivos:[]}));
    const incompleto=conferir();
    assert.notEqual(incompleto.status,0);
    assert.match(incompleto.stderr,/ausente do manifesto/);
    fs.writeFileSync(manifestoPath,JSON.stringify({...manifesto,arquivos:[...manifesto.arquivos,...manifesto.arquivos]}));
    assert.notEqual(conferir().status,0,'Manifesto duplicado deve ser rejeitado');
    fs.writeFileSync(manifestoPath,JSON.stringify(manifesto));
    fs.writeFileSync(path.join(backup,'uploads',nome),'PDF alterado');
    assert.notEqual(conferir().status,0,'PDF alterado deve ser rejeitado');
  }finally{fs.rmSync(pasta,{recursive:true,force:true});}
});
