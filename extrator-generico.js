const { prepararLayout } = require('./layout-texto');
const normalizar = s => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
function extrairGenerico(original) {
  const texto = prepararLayout(original.normalize('NFC').replace(/\r\n?/g, '\n').replace(/\u00a0/g, ' '));
  const dados = { modelo: 'generico' }, origens = {}, avisos = [];
  function buscar(campo, fonte, expressao, converter = v => v.trim()) {
    const encontrados = [...normalizar(fonte).matchAll(new RegExp(expressao, 'gim'))];
    const valores = encontrados.map(m => {
      const inicio = m.index + m[0].lastIndexOf(m[1]);
      return { valor: converter(fonte.slice(inicio, inicio + m[1].length)), trecho: fonte.slice(m.index, m.index + m[0].length).trim() };
    }).filter(x => x.valor != null && x.valor !== '');
    const unicos = [...new Set(valores.map(x => x.valor))];
    if (unicos.length === 1) { dados[campo] = unicos[0]; origens[campo] = { metodo: 'rotulo', trecho: valores[0].trecho }; }
    else if (unicos.length > 1) avisos.push(`Há valores diferentes para ${campo}; confira o PDF.`);
  }
  const sep = '[ \\t]*(?:\\(r\\$\\)|\\(%\\))?[ \\t]*:?[ \\t]*(?:\\n[ \\t]*)?';
  const dinheiro = v => { const n = Number(v.replace(/\./g, '').replace(',', '.')); return Number.isFinite(n) && Number.isSafeInteger(Math.round(n*100)) ? Math.round(n*100) : null; };
  const moeda = '(?:r\\$[ \\t]*)?([0-9]+(?:\\.[0-9]{3})*,[0-9]{2})(?![0-9])';
  buscar('numero_nota', texto, '(?:^|\\n)[ \\t]*(?:(?:numero|n[º°o.]*) (?:da |de )?(?:nota(?: fiscal)?|nfs-?e)|nfs-e (?:n[oº°.]|numero)|nota fiscal (?:de servicos )?(?:n[oº°.]|numero))'+sep+'([0-9]+)\\b');
  buscar('codigo_verificacao', texto, '(?:codigo (?:de )?(?:verificacao|autenticidade))'+sep+'([a-z0-9][a-z0-9.\\-]{3,50})\\b');
  buscar('data_emissao', texto, '(?:data (?:e hora )?(?:de )?emissao(?: da nfs-e)?|emissao da nfs-e)'+sep+'(\\d{2}/\\d{2}/\\d{4}(?:[ \\t]+\\d{2}:\\d{2}(?::\\d{2})?)?)', v => {
    const m=v.match(/(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}:\d{2}(?::\d{2})?))?/);
    const data=`${m[3]}-${m[2]}-${m[1]}`; const t=new Date(data+'T00:00:00Z');
    return !Number.isNaN(t.getTime()) && t.toISOString().slice(0,10)===data ? data+(m[4]?'T'+m[4]+(m[4].length===5?':00':''):'') : null;
  });
  buscar('competencia', texto, 'competencia'+sep+'((?:\\d{2}/)?\\d{2}/\\d{4})', v => { const p=v.split('/'); const mes=p[p.length-2]; return Number(mes)>=1 && Number(mes)<=12 ? `${p[p.length-1]}-${mes}` : null; });
  const dinheiroCampos = {
    valor_servicos_centavos: 'valor (?:total (?:dos? )?)?(?:dos? )?servicos?',
    valor_liquido_centavos: 'valor liquido(?: (?:da )?nota)?', base_calculo_centavos: 'base de calculo',
    valor_total_nota_centavos: 'valor total da nota', valor_iss_centavos: '(?:valor (?:do )?)?iss(?:qn)?',
    valor_pis_centavos: '(?:valor (?:do )?)?pis(?:/pasep)?', valor_cofins_centavos: '(?:valor (?:da )?)?cofins',
    valor_inss_centavos: '(?:valor (?:do )?)?inss', valor_ir_centavos: '(?:valor (?:do )?)?ir(?:rf)?',
    valor_csll_centavos: '(?:valor (?:da )?)?csll', valor_ibs_centavos: '(?:valor (?:do )?)?ibs', valor_cbs_centavos: '(?:valor (?:da )?)?cbs'
  };
  for (const [campo,rotulo] of Object.entries(dinheiroCampos)) buscar(campo,texto,'(?:^|\\n)[ \\t]*'+rotulo+sep+moeda,dinheiro);
  buscar('aliquota_percentual',texto,'aliquota'+sep+'(\\d{1,3}(?:[.,]\\d{1,4})?)[ \\t]*%',v=>{const n=Number(v.replace(',','.'));return n<=100?n:null});
  buscar('item_lista_servico',texto,'(?:item (?:da )?lista (?:de )?servicos?|item lc ?116(?:/2003)?)'+sep+'(\\d{1,2}\\.\\d{2})');
  buscar('iss_retido',texto,'iss(?:qn)? (?:retido|a reter)'+sep+'(sim|nao)\\b',v=>normalizar(v));
  buscar('rps_numero',texto,'(?:numero (?:do )?rps|rps numero)'+sep+'(\\d+)\\b');
  buscar('rps_serie',texto,'serie (?:do )?rps'+sep+'([a-z0-9-]+)');
  // No CNPJ is assigned by its position on the page: the party heading must exist.
  for (const pessoa of ['prestador','tomador']) {
    const heading=new RegExp('(?:^|\\n)[ \\t]*(?:(?:dados|identificacao) (?:do )?)?'+(pessoa==='prestador'?'(?:prestador|emitente)':'tomador')+'(?: (?:de |dos? )?servicos?)?(?: da nfs-e)?[ \\t]*:?[ \\t]*(?:\\n|$)','im');
    const m=normalizar(texto).match(heading); if(!m) continue;
    let bloco=texto.slice(m.index + m[0].length);
    const fim=normalizar(bloco).search(/(?:^|\n)[ \t]*(?:(?:(?:dados|identificacao) (?:do )?)?(?:prestador|emitente|tomador|intermediario)|discriminacao|descricao dos servicos|valores da nota|atividade economica|servico prestado|tributacao)/i);
    if(fim>=0) bloco=bloco.slice(0,fim);
    buscar('cnpj_'+pessoa,bloco,'(?:cpf\\s*/\\s*cnpj|cnpj\\s*/\\s*cpf|cnpj|cpf)'+sep+'([\\d./-]{11,18})(?![\\d./-])',v=>{v=v.replace(/\D/g,'');return [11,14].includes(v.length)?v:null});
    buscar('nome_'+pessoa,bloco,'(?:nome/razao social|razao social|nome)'+sep+'([^\\n:]{2,180})(?=\\n|$)');
    for(const [campo,rotulo] of Object.entries({endereco:'endereco|logradouro',bairro:'bairro',municipio:'municipio|cidade',complemento:'complemento'})) buscar(pessoa+'_'+campo,bloco,'(?:^|\\n)[ \\t]*(?:'+rotulo+')'+sep+'([^\\n:]{1,180})(?=\\n|$)');
    buscar(pessoa+'_numero',bloco,'(?:^|\\n)[ \\t]*numero'+sep+'([0-9]+|s/?n)\\b');
    buscar(pessoa+'_cep',bloco,'cep'+sep+'(\\d{5}-?\\d{3})',v=>v.replace('-',''));
    buscar(pessoa+'_uf',bloco,'\\buf'+sep+'([a-z]{2})\\b',v=>v.toUpperCase());
    buscar(pessoa+'_inscricao_municipal',bloco,'inscricao municipal'+sep+'([a-z0-9./-]+)');
    buscar(pessoa+'_email',bloco,'e-?mail'+sep+'([^\\s@]+@[^\\s@]+\\.[^\\s@]+)');
    const cidade=bloco.match(/(?:Munic[ií]pio(?:\s*\/\s*UF)?|Cidade)\s*:?\s*([^\n:]+?)\s*[-/]\s*([A-Z]{2})\b/i);
    if(cidade) {dados[pessoa+'_municipio']=cidade[1].trim();dados[pessoa+'_uf']=cidade[2].toUpperCase();}
  }
  const descricao = texto.match(/(?:discrimina[çc][ãa]o (?:dos? )?servi[çc]os|descri[çc][ãa]o dos servi[çc]os)[ \t]*:?\s*\n([\s\S]*?)(?=\n(?:VALOR|RETEN|OUTRAS INFORMA|TRIBUT)|$)/i);
  if(descricao) dados.discriminacao_servicos=descricao[1].trim().slice(0,10000);
  return {dados,origens,avisos};
}
module.exports={extrairGenerico};
