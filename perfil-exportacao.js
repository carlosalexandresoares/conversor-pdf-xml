// Regras operacionais para distinguir uma revisão salva de um XML liberado.
// A lista é conservadora; a homologação no sistema de destino pode exigir mais campos.
const { cpfValido, cnpjValido, avisosValidacao } = require('./validacao-extracao');

const obrigatorios = {
  numero_nota: 'Número da nota',
  codigo_verificacao: 'Código de verificação',
  data_emissao: 'Data de emissão',
  competencia_xml: 'Competência com data completa',
  cnpj_prestador: 'CPF/CNPJ do prestador',
  nome_prestador: 'Nome do prestador',
  cnpj_tomador: 'CPF/CNPJ do tomador',
  nome_tomador: 'Nome do tomador',
  valor_servicos_centavos: 'Valor dos serviços',
  incentivo_fiscal_xml: 'Incentivo fiscal',
  iss_retido: 'ISS retido',
};

function leituraConcluida(doc, dados = JSON.parse(doc.dados_json || '{}')) {
  return doc.processamento === 'pronto' ||
    (doc.processamento === 'erro' && !!dados.concluido_manual_em && !!dados.revisado_em);
}

function pendenciasExportacao(doc, dados) {
  const pendencias = [];
  if (!leituraConcluida(doc, dados)) pendencias.push('Leitura do PDF não concluída. Em caso de falha, salve os dados e use Concluir por revisão manual.');
  if (!dados.revisado_em) pendencias.push('Revisão ainda não salva.');
  for (const [campo, titulo] of Object.entries(obrigatorios)) {
    if (dados[campo] == null || dados[campo] === '') pendencias.push(`${titulo} ausente.`);
  }
  if (!dados.item_lista_servico_xml && !dados.item_lista_servico) pendencias.push('Item da lista de serviços ausente.');
  if (dados.valor_servicos_centavos != null && (!Number.isSafeInteger(dados.valor_servicos_centavos) || dados.valor_servicos_centavos < 0)) pendencias.push('Valor dos serviços inválido.');
  for (const parte of ['prestador', 'tomador']) {
    const valor = dados[`cnpj_${parte}`];
    if (!valor) continue;
    const digitos = String(valor).replace(/\D/g, '');
    if (!((digitos.length === 11 && cpfValido(digitos)) || (digitos.length === 14 && cnpjValido(digitos)))) pendencias.push(`CPF/CNPJ do ${parte} inválido.`);
  }
  pendencias.push(...avisosValidacao(dados).filter(a => a.includes('ISS informado')));
  return [...new Set(pendencias)];
}

function avaliarExportacao(doc) {
  const dados = JSON.parse(doc.dados_json || '{}');
  const pendencias = pendenciasExportacao(doc, dados);
  return { id: doc.id, nome_arquivo: doc.nome_arquivo, aprovado: doc.status === 'conferido' && !!dados.aprovado_em, pendencias, dados };
}

module.exports = { pendenciasExportacao, avaliarExportacao, leituraConcluida };
