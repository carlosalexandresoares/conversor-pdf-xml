// Extração determinística: rótulos, tipos de valor e proximidade na página.
const normalizar=s=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ').trim();
const texto=v=>v.trim()&&!/^[-*]+$/.test(v.trim())?v.trim():null;
const digitos=v=>/^(?:\d{11}|\d{14})$/.test(v.replace(/[.\/\-\s]/g,''))?v.replace(/\D/g,''):null;
const dinheiro=v=>{
  const m=v.trim().match(/^(?:R\$\s*)?(\d+(?:\.\d{3})*),(\d{2})$/i);
  if(!m)return null;const n=Number(m[1].replace(/\./g,''))*100+Number(m[2]);return Number.isSafeInteger(n)?n:null;
};
function data(v){
  const m=v.match(/^(\d{2})[/-](\d{2})[/-](\d{4})(?:[ T]+(\d{2}:\d{2})(?::(\d{2}))?)?$/);
  const iso=m?`${m[3]}-${m[2]}-${m[1]}`+(m[4]?`T${m[4]}:${m[5]||'00'}`:''):v;
  if(!/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2})?$/.test(iso))return null;
  const d=new Date(iso+(iso.length===10?'T00:00:00Z':'Z'));
  return !Number.isNaN(d.getTime())&&d.toISOString().slice(0,iso.length)===iso?iso:null;
}
const regras=[
 ['numero_nota',/^(?:numero|n[º°.o]*) (?:da |de )?(?:nota(?: fiscal)?|nfs-?e)$/,v=>/^\d+$/.test(v)?v:null],
 ['codigo_verificacao',/^codigo (?:de )?(?:verificacao|autenticidade)$/,v=>/^[a-z0-9.-]{4,60}$/i.test(v)?v:null],
 ['data_emissao',/^(?:data (?:e hora )?(?:de |da )?emissao|emissao (?:da )?nfs-?e)$/,data],
 ['competencia',/^competencia(?: da nfs-?e)?$/,v=>{const m=v.match(/^(0[1-9]|1[0-2])\/(\d{4})$/);return m?`${m[2]}-${m[1]}`:data(v)?.slice(0,7)||null;}],
 ['rps_numero',/^(?:numero (?:do )?rps|rps numero)$/,v=>/^\d+$/.test(v)?v:null],
 ['rps_serie',/^serie (?:do )?rps$/,texto],['rps_data',/^data (?:do )?rps$/,data],
 ['cnpj_{p}',/^(?:cpf\s*\/\s*cnpj(?:\s*\/\s*nif)?|cnpj\s*\/\s*cpf|cnpj|cpf)$/,digitos],
 ['nome_{p}',/^(?:nome(?:\s*\/\s*(?:nome empresarial|razao social))?|razao social|nome empresarial)$/,texto],
 ['{p}_endereco',/^(?:endereco|logradouro)$/,texto],['{p}_bairro',/^bairro$/,texto],
 ['{p}_complemento',/^complemento$/,texto],['{p}_numero',/^(?:numero|n[º°.]+)$/,v=>/^(?:\d+[a-z]?|s\/?n)$/i.test(v)?v:null],
 ['{p}_municipio',/^(?:municipio(?:\s*\/\s*uf)?|cidade)$/,texto],
 ['{p}_codigo_municipio',/^(?:codigo (?:ibge|do municipio)|ibge)$/,v=>/^\d{7}$/.test(v)?v:null],
 ['{p}_uf',/^uf$/,v=>/^(AC|AL|AP|AM|BA|CE|DF|ES|GO|MA|MT|MS|MG|PA|PB|PR|PE|PI|RJ|RN|RS|RO|RR|SC|SP|SE|TO)$/i.test(v)?v.toUpperCase():null],
 ['{p}_cep',/^cep$/,v=>/^\d{5}-?\d{3}$/.test(v)?v.replace('-',''):null],
 ['{p}_inscricao_municipal',/^(?:inscricao municipal|i\.?m\.?)$/,v=>/^[\d.\/-]+$/.test(v)&&/\d/.test(v)?v:null],
 ['{p}_email',/^e-?mail$/,v=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)?v:null],
 ['{p}_telefone',/^(?:telefone|fone)$/,v=>/^[+()\d\s-]{8,25}$/.test(v)?v:null],
 ['valor_servicos_centavos',/^valor (?:total (?:dos? )?)?(?:dos? )?servicos?$/,dinheiro],
 ['valor_total_nota_centavos',/^valor total (?:da )?(?:nota|nfs-?e)$/,dinheiro],
 ['valor_liquido_centavos',/^(?:valor|v\.) liquido(?: (?:da )?(?:nota|nfs-?e))?$/,dinheiro],
 ['base_calculo_centavos',/^(?:base (?:de )?calculo(?: do issqn)?|b\. calculo|bc issqn)$/,dinheiro],
 ['valor_iss_centavos',/^(?:(?:valor|v\.) (?:do )?iss(?:qn)?|iss(?:qn)? apurado)$/,dinheiro],
 ...['pis','cofins','ir','inss','csll','ibs','cbs'].map(t=>['valor_'+t+'_centavos',new RegExp('^(?:valor (?:total )?(?:do |da )?)?'+(t==='ir'?'ir(?:rf)?':t)+'$'),dinheiro]),
 ['aliquota_percentual',/^(?:aliquota(?: aplicada)?|aliq\.)$/,v=>{const m=v.match(/^(\d{1,3}(?:[.,]\d{1,4})?)\s*%?$/);const n=m?Number(m[1].replace(',','.')):NaN;return n>=0&&n<=100?n:null;}],
 ['iss_retido',/^(?:iss(?:qn)? retido|retencao do issqn)$/,v=>{const n=normalizar(v);return /^(?:2\s*-\s*)?(?:nao|nao retido)$/.test(n)?'nao':/^(?:1\s*-\s*)?(?:sim|retido)$/.test(n)?'sim':null;}],
 ['codigo_servico_municipal',/^codigo (?:do servico|municipal (?:do servico)?)$/,v=>/^[\d.-]+$/.test(v)?v:null],
 ['item_lista_servico',/^item (?:da )?lista (?:de )?servicos?$/,v=>/^\d{1,2}\.\d{2}$/.test(v)?v:null],
 ['discriminacao_servicos',/^(?:discriminacao|descricao) (?:dos? )?servicos?(?: prestados?)?$/,texto],
 ['municipio_prestacao',/^(?:municipio (?:da |de )?prestacao|local da prestacao(?: do servico)?)$/,texto],
 ['municipio_incidencia',/^municipio (?:da |de )?incidencia(?: do issqn)?$/,texto],
];
function rotulo(s){
  const n=normalizar(s).replace(/\s*\((?:r\$|%)\)\s*/g,'').replace(/\s*[:=]\s*$/,'').trim();
  const r=regras.find(([,re])=>re.test(n));return r?{campo:r[0],converter:r[2]}:null;
}
function papel(s){
  const n=normalizar(s).replace(/:$/,'');
  if(/^(?:(?:dados|identificacao) (?:do )?)?(?:prestador|emitente|fornecedor)(?: (?:de |do |dos? )?servicos?)?$/.test(n))return 'prestador';
  if(/^(?:(?:dados|identificacao) (?:do )?)?(?:tomador|destinatario|cliente)(?: (?:de |do |dos? )?servicos?)?$/.test(n))return 'tomador';
  if(/^(?:intermediario|servico prestado|valores(?: da nota)?|tributacao|retencoes|discriminacao dos servicos|descricao dos servicos)$/.test(n))return 'fim';
  return null;
}
function extrairPosicoes(paginas){
  const candidatos=new Map(),avisos=[],vistos=new Set();
  function registrar(campo,valor,origem){
    vistos.add(campo);if(valor==null)return;
    if(!candidatos.has(campo))candidatos.set(campo,[]);
    candidatos.get(campo).push({valor,origem});
  }
  paginas.forEach((pagina,indice)=>{
    const v=pagina.viewport;
    const itens=pagina.items.filter(i=>i.str?.trim()).map(i=>{
      const p=v? v.convertToViewportPoint(i.transform[4],i.transform[5]):[i.transform[4],-i.transform[5]];
      return {s:i.str.trim(),x:p[0],y:p[1],w:i.width||i.str.length*5,h:Math.max(6,Math.abs(i.height||i.transform[0]||10))};
    }).sort((a,b)=>a.y-b.y||a.x-b.x);
    const linhas=[];
    for(const i of itens){let l=linhas.find(l=>Math.abs(l.y-i.y)<=2);if(!l){l={y:i.y,itens:[]};linhas.push(l);}l.itens.push(i);}
    const unidades=[];
    for(const linha of linhas){
      const ordenados=linha.itens.sort((a,b)=>a.x-b.x);
      for(let i=0;i<ordenados.length;i++){
        let atual=ordenados[i];
        // Junta rótulos divididos em fragmentos, apenas quando a união é reconhecida.
        for(let n=Math.min(5,ordenados.length-i);n>1;n--){
          const grupo=ordenados.slice(i,i+n);
          if(grupo.some((a,j)=>j&&a.x-(grupo[j-1].x+grupo[j-1].w)>15))continue;
          const s=grupo.map(a=>a.s).join(' ');
          if(rotulo(s)||papel(s)){atual={...atual,s,w:grupo.at(-1).x+grupo.at(-1).w-atual.x};i+=n-1;break;}
        }
        const separado=atual.s.match(/^(.+?[:=])\s*(.+)$/);
        const label=separado&&rotulo(separado[1]);
        unidades.push({...atual,r:label||rotulo(atual.s),inline:label?separado[2]:null,papel:papel(atual.s)});
      }
    }
    const headings=unidades.filter(i=>i.papel);
    function pessoa(i){
      const anteriores=headings.filter(h=>h.y<i.y-2);
      if(!anteriores.length)return null;
      const ultimo=Math.max(...anteriores.map(h=>h.y));
      const linha=anteriores.filter(h=>Math.abs(h.y-ultimo)<=2).sort((a,b)=>a.x-b.x);
      const h=linha.filter(h=>h.x<=i.x+3).at(-1)||linha[0];
      return h.papel==='fim'?null:h.papel;
    }
    for(const label of unidades.filter(i=>i.r)){
      const p=pessoa(label);if(label.r.campo.includes('{p}')&&!p)continue;
      const campo=label.r.campo.replace('{p}',p);
      let valor=label.inline;
      if(!valor){
        const direita=unidades.filter(i=>Math.abs(i.y-label.y)<=2&&i.x>label.x+2).sort((a,b)=>a.x-b.x);
        const proximo=direita[0];
        if(proximo&&!proximo.r&&!proximo.papel&&proximo.x-(label.x+label.w)<Math.max(60,label.h*6)){
          const fim=direita.find(i=>i.r||i.papel)?.x??Infinity;
          valor=direita.filter(i=>i.x<fim).map(i=>i.s).join(' ');
        }else{
          const limiteX=direita.find(i=>i.r||i.papel)?.x??Infinity;
          const abaixo=unidades.filter(i=>i.y>label.y+3&&i.y<=label.y+Math.max(26,label.h*3)&&i.x>=label.x-2&&i.x<limiteX-2);
          const y=Math.min(...abaixo.map(i=>i.y));
          const linha=abaixo.filter(i=>Math.abs(i.y-y)<=2).sort((a,b)=>a.x-b.x);
          if(linha.length&&!linha.some(i=>i.r||i.papel))valor=linha.map(i=>i.s).join(' ');
        }
      }
      if(campo==='discriminacao_servicos'&&valor){
        const fim=Math.min(...unidades.filter(i=>i.y>label.y+3&&(i.r||i.papel)).map(i=>i.y),Infinity);
        const conteudo=unidades.filter(i=>i.y>label.y+3&&i.y<fim&&i.x>=label.x-2).sort((a,b)=>a.y-b.y||a.x-b.x);
        const grupos=[];
        for(const i of conteudo){
          let linha=grupos.at(-1);
          if(linha&&i.y-linha.y>Math.max(26,label.h*3))break;
          if(!linha||Math.abs(i.y-linha.y)>2){linha={y:i.y,itens:[]};grupos.push(linha);}linha.itens.push(i.s);
        }
        if(grupos.length)valor=(label.inline?valor+'\n':'')+grupos.map(g=>g.itens.join(' ')).join('\n');
        valor=valor.slice(0,10000);
      }
      const origem={metodo:'posição e rótulo',pagina:indice+1,trecho:`${label.s} → ${valor||'não identificado'}`,confianca:'conferir'};
      const convertido=valor?label.r.converter(valor.trim()):null;
      registrar(campo,convertido,origem);
      if(campo.endsWith('_municipio')&&convertido){
        const m=convertido.match(/^(.+?)\s*[-/]\s*([A-Z]{2})$/);
        if(m){candidatos.get(campo).at(-1).valor=m[1];registrar(campo.replace('_municipio','_uf'),m[2],origem);}
      }
      if(/^municipio_(prestacao|incidencia)$/.test(campo)&&convertido){
        const m=convertido.match(/^(.+?)\s*[-/]\s*([A-Z]{2})$/);
        if(m){candidatos.get(campo).at(-1).valor=m[1];registrar(campo.replace('municipio_','uf_'),m[2],origem);}
      }
    }
  });
  const dados={modelo:'generico_posicional'},origens={},conflitos=[];
  for(const [campo,opcoes] of candidatos){
    const unicos=[...new Set(opcoes.map(o=>o.valor))];
    if(unicos.length===1){dados[campo]=unicos[0];origens[campo]=opcoes[0].origem;}
    else {conflitos.push(campo);avisos.push(`Valores diferentes para ${campo} no PDF; confira o original antes de preencher.`);}
  }
  if(Object.keys(origens).length)avisos.unshift('Leitura por posição e rótulos, sem adaptador específico. Confira os campos com o PDF.');
  return {dados,origens,avisos,conflitos,vistos:[...vistos]};
}
async function lerPosicoes(buffer){
  const {getDocument}=await import('pdfjs-dist/legacy/build/pdf.mjs');
  const pdf=await getDocument({data:new Uint8Array(buffer),useSystemFonts:true,verbosity:0}).promise;
  try{
    const paginas=[];
    if(pdf.numPages>50)throw new Error('Limite de páginas excedido.');
    for(let i=1;i<=pdf.numPages;i++){const pagina=await pdf.getPage(i);paginas.push({items:(await pagina.getTextContent()).items,viewport:pagina.getViewport({scale:1})});}
    return extrairPosicoes(paginas);
  }finally{await pdf.destroy();}
}
function combinarPosicoes(posicional,generico){
  const dados={...generico.dados},origens={...generico.origens};
  // Um rótulo visto sem valor (traço, asteriscos ou conflito) não pode ser
  // preenchido acidentalmente por uma regex que alcançou outro campo.
  for(const c of posicional.vistos){delete dados[c];delete origens[c];}
  Object.assign(dados,posicional.dados);Object.assign(origens,posicional.origens);
  if(!Object.keys(posicional.origens).length)dados.modelo='generico';
  return {dados,origens,avisos:[...new Set([...generico.avisos,...posicional.avisos])]};
}
module.exports={extrairPosicoes,lerPosicoes,combinarPosicoes};
