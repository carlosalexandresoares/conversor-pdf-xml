// Layout municipal de Poá, inclusive a versão digitalizada lida por OCR.
const semAcento = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const pegar = (texto, re) => texto.match(re)?.[1]?.trim() || null;
const dinheiro = s => s ? Math.round(Number(s.replace(/\./g, '').replace(',', '.')) * 100) : null;
const data = s => { const m=s?.match(/(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}:\d{2}:\d{2})/); return m ? `${m[3]}-${m[2]}-${m[1]}T${m[4]}` : null; };

function extrairPoa(original) {
  const t=semAcento(original).replace(/\r\n?/g,'\n');
  if(!/Prefeitura da Estancia Hidromineral de Poa/i.test(t)) return null;
  const dados={modelo:'poa'};
  const cnps=[...t.matchAll(/\b\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}\b/g)].map(m=>m[0].replace(/\D/g,''));
  dados.cnpj_prestador=cnps[0] || null;
  dados.cnpj_tomador=cnps.find(c=>c!==cnps[0]) || null;
  const inicioTomador=original.search(/Tomador\/Adquirente da Opera[cç][aã]o/i);
  const fimTomador=original.search(/O DESTINAT[AÁ]RIO [EÉ] O PR[OÓ]PRIO/i);
  const prestadorBloco=original.slice(0,inicioTomador<0?undefined:inicioTomador);
  const tomadorBloco=inicioTomador<0?'':original.slice(inicioTomador,fimTomador>inicioTomador?fimTomador:undefined);
  dados.nome_prestador=pegar(prestadorBloco,/Raz[aã]o Social[ \t]*:?[ \t]*([^\n]+)/i);
  dados.nome_tomador=pegar(tomadorBloco,/Raz[aã]o Social[ \t]*:?[ \t]*([^\n]+)/i)
    || pegar(tomadorBloco,/([^\n]+?)\s+Raz[aã]o Social\s*(?:\n|$)/i);
  const nota=pegar(t,/\b(\d[\d.]*)\/NFE\b/i);
  dados.numero_nota=nota?.replace(/\./g,'') || null;
  dados.codigo_verificacao=pegar(t,/\b(DA[0-9A-F]{18,})\b/i);
  dados.data_emissao=data(pegar(t,/\b(\d{2}\/\d{2}\/\d{4}\s+\d{2}:\d{2}:\d{2})\b/));
  dados.rps_numero=pegar(t,/RPS no\.?\s*(\d+)/i);
  dados.rps_data=data((pegar(t,/RPS no\.?\s*\d+,?\s*Emitido em:\s*(\d{2}\/\d{2}\/\d{4})/i)||'')+' 00:00:00')?.slice(0,10) || null;
  const total=pegar(t,/VALOR TOTAL DA NOTA\s*=\s*R\$\s*([\d.]+,\d{2})/i);
  dados.valor_total_nota_centavos=dinheiro(total);
  // Na versão impressa a base também aparece isolada na linha da tabela.
  const base=pegar(t,/Base de Calculo\s*\(R\$\)[^\n]*\n\s*([\d.]+,\d{2})/i)
    || pegar(t,/Base de Calculo\s*\(R\$\)[\s\S]{0,90}?\n\s*([\d.]+,\d{2})\s*\nDesconto Incondicional/i);
  dados.base_calculo_centavos=dinheiro(base);
  dados.valor_servicos_centavos=dados.valor_total_nota_centavos ?? dados.base_calculo_centavos;
  dados.valor_liquido_centavos=dados.valor_total_nota_centavos;
  // OCR: os títulos vêm antes dos dois números; texto nativo: ISS e alíquota vêm antes.
  const par= t.match(/Aliquota ISSQN\s*\(%\)\s*Valor do ISSQN\s*\(R\$\)\s*\n\s*([\d.]+,\d{2})\s+([\d.]+,\d{2})/i);
  if(par){dados.aliquota_percentual=Number(par[1].replace(',','.'));dados.valor_iss_centavos=dinheiro(par[2]);}
  else {
    dados.valor_iss_centavos=dinheiro(pegar(t,/([\d.]+,\d{2})\s*\nValor do ISSQN\s*\(R\$\)/i));
    const aliq=pegar(t,/([\d.]+,\d{2})\s*\nAliquota ISSQN\s*\(%\)/i);
    dados.aliquota_percentual=aliq?Number(aliq.replace(',','.')):null;
  }
  const retido=pegar(t,/ISSQN Retido na Fonte\s*\n[^\n]*\b(NAO|SIM)\b/i) || pegar(t,/\b(NAO|SIM)\s*\nOutras Informacoes/i);
  if(retido)dados.iss_retido=retido.toUpperCase()==='SIM'?'sim':'nao';
  dados.item_lista_servico=pegar(t,/Codigo do Servico:\s*(\d{2}\.\d{2})/i);
  dados.codigo_servico_municipal=pegar(t,/Codigo Tributacao Nacional:\s*([\d.]+)/i);
  dados.discriminacao_servicos=pegar(t,/(AQUISICAO DE CERTIFICADO[^\n]*)/i);
  const linhas=t.split('\n');
  function tributo(rotulo){
    const linha=linhas.findIndex(l=>new RegExp(`\\b${rotulo}\\b`,'i').test(l) && /\d+,\d{2}/.test(l));
    if(linha<0)return null;
    const atual=linhas[linha];
    const valores=atual.match(/\b[\d.]+,\d{2}\b/g)||[];
    if(new RegExp(`^\\s*${rotulo}\\b`,'i').test(atual))return dinheiro(valores.at(-1));
    return dinheiro(valores[0]);
  }
  dados.valor_cbs_centavos=tributo('CBS');
  const ibsUf=tributo('IBS UF'),ibsMun=tributo('IBS Mun');
  dados.valor_ibs_centavos=ibsUf==null&&ibsMun==null?null:(ibsUf||0)+(ibsMun||0);
  // O cadastro do tomador precisa sobreviver mesmo quando a nota foi escaneada.
  const bloco=tomadorBloco;
  dados.tomador_endereco=pegar(bloco,/Endere[cç]o\s*[:—-]?\s*([^\n]+?)\s*-\s*Num:/i);
  dados.tomador_numero=pegar(bloco,/Endere[cç]o[^\n]*-\s*Num:\s*(\d+)/i);
  dados.tomador_bairro=pegar(bloco,/Bairro\s*[:—-]?\s*([^\n]+?)\s*-\s*CEP/i)
    || pegar(bloco,/([^\n]+?)\s*-\s*CEP:[^\n]*\s+Bairro\b/i);
  dados.tomador_cep=pegar(bloco,/CEP:\s*(\d{2}\.\d{3}-\d{3})/i)?.replace(/\D/g,'') || null;
  const municipio=bloco.match(/Munic[ií]pio\s*[:—-]*\s*([A-Za-zÀ-ú ]+?)\s*-\s*([A-Z]{2})\b/i);
  dados.tomador_municipio=municipio?.[1]?.trim().toUpperCase() || null;
  dados.tomador_uf=municipio?.[2]?.toUpperCase() || null;
  dados.prestador_municipio='POA';dados.prestador_uf='SP';
  dados.municipio_prestacao='POA';dados.uf_prestacao='SP';
  dados.municipio_incidencia='POA';dados.uf_incidencia='SP';
  return dados;
}
module.exports={extrairPoa};
