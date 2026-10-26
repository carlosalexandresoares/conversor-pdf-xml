// Organiza a fila, inicia o leitor isolado e grava o resultado da extracao.
const {fork}=require('node:child_process');
const path=require('node:path');
const db=require('./database');
const {extrairCampos}=require('./extrator');
const {extrairComplementos}=require('./extrator-complementos');
const {extrairGenerico}=require('./extrator-generico');
const {extrairDanfse}=require('./extrator-danfse');
const {extrairQive}=require('./extrator-qive');
const {extrairPoa}=require('./extrator-poa');
const {preencherCodigosMunicipios}=require('./municipios');
const {atualizarAvisosValidacao}=require('./validacao-extracao');
const pastaUploads=process.env.CONVERSOR_UPLOAD_DIR || path.join(__dirname,'uploads');
const fila=[]; const ativos=new Set(); let trabalhando=false;
// Resolve somente nomes de arquivo dentro da pasta de uploads.
function caminhoPdf(doc) {
  const caminho=path.resolve(pastaUploads,path.basename(doc.caminho_pdf || ''));
  if(!doc.caminho_pdf || path.dirname(caminho)!==path.resolve(pastaUploads)) throw new Error('PDF original não localizado.');
  return caminho;
}
// Executa a leitura em processo filho com limite de memória e tempo.
function lerPdf(caminho) {
  return new Promise((resolve,reject)=>{
    const child=fork(path.join(__dirname,'leitor-worker.js'),[],{stdio:['ignore','ignore','pipe','ipc'],execArgv:['--max-old-space-size=512']});
    let fim=false;
    const timer=setTimeout(()=>finalizar(new Error('Tempo limite de 180 segundos excedido. Divida o PDF ou revise manualmente.')),180000);
    function finalizar(erro,dados) {
      if(fim)return;fim=true;clearTimeout(timer);child.kill();
      if(erro)reject(erro);else resolve(dados);
    }
    child.on('error',erro=>finalizar(erro));
    child.on('exit',()=>finalizar(new Error('A leitura foi interrompida. O documento pode ser revisado manualmente.')));
    child.on('message',msg=>msg.ok?finalizar(null,msg):finalizar(new Error(msg.erro)));
    // Drain stderr without exposing PDF contents or filling the pipe.
    child.stderr.on('data',()=>{});
    child.send({caminho});
  });
}
// Combina o resultado do leitor com adaptadores conhecidos e códigos municipais.
function interpretar(texto,extracao) {
  const poa=extrairPoa(texto);
  if(poa){
    const generico=extrairGenerico(texto);
    const dados={...generico.dados};
    const origens={...generico.origens};
    for(const [campo,valor] of Object.entries(poa))if(valor!=null){dados[campo]=valor;origens[campo]={metodo:'layout poa'};}
    dados.origens=origens;dados.avisos=generico.avisos;
    preencherCodigosMunicipios(dados);atualizarAvisosValidacao(dados);
    return dados;
  }
  const qive=extracao||extrairQive(texto);
  if(qive){
    const dados={...qive.dados,origens:qive.origens,avisos:qive.avisos};
    preencherCodigosMunicipios(dados);
    atualizarAvisosValidacao(dados);
    return dados;
  }
  const generico=extrairGenerico(texto);
  let dados={...generico.dados},origens={...generico.origens};
  try {
    const conhecido=extrairDanfse(texto)||{...extrairCampos(texto),...extrairComplementos(texto)};
    for(const [campo,valor] of Object.entries(conhecido)) if(valor!=null) {dados[campo]=valor;origens[campo]={metodo:'layout '+conhecido.modelo};}
  } catch(erro) { if(!/Layout ainda/.test(erro.message)) generico.avisos.push('Adaptador específico indisponível; usada leitura por rótulos.'); }
  if(dados.modelo==='generico') generico.avisos.push('Layout sem adaptador específico. Os campos encontrados por rótulo precisam de conferência.');
  dados.origens=origens;
  dados.avisos=generico.avisos;
  preencherCodigosMunicipios(dados);
  atualizarAvisosValidacao(dados);
  return dados;
}
// Consome a fila em ordem e só grava se a revisão não mudou durante a leitura.
async function consumir() {
  if(trabalhando)return;trabalhando=true;
  try {
    while(fila.length) {
      const id=fila.shift();
      try {
        const doc=db.prepare('SELECT * FROM documentos WHERE id=? AND excluido_em IS NULL').get(id);
        if(!doc)continue;
        const anterior=JSON.parse(doc.dados_json||'{}');
        if(anterior.revisado_em||doc.status==='conferido') {db.prepare("UPDATE documentos SET processamento='pronto' WHERE id=?").run(id);continue;}
        db.prepare("UPDATE documentos SET processamento='processando',erro_processamento=NULL WHERE id=?").run(id);
        const leitura=await lerPdf(caminhoPdf(doc));
        const extraido=interpretar(leitura.texto,leitura.extracao);
        // Adaptadores de layouts conhecidos mantêm seus valores. A posição é
        // anexada apenas quando confirma exatamente o mesmo campo e valor.
        for(const [campo,origem] of Object.entries(leitura.evidencias?.origens||{})){
          if(extraido[campo]==null||String(extraido[campo])!==String(leitura.evidencias.dados[campo]))continue;
          extraido.origens??={};
          extraido.origens[campo]={...extraido.origens[campo],pagina:origem.pagina,area:origem.area,
            trecho:extraido.origens[campo]?.trecho||origem.trecho};
        }
        // Reviewed documents are excluded above. Retry must replace stale extraction.
        const dados={...extraido};
        for(const [campo,origem] of Object.entries(anterior.origens||{})) if(origem.metodo==='revisão manual') dados[campo]=anterior[campo];
        dados.avisos=[...new Set([...extraido.avisos,...leitura.avisos])];
        dados.metodo_leitura=leitura.metodo;dados.paginas=leitura.paginas;
        dados.campos_nao_encontrados=['numero_nota','data_emissao','cnpj_prestador','cnpj_tomador','valor_servicos_centavos'].filter(c=>dados[c]==null);
        const colunas=['modelo','numero_nota','codigo_verificacao','data_emissao','competencia','cnpj_prestador','nome_prestador','cnpj_tomador','nome_tomador','valor_servicos_centavos','valor_liquido_centavos'];
        const resultado=db.prepare(`UPDATE documentos SET ${colunas.map(c=>c+'=?').join(',')},dados_json=?,texto_extraido=?,processamento='pronto',erro_processamento=NULL,processado_em=? WHERE id=? AND dados_json=?`).run(...colunas.map(c=>dados[c]??null),JSON.stringify(dados),leitura.texto,new Date().toISOString(),id,doc.dados_json);
        if(!resultado.changes) db.prepare("UPDATE documentos SET processamento='pronto',erro_processamento='Dados alterados durante a leitura; a revisão foi preservada.' WHERE id=?").run(id);
      } catch(erro) {
        console.error(`Documento ${id}: ${erro.message}`);
        db.prepare("UPDATE documentos SET processamento='erro',erro_processamento=? WHERE id=?").run(erro.message.slice(0,500),id);
      } finally {ativos.delete(id);}
    }
  } finally {trabalhando=false;}
}
// Impede o mesmo documento de entrar duas vezes na fila ativa.
function enfileirar(id) {
  if(ativos.has(id))return;
  ativos.add(id);fila.push(id);
  db.prepare("UPDATE documentos SET processamento='fila',erro_processamento=NULL WHERE id=?").run(id);
  setImmediate(()=>consumir().catch(erro=>console.error('Fila:',erro.message)));
}
// Recupera leituras interrompidas quando o servidor volta a iniciar.
function retomar() {
  for(const doc of db.prepare("SELECT id,dados_json,processamento FROM documentos WHERE excluido_em IS NULL AND processamento IN ('novo','fila','processando')").all()) {
    const dados=JSON.parse(doc.dados_json||'{}');
    if(dados.modelo || dados.revisado_em) db.prepare("UPDATE documentos SET processamento='pronto' WHERE id=?").run(doc.id);
    else enfileirar(doc.id);
  }
}
module.exports={enfileirar,retomar,caminhoPdf,pastaUploads,interpretar,lerPdf};
