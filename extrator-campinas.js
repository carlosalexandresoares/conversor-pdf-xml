const normalizar=s=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ').trim().toUpperCase();
function extrairPaginaCampinas(itens) {
  const items=itens.filter(i=>i.str?.trim()).map(i=>({texto:i.str.trim(),x:i.transform[4],y:i.transform[5]}));
  if(!items.some(i=>normalizar(i.texto)==='NFSE CAMPINAS - PRESTADOR'))return null;
  const dados={modelo:'campinas'},origens={},avisos=[];
  const achar=(titulo,topo=Infinity,fundo=-Infinity)=>items.find(i=>normalizar(i.texto)===normalizar(titulo)&&i.y<topo&&i.y>fundo);
  function guardar(campo,valor,rotulo){
    if(valor==null||valor===''||/^[-*]+$/.test(valor))return;
    dados[campo]=valor;origens[campo]={metodo:'posição no layout Campinas',trecho:rotulo?`${rotulo}: ${valor}`:String(valor)};
  }
  function campo(titulo,topo=Infinity,fundo=-Infinity){
    const label=achar(titulo,topo,fundo);if(!label)return null;
    const direita=Math.min(...items.filter(i=>Math.abs(i.y-label.y)<3&&i.x>label.x+3).map(i=>i.x),Infinity);
    const valores=items.filter(i=>i.y<label.y-3&&i.y>Math.max(label.y-16,fundo)&&i.x>=label.x-2&&i.x<direita-2).sort((a,b)=>a.x-b.x);
    return valores.map(i=>i.texto).join(' ')||null;
  }
  function data(v){
    const m=v?.match(/^(\d{2})\/(\d{2})\/(\d{4})(?: (\d{2}:\d{2}:\d{2}))?$/);if(!m)return null;
    const iso=`${m[3]}-${m[2]}-${m[1]}`+(m[4]?'T'+m[4]:'');
    const d=new Date(iso+(m[4]?'Z':'T00:00:00Z'));
    return !Number.isNaN(d.getTime())&&d.toISOString().slice(0,iso.length)===iso?iso:null;
  }
  const identificacao=achar('DADOS DA NFSe Campinas'),prestador=achar('EMITENTE PRESTADOR DO SERVIÇO'),tomador=achar('TOMADOR DO SERVIÇO'),servico=achar('SERVIÇO PRESTADO');
  if(!identificacao||!prestador||!tomador||!servico)return null;
  const numero=campo('Número / Série',identificacao.y,prestador.y)?.match(/^(\d+)\s*\/\s*(\S+)$/);
  guardar('numero_nota',numero?.[1]);guardar('serie_nota',numero?.[2]);
  guardar('data_emissao',data(campo('Data e hora de emissão',identificacao.y,prestador.y)));
  const competencia=campo('Competência',identificacao.y,prestador.y)?.match(/^(0[1-9]|1[0-2])\/(\d{4})$/);
  if(competencia)guardar('competencia',`${competencia[2]}-${competencia[1]}`);
  const rps=campo('Número / Série do RPS',identificacao.y,prestador.y)?.match(/^(\d+)\s*\/\s*(\S+)$/);
  guardar('rps_numero',rps?.[1]);guardar('rps_serie',rps?.[2]);guardar('rps_data',data(campo('Data do RPS',identificacao.y,prestador.y)));
  const codigos=items.filter(i=>i.y>identificacao.y&&/^[a-z0-9]{8,30}$/i.test(i.texto)&&/\d/.test(i.texto)&&/[a-z]/i.test(i.texto));
  if(codigos.length===1)guardar('codigo_verificacao',codigos[0].texto);
  function cidade(campoNome,valor){
    const m=valor?.match(/^(.+?)\s*[-/]\s*([A-Z]{2})(?:\s+BRASIL)?$/i);if(!m)return;
    if(['prestador','tomador'].includes(campoNome)){guardar(campoNome+'_municipio',m[1]);guardar(campoNome+'_uf',m[2]);}
    else {guardar('municipio_'+campoNome,m[1]);guardar('uf_'+campoNome,m[2]);}
  }
  for(const [pessoa,topo,fundo] of [['prestador',prestador.y,tomador.y],['tomador',tomador.y,servico.y]]){
    const cpf=campo('CPF / CNPJ / NIF',topo,fundo)?.replace(/[./\-\s]/g,'');
    if(/^(?:\d{11}|\d{14})$/.test(cpf||''))guardar('cnpj_'+pessoa,cpf);
    guardar('nome_'+pessoa,campo('Nome / Nome Empresarial',topo,fundo));
    for(const [nome,titulo] of [['inscricao_municipal','Inscrição Municipal'],['telefone','Telefone'],['email','E-mail']])guardar(pessoa+'_'+nome,campo(titulo,topo,fundo));
    guardar(pessoa+'_cep',campo('CEP',topo,fundo)?.match(/^\d{5}-?\d{3}$/)?.[0].replace('-',''));
    cidade(pessoa,campo('Município',topo,fundo));
    // Sem separadores de bairro/complemento, mantém o endereço completo.
    guardar(pessoa+'_endereco',campo('Endereço',topo,fundo));
  }
  const descricao=items.find(i=>normalizar(i.texto).startsWith('DESCRICAO DO SERVICO PRESTADO ('));
  const tributacao=achar('TRIBUTAÇÃO MUNICIPAL');
  const calculo=achar('CÁLCULO DO ISSQN'),retencoes=achar('RETENÇÕES'),total=achar('VALOR TOTAL');
  guardar('descricao_servico',campo('Serviço',servico.y,descricao?.y));
  guardar('item_lista_servico',dados.descricao_servico?.match(/^(\d{2}\.\d{2})\s*-/)?.[1]);
  cidade('prestacao',campo('Local da prestação do serviço',servico.y,descricao?.y));
  cidade('incidencia',campo('Município da Incidência do ISSQN',tributacao?.y,calculo?.y));
  const fimTitulo=items.find(i=>normalizar(i.texto).startsWith('PRESTADO, ESPECIFICANDO A QUANTIDADE'));
  if(fimTitulo&&tributacao){
    const linhas=items.filter(i=>i.y<fimTitulo.y-2&&i.y>tributacao.y+3).sort((a,b)=>b.y-a.y||a.x-b.x);
    const grupos=[];
    for(const item of linhas){let linha=grupos.find(g=>Math.abs(g.y-item.y)<2);if(!linha){linha={y:item.y,itens:[]};grupos.push(linha);}linha.itens.push(item);}
    guardar('discriminacao_servicos',grupos.map(g=>g.itens.sort((a,b)=>a.x-b.x).map(i=>i.texto).join(' ')).join('\n'));
  }
  function moeda(c,t,topo,fundo){
    const v=campo(t,topo,fundo);const m=v?.match(/^(\d+(?:\.\d{3})*),(\d{2})$/);
    if(m){const n=Number(m[1].replace(/\./g,''))*100+Number(m[2]);if(Number.isSafeInteger(n))guardar(c,n,t);}
  }
  if(calculo&&retencoes){
    moeda('valor_servicos_centavos','Valor total da NFSe Campinas (R$)',calculo.y,retencoes.y);
    moeda('valor_total_nota_centavos','Valor total da NFSe Campinas (R$)',calculo.y,retencoes.y);
    moeda('base_calculo_centavos','Base de cálculo do ISSQN (R$)',calculo.y,retencoes.y);
    moeda('valor_iss_centavos','Valor do ISSQN (R$)',calculo.y,retencoes.y);
    const aliquota=campo('Alíq. (%)',calculo.y,retencoes.y);
    if(/^\d+(?:,\d+)?$/.test(aliquota||'')&&Number(aliquota.replace(',','.'))<=100)guardar('aliquota_percentual',Number(aliquota.replace(',','.')));
    if(/\*/.test(aliquota||''))avisos.push('Alíquota e/ou ISS ocultos com asteriscos no PDF; não foram presumidos como zero.');
  }
  if(retencoes&&total)for(const [c,t] of Object.entries({valor_ir_centavos:'IRRF (R$)',valor_pis_centavos:'PIS (R$)',valor_cofins_centavos:'COFINS (R$)',valor_inss_centavos:'INSS (R$)',valor_csll_centavos:'CSLL (R$)'}))moeda(c,t,retencoes.y,total.y);
  if(total)moeda('valor_liquido_centavos','Valor Líquido da NFSe Campinas (R$)',total.y,-Infinity);
  const retido=normalizar(campo('Retenção do ISSQN',tributacao?.y,calculo?.y)||'');
  guardar('iss_retido',retido==='NAO RETIDO'?'nao':retido==='RETIDO'?'sim':null);
  return {dados,origens,avisos};
}
async function lerCampinas(buffer){
  const {getDocument}=await import('pdfjs-dist/legacy/build/pdf.mjs');
  const pdf=await getDocument({data:new Uint8Array(buffer),useSystemFonts:true,verbosity:0}).promise;
  try{
    if(pdf.numPages!==1)return null;
    const pagina=await pdf.getPage(1);
    return extrairPaginaCampinas((await pagina.getTextContent()).items);
  }finally{await pdf.destroy();}
}
module.exports={lerCampinas,extrairPaginaCampinas};
