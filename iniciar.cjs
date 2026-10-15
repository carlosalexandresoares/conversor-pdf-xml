// Iniciador local: verifica Node e dependencias antes de abrir o servidor.
'use strict';
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {spawn,spawnSync}=require('node:child_process');
const raiz=__dirname;
process.chdir(raiz);
const verificar=process.argv.includes('--verificar');

function executarNpm(args){
  return spawnSync(process.platform==='win32'?'npm.cmd':'npm',args,{
    cwd:raiz,stdio:verificar?'pipe':'inherit',shell:process.platform==='win32',windowsHide:true,
  });
}
function dependenciasValidas(){
  // Processo separado para não manter módulos nativos abertos durante npm ci.
  const teste=spawnSync(process.execPath,['-e',[
    "const DB=require('better-sqlite3');const db=new DB(':memory:');db.prepare('SELECT 1').get();db.close();",
    "for(const m of ['express','multer','archiver','pdf-parse','pdfjs-dist/package.json','tesseract.js','@tesseract.js-data/por'])require(m);",
  ].join('')],{cwd:raiz,stdio:'pipe',windowsHide:true});
  return teste.status===0;
}
async function main(){
  const [major,minor]=process.versions.node.split('.').map(Number);
  if(major<22||(major===22&&minor<13))throw new Error('Node.js muito antigo. Instale Node.js 24 LTS em https://nodejs.org/ e abra INICIAR.bat novamente.');
  for(const arquivo of ['package-lock.json','server.js','public/index.html']){
    if(!fs.existsSync(path.join(raiz,arquivo)))throw new Error(`Arquivo ausente: ${arquivo}. Copie a pasta completa do projeto.`);
  }
  const porta=Number(process.env.PORT||3000);
  if(!Number.isInteger(porta)||porta<1||porta>65535)throw new Error('PORT deve ser um número entre 1 e 65535.');
  const assinatura=crypto.createHash('sha256').update(fs.readFileSync(path.join(raiz,'package-lock.json'))).update(`${process.versions.modules}|${process.platform}|${process.arch}`).digest('hex');
  const marcador=path.join(raiz,'node_modules','.conversor-instalacao');
  let anterior;try{anterior=fs.readFileSync(marcador,'utf8').trim();}catch{}
  const validas=dependenciasValidas();
  if(verificar){
    if(!validas)throw new Error('Dependências ausentes ou incompatíveis. Abra INICIAR.bat para preparar este computador.');
    if(anterior&&anterior!==assinatura)throw new Error('Dependências precisam ser atualizadas. Abra INICIAR.bat.');
    console.log('Verificação concluída: Node.js, módulos nativos e arquivos necessários disponíveis.');
    return;
  }
  let instalar=!validas||(anterior&&anterior!==assinatura);
  if(!anterior&&validas){
    // Instalações feitas antes deste iniciador também precisam corresponder ao lockfile.
    instalar=executarNpm(['ls','--omit=dev','--depth=0']).status!==0;
  }
  if(instalar){
    console.log('Preparando as dependências deste computador. A primeira instalação precisa de internet e pode levar alguns minutos.');
    const r=executarNpm(['ci','--omit=dev','--no-audit','--no-fund']);
    if(r.error||r.status!==0)throw new Error('Não foi possível instalar as dependências. Confira a conexão, a permissão de escrita nesta pasta e as mensagens do npm acima. Use o instalador completo do Node.js, que inclui npm.');
    if(!dependenciasValidas())throw new Error('As dependências foram instaladas, mas não carregaram. Confira a versão/arquitetura do Node.js e as mensagens de instalação.');
  }
  fs.writeFileSync(marcador,assinatura);
  const app=require('./server');
  const {retomar}=require('./processamento');
  const url=`http://localhost:${porta}`;
  const server=app.listen(porta,'0.0.0.0',()=>{
    console.log(`\nSistema disponível em ${url}\nMantenha esta janela aberta enquanto usar o sistema. Para encerrar, pressione Ctrl+C.\n`);
    retomar();
    if(process.platform==='win32'){
      const navegador=spawn('powershell.exe',['-NoProfile','-NonInteractive','-Command',`Start-Process '${url}'`],{stdio:'ignore',windowsHide:true});
      navegador.on('error',()=>console.log(`Abra o navegador em ${url}`));
      navegador.on('exit',code=>{if(code)console.log(`Abra o navegador em ${url}`);});
    }
  });
  server.on('error',erro=>{
    console.error(erro.code==='EADDRINUSE'?`A porta ${porta} já está em uso. Feche a outra instância ou configure PORT com outra porta.`:erro.message);
    process.exitCode=1;
  });
}
main().catch(erro=>{console.error('\n'+erro.message);process.exitCode=1;});
