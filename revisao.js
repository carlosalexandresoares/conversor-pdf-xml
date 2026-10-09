const express = require("express");
const { preencherCodigosMunicipios } = require("./municipios");
const db = require("./database");

const router = express.Router();

const camposTexto = [
  "rps_status",
  "prestador_codigo_municipio",
  "tomador_codigo_municipio",
  "codigo_municipio_prestacao",
  "codigo_municipio_incidencia",
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
  "competencia_xml",
"item_lista_servico_xml",
"incentivo_fiscal_xml",
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
      SELECT id, nome_arquivo, dados_json, status, texto_extraido, processamento, erro_processamento
      FROM documentos WHERE id = ?
    `).get(id);

    if (!documento) {
      return res.status(404).json({ erro: "Documento não encontrado." });
    }

    const dados = JSON.parse(documento.dados_json);
    preencherCodigosMunicipios(dados);

    res.json({
      id: documento.id,
      nome_arquivo: documento.nome_arquivo,
      dados,
      texto_extraido: documento.texto_extraido,
      processamento: documento.processamento,
      erro_processamento: documento.erro_processamento,
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
      SELECT dados_json, status, processamento FROM documentos WHERE id = ?
    `).get(id);

    if (!documento) {
      return res.status(404).json({ erro: "Documento não encontrado." });
    }

    if (["fila", "processando"].includes(documento.processamento)) {
      return res.status(409).json({ erro: "Aguarde o processamento terminar antes de salvar." });
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
        if (!(campo in entrada)) continue;
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

          if (! /^(?:\d{11}|\d{14})$/.test(dados[campo])) {
            throw new Error(`O campo ${campo} deve ter 11 (CPF) ou 14 (CNPJ) dígitos.`);
          }
        }
      }

      if (dados.competencia &&
        !/^\d{4}-(0[1-9]|1[0-2])$/.test(dados.competencia)) {
        throw new Error("Use a competência no formato AAAA-MM.");
      }

      if (dados.data_emissao) {
        const data = dados.data_emissao;

        if (!/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2})?$/.test(data)) {
          throw new Error("Use a emissão no formato AAAA-MM-DD ou AAAA-MM-DDTHH:MM:SS.");
        }

        const instante = new Date(data.length === 10 ? `${data}T00:00:00Z` : `${data}Z`);

        if (
          Number.isNaN(instante.getTime()) ||
          instante.toISOString().slice(0, data.length) !== data
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
        dados.iss_retido != null &&
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

      if (dados.competencia_xml) {
  const data = dados.competencia_xml;
  const instante = new Date(`${data}T00:00:00Z`);

  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(data) ||
    Number.isNaN(instante.getTime()) ||
    instante.toISOString().slice(0, 10) !== data
  ) {
    throw new Error("Competência do XML: informe uma data válida AAAA-MM-DD.");
  }

  if (
    dados.competencia &&
    data.slice(0, 7) !== dados.competencia
  ) {
    throw new Error("A competência do XML difere do mês/ano informado.");
  }
}

if (
  dados.incentivo_fiscal_xml &&
  !["1", "2"].includes(dados.incentivo_fiscal_xml)
) {
  throw new Error("Incentivo fiscal do XML: informe o código confirmado 1 ou 2.");
}

      for (const campo of camposDinheiro) {
        if (campo in entrada) dados[campo] = converterDinheiro(entrada[campo], campo);
      }

      const aliquota = entrada.aliquota_percentual ?? String(dados.aliquota_percentual ?? "");

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

    for (const campo of ["prestador_codigo_municipio", "tomador_codigo_municipio", "codigo_municipio_prestacao", "codigo_municipio_incidencia"]) {
      if (dados[campo] && !/^\d{7}$/.test(dados[campo])) return res.status(400).json({erro: `Código IBGE inválido: ${campo}. Use sete dígitos.`});
    }
    if (dados.rps_status && !["1", "2"].includes(dados.rps_status)) return res.status(400).json({erro: "Status do RPS: use 1 ou 2, conforme o documento."});
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

    const anteriores = JSON.parse(documento.dados_json);
    dados.origens = {...dados.origens};
    for (const campo of Object.keys(entrada)) {
      if (JSON.stringify(dados[campo]) !== JSON.stringify(anteriores[campo])) dados.origens[campo] = {metodo: "revisão manual"};
    }
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
      numero_nota: dados.numero_nota ?? null,
      codigo_verificacao: dados.codigo_verificacao ?? null,
      data_emissao: dados.data_emissao ?? null,
      competencia: dados.competencia ?? null,
      cnpj_prestador: dados.cnpj_prestador ?? null,
      nome_prestador: dados.nome_prestador ?? null,
      cnpj_tomador: dados.cnpj_tomador ?? null,
      nome_tomador: dados.nome_tomador ?? null,
      valor_servicos_centavos: dados.valor_servicos_centavos ?? null,
      valor_liquido_centavos: dados.valor_liquido_centavos ?? null,
    });

    if (!resultado.changes) {
      return res.status(409).json({
        erro: "Os dados mudaram. Reabra a revisão.",
      });
    }

    res.json({
      mensagem: "Revisão salva. O XML usará estes dados.",
      versao: novoJson,
    });
  } catch (erro) {
    console.error(erro);
    res.status(500).json({ erro: "Não foi possível salvar a revisão." });
  }
});

module.exports = router;