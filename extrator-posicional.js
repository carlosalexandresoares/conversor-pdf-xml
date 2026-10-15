// Extração determinística: rótulos, tipos de valor e proximidade na página.
const {organizarDocumento,areaTrechos}=require('./layout-documento');
const normalizar=s=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ').trim();
const texto=v=>v.trim()&&!/^[-*]+$/.test(v.trim())?v.trim():null;
const municipioServico=v=>/^[\p{L}][\p{L}\s.'-]+\s*[-/]\s*[A-Z]{2}$/iu.test(v.trim())?v.trim():null;
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
 ['numero_nota',/^(?:(?:numero|n[º°.o]*) (?:da |de )?(?:nota(?: fiscal)?|nfs-?e)|nota (?:numero|n[º°.o]*))$/,v=>/^\d+$/.test(v)?v:null],
 ['codigo_verificacao',/^codigo (?:de )?(?:verificacao|autenticidade)$/,v=>/^[a-z0-9.-]{4,60}$/i.test(v)?v:null],
 ['codigo_verificacao',/^chave$/,v=>v.length<=20&&/[a-z]/i.test(v)&&/^[a-z0-9.-]{4,20}$/i.test(v)?v:null],
 ['data_emissao',/^(?:data (?:e hora )?(?:de |da )?emissao|emissao (?:da )?nfs-?e)$/,data],
 ['competencia',/^competencia(?: da nfs-?e)?$/,v=>{const m=v.match(/^(0[1-9]|1[0-2])\/(\d{4})$/);return m?`${m[2]}-${m[1]}`:data(v)?.slice(0,7)||null;}],
 ['rps_numero',/^(?:numero (?:do )?rps|rps numero)$/,v=>/^\d+$/.test(v)?v:null],
 ['rps_serie',/^serie (?:do )?rps$/,texto],['rps_data',/^data (?:do )?rps$/,data],
 ['cnpj_{p}',/^(?:cpf\s*\/\s*cnpj|cnpj\s*\/\s*cpf)(?:\s*\/\s*nif)?$|^(?:cnpj|cpf)$/,digitos],
 ['nome_{p}',/^(?:nome(?:\s*\/\s*(?:nome empresarial|razao social))?|razao social(?:\s*\/\s*nome)?|nome empresarial)$/,texto],
 ['{p}_endereco',/^(?:endereco(?: e cep)?|logradouro)$/,texto],['{p}_bairro',/^bairro$/,texto],
 ['{p}_complemento',/^complemento$/,texto],['{p}_numero',/^(?:numero|n[º°.]+)$/,v=>/^(?:\d+[a-z]?|s\/?n)$/i.test(v)?v:null],
 ['{p}_municipio',/^(?:municipio(?:\s*\/\s*uf)?|cidade)$/,texto],
 ['{p}_codigo_municipio',/^(?:codigo (?:ibge|do municipio)|ibge)$/,v=>/^\d{7}$/.test(v)?v:null],
 ['{p}_uf',/^uf$/,v=>/^(AC|AL|AP|AM|BA|CE|DF|ES|GO|MA|MT|MS|MG|PA|PB|PR|PE|PI|RJ|RN|RS|RO|RR|SC|SP|SE|TO)$/i.test(v)?v.toUpperCase():null],
 ['{p}_cep',/^cep$/,v=>/^\d{5}-?\d{3}$/.test(v)?v.replace('-',''):null],
 ['{p}_inscricao_municipal',/^(?:inscricao municipal|i\.?m\.?|ccm)$/,v=>/^[\d.\/-]+$/.test(v)&&/\d/.test(v)?v:null],
 ['{p}_email',/^e-?mail$/,v=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)?v:null],
 ['{p}_telefone',/^(?:telefone|fone)$/,v=>/^[+()\d\s-]{8,25}$/.test(v)?v:null],
 ['valor_servicos_centavos',/^(?:(?:valor|vl\.) (?:total (?:dos? )?)?(?:dos? )?servicos?|total dos? servicos?)$/,dinheiro],
 ['valor_total_nota_centavos',/^valor total (?:da )?(?:nota|nfs-?e)$/,dinheiro],
 ['valor_liquido_centavos',/^(?:valor|v\.|vl\.) liquido(?: (?:da )?(?:nota(?: fiscal)?|nfs-?e))?$/,dinheiro],
 ['base_calculo_centavos',/^(?:base (?:de )?calculo(?: do issqn)?|b\. calculo|bc issqn)$/,dinheiro],
 ['valor_iss_centavos',/^(?:(?:valor|v\.|vl\.|total) (?:do )?iss(?:qn)?|iss(?:qn)? apurado)$/,dinheiro],
 ...['pis','cofins','ir','inss','csll','ibs','cbs'].map(t=>['valor_'+t+'_centavos',new RegExp('^(?:valor (?:total )?(?:do |da )?)?'+(t==='ir'?'ir(?:rf)?':t)+'$'),dinheiro]),
 ['aliquota_percentual',/^(?:aliquota(?: aplicada)?|aliq\.)$/,v=>{const m=v.match(/^(\d{1,3}(?:[.,]\d{1,4})?)\s*%?$/);const n=m?Number(m[1].replace(',','.')):NaN;return n>=0&&n<=100?n:null;}],
 ['iss_retido',/^(?:iss(?:qn)? retido|retencao do issqn|iss a reter)$/,v=>{const n=normalizar(v);return /^(?:2\s*-\s*)?(?:nao|nao retido)$/.test(n)?'nao':/^(?:1\s*-\s*)?(?:sim|retido)$/.test(n)?'sim':null;}],
 ['codigo_servico_municipal',/^codigo (?:do servico|municipal (?:do servico)?|de tributacao municipal)$/,v=>v.match(/^(\d[\d.-]*)(?:\s+-\s+.*)?$/)?.[1]||null],
 ['item_lista_servico',/^(?:item (?:da )?lista (?:de )?servicos?|item da lei 116)$/,v=>/^\d{1,2}\.\d{2}$/.test(v)?v:/^\d{4}$/.test(v)?`${v.slice(0,2)}.${v.slice(2)}`:null],
 ['discriminacao_servicos',/^(?:discriminacao|descricao) (?:dos? )?servicos?(?: prestados?)?$/,texto],
 ['municipio_prestacao',/^(?:municipio (?:da |de )?prestacao|local da prestacao(?: do servico)?)$/,municipioServico],
 ['municipio_incidencia',/^municipio (?:da |de )?incidencia(?: do issqn)?$/,municipioServico],
];
function rotulo(s){
  const n=normalizar(s).replace(/^\([=x+-]\)\s*/,'').replace(/\s*\((?:r\$|%)\)\s*/g,'').replace(/\s*r\$\s*$/,'').replace(/\s*[:=%]\s*$/,'').trim();
  const r=regras.find(([,re])=>re.test(n));return r?{campo:r[0],converter:r[2]}:null;
}
function papel(s){
  const n=normalizar(s).replace(/:$/,'');
  if(/^(?:(?:dados|identificacao) (?:do )?)?(?:prestador|emitente|fornecedor)(?: (?:de |do |dos? )?servicos?| da nfs-?e)?$/.test(n))return 'prestador';
  if(/^(?:(?:dados|identificacao) (?:do )?)?(?:tomador|destinatario|cliente)(?: (?:de |do |dos? )?servicos?)?$/.test(n))return 'tomador';
  if(/^(?:intermediario(?: do servico.*)?|servico prestado|valores(?: da nota)?|valor total da nfs-?e|tributacao(?: municipal| federal)?|total tributacao federal|retencoes|discriminacao dos servicos|descricao dos servicos|informacoes complementares)$/.test(n))return 'fim';
  return null;
}
function extrairPosicoes(paginas){
  const documento=Array.isArray(paginas)?organizarDocumento(paginas):paginas;
  const candidatos=new Map(),avisos=[],vistos=new Set();
  function registrar(campo,valor,origem){
    vistos.add(campo);if(valor==null)return;
    if(!candidatos.has(campo))candidatos.set(campo,[]);
    candidatos.get(campo).push({valor,origem});
  }
  documento.paginas.forEach((pagina,indice)=>{
    const itens=pagina.fragmentos;
    const cidadeCabecalho=itens.map(i=>i.s.match(/^MUNIC[IÍ]PIO DE (.{10,})$/i)?.[1]).find(Boolean);
    const unidades=[];
    for(const linha of pagina.linhas){
      const ordenados=linha.fragmentos.sort((a,b)=>a.x-b.x);
      for(let i=0;i<ordenados.length;i++){
        let atual=ordenados[i];
        // Junta rótulos divididos em fragmentos, apenas quando a união é reconhecida.
        for(let n=Math.min(5,ordenados.length-i);n>1;n--){
          const grupo=ordenados.slice(i,i+n);
          if(grupo.some((a,j)=>j&&a.x-(grupo[j-1].x+grupo[j-1].w)>15))continue;
          const s=grupo.map(a=>a.s).join(' ');
          if(rotulo(s)||papel(s)){atual={...atual,s,w:grupo.at(-1).x+grupo.at(-1).w-atual.x};i+=n-1;break;}
        }
        const separado=atual.s.match(/^(.+?[:=])\s*(.+)$/)||atual.s.match(/^(CCM)\s+(\d[\d.\/-]*)$/i);
        const label=separado&&rotulo(separado[1]);
        unidades.push({...atual,r:label||rotulo(atual.s),inline:label?separado[2]:null,papel:papel(atual.s)});
      }
    }
    // Reconstitui qualquer rótulo ou seção dividida verticalmente pelo PDF.
    // Só aceita uma união que seja um título conhecido; texto livre continua intacto.
    const fragmentos=[...unidades].sort((a,b)=>a.y-b.y||a.x-b.x);
    const usados=new Set();
    for(const inicio of fragmentos){
      if(inicio.r||inicio.papel||usados.has(inicio))continue;
      let partes=[inicio],anterior=inicio;
      for(let n=0;n<2;n++){
        const proximos=fragmentos.filter(i=>!i.r&&!i.papel&&!usados.has(i)&&!partes.includes(i)
          &&i.y>anterior.y+2&&i.y-anterior.y<=Math.max(18,anterior.h*1.8)
          &&Math.abs(i.x-inicio.x)<=Math.max(20,inicio.h*2));
        const y=Math.min(...proximos.map(i=>i.y));
        const proximo=proximos.filter(i=>Math.abs(i.y-y)<=2).sort((a,b)=>Math.abs(a.x-inicio.x)-Math.abs(b.x-inicio.x))[0];
        if(!proximo)break;
        partes.push(proximo);anterior=proximo;
        const s=partes.map(i=>i.s).join(' '),r=rotulo(s),p=papel(s);
        if(r||p){unidades.push({...inicio,s,y:proximo.y,w:Math.max(...partes.map(i=>i.x+i.w))-inicio.x,r,inline:null,papel:p});
          partes.forEach(i=>usados.add(i));break;}
      }
    }
    for(let i=unidades.length-1;i>=0;i--)if(usados.has(unidades[i]))unidades.splice(i,1);
    const headings=unidades.filter(i=>i.papel);
    // Alguns municípios omitem o título "Prestador". Só inferimos o bloco
    // anterior ao tomador quando há uma única empresa e um CNPJ rotulado perto.
    const primeiroTomador=headings.filter(i=>i.papel==='tomador').sort((a,b)=>a.y-b.y)[0];
    const empresas=primeiroTomador?unidades.filter(i=>i.y<primeiroTomador.y&&
      /\b(?:LTDA|EIRELI|S\/?A)\.?$/i.test(i.s)&&!/PREFEITURA|MUNIC[IÍ]PIO|SECRETARIA/i.test(i.s)):[];
    const prestadorInferido=!headings.some(i=>i.papel==='prestador'&&i.y<primeiroTomador?.y)&&empresas.length===1&&unidades.some(i=>i.r?.campo==='cnpj_{p}'&&
      i.y>empresas[0].y&&i.y<primeiroTomador.y&&i.y-empresas[0].y<100)?empresas[0]:null;
    const origemDireta=(item,trecho)=>({metodo:'posição e contexto',pagina:indice+1,trecho,
      confianca:'conferir',area:areaTrechos([item],pagina)});
    function enderecoSemRotulo(pessoa,nome,fim){
      // Procura endereço apenas perto de uma empresa já identificada. Uma rua
      // ou cidade isolada no documento não define a qual pessoa pertence.
      const bloco=unidades.filter(i=>i.y>nome.y+2&&i.y<Math.min(fim,nome.y+100));
      const ruas=bloco.map(i=>({item:i,m:i.s.match(/^(?:\d{5}-?\d{3}\s*-\s*)?((?:R(?:UA)?\.?|AV(?:ENIDA)?\.?|ESTRADA|ALAMEDA|RODOVIA|TRAVESSA)\s+.+?)[,\s]+(\d+[A-Za-z]?)(?:\s*-\s*(.+))?$/i)})).filter(i=>i.m);
      if(ruas.length===1){
        const {item,m}=ruas[0],origem=origemDireta(item,item.s);
        registrar(pessoa+'_endereco',m[1].trim(),origem);registrar(pessoa+'_numero',m[2],origem);
        if(m[3])registrar(pessoa+'_bairro',m[3].trim(),origem);
        const prefixo=item.s.match(/^(\d{5}-?\d{3})\s*-/);
        if(prefixo)registrar(pessoa+'_cep',prefixo[1].replace(/\D/g,''),origem);
        const complemento=bloco.find(i=>Math.abs(i.y-item.y)<=2&&i.x>item.x+item.w-2&&
          /^(?:SALA|APTO|APARTAMENTO|LOJA|BLOCO|CONJUNTO)\s+/i.test(i.s));
        if(complemento){
          const partes=complemento.s.split(/\s+-\s+/,2);
          registrar(pessoa+'_complemento',partes[0],origemDireta(complemento,complemento.s));
          if(partes[1])registrar(pessoa+'_bairro',partes[1],origemDireta(complemento,complemento.s));
        }
      }
      const cidades=bloco.map(i=>({item:i,m:i.s.match(/^([\p{L}\s]+?)\s*-\s*([A-Z]{2})\s*-\s*(?:BRASIL\s*-\s*)?CEP\s*:\s*(\d{5}-?\d{3})$/iu)})).filter(i=>i.m);
      if(cidades.length===1){
        const {item,m}=cidades[0],origem=origemDireta(item,item.s);
        registrar(pessoa+'_municipio',m[1].trim(),origem);registrar(pessoa+'_uf',m[2].toUpperCase(),origem);
        registrar(pessoa+'_cep',m[3].replace(/\D/g,''),origem);
      }
    }
    if(prestadorInferido)registrar('nome_prestador',prestadorInferido.s,origemDireta(prestadorInferido,prestadorInferido.s));
    if(prestadorInferido)enderecoSemRotulo('prestador',prestadorInferido,primeiroTomador.y);
    // Nome sem rótulo na primeira linha do bloco do tomador.
    if(primeiroTomador){
      const seguinte=Math.min(...headings.filter(i=>i.y>primeiroTomador.y+2).map(i=>i.y),Infinity);
      const nomes=unidades.filter(i=>i.y>primeiroTomador.y+2&&i.y<Math.min(seguinte,primeiroTomador.y+55)
        &&/\b(?:LTDA|EIRELI|S\/?A)\.?$/i.test(i.s));
      if(nomes.length===1&&!unidades.some(i=>i.r?.campo==='nome_{p}'&&i.y>primeiroTomador.y&&i.y<seguinte)){
        registrar('nome_tomador',nomes[0].s,origemDireta(nomes[0],nomes[0].s));
        enderecoSemRotulo('tomador',nomes[0],seguinte);
      }
    }
    function pessoa(i){
      const anteriores=headings.filter(h=>h.y<=i.y+2);
      if(!anteriores.length)return prestadorInferido&&i.y>=prestadorInferido.y&&i.y<primeiroTomador.y?'prestador':null;
      const ultimo=Math.max(...anteriores.map(h=>h.y));
      const linha=anteriores.filter(h=>Math.abs(h.y-ultimo)<=2).sort((a,b)=>a.x-b.x);
      const h=linha.filter(h=>h.x<=i.x+3).at(-1)||linha[0];
      return h.papel==='fim'?null:h.papel;
    }
    for(const label of unidades.filter(i=>i.r)){
      const p=pessoa(label);if(label.r.campo.includes('{p}')&&!p)continue;
      const campo=label.r.campo.replace('{p}',p);
      let valor=label.inline;
      let valorItens=valor?[label]:[];
      if(!valor){
        const direita=unidades.filter(i=>Math.abs(i.y-label.y)<=2&&i.x>label.x+2).sort((a,b)=>a.x-b.x);
        const proximo=direita[0];
        const alternativas=[];
        if(proximo&&!proximo.r&&!proximo.papel&&proximo.x-(label.x+label.w)<Math.max(180,label.h*14)){
          const fim=direita.find(i=>i.r||i.papel)?.x??Infinity;
          alternativas.push(direita.filter(i=>i.x<fim));
        }
        // Em cabeçalhos de várias colunas, um título ainda desconhecido também
        // delimita a célula: o valor pertence à coluna mais próxima.
        const proximaColuna=direita[0];
        const centro=i=>i.x+i.w/2;
        const limiteX=proximaColuna?(centro(label)+centro(proximaColuna))/2:Infinity;
        const colunaAnterior=unidades.filter(i=>Math.abs(i.y-label.y)<=2&&i.x<label.x).sort((a,b)=>b.x-a.x)[0];
        const limiteEsquerda=colunaAnterior?(centro(colunaAnterior)+centro(label))/2:label.x-Math.max(15,label.h*2);
        const proximaSecao=Math.min(...unidades.filter(i=>i.papel&&i.y>label.y+2&&
          (i.papel!==p||i.y-label.y>Math.max(20,label.h*2))).map(i=>i.y),Infinity);
        const abaixo=unidades.filter(i=>i.y>label.y+3&&i.y<proximaSecao-2&&i.y<=label.y+Math.max(34,label.h*3)&&i.x>=limiteEsquerda&&i.x<limiteX-2);
        const y=Math.min(...abaixo.map(i=>i.y));
        const linha=abaixo.filter(i=>Math.abs(i.y-y)<=2).sort((a,b)=>a.x-b.x);
        if(linha.length&&!linha.some(i=>i.r||i.papel))alternativas.push(linha);
        // Uma célula vizinha pode estar na mesma linha. Só a aceita se o tipo
        // do campo for válido; caso contrário, tenta a célula logo abaixo.
        const escolher=grupo=>{
          if(label.r.converter(grupo.map(i=>i.s).join(' ').trim())!=null)return grupo;
          // Números e datas podem vir seguidos de outro título sem separador.
          // Aceita um prefixo somente para campos com valor estritamente tipado.
          if(!/^(?:cnpj_|.*_centavos$|numero_nota$|rps_numero$|data_emissao$|codigo_verificacao$|.*_cep$|.*_email$)/.test(campo))return null;
          for(let n=1;n<grupo.length;n++)if(label.r.converter(grupo.slice(0,n).map(i=>i.s).join(' ').trim())!=null)return grupo.slice(0,n);
          return null;
        };
        valorItens=alternativas.map(escolher).find(Boolean)||[];
        valor=valorItens.map(i=>i.s).join(' ');
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
        if(grupos.length)valorItens=conteudo;
        valor=valor.slice(0,10000);
      }
      if(campo.endsWith('_endereco')&&valor.endsWith('-')){
        const continuacao=unidades.filter(i=>i.y>label.y+3&&i.y<=label.y+Math.max(30,label.h*3)
          &&i.y>valorItens.at(-1)?.y+2&&i.x>=label.x-2&&i.x<label.x+Math.max(40,label.w)
          &&!i.r&&!i.papel).sort((a,b)=>a.y-b.y)[0];
        if(continuacao&&/^[\p{L}\s-]+$/u.test(continuacao.s)){
          valor+=continuacao.s.trim();valorItens.push(continuacao);
        }
      }
      const origem={metodo:pagina.fonte==='ocr'?'OCR, posição e rótulo':'posição e rótulo',pagina:indice+1,
        trecho:`${label.s} → ${valor||'não identificado'}`,confianca:'conferir',
        area:areaTrechos(valorItens.length?valorItens:[label],pagina)};
      const convertido=valor?label.r.converter(valor.trim()):null;
      registrar(campo,convertido,origem);
      if(campo.endsWith('_endereco')&&convertido){
        const pessoa=campo.slice(0,-'_endereco'.length);
        const cep=convertido.match(/\bCEP\s*:\s*(\d{2}\.?\d{3}-?\d{3}|\d{8})\b/i);
        if(cep)registrar(pessoa+'_cep',cep[1].replace(/\D/g,''),origem);
        const endereco=convertido.replace(/\s*CEP\s*:\s*[\d.-]+\s*$/i,'');
        const semNumero=endereco.match(/^(.+?)\s+(S\/N),\s*(.+)$/i);
        if(semNumero){
          candidatos.get(campo).at(-1).valor=semNumero[1].trim();
          registrar(pessoa+'_numero','S/N',origem);
          const detalhes=semNumero[3].split(',').map(s=>s.trim()).filter(Boolean);
          if(detalhes.length>=2){
            registrar(pessoa+'_complemento',detalhes.slice(0,-1).join(', '),origem);
            registrar(pessoa+'_bairro',detalhes.at(-1),origem);
          }else if(detalhes.length)registrar(pessoa+'_complemento',detalhes[0],origem);
          continue;
        }
        const partes=endereco.match(/^(.+?),\s*(\d+[A-Za-z]?)(?:\s*[,–-]\s*(.+))?$/)
          || endereco.match(/^(.+?)\s+(\d+[A-Za-z]?)(?:,\s*([^,]+))?$/);
        if(partes){candidatos.get(campo).at(-1).valor=partes[1].trim();registrar(pessoa+'_numero',partes[2],origem);if(partes[3]&&!/^(?:N\/D|S\/N)(?:\b|\s*-)/i.test(partes[3]))registrar(pessoa+'_bairro',partes[3].trim(),origem);}
        else if(endereco!==convertido)candidatos.get(campo).at(-1).valor=endereco;
      }
      if(campo.endsWith('_municipio')&&convertido){
        const m=convertido.match(/^(.+?)\s*[-/]\s*([A-Z]{2})$/);
        if(m){candidatos.get(campo).at(-1).valor=m[1];registrar(campo.replace('_municipio','_uf'),m[2],origem);}
      }
      if(/^municipio_(prestacao|incidencia)$/.test(campo)&&convertido){
        const m=convertido.match(/^(.+?)\s*[-/]\s*([A-Z]{2})$/);
        if(m){candidatos.get(campo).at(-1).valor=m[1];registrar(campo.replace('municipio_','uf_'),m[2],origem);}
      }
    }
    const cidadePrestador=candidatos.get('prestador_municipio');
    if(cidadeCabecalho&&cidadePrestador?.length===1){
      const atual=cidadePrestador[0].valor;
      if(atual&&normalizar(atual).length>=10&&normalizar(cidadeCabecalho).startsWith(normalizar(atual)+' ')){
        cidadePrestador[0].valor=cidadeCabecalho;
        cidadePrestador[0].origem={...cidadePrestador[0].origem,trecho:`Município: ${atual}; cabeçalho: MUNICÍPIO DE ${cidadeCabecalho}`};
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
async function lerPosicoes(buffer,{comDocumento=false}={}){
  const {getDocument}=await import('pdfjs-dist/legacy/build/pdf.mjs');
  const pdf=await getDocument({data:new Uint8Array(buffer),useSystemFonts:true,verbosity:0}).promise;
  try{
    const paginas=[];
    if(pdf.numPages>50)throw new Error('Limite de páginas excedido.');
    for(let i=1;i<=pdf.numPages;i++){const pagina=await pdf.getPage(i);paginas.push({items:(await pagina.getTextContent()).items,viewport:pagina.getViewport({scale:1})});}
    const documento=organizarDocumento(paginas);
    const resultado=extrairPosicoes(documento);
    return comDocumento?{...resultado,documento}:resultado;
  }finally{await pdf.destroy();}
}
function combinarPosicoes(posicional,generico){
  const dados={...generico.dados},origens={...generico.origens};
  // Um rótulo visto sem valor (traço, asteriscos ou conflito) não pode ser
  // preenchido acidentalmente por uma regex que alcançou outro campo.
  for(const c of posicional.vistos){delete dados[c];delete origens[c];}
  Object.assign(dados,posicional.dados);Object.assign(origens,posicional.origens);
  if(!Object.keys(posicional.origens).length)dados.modelo='generico';
  const pendentes=generico.avisos.filter(aviso=>!Object.keys(posicional.origens).some(campo=>aviso.includes(campo)));
  return {dados,origens,avisos:[...new Set([...pendentes,...posicional.avisos])]};
}
module.exports={extrairPosicoes,lerPosicoes,combinarPosicoes};
