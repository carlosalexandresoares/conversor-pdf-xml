// Backup consistente do SQLite e dos PDFs referenciados, com hashes verificáveis.
const fs=require('node:fs/promises');
const path=require('node:path');
const crypto=require('node:crypto');
const db=require('../database');
const raiz=path.resolve(__dirname,'..');
const destino=path.resolve(process.argv[2]||path.join(raiz,'backups',new Date().toISOString().replace(/[:.]/g,'-')));
const uploads=path.resolve(process.env.CONVERSOR_UPLOAD_DIR||path.join(raiz,'uploads'));
async function hash(arquivo){return crypto.createHash('sha256').update(await fs.readFile(arquivo)).digest('hex');}
(async()=>{
  await fs.mkdir(path.join(destino,'uploads'),{recursive:true});
  const banco=path.join(destino,'conversor.db');
  await db.backup(banco);
  const copia=new (require('better-sqlite3'))(banco,{readonly:true});
  const docs=copia.prepare('SELECT id,caminho_pdf,hash_pdf FROM documentos').all();copia.close();
  const manifesto={criado_em:new Date().toISOString(),arquivos:[]};
  for(const doc of docs){
    if(!doc.caminho_pdf)continue;
    const origem=path.join(uploads,path.basename(doc.caminho_pdf));
    const nome=path.basename(origem),alvo=path.join(destino,'uploads',nome);
    await fs.copyFile(origem,alvo);
    const digest=await hash(alvo);
    if(doc.hash_pdf&&doc.hash_pdf!==digest)throw new Error(`PDF #${doc.id} mudou durante o backup; tente novamente.`);
    manifesto.arquivos.push({id:doc.id,nome,sha256:digest});
  }
  manifesto.banco_sha256=await hash(banco);
  await fs.writeFile(path.join(destino,'manifesto.json'),JSON.stringify(manifesto,null,2));
  console.log(`Backup criado em ${destino}. Execute npm run verificar-backup -- "${destino}".`);
})().catch(erro=>{console.error(erro.message);process.exitCode=1;}).finally(()=>db.close());
