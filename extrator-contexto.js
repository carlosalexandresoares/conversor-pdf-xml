// Complementa rótulos explícitos com blocos do texto completo. Sem serviço externo.
const {padraoRotulos}=require('./catalogo-rotulos');
const norm=s=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
function extrairContexto(texto){
  texto=texto.normalize('NFC').replace(/\r/g,'').replace(/\u00a0/g,' ');
  const dados={},origens={},avisos=[],conflitos=[];
  function guardar(campo,valor,trecho){
    if(valor==null||valor===''||conflitos.includes(campo))return;
    if(dados[campo]!=null&&dados[campo]!==valor){delete dados[campo];delete origens[campo];conflitos.push(campo);avisos.push(`Valores diferentes para ${campo} no texto completo; confira o original.`);return;}
    dados[campo]=valor;origens[campo]={metodo:'contexto do texto completo',trecho};
  }
  function capturar(campo,fonte,re,converter=v=>v.trim()){
    for(const m of fonte.matchAll(re)){const v=converter(m[1]);guardar(campo,v,m[0].trim());}
  }
  const moeda=v=>{const n=Number(v.replace(/\./g,'').replace(',','.'));return Number.isSafeInteger(Math.round(n*100))?Math.round(n*100):null;};
  const dinheiro='(?:R\\$\\s*)?(\\d+(?:\\.\\d{3})*,\\d{2})(?!\\d)';
  for(const [campo,rotulo] of Object.entries({valor_servicos_centavos:'valor dos servicos',valor_total_nota_centavos:'valor total da nota',valor_liquido_centavos:'valor liquido'})){
    capturar(campo,norm(texto),new RegExp('\\b'+padraoRotulos(rotulo)+'[ \\t]*(?:[:=]|\\(R\\$\\))?[ \\t]*(?:\\n[ \\t]*)?'+dinheiro,'gi'),moeda);
  }
  capturar('item_lista_servico',texto,/(?:Atividade|Item da lista de servi[çc]os)\s*:\s*(\d{1,2}\.\d{2})(?=\s*[-–])/gi);
  const iss=/\bISS\s+(SEM RETEN[ÇC][ÃA]O|RETIDO)[ \t|:]*(\d{1,2}(?:,\d{1,4})?)\s*%[ \t]+(\d+(?:\.\d{3})*,\d{2})(?!\d)/gi;
  for(const m of texto.matchAll(iss)){
    guardar('iss_retido',/^sem/i.test(m[1])?'nao':'sim',m[0]);guardar('aliquota_percentual',Number(m[2].replace(',','.')),m[0]);guardar('valor_iss_centavos',moeda(m[3]),m[0]);
  }
  // Cabeçalho compacto: só associa colunas quando a quantidade e os tipos batem.
  const linhas=texto.split('\n');
  for(let i=0;i<linhas.length-1;i++){
    const n=norm(linhas[i]);
    if(!/(?:numero nota|numero da nota)/.test(n)||!/data (?:de )?emissao/.test(n)||!/chave/.test(n))continue;
    const valores=linhas[i+1].trim();
    const m=valores.match(/^(?:(\d+)\s+)?(\d+)([^\d\s]?)\s+(\d{2}\/\d{2}\/\d{4})\s+([a-z0-9]+-[a-z0-9]+)$/i);
    if(!m)continue;
    const [dia,mes,ano]=m[4].split('/'),iso=`${ano}-${mes}-${dia}`,d=new Date(iso+'T00:00:00Z');
    if(!Number.isNaN(d.getTime())&&d.toISOString().slice(0,10)===iso)guardar('data_emissao',iso,linhas[i]+'\n'+valores);
    guardar('codigo_verificacao',m[5],linhas[i]+'\n'+valores);
    if(!m[3]){guardar('numero_nota',m[2],valores);if(m[1]&&/rps/.test(n))guardar('rps_numero',m[1],valores);}
    else avisos.push('O número da nota contém um caractere inesperado no OCR; confira o PDF antes de preencher.');
  }
  const heading=/^(?:(?:dados|identifica[çc][ãa]o)\s+(?:do\s+)?)?(prestador|emitente|fornecedor|tomador|destinat[áa]rio|cliente)(?:\s+(?:de\s+|do\s+|dos?\s+)?servi[çc]os?)?\s*:?\s*$/i;
  const secoes=[];
  linhas.forEach((l,i)=>{const m=l.trim().match(heading);if(m)secoes.push({i,pessoa:/^(prestador|emitente|fornecedor)$/i.test(m[1])?'prestador':'tomador'});});
  // Empresa no cabeçalho sem "Prestador": exige razão social, CNPJ rotulado e
  // separação explícita do tomador; não usa o CNPJ da prefeitura por posição.
  const primeiroTomador=secoes.find(s=>s.pessoa==='tomador');
  if(primeiroTomador&&!secoes.some(s=>s.pessoa==='prestador'&&s.i<primeiroTomador.i)){
    const candidatos=linhas.slice(0,primeiroTomador.i).map((l,i)=>({l,i})).filter(({l})=>/\b(?:LTDA|EIRELI|S\/?A)\s*\.?$/i.test(l.trim())&&!/prefeitura|secretaria/i.test(l));
    if(candidatos.length===1){
      const c=candidatos[0];const bloco=linhas.slice(c.i,primeiroTomador.i).join('\n');
      const ids=[...bloco.matchAll(/(?:CNPJ\s*\/\s*CPF|CPF\s*\/\s*CNPJ|CNPJ)\s*:\s*(\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2})/gi)];
      if(new Set(ids.map(m=>m[1])).size===1)secoes.push({i:c.i-1,pessoa:'prestador'});
    }
  }
  secoes.sort((a,b)=>a.i-b.i);
  for(let j=0;j<secoes.length;j++){
    const {i,pessoa}=secoes[j];let bloco=linhas.slice(i+1,secoes[j+1]?.i??linhas.length).join('\n');
    bloco=bloco.split(/\n(?:(?:Qtd|Qtde)\s|Discrimina[çc][ãa]o|Descri[çc][ãa]o dos servi[çc]os|Local do Servi[çc]o|Natureza Opera[çc][ãa]o|Atividade:|VALOR|RETEN[ÇC])/i)[0];
    const primeiras=bloco.split('\n').map(s=>s.trim()).filter(Boolean);
    const nome=primeiras[0];
    if(nome&&/^[\p{L}]/u.test(nome)&&!/:|\b(?:cpf|cnpj|endere[çc]o|nome|raz[ãa]o|munic[íi]pio|e-mail|telefone|rua|avenida)\b/i.test(nome)){
      if(/\d{11,14}\s*$/.test(nome))avisos.push(`Nome do ${pessoa} contém um documento numérico colado; confira o original.`);
      else guardar('nome_'+pessoa,nome,nome);
    }
    capturar('cnpj_'+pessoa,bloco,/(?:CNPJ\s*\/\s*CPF|CPF\s*\/\s*CNPJ|CNPJ|CPF)\s*:\s*([\d./-]{11,18})(?![\d./-])/gi,v=>{const n=v.replace(/\D/g,'');return [11,14].includes(n.length)?n:null;});
    capturar(pessoa+'_cep',bloco,/\bCEP\s*:\s*(\d{5}-?\d{3})(?!\d)/gi,v=>v.replace('-',''));
    capturar(pessoa+'_email',bloco,/(?:E-?mail)\s*:\s*([^\s@]+@[^\s@]+\.[^\s@]+)/gi);
    capturar(pessoa+'_telefone',bloco,/Telefone\s*:\s*([+()\d][()\d\s-]{7,23})(?=\s*[A-Za-z]|$)/gi);
    capturar(pessoa+'_inscricao_municipal',bloco,/Inscr(?:i[çc][ãa]o|\.)\s*Mun[íi]cipal\s*:\s*([\d./-]+)/gi);
    for(const l of primeiras){
      const cidade=l.match(/^(.*?)\s*-\s*([A-Z]{2})\s*-\s*(?:BRASIL\s*-\s*)?CEP\s*:/i);
      if(cidade){const partes=cidade[1].split(/\s+-\s+/);guardar(pessoa+'_municipio',partes.at(-1),l);guardar(pessoa+'_uf',cidade[2].toUpperCase(),l);if(partes.length===2)guardar(pessoa+'_bairro',partes[0],l);}
      const rua=l.replace(/^\d{5}-\d{3}\s*-\s*/,'').match(/^((?:RUA|AVENIDA|AV\.|ESTRADA|RODOVIA|ALAMEDA|TRAVESSA)\s+.+?),\s*(\d+[A-Za-z]?)(?:\s*-\s*(.+))?$/i);
      if(rua){guardar(pessoa+'_endereco',rua[1],l);guardar(pessoa+'_numero',rua[2],l);if(rua[3])guardar(pessoa+'_bairro',rua[3].replace(/\s*\|$/,'').trim(),l);}
    }
  }
  if(/(?:email|e-mail)\s*:[^\n@]*(?:hotmail|gmail|outlook)\.com/i.test(texto))avisos.push('Há um e-mail possivelmente corrompido no OCR; confira o original.');
  return {dados,origens,avisos,conflitos};
}
module.exports={extrairContexto};
