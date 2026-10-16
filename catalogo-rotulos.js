// Um único vocabulário para os leitores. Só normaliza rótulos, nunca o valor do PDF.
const dicionario=require('./rotulos.json');
const semAcentos=s=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
function normalizarRotulo(s){
  return semAcentos(String(s))
    .replace(/\bcod\.(?=\s|$)/g,'codigo')
    .replace(/\bvl\.(?=\s|$)/g,'valor')
    .replace(/\bdt\.(?=\s|$)/g,'data')
    .replace(/\bn[º°.](?=\s|$)/g,'numero')
    .replace(/\s*\((?:r\$|%)\)\s*/g,' ')
    .replace(/\s*r\$\s*$/g,'')
    .replace(/\s*[:=%]\s*$/g,'')
    .replace(/\s+/g,' ').trim();
}
const indices=new Map();
for(const [canonico,aliases] of Object.entries(dicionario)){
  for(const alias of [canonico,...aliases]){
    const chave=normalizarRotulo(alias);
    if(indices.has(chave)&&indices.get(chave)!==canonico)throw new Error(`Rótulo ambíguo no catálogo: ${alias}`);
    indices.set(chave,canonico);
  }
}
const canonicalizarRotulo=s=>indices.get(normalizarRotulo(s))||normalizarRotulo(s);
const ehRotuloCatalogado=s=>indices.has(normalizarRotulo(s));
const escapar=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
function padraoRotulos(canonico){
  const aliases=[canonico,...(dicionario[canonico]||[])];
  return '(?:'+[...new Set(aliases.map(semAcentos))].sort((a,b)=>b.length-a.length)
    .map(s=>escapar(s).replace(/\s+/g,'[ \\t]+')).join('|')+')';
}
module.exports={normalizarRotulo,canonicalizarRotulo,ehRotuloCatalogado,padraoRotulos};
