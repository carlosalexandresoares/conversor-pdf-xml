// Reorganiza rótulos e valores sem depender do município emissor.
const {ehRotuloCatalogado}=require('./catalogo-rotulos');
const normalizar = s => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const rotulo = /^(?:(?:n[uú]mero|n[º°o.]*) (?:da |do )?(?:nota|nfs-?e|rps)|c[oó]digo (?:de )?(?:verifica[çc][ãa]o|autenticidade)|data.*emiss[ãa]o|compet[eê]ncia(?: da nfs-e)?|(?:nome\s*\/\s*)?raz[ãa]o social|nome|(?:cpf\s*\/\s*cnpj|cnpj\s*\/\s*cpf|cnpj|cpf)|inscri[çc][ãa]o municipal|endere[çc]o|logradouro|bairro|munic[ií]pio(?:\s*\/\s*uf)?|cidade|uf|cep|e-?mail|telefone|valor.*|base de c[aá]lculo|al[ií]quota(?:\s*\(%\))?|iss(?:qn)?|pis|cofins|inss|irrf|csll|ibs|cbs)$/i;
function prepararLayout(texto) {
  const linhas = texto.split('\n');
  const saida = [];
  for (let i = 0; i < linhas.length; i++) {
    const linha = linhas[i].trim();
    const colunas = linha.split(/\t+| {2,}/).map(s => s.trim()).filter(Boolean);
    const valores = (linhas[i + 1] || '').trim().split(/\t+| {2,}/).map(s => s.trim()).filter(Boolean);
    if (colunas.length > 1 && colunas.every(s => ehRotuloCatalogado(s)||rotulo.test(s.replace(/:$/, ''))) && valores.length === colunas.length && !valores.some(s => ehRotuloCatalogado(s)||rotulo.test(s))) {
      saida.push(...colunas.map((s, j) => `${s.replace(/:$/, '')}: ${valores[j]}`));
      i++;
      continue;
    }
    // Alguns geradores serializam todos os títulos antes de todos os valores.
    if (ehRotuloCatalogado(linha)||rotulo.test(linha.replace(/:$/, ''))) {
      let fim = i;
      while (fim < linhas.length && (ehRotuloCatalogado(linhas[fim])||rotulo.test(linhas[fim].trim().replace(/:$/, '')))) fim++;
      const quantidade = fim - i;
      const itens = linhas.slice(fim, fim + quantidade).map(s => s.trim());
      if (quantidade > 1 && itens.length === quantidade && itens.every(s => s && !ehRotuloCatalogado(s)&&!rotulo.test(s) && !/^(prestador|tomador|discriminacao|valores)/.test(normalizar(s)))) {
        saida.push(...linhas.slice(i, fim).map((s, j) => `${s.trim().replace(/:$/, '')}: ${itens[j]}`));
        i = fim + quantidade - 1;
        continue;
      }
    }
    // Campos lado a lado com seus próprios rótulos, inclusive texto de OCR.
    saida.push(linha.replace(/[ \t]+(?=(?:(?:Nome\s*\/\s*)?Raz[aã]o Social|CPF\s*\/\s*CNPJ|CNPJ\s*\/\s*CPF|CNPJ|CPF|Inscri[cç][aã]o Municipal|Endere[cç]o|Bairro|Munic[ií]pio|Cidade|UF|CEP|E-?mail|Valor[^:\n]*|Base de C[aá]lculo|Al[ií]quota)\s*:)/gi, '\n'));
  }
  return saida.join('\n');
}
module.exports = { prepararLayout };
