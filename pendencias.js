// Modulo legado de pendencias; nao e montado pelo servidor atual.
const express = require("express");
const db = require("./database");
const { preencherCodigosMunicipios } = require("./municipios");

const router = express.Router();

function verificarPendencias(dados) {
  const pendencias = [];
  const avisos = [];

  const campos = [
    ["numero_nota", "Número da nota"],
    ["codigo_verificacao", "Código de verificação"],
    ["data_emissao", "Data de emissão"],
    ["competencia", "Competência"],
    ["cnpj_prestador", "CNPJ do prestador"],
    ["nome_prestador", "Nome do prestador"],
    ["prestador_inscricao_municipal", "Inscrição municipal do prestador"],
    ["prestador_endereco", "Endereço do prestador"],
    ["prestador_numero", "Número do endereço do prestador"],
    ["prestador_codigo_municipio", "Código IBGE do prestador"],
    ["prestador_uf", "UF do prestador"],
    ["prestador_cep", "CEP do prestador"],
    ["cnpj_tomador", "CNPJ do tomador"],
    ["nome_tomador", "Nome do tomador"],
    ["tomador_endereco", "Endereço do tomador"],
    ["tomador_numero", "Número do endereço do tomador"],
    ["tomador_codigo_municipio", "Código IBGE do tomador"],
    ["tomador_uf", "UF do tomador"],
    ["tomador_cep", "CEP do tomador"],
    ["valor_servicos_centavos", "Valor dos serviços"],
    ["valor_liquido_centavos", "Valor líquido"],
    ["base_calculo_centavos", "Base de cálculo"],
    ["aliquota_percentual", "Alíquota"],
    ["valor_iss_centavos", "Valor do ISS"],
    ["iss_retido", "Indicação de ISS retido"],
  ];

  for (const [campo, nome] of campos) {
    const valor = dados[campo];

    // Zero é um valor preenchido; null e vazio são ausências.
    if (
      valor == null ||
      (typeof valor === "string" && !valor.trim())
    ) {
      pendencias.push(`Preencher ou confirmar: ${nome}.`);
    }
  }

  if (!dados.discriminacao_servicos && !dados.descricao_servico) {
    pendencias.push("Preencher a descrição ou discriminação dos serviços.");
  }

  if (!dados.codigo_servico_municipal && !dados.item_lista_servico) {
    pendencias.push("Informar o código municipal ou o item da lista de serviços.");
  }

  if (!dados.revisado_em) {
    pendencias.push("Abrir a revisão e salvar os dados conferidos.");
  }

  if (dados.competencia && /^\d{4}-\d{2}$/.test(dados.competencia)) {
    avisos.push(
      "A competência possui apenas mês e ano. " +
      "O modelo XML de referência usa uma data completa; " +
      "precisamos definir essa conversão antes da exportação."
    );
  }

  if (!dados.item_lista_servico && dados.codigo_servico_municipal) {
    avisos.push(
      "Há código municipal, mas não há item da lista de serviços. " +
      "O mapeamento para o XML precisa ser confirmado."
    );
  }

  if (dados.rps_numero && (!dados.rps_serie || !dados.rps_data)) {
    avisos.push(
      "O RPS tem número, mas falta série ou data. " +
      "Confira o documento antes de exportar esse grupo."
    );
  }

  if (!dados.codigo_municipio_prestacao) {
    avisos.push("Município de prestação sem código IBGE identificado.");
  }

  if (!dados.codigo_municipio_incidencia) {
    avisos.push("Município de incidência do ISS sem código IBGE identificado.");
  }

  if (
    dados.tomador_numero &&
    /^SN$/i.test(dados.tomador_numero) &&
    /,\s*\d+/.test(dados.tomador_endereco || "")
  ) {
    avisos.push(
      "O número do tomador está como SN, mas o endereço contém um número. " +
      "Confira essa diferença no PDF."
    );
  }

  for (const [campo, nome] of [
    ["valor_pis_centavos", "PIS"],
    ["valor_cofins_centavos", "COFINS"],
    ["valor_inss_centavos", "INSS"],
    ["valor_ir_centavos", "IR"],
    ["valor_csll_centavos", "CSLL"],
  ]) {
    if (dados[campo] == null) {
      avisos.push(`${nome} não informado. Não será assumido como zero.`);
    }
  }

  if (
    dados.valor_ibs_centavos != null ||
    dados.valor_cbs_centavos != null
  ) {
    avisos.push(
      "IBS/CBS estão armazenados. O XML ABRASF de referência " +
      "não contém esses campos; a exportação deles ainda precisa ser definida."
    );
  }

  return { pendencias, avisos };
}

router.get("/:id/pendencias", (req, res) => {
  const id = Number(req.params.id);

  if (!Number.isSafeInteger(id) || id <= 0) {
    return res.status(400).json({ erro: "ID inválido." });
  }

  try {
    const documento = db.prepare(`
      SELECT nome_arquivo, dados_json
      FROM documentos WHERE id = ?
    `).get(id);

    if (!documento) {
      return res.status(404).json({ erro: "Documento não encontrado." });
    }

    const dados = JSON.parse(documento.dados_json);
    preencherCodigosMunicipios(dados);

    res.json({
      nome_arquivo: documento.nome_arquivo,
      ...verificarPendencias(dados),
    });
  } catch (erro) {
    console.error(erro);
    res.status(500).json({
      erro: "Não foi possível verificar as pendências.",
    });
  }
});

module.exports = router;