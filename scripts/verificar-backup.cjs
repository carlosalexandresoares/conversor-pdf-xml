// Testa a restauração em pasta temporária, sem alterar a biblioteca em uso.
const fs=require('node:fs/promises');
const os=require('node:os');
const path=require('node:path');
const crypto=require('node:crypto');
const Database=require('better-sqlite3');
const origem=process.argv[2];
if(!origem){console.error('Uso: npm run verificar-backup -- CAMINHO_DO_BACKUP');process.exit(1);}
async function hash(p){return crypto.createHash('sha256').update(await fs.readFile(p)).digest('hex');}
(async()=>{
  const pasta=await fs.mkdtemp(path.join(os.tmpdir(),'conversor-restauracao-'));
  try{
    const manifesto=JSON.parse(await fs.readFile(path.join(origem,'manifesto.json'),'utf8'));
    if(!Array.isArray(manifesto.arquivos))throw new Error('Lista de PDFs do manifesto inválida.');
    const banco=path.join(pasta,'conversor.db');await fs.copyFile(path.join(origem,'conversor.db'),banco);
    if(await hash(banco)!==manifesto.banco_sha256)throw new Error('Hash do banco não confere.');
    const db=new Database(banco,{readonly:true});
    try{
      if(db.pragma('integrity_check',{simple:true})!=='ok')throw new Error('Integridade do SQLite falhou.');
      const documentos=db.prepare('SELECT id,caminho_pdf,hash_pdf FROM documentos').all();
      const porId=new Map(documentos.map(doc=>[doc.id,doc]));
      const incluidos=new Set();
      for(const arquivo of manifesto.arquivos){
        if(!arquivo||!Number.isSafeInteger(arquivo.id)||incluidos.has(arquivo.id))throw new Error('Documento repetido ou inválido no manifesto.');
        if(typeof arquivo.nome!=='string'||!arquivo.nome||['.','..'].includes(arquivo.nome)||path.basename(arquivo.nome)!==arquivo.nome||path.win32.basename(arquivo.nome)!==arquivo.nome)throw new Error('Nome de PDF inválido no manifesto.');
        const doc=porId.get(arquivo.id);
        if(!doc||!doc.caminho_pdf||path.basename(doc.caminho_pdf)!==arquivo.nome)throw new Error(`PDF #${arquivo.id} não corresponde ao documento no banco restaurado.`);
        incluidos.add(arquivo.id);
        const alvo=path.join(pasta,arquivo.nome);await fs.copyFile(path.join(origem,'uploads',arquivo.nome),alvo);
        const digest=await hash(alvo);
        if(digest!==arquivo.sha256||(doc.hash_pdf&&digest!==doc.hash_pdf))throw new Error(`PDF #${arquivo.id} não confere.`);
      }
      for(const doc of documentos)if(doc.caminho_pdf&&!incluidos.has(doc.id))throw new Error(`PDF #${doc.id} referenciado pelo banco está ausente do manifesto.`);
      console.log(`Restauração de teste OK: ${db.prepare('SELECT count(*) n FROM documentos').get().n} documentos, ${manifesto.arquivos.length} PDFs.`);
    }finally{db.close();}
  }finally{await fs.rm(pasta,{recursive:true,force:true});}
})().catch(erro=>{console.error(erro.message);process.exitCode=1;});
