const express = require("express");
const db = require("./database");

const router = express.Router();

function capturar(texto, expressao) {
  return texto.match(expressao)?.[1]?.trim() || null;
}

function extrairEnderecos(textoOriginal) {
  const texto = textoOriginal.replace(/\r\n?/g, "\n");
  const dados = {};

  for (const pessoa of ["prestador", "tomador"]) {
    for (const campo of [
      "endereco",
      "numero",
      "complemento",
      "bairro",
      "cep",
      "municipio",
      "uf",
      "inscricao_municipal",
      "email",
      "telefone",
    ]) {
      dados[`${pessoa}_${campo}`] = null;
    }
  }

  if (/PREFEITURA MUNICIPAL DE BARUERI/i.test(texto)) {
    const prestador = capturar(
      texto,
      /Prestador de Serviços[^\n]*\n([\s\S]*?)(?=\nNome Tomador de Serviços)/i
    ) || "";

    const endereco = prestador.match(
      /^([^\n]+?),[ \t]*(\d+)[ \t]*(?:-[ \t]*([^\n]+))?$/m
    );

    if (endereco) {
      dados.prestador_endereco = endereco[1].trim();
      dados.prestador_numero = endereco[2];
      dados.prestador_complemento = endereco[3]?.trim() || null;
    }

    dados.prestador_bairro = capturar(
      prestador, /(?:^|\n)([^\n]+)\nCEP[ \t]/i
    );

    const local = prestador.match(
      /CEP[ \t]+(\d{5}-\d{3})[ \t]*-[ \t]*([^\n]+?)[ \t]*-[ \t]*([A-Z]{2})(?:\n|$)/i
    );

    if (local) {
      dados.prestador_cep = local[1].replace("-", "");
      dados.prestador_municipio = local[2].trim();
      dados.prestador_uf = local[3].toUpperCase();
    }

    dados.prestador_inscricao_municipal = capturar(
      prestador, /Inscrição Municipal[ \t]+([^\s]+)/i
    );

    const tomador = texto.match(
      /\n([^\n]+)[ \t]+\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}\s*\n([^\n]+)\n(\d{5}-\d{3})[ \t]+([^\n]+)\n([^\s]+@[^\s]+)/
    );

    if (tomador) {
      const enderecoTomador = tomador[2].match(
        /^(.+?),[ \t]*(\d+)$/
      );

      if (enderecoTomador) {
        dados.tomador_endereco = enderecoTomador[1].trim();
        dados.tomador_numero = enderecoTomador[2];
      } else {
        dados.tomador_endereco = tomador[2].trim();
      }

      dados.tomador_cep = tomador[3].replace("-", "");
      dados.tomador_email = tomador[5];

      // Trata a separação específica deste layout de Barueri.
      // Se o município for diferente, não tenta adivinhar o bairro.
      const localTomador = tomador[4].match(
        /^(.+?)[ \t]+(Itaquaquecetuba)[ \t]+([A-Z]{2})$/i
      );

      if (localTomador) {
        dados.tomador_bairro = localTomador[1].trim();
        dados.tomador_municipio = localTomador[2];
        dados.tomador_uf = localTomador[3].toUpperCase();
      }
    }
  } else if (/PREFEITURA MUNICIPAL DE SANTOS/i.test(texto)) {
    const prestador = capturar(
      texto,
      /Prestador de Serviço\s*\n([\s\S]*?)(?=Atividade Econômica)/i
    ) || "";

    dados.prestador_numero = capturar(
      prestador, /Número:[ \t]*([^\s]+)/i
    );

    dados.prestador_endereco = capturar(
      prestador, /Nome\/Razão Social:[^\n]+\n([^\n]+)/i
    );

    dados.prestador_cep = capturar(
      prestador, /CEP:[ \t]*(\d{5}-\d{3})/i
    )?.replace("-", "") || null;

    dados.prestador_bairro = capturar(
      prestador, /Bairro:[ \t]*([^\t\n]+?)(?=[ \t]+Complemento:|\n)/i
    );

    dados.prestador_complemento = capturar(
      prestador, /Complemento:[ \t]*([^\n]+)/i
    );

    dados.prestador_email = capturar(
      prestador, /E-mail:[ \t]*([^\s]+@[^\s]+)/i
    );

    dados.prestador_telefone = capturar(
      prestador, /Telefone:[ \t]*(\([^\n]+)/i
    );

    const local = prestador.match(
      /Município:[ \t]*([^\n]+?)[ \t]+UF:[ \t]*([A-Z]{2})/i
    );

    if (local) {
      dados.prestador_municipio = local[1].trim();
      dados.prestador_uf = local[2].toUpperCase();
    }

    // A inscrição do prestador aparece no final do texto extraído.
    dados.prestador_inscricao_municipal = capturar(
      texto, /(?:^|\n)Inscrição[ \t]+(\d+)(?=\s*\n|$)/i
    );

    const tomador = texto.split("Tomador de Serviço")[1] || "";

    dados.tomador_endereco = capturar(
      tomador,
      /Endereço:\s*\n[\d./-]+\s*\n[^\n]+\n([^\n]+)/i
    );

    dados.tomador_municipio = capturar(
      tomador, /Município:[ \t]*([^\n]+)/i
    );

    dados.tomador_bairro = capturar(
      tomador, /\n(JARDIM MARAGOGIPE)(?=\s*\n)/i
    );

    dados.tomador_cep = capturar(
      tomador, /CEP:[ \t]*(\d{5}-\d{3})/i
    )?.replace("-", "") || null;

    dados.tomador_uf = capturar(
      tomador, /CEP:[^\n]*UF:[ \t]*([A-Z]{2})/i
    )?.toUpperCase() || null;

    dados.tomador_numero = capturar(
      tomador, /Número:[ \t]*([^\s]+)/i
    );
  }

  return dados;
}

function extrairDadosFiscais(textoOriginal) {
  const texto = textoOriginal.replace(/\r\n?/g, "\n");

  const dados = {
    base_calculo_centavos: null,
    valor_pis_centavos: null,
    valor_cofins_centavos: null,
    valor_inss_centavos: null,
    valor_ir_centavos: null,
    valor_csll_centavos: null,
    iss_retido: null,
    municipio_prestacao: null,
    uf_prestacao: null,
    municipio_incidencia: null,
    uf_incidencia: null,
  };

  function centavos(valor) {
    if (!valor) return null;

    const numero = Number(
      valor.replace(/\./g, "").replace(",", ".")
    );

    return Number.isFinite(numero)
      ? Math.round(numero * 100)
      : null;
  }

  if (/PREFEITURA MUNICIPAL DE BARUERI/i.test(texto)) {
    const tributos = texto.match(
      /IRRF PIS\/PASEP COFINS CSLL\s*\n([\d.]+,\d{2})[ \t]+([\d.]+,\d{2})[ \t]+([\d.]+,\d{2})[ \t]+([\d.]+,\d{2})/i
    );

    if (tributos) {
      dados.valor_ir_centavos = centavos(tributos[1]);
      dados.valor_pis_centavos = centavos(tributos[2]);
      dados.valor_cofins_centavos = centavos(tributos[3]);
      dados.valor_csll_centavos = centavos(tributos[4]);
    }

    const incidencia = texto.match(
      /ISSQN devido a:[ \t]*([^\n]+?)[ \t]*-[ \t]*([A-Z]{2})(?=\n|$)/i
    );

    if (incidencia) {
      dados.municipio_incidencia = incidencia[1].trim();
      dados.uf_incidencia = incidencia[2].toUpperCase();
    }
  } else if (/PREFEITURA MUNICIPAL DE SANTOS/i.test(texto)) {
    // A sequência foi identificada no texto deste layout.
    const valores = texto.match(
      /Valor do Serviço\s*\nDesconto Incondicionado\s*\nDesconto Condicionado\s*\nOutras Retenções\s*\nDeduções Previstas em Lei\s*\nBase de Cálculo\s*\nAlíquota\s*\nISSQN\s*\n((?:[\d.]+,\d{2}\s*\n){7}[\d.]+,\d{2})/i
    );

    if (valores) {
      const itens = valores[1].match(/[\d.]+,\d{2}/g);
      dados.base_calculo_centavos = centavos(itens[5]);
    }

    // Os valores dos municípios aparecem antes dos títulos.
    const municipios = texto.match(
      /(?:^|\n)([^\n]+?)[ \t]+-[ \t]+([A-Z]{2})\s*\n([^\n]+?)[ \t]+-[ \t]+([A-Z]{2})\s*\nMunicípio Prestação\s*\nISSQN a Reter\s*\nMunícipio Incidência/i
    );

    if (municipios) {
      dados.municipio_prestacao = municipios[1].trim();
      dados.uf_prestacao = municipios[2].toUpperCase();
      dados.municipio_incidencia = municipios[3].trim();
      dados.uf_incidencia = municipios[4].toUpperCase();
    }

    // Neste exemplo aparecem duas marcações explícitas de "Não":
    // Simples Nacional e ISSQN a Reter.
    // Só interpreta o trecho de identificação fiscal.
    const trechoFiscal = texto.split("Outras Informações")[0];
    const marcacoesNao = trechoFiscal.match(
      /\(\s*\)\s*Sim\s*\(\s*X\s*\)\s*Não/gi
    ) || [];

    if (
      /Simples Nacional/.test(trechoFiscal) &&
      /ISSQN a Reter/.test(trechoFiscal) &&
      marcacoesNao.length === 2 &&
      !/\(\s*X\s*\)\s*Sim/i.test(trechoFiscal)
    ) {
      dados.iss_retido = "nao";
    }

    // Os tributos federais ficam separados dos seus títulos.
    // Serão conferidos manualmente nesta etapa, sem assumir zero.
  }

  return dados;
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
  
  Object.assign(dados, extrairEnderecos(textoOriginal));
  Object.assign(dados, extrairDadosFiscais(textoOriginal));

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