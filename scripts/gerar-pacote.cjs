// Cria um pacote de atualização apenas com código e arquivos necessários.
const fs=require('node:fs');
const path=require('node:path');
const archiver=require('archiver');
const raiz=path.resolve(__dirname,'..');
const destino=path.join(raiz,'dist','conversor-codigo.zip');
const ignorar=new Set(['.git','node_modules','data','uploads','dist','backups','.env']);
const legado=new Set(['campos.js','complementos.js','leitura.js','pendencias.js']);
const arquivos=[];
function coletar(pasta){
  for(const item of fs.readdirSync(pasta,{withFileTypes:true})){
    if(ignorar.has(item.name)||item.name.startsWith('.env.')||(pasta===raiz&&legado.has(item.name)))continue;
    const absoluto=path.join(pasta,item.name);
    if(item.isDirectory())coletar(absoluto);
    else if(item.isFile()&&(!/\.(pdf|db|db-shm|db-wal|zip|log)$/i.test(item.name)||absoluto.startsWith(path.join(raiz,'tests','fixtures')+path.sep)&&/\.pdf$/i.test(item.name)))arquivos.push(absoluto);
  }
}
coletar(raiz);
fs.mkdirSync(path.dirname(destino),{recursive:true});
const saida=fs.createWriteStream(destino),zip=archiver('zip',{zlib:{level:6}});
zip.on('error',erro=>{console.error(erro);process.exitCode=1;});
saida.on('close',()=>console.log(`Pacote criado: ${destino} (${arquivos.length} arquivos, ${zip.pointer()} bytes)`));
zip.pipe(saida);
for(const arquivo of arquivos)zip.file(arquivo,{name:path.relative(raiz,arquivo).replaceAll('\\','/')});
zip.finalize();
