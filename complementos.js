const express = require("express");
const db = require("./database");

const router = express.Router();

function capturar(texto, expressao) {
  return texto.match(expressao)?.[1]?.trim() || null;
}

function extrairComplementos(textoOriginal) {
  const texto = textoOriginal.replace(/\r\n?/g, "\n");

  const dados = {
    rps_numero: null,
    rps_serie: null,
    rps_tipo: null,
    rps_data: null,
    codigo_servico_municipal: null,
    item_lista_servico: null,
    descricao_servico: null,
    discriminacao_servicos: null,
  };

  if (/PREFEITURA MUNICIPAL DE BARUERI/i.test(texto)) {
    dados.rps_numero = capturar(
      texto, /Número RPS\s*\n(\d+)/i
    );

    dados.rps_serie = capturar(
      texto, /Série RPS\s*\n([^\n]+)/i
    );

    const data = capturar(
      texto, /Data RPS\s*\n(\d{2}\/\d{2}\/\d{4})/i
    );

    if (data) {
      const [dia, mes, ano] = data.split("/");
      dados.rps_data = `${ano}-${mes}-${dia}`;
    }

    const servico = texto.match(
      /^\s*\d+[ \t]+(.+?)[ \t]+(\d{9})[ \t]+\d+,\d{2}[ \t]+[\d.]+,\d{2}[ \t]+[\d.]+,\d{2}[ \t]*$/m
    );

    if (servico) {
      dados.descricao_servico = servico[1].trim();
      dados.codigo_servico_municipal = servico[2];
    }

    dados.discriminacao_servicos = capturar(
      texto,
      /DISCRIMINAÇÃO DOS SERVIÇOS E INFORMAÇÕES RELEVANTES\s*\n([\s\S]*?)(?=\nVALORES DE REPASSE A TERCEIROS)/i
    );
  } else if (/PREFEITURA MUNICIPAL DE SANTOS/i.test(texto)) {
    dados.rps_tipo = capturar(
      texto, /(?:^|\n)(\d+)\s*\nTipo RPS/i
    );

    const rps = texto.match(
      /Série RPS\s*\n([^\s]+)[ \t]+(\d+)/i
    );

    if (rps) {
      dados.rps_serie = rps[1];
      dados.rps_numero = rps[2];
    }

    const atividade = texto.match(
      /Atividade Econômica\s*\n(\d{2}\.\d{2})[ \t]*\/[ \t]*(\d+)/i
    );

    if (atividade) {
      dados.item_lista_servico = atividade[1];
      dados.codigo_servico_municipal = atividade[2];
    }

    dados.descricao_servico = capturar(
      texto, /(?:^|\n)(\* Item:[^\n]+)/i
    );

    dados.discriminacao_servicos = dados.descricao_servico;
  } else {
    throw new Error("Layout ainda não reconhecido.");
  }

  return dados;
}

router.post("/:id/complementos", (req, res) => {
  const id = Number(req.params.id);

  if (!Number.isSafeInteger(id) || id <= 0) {
    return res.status(400).json({ erro: "ID inválido." });
  }

  try {
    const documento = db.prepare(`
      SELECT dados_json, texto_extraido, status
      FROM documentos WHERE id = ?
    `).get(id);

    if (!documento) {
      return res.status(404).json({ erro: "Documento não encontrado." });
    }

    if (documento.status === "conferido") {
      return res.status(409).json({
        erro: "O documento já foi conferido.",
      });
    }

    const dados = JSON.parse(documento.dados_json);

    if (!dados.modelo || !documento.texto_extraido.trim()) {
      return res.status(400).json({
        erro: "Leia o texto e identifique os campos principais primeiro.",
      });
    }

    let complementos;

    try {
      complementos = extrairComplementos(documento.texto_extraido);
    } catch (erro) {
      return res.status(422).json({ erro: erro.message });
    }

    // Acrescenta apenas campos que ainda não existem.
    // Valores presentes, inclusive null, são preservados.
    const adicionados = [];

    for (const [campo, valor] of Object.entries(complementos)) {
      if (!Object.prototype.hasOwnProperty.call(dados, campo)) {
        dados[campo] = valor;
        adicionados.push(campo);
      }
    }

    if (adicionados.length === 0) {
      return res.json({
        mensagem: "Os complementos já foram incluídos. Abra a revisão.",
      });
    }

    const resultado = db.prepare(`
      UPDATE documentos
      SET dados_json = ?
      WHERE id = ? AND dados_json = ? AND status = 'pendente'
    `).run(
      JSON.stringify(dados),
      id,
      documento.dados_json
    );

    if (!resultado.changes) {
      return res.status(409).json({
        erro: "O documento foi alterado. Tente novamente.",
      });
    }

    res.json({
      mensagem: "Complementos incluídos. Abra a revisão para conferir.",
      adicionados,
    });
  } catch (erro) {
    console.error(erro);
    res.status(500).json({
      erro: "Não foi possível incluir os complementos.",
    });
  }
});

module.exports = router;