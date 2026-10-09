const express = require("express");
const { preencherCodigosMunicipios } = require("./municipios");
const db = require("./database");

const router = express.Router();

const camposTexto = [
  "numero_nota",
  "codigo_verificacao",
  "data_emissao",
  "competencia",
  "cnpj_prestador",
  "nome_prestador",
  "cnpj_tomador",
  "nome_tomador",
  "rps_numero",
  "rps_serie",
  "rps_tipo",
  "rps_data",
  "codigo_servico_municipal",
  "item_lista_servico",
  "descricao_servico",
  "discriminacao_servicos",
  "prestador_endereco",
  "prestador_numero",
  "prestador_complemento",
  "prestador_bairro",
  "prestador_cep",
  "prestador_municipio",
  "prestador_uf",
  "prestador_inscricao_municipal",
  "prestador_email",
  "prestador_telefone",
  "tomador_endereco",
  "tomador_numero",
  "tomador_complemento",
  "tomador_bairro",
  "tomador_cep",
  "tomador_municipio",
  "tomador_uf",
  "tomador_inscricao_municipal",
  "tomador_email",
  "tomador_telefone",
  "iss_retido",
  "municipio_prestacao",
  "uf_prestacao",
  "municipio_incidencia",
  "uf_incidencia",
];

const camposDinheiro = [
  "valor_servicos_centavos",
  "valor_liquido_centavos",
  "valor_total_nota_centavos",
  "valor_iss_centavos",
  "valor_ibs_centavos",
  "valor_cbs_centavos",
  "base_calculo_centavos",
  "valor_pis_centavos",
  "valor_cofins_centavos",
  "valor_inss_centavos",
  "valor_ir_centavos",
  "valor_csll_centavos",
];

function validarId(valor) {
  const id = Number(valor);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

function converterDinheiro(valor, campo) {
  if (typeof valor !== "string") {
    throw new Error(`Valor inválido: ${campo}.`);
  }

  const texto = valor.trim();
  if (!texto) return null;

  // Aceita 5745,84 ou 5745.84, sem separador de milhares.
  if (!/^\d+(?:[.,]\d{1,2})?$/.test(texto)) {
    throw new Error(
      `Use um valor como 5745,84 no campo ${campo}.`
    );
  }

  const [inteiro, fracao = ""] = texto.replace(",", ".").split(".");
  const centavos = Number(inteiro) * 100 +
    Number(fracao.padEnd(2, "0"));

  if (!Number.isSafeInteger(centavos)) {
    throw new Error(`Valor muito alto: ${campo}.`);
  }

  return centavos;
}

router.get("/:id/revisao", (req, res) => {
  const id = validarId(req.params.id);

  if (!id) {
    return res.status(400).json({ erro: "ID inválido." });
  }

  try {
    const documento = db.prepare(`
      SELECT id, nome_arquivo, dados_json, status
      FROM documentos WHERE id = ?
    `).get(id);

    if (!documento) {
      return res.status(404).json({ erro: "Documento não encontrado." });
    }

    const dados = JSON.parse(documento.dados_json);
    preencherCodigosMunicipios(dados);
    if (!dados.modelo) {
      return res.status(400).json({
        erro: 'Clique primeiro em "Identificar campos".',
      });
    }

    res.json({
      id: documento.id,
      nome_arquivo: documento.nome_arquivo,
      dados,
      versao: documento.dados_json,
    });
  } catch (erro) {
    console.error(erro);
    res.status(500).json({ erro: "Não foi possível abrir a revisão." });
  }
});

router.put("/:id/revisao", (req, res) => {
  const id = validarId(req.params.id);

  if (!id) {
    return res.status(400).json({ erro: "ID inválido." });
  }

  try {
    const documento = db.prepare(`
      SELECT dados_json, status FROM documentos WHERE id = ?
    `).get(id);

    if (!documento) {
      return res.status(404).json({ erro: "Documento não encontrado." });
    }

    if (documento.status === "conferido") {
      return res.status(409).json({
        erro: "O documento já foi conferido e está bloqueado nesta etapa.",
      });
    }

    if (req.body?.versao !== documento.dados_json) {
      return res.status(409).json({
        erro: "Os dados foram alterados. Reabra a revisão antes de salvar.",
      });
    }

    const entrada = req.body.campos;

    if (!entrada || typeof entrada !== "object" || Array.isArray(entrada)) {
      return res.status(400).json({ erro: "Campos inválidos." });
    }

    const dados = JSON.parse(documento.dados_json);

    try {
      for (const campo of camposTexto) {
        if (typeof entrada[campo] !== "string") {
          throw new Error(`Campo inválido: ${campo}.`);
        }

        const valor = entrada[campo].trim();

        const limite = [
          "descricao_servico",
          "discriminacao_servicos",
        ].includes(campo) ? 10000 : 300;

        if (valor.length > limite) {
          throw new Error(`Campo muito longo: ${campo}.`);
        }

        dados[campo] = valor || null;
      }

      for (const campo of ["cnpj_prestador", "cnpj_tomador"]) {
        if (dados[campo]) {
          dados[campo] = dados[campo].replace(/[./\-\s]/g, "");

          if (!/^\d{14}$/.test(dados[campo])) {
            throw new Error(`O campo ${campo} deve ter 14 dígitos.`);
          }
        }
      }

      if (dados.competencia &&
        !/^\d{4}-(0[1-9]|1[0-2])$/.test(dados.competencia)) {
        throw new Error("Use a competência no formato AAAA-MM.");
      }

      if (dados.data_emissao) {
        const data = dados.data_emissao;

        if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(data)) {
          throw new Error("Use a emissão no formato AAAA-MM-DDTHH:MM:SS.");
        }

        const instante = new Date(`${data}Z`);

        if (
          Number.isNaN(instante.getTime()) ||
          instante.toISOString().slice(0, 19) !== data
        ) {
          throw new Error("A data de emissão é inválida.");
        }
      }

      const ufsValidas = new Set([
        "AC", "AL", "AP", "AM", "BA", "CE", "DF",
        "ES", "GO", "MA", "MT", "MS", "MG", "PA",
        "PB", "PR", "PE", "PI", "RJ", "RN", "RS",
        "RO", "RR", "SC", "SP", "SE", "TO",
      ]);

      for (const pessoa of ["prestador", "tomador"]) {
        const campoCep = `${pessoa}_cep`;
        const campoUf = `${pessoa}_uf`;
        const campoEmail = `${pessoa}_email`;

        if (dados[campoCep]) {
          const cep = dados[campoCep].replace(/[-\s]/g, "");

          if (!/^\d{8}$/.test(cep)) {
            throw new Error(`O CEP do ${pessoa} deve ter 8 dígitos.`);
          }

          dados[campoCep] = cep;
        }

        if (dados[campoUf]) {
          const uf = dados[campoUf].toUpperCase();

          if (!ufsValidas.has(uf)) {
            throw new Error(`A UF do ${pessoa} é inválida.`);
          }

          dados[campoUf] = uf;
        }

        if (
          dados[campoEmail] &&
          !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(dados[campoEmail])
        ) {
          throw new Error(`O e-mail do ${pessoa} está em formato inválido.`);
        }
      }

      // Valida a data do RPS quando preenchida.
      if (dados.rps_data) {
        const data = dados.rps_data;

        if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) {
          throw new Error("Use a data do RPS no formato AAAA-MM-DD.");
        }

        const instante = new Date(`${data}T00:00:00Z`);

        if (
          Number.isNaN(instante.getTime()) ||
          instante.toISOString().slice(0, 10) !== data
        ) {
          throw new Error("A data do RPS é inválida.");
        }
      }

      if (
        dados.iss_retido !== null &&
        !["sim", "nao"].includes(dados.iss_retido)
      ) {
        throw new Error('ISS retido: informe "sim", "nao" ou deixe vazio.');
      }

      for (const campo of ["uf_prestacao", "uf_incidencia"]) {
        if (dados[campo]) {
          dados[campo] = dados[campo].toUpperCase();

          if (!ufsValidas.has(dados[campo])) {
            throw new Error(`UF inválida: ${campo}.`);
          }
        }
      }

      for (const campo of camposDinheiro) {
        dados[campo] = converterDinheiro(entrada[campo], campo);
      }

      const aliquota = entrada.aliquota_percentual;

      if (typeof aliquota !== "string") {
        throw new Error("Alíquota inválida.");
      }

      const textoAliquota = aliquota.trim();

      if (!textoAliquota) {
        dados.aliquota_percentual = null;
      } else {
        if (!/^\d+(?:[.,]\d{1,4})?$/.test(textoAliquota)) {
          throw new Error("Use uma alíquota como 2 ou 2,5.");
        }

        const numero = Number(textoAliquota.replace(",", "."));

        if (numero > 100) {
          throw new Error("A alíquota deve estar entre 0 e 100.");
        }

        dados.aliquota_percentual = numero;
      }
    } catch (erro) {
      return res.status(400).json({ erro: erro.message });
    }

    dados.campos_nao_encontrados = [
      "numero_nota",
      "data_emissao",
      "cnpj_prestador",
      "nome_prestador",
      "cnpj_tomador",
      "nome_tomador",
      "valor_servicos_centavos",
    ].filter((campo) => dados[campo] == null);

    preencherCodigosMunicipios(dados);

    dados.revisado_em = new Date().toISOString();

    const novoJson = JSON.stringify(dados);

    const resultado = db.prepare(`
      UPDATE documentos SET
        numero_nota = @numero_nota,
        codigo_verificacao = @codigo_verificacao,
        data_emissao = @data_emissao,
        competencia = @competencia,
        cnpj_prestador = @cnpj_prestador,
        nome_prestador = @nome_prestador,
        cnpj_tomador = @cnpj_tomador,
        nome_tomador = @nome_tomador,
        valor_servicos_centavos = @valor_servicos_centavos,
        valor_liquido_centavos = @valor_liquido_centavos,
        dados_json = @novoJson
      WHERE id = @id AND dados_json = @versao AND status = 'pendente'
    `).run({
      id,
      versao: documento.dados_json,
      novoJson,
      numero_nota: dados.numero_nota,
      codigo_verificacao: dados.codigo_verificacao,
      data_emissao: dados.data_emissao,
      competencia: dados.competencia,
      cnpj_prestador: dados.cnpj_prestador,
      nome_prestador: dados.nome_prestador,
      cnpj_tomador: dados.cnpj_tomador,
      nome_tomador: dados.nome_tomador,
      valor_servicos_centavos: dados.valor_servicos_centavos,
      valor_liquido_centavos: dados.valor_liquido_centavos,
    });

    if (!resultado.changes) {
      return res.status(409).json({
        erro: "Os dados mudaram. Reabra a revisão.",
      });
    }

    res.json({
      mensagem: "Revisão salva. Documento ainda pendente.",
      versao: novoJson,
    });
  } catch (erro) {
    console.error(erro);
    res.status(500).json({ erro: "Não foi possível salvar a revisão." });
  }
});

module.exports = router;