const express = require("express");
const db = require("./database");
const { extrairCampos } = require("./extrator");

const router = express.Router();

router.post("/:id/identificar-campos", (req, res) => {
  const id = Number(req.params.id);

  if (!Number.isSafeInteger(id) || id <= 0) {
    return res.status(400).json({ erro: "ID inválido." });
  }

  try {
    const documento = db.prepare(`
      SELECT id, texto_extraido, status
      FROM documentos
      WHERE id = ?
    `).get(id);

    if (!documento) {
      return res.status(404).json({
        erro: "Documento não encontrado.",
      });
    }

    if (documento.status === "conferido") {
      return res.status(409).json({
        erro: "Este documento já foi conferido. Não será sobrescrito.",
      });
    }

    if (!documento.texto_extraido.trim()) {
      return res.status(400).json({
        erro: 'Clique primeiro em "Ler texto".',
      });
    }

    let dados;

    try {
      dados = extrairCampos(documento.texto_extraido);
    } catch (erro) {
      return res.status(422).json({ erro: erro.message });
    }

    db.prepare(`
      UPDATE documentos SET
        modelo = @modelo,
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
        dados_json = @dados_json
      WHERE id = @id
    `).run({
      id,
      modelo: dados.modelo,
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
      dados_json: JSON.stringify(dados),
    });

    res.json({
      mensagem: "Campos identificados e salvos. A conferência está pendente.",
      dados,
    });
  } catch (erro) {
    console.error(erro);
    res.status(500).json({
      erro: "Não foi possível salvar os campos.",
    });
  }
});

module.exports = router;