// Exportação de NFS-e da Qive: campos em linha e quadro financeiro abreviado.
const normalizar=s=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'');
function extrairQive(original) {
  const texto=original.normalize('NFC').replace(/\r/g,'').replace(/\u00a0/g,' ');
  if(!/Notas fiscais gerenciadas pela Qive/i.test(texto) || !/Dados do Prestador de Servi[çc]os/i.test(texto))return null;
  const dados={modelo:'qive'},origens={},avisos=[];
  function capturar(fonte,re){return fonte.match(re)?.[1]?.trim()||null;}
  function guardar(campo,valor){if(valor!=null && valor!=='' && valor!=='-'){dados[campo]=valor;origens[campo]={metodo:'layout qive'};}}
  function dinheiro(v){
    const m=v?.trim().match(/^(?:R\$\s*)?(\d+(?:\.\d{3})*),(\d{2})$/);
    if(!m)return null;
    const n=Number(m[1].replace(/\./g,''))*100+Number(m[2]);
    return Number.isSafeInteger(n)?n:null;
  }
  function quadro(rotulo){return capturar(texto,new RegExp('(?:^|\\n)'+rotulo+'[ \\t]*\\n([^\\n]+)','i'));}
  guardar('numero_nota',capturar(texto,/N[uú]mero da NFS-e\s*:\s*(\d+)\b/i));
  guardar('codigo_verificacao',capturar(texto,/C[óo]digo de Verifica[çc][ãa]o[ \t]+([A-Z0-9.-]+)[ \t]+N[uú]mero RPS/i));
  guardar('rps_numero',capturar(texto,/N[uú]mero RPS[ \t]+(\d+)/i));
  guardar('rps_serie',capturar(texto,/S[ée]rie RPS:[ \t]*([^\n]+)/i));
  const emissao=texto.match(/Data de Emiss[ãa]o\s+(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}:\d{2}:\d{2})/i);
  if(emissao){
    const iso=`${emissao[3]}-${emissao[2]}-${emissao[1]}T${emissao[4]}`;
    const instante=new Date(iso+'Z');
    if(!Number.isNaN(instante.getTime())&&instante.toISOString().slice(0,19)===iso)guardar('data_emissao',iso);
  }
  const competencia=texto.match(/Compet[êe]ncia\s+(0[1-9]|1[0-2])\/(\d{4})/i);
  if(competencia)guardar('competencia',`${competencia[2]}-${competencia[1]}`);
  function municipio(valor,pessoa){
    const m=valor?.match(/^(\d{7})\s*-\s*(.+?)\s*-\s*([A-Z]{2})$/i);
    if(!m)return;
    if(pessoa==='prestacao'){
      guardar('codigo_municipio_prestacao',m[1]);guardar('municipio_prestacao',m[2]);guardar('uf_prestacao',m[3].toUpperCase());
    }else{
      guardar(pessoa+'_codigo_municipio',m[1]);guardar(pessoa+'_municipio',m[2]);guardar(pessoa+'_uf',m[3].toUpperCase());
    }
  }
  municipio(capturar(texto,/Munic[íi]pio da Presta[çc][ãa]o[ \t]+(.*?)[ \t]*NFS-e Substitu[íi]da/i),'prestacao');
  for(const pessoa of ['prestador','tomador']){
    const bloco=capturar(texto,new RegExp('Dados do '+pessoa+' de Servi[çc]os\\s*\\n([\\s\\S]*?)(?=\\n(?:Dados do Tomador|Discrimina[çc][ãa]o dos Servi[çc]os)|$)','i'));
    if(!bloco)continue;
    guardar('nome_'+pessoa,capturar(bloco,/Nome\s*\/\s*Nome Empresarial[ \t]+([^\n]+)/i));
    const cpf=capturar(bloco,/CPF\/CNPJ[ \t]+([\d./-]+)/i)?.replace(/\D/g,'');
    if(/^(?:\d{11}|\d{14})$/.test(cpf||''))guardar('cnpj_'+pessoa,cpf);
    guardar(pessoa+'_inscricao_municipal',capturar(bloco,/Inscri[çc][ãa]o Municipal[ \t]+(.+?)[ \t]+Munic[íi]pio/i));
    municipio(capturar(bloco,/Munic[íi]pio[ \t]+([^\n]+)/i),pessoa);
    guardar(pessoa+'_complemento',capturar(bloco,/(?:^|\n)Complemento[ \t]+(.+?)[ \t]+Telefone/i));
    guardar(pessoa+'_telefone',capturar(bloco,/Telefone[ \t]+(.+?)[ \t]+E-mail/i));
    guardar(pessoa+'_email',capturar(bloco,/E-mail[ \t]+([^\s@]+@[^\s@]+\.[^\s@]+)/i));
    const endereco=capturar(bloco,/Endere[çc]o e CEP[ \t]+([^\n]+)/i);
    guardar(pessoa+'_cep',capturar(endereco||'',/CEP:\s*(\d{5}-?\d{3})/i)?.replace('-',''));
    const rua=endereco?.replace(/\s*-\s*\d{7}\s*-.*$/,'').trim();
    const partes=rua?.match(/^(.+?),\s*(\d+[A-Za-z]?|s\/?n)(?:\s*-\s*(.+))?$/i)
      ||rua?.match(/^(.+?)\s+(\d+[A-Za-z]?)$/);
    guardar(pessoa+'_endereco',partes?partes[1]:rua);
    guardar(pessoa+'_numero',partes?.[2]);guardar(pessoa+'_bairro',partes?.[3]);
  }
  guardar('discriminacao_servicos',capturar(texto,/Discrimina[çc][ãa]o dos Servi[çc]os\s*\n([\s\S]*?)(?=\nC[óo]digo do Servi[çc]o)/i));
  // O PDF só diz "Código do Serviço": preserva o código sem presumir lista LC116.
  guardar('codigo_servico_municipal',quadro('C[óo]digo do Servi[çc]o')?.match(/^\d+$/)?.[0]);
  guardar('codigo_nbs',quadro('C[óo]digo NBS')?.match(/^\d+$/)?.[0]);
  guardar('valor_servicos_centavos',dinheiro(capturar(texto,/VALOR DO SERVI[ÇC]O\s*=\s*([^\n]+)/i)));
  for(const [campo,rotulo] of Object.entries({base_calculo_centavos:'B\\. C[áa]lculo \\(R\\$\\)',valor_iss_centavos:'V\\. do ISS \\(R\\$\\)',valor_liquido_centavos:'V\\. L[íi]quido \\(R\\$\\)',valor_cbs_centavos:'Valor total CBS\\s*\\(R\\$\\)'}))guardar(campo,dinheiro(quadro(rotulo)));
  // Restringe os tributos ao quadro, excluindo valores citados na discriminação.
  const tributos=capturar(texto,/(?:^|\n)(PIS[ \t]+[^\n]+)\nB\. C[áa]lculo/i)||'';
  for(const [campo,rotulo] of Object.entries({valor_pis_centavos:'PIS',valor_cofins_centavos:'COFINS',valor_ir_centavos:'IR',valor_inss_centavos:'INSS',valor_csll_centavos:'CSLL'})){
    guardar(campo,dinheiro(capturar(tributos,new RegExp('(?:^|[ \\t])'+rotulo+'[ \\t]+(R\\$[ \\t]*[\\d.]+,\\d{2}|-)(?=[ \\t]|$)','i'))));
  }
  const aliquota=quadro('Al[íi]quota \\(%\\)')?.match(/^(\d+(?:,\d+)?)\s*%$/);
  if(aliquota && Number(aliquota[1].replace(',','.'))<=100)guardar('aliquota_percentual',Number(aliquota[1].replace(',','.')));
  const retido=normalizar(quadro('ISS Retido')||'');
  guardar('iss_retido',/^(?:2\s*-\s*)?Nao$/i.test(retido)?'nao':/^(?:1\s*-\s*)?Sim$/i.test(retido)?'sim':null);
  const ibsMunicipal=dinheiro(quadro('Valor do IBS no Munic[íi]pio\\s*\\(R\\$\\)'));
  const ibsEstadual=dinheiro(quadro('Valor do IBS da UF\\s*\\(R\\$\\)'));
  if(ibsMunicipal!=null && ibsEstadual!=null){
    guardar('valor_ibs_centavos',ibsMunicipal+ibsEstadual);
    origens.valor_ibs_centavos={metodo:'soma do IBS municipal e estadual do PDF'};
  }
  if(dados.valor_liquido_centavos==null)avisos.push('Valor líquido não informado no PDF; confira o documento fiscal original.');
  return {dados,origens,avisos};
}
module.exports={extrairQive};
