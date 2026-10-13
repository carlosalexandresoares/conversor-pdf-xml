// DANFSe nacional v2: os nomes dos blocos diferem dos layouts municipais.
const normalizar=s=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ').trim().toUpperCase();
function extrairDanfse(texto) {
  if(!/DANFSe\s+v2/i.test(texto))return null;
  const linhas=texto.replace(/\r/g,'').split('\n').map(s=>s.trim()).filter(Boolean);
  const dados={modelo:'danfse_nacional_v2'};
  function valor(rotulo,fonte=linhas){
    const i=fonte.findIndex(s=>normalizar(s)===normalizar(rotulo));
    const v=i>=0?fonte[i+1]:null;
    return v && v!=='-'?v:null;
  }
  function guardar(campo,v){if(v!=null && v!=='')dados[campo]=v;}
  function data(v){
    const m=v?.match(/^(\d{2})\/(\d{2})\/(\d{4})(?: (\d{2}:\d{2}:\d{2}))?$/);
    if(!m)return null;
    const d=`${m[3]}-${m[2]}-${m[1]}`;
    const instante=new Date(d+'T00:00:00Z');
    return !Number.isNaN(instante.getTime())&&instante.toISOString().slice(0,10)===d?d+(m[4]?'T'+m[4]:''):null;
  }
  guardar('numero_nota',valor('NÚMERO DA NFS-e')?.match(/^\d+$/)?.[0]);
  guardar('data_emissao',data(valor('EMISSÃO DA NFS-e')));
  const competencia=data(valor('COMPETÊNCIA'));
  guardar('competencia',competencia?.slice(0,7));guardar('competencia_xml',competencia?.slice(0,10));
  // Chave de acesso e DPS são preservadas sem confundi-las com verificação/RPS.
  guardar('chave_acesso',valor('CHAVE DE ACESSO DA NFS-e')?.match(/^\d{50}$/)?.[0]);
  guardar('dps_numero',valor('NÚMERO DA DPS'));guardar('dps_serie',valor('SÉRIE DA DPS'));
  guardar('dps_data',data(valor('EMISSÃO DA DPS')));
  for(const [pessoa,titulo] of [['prestador','PRESTADOR / FORNECEDOR DA NFS-e'],['tomador','TOMADOR / ADQUIRENTE DA OPERAÇÃO']]) {
    const inicio=linhas.findIndex(s=>normalizar(s)===normalizar(titulo));
    if(inicio<0)continue;
    let fim=inicio+1;
    while(fim<linhas.length && !/^(?:TOMADOR \/|DESTINATARIO |INTERMEDIARIO |SERVICO PRESTADO)/.test(normalizar(linhas[fim])))fim++;
    const bloco=linhas.slice(inicio+1,fim);
    const cpf=valor('CPF / CNPJ / NIF',bloco)?.replace(/[.\/-]/g,'');
    guardar('cnpj_'+pessoa,/^(?:\d{11}|\d{14})$/.test(cpf||'')?cpf:null);
    guardar('nome_'+pessoa,valor('NOME / NOME EMPRESARIAL',bloco));
    for(const [campo,rotulo] of [['inscricao_municipal','INSCRIÇÃO MUNICIPAL'],['telefone','TELEFONE'],['email','E-MAIL']])guardar(`${pessoa}_${campo}`,valor(rotulo,bloco));
    const municipio=valor('MUNICÍPIO / UF',bloco)?.match(/^(.+?)\s*\/\s*([A-Z]{2})$/);
    guardar(pessoa+'_municipio',municipio?.[1]);guardar(pessoa+'_uf',municipio?.[2]);
    const cep=valor('CÓDIGO IBGE / CEP',bloco)?.match(/^(\d{7})\s*\/\s*(\d{5}-?\d{3})$/);
    guardar(pessoa+'_codigo_municipio',cep?.[1]);guardar(pessoa+'_cep',cep?.[2].replace('-',''));
    const endereco=valor('ENDEREÇO',bloco);
    const partes=endereco?.match(/^(.+?),\s*(\d+[A-Za-z]?|s\/?n),\s*([^,]+)$/i);
    guardar(pessoa+'_endereco',partes?partes[1]:endereco);
    guardar(pessoa+'_numero',partes?.[2]);guardar(pessoa+'_bairro',partes?.[3]);
  }
  for(const [campo,rotulo] of Object.entries({valor_servicos_centavos:'VALOR DO SERVIÇO',valor_liquido_centavos:'VALOR LÍQUIDO DA NFS-e',base_calculo_centavos:'BC ISSQN',valor_iss_centavos:'ISSQN APURADO',valor_ibs_centavos:'VALOR TOTAL APURADO - IBS',valor_cbs_centavos:'VALOR TOTAL APURADO - CBS',valor_ir_centavos:'IRRF',valor_inss_centavos:'CONTRIBUIÇÃO PREVIDENCIÁRIA - RETIDA',valor_pis_centavos:'PIS - DÉBITO APURAÇÃO PRÓPRIA',valor_cofins_centavos:'COFINS - DÉBITO APURAÇÃO PRÓPRIA'})) {
    const m=valor(rotulo)?.match(/^(?:R\$\s*)?(\d+(?:\.\d{3})*),(\d{2})$/);
    if(m){const n=Number(m[1].replace(/\./g,''))*100+Number(m[2]);if(Number.isSafeInteger(n))guardar(campo,n);}
  }
  const aliquota=valor('ALÍQUOTA APLICADA')?.match(/^(\d+(?:,\d+)?)%$/);
  if(aliquota && Number(aliquota[1].replace(',','.'))<=100)guardar('aliquota_percentual',Number(aliquota[1].replace(',','.')));
  const retencao=normalizar(valor('RETENÇÃO DO ISSQN')||'');
  guardar('iss_retido',retencao==='NAO RETIDO'?'nao':retencao==='RETIDO'?'sim':null);
  guardar('municipio_prestacao',valor('LOCAL DA PRESTAÇÃO'));
  guardar('municipio_incidencia',valor('MUNICÍPIO / UF / PAÍS DA INCIDÊNCIA'));
  const municipios=require('./municipios-ibge.json');
  for(const tipo of ['prestacao','incidencia']) {
    const nome=dados['municipio_'+tipo];
    if(!nome)continue;
    const candidatos=Object.entries(municipios).filter(([chave])=>normalizar(chave.slice(3))===normalizar(nome));
    if(candidatos.length===1){guardar('uf_'+tipo,candidatos[0][0].slice(0,2));guardar('codigo_municipio_'+tipo,candidatos[0][1]);}
  }
  const inicio=linhas.findIndex(s=>normalizar(s)==='DESCRICAO DO SERVICO');
  const fim=linhas.findIndex((s,i)=>i>inicio&&normalizar(s)==='TRIBUTACAO MUNICIPAL (ISSQN)');
  if(inicio>=0 && fim>inicio)guardar('discriminacao_servicos',linhas.slice(inicio+1,fim).join('\n'));
  const codigo=valor('CÓD. TRIBUTAÇÃO NACIONAL / MUNICIPAL')?.match(/^(\d{6})(?:\s*\/\s*(\d+))?$/);
  guardar('codigo_tributacao_nacional',codigo?.[1]);guardar('codigo_servico_municipal',codigo?.[2]);
  if(codigo)guardar('item_lista_servico',codigo[1].slice(0,2)+'.'+codigo[1].slice(2,4));
  // No v2, o texto do serviço está entre o local da prestação e sua descrição.
  const local=linhas.findIndex(s=>normalizar(s)==='LOCAL DA PRESTACAO');
  if(local>=0 && inicio>local+2)guardar('descricao_servico',linhas.slice(local+2,inicio).join('\n'));
  return dados;
}
module.exports={extrairDanfse};
