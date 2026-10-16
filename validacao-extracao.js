// Conferências não alteram campos sugeridos. Valores inconsistentes ficam visíveis na revisão.
function digitoMod11(numeros,pesos){
  const resto=numeros.reduce((s,n,i)=>s+n*pesos[i],0)%11;
  return resto<2?0:11-resto;
}
function cpfValido(valor){
  const n=String(valor).replace(/\D/g,'').split('').map(Number);
  if(n.length!==11||n.every(d=>d===n[0]))return false;
  const primeiro=digitoMod11(n.slice(0,9),[10,9,8,7,6,5,4,3,2]);
  const segundo=digitoMod11(n.slice(0,10),[11,10,9,8,7,6,5,4,3,2]);
  return n[9]===primeiro&&n[10]===segundo;
}
function cnpjValido(valor){
  const n=String(valor).replace(/\D/g,'').split('').map(Number);
  if(n.length!==14||n.every(d=>d===n[0]))return false;
  const primeiro=digitoMod11(n.slice(0,12),[5,4,3,2,9,8,7,6,5,4,3,2]);
  const segundo=digitoMod11(n.slice(0,13),[6,5,4,3,2,9,8,7,6,5,4,3,2]);
  return n[12]===primeiro&&n[13]===segundo;
}
function avisosValidacao(dados){
  const avisos=[];
  for(const parte of ['prestador','tomador']){
    const campo='cnpj_'+parte,valor=dados[campo];
    if(valor==null)continue;
    const n=String(valor).replace(/\D/g,'');
    if(n.length===11&&!cpfValido(n)||n.length===14&&!cnpjValido(n))
      avisos.push(`CPF/CNPJ do ${parte} não passou na conferência dos dígitos verificadores; confira o PDF.`);
  }
  const base=dados.base_calculo_centavos,aliquota=dados.aliquota_percentual,iss=dados.valor_iss_centavos;
  if(Number.isSafeInteger(base)&&typeof aliquota==='number'&&Number.isFinite(aliquota)&&Number.isSafeInteger(iss)){
    const estimado=Math.round(base*aliquota/100);
    if(Math.abs(estimado-iss)>1)avisos.push('O ISS informado difere de base × alíquota; confira retenções e regras tributárias no PDF.');
  }
  return avisos;
}
function atualizarAvisosValidacao(dados){
  const anteriores=new Set(dados.avisos_validacao||[]);
  const novos=avisosValidacao(dados);
  // Versões anteriores não separavam os avisos recalculáveis. Remova apenas
  // mensagens conhecidas desse validador, preservando avisos de OCR e layout.
  const legado=a=>/^CPF\/CNPJ do (prestador|tomador) não passou na conferência dos dígitos verificadores; confira o PDF\.$/.test(a)
    || a==='O ISS informado difere de base × alíquota; confira retenções e regras tributárias no PDF.';
  dados.avisos_validacao=novos;
  dados.avisos=[...new Set([...(dados.avisos||[]).filter(a=>!anteriores.has(a)&&!legado(a)),...novos])];
  return dados;
}
module.exports={cpfValido,cnpjValido,avisosValidacao,atualizarAvisosValidacao};
