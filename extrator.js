// Adaptadores dos layouts municipais originalmente suportados.
function capturar(texto, expressao, grupo = 1) {
  const resultado = texto.match(expressao);
  return resultado?.[grupo]?.trim() || null;
}

function somenteDigitos(valor) {
  return valor ? valor.replace(/\D/g, "") : null;
}

function centavos(valor) {
  if (!valor) return null;

  const normalizado = valor.replace(/\./g, "").replace(",", ".");
  const numero = Number(normalizado);

  return Number.isFinite(numero)
    ? Math.round(numero * 100)
    : null;
}

function dataIso(valor) {
  if (!valor) return null;

  const resultado = valor.match(
    /^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}:\d{2}(?::\d{2})?))?$/
  );

  if (!resultado) return null;

  const [, dia, mes, ano, hora] = resultado;

  return `${ano}-${mes}-${dia}` +
    (hora ? `T${hora.length === 5 ? hora + ":00" : hora}` : "");
}

function extrairCampos(textoOriginal) {
  const texto = textoOriginal
    .replace(/\r\n?/g, "\n")
    .replace(/\u00a0/g, " ");

  const dados = {
    modelo: null,
    numero_nota: null,
    codigo_verificacao: null,
    data_emissao: null,
    competencia: null,
    cnpj_prestador: null,
    nome_prestador: null,
    cnpj_tomador: null,
    nome_tomador: null,
    valor_servicos_centavos: null,
    valor_liquido_centavos: null,
    aliquota_percentual: null,
    valor_iss_centavos: null,
    valor_ibs_centavos: null,
    valor_cbs_centavos: null,
  };

  if (/PREFEITURA MUNICIPAL DE BARUERI/i.test(texto)) {
    dados.modelo = "barueri";

    dados.numero_nota = capturar(
      texto, /Número da Nota\s*\n\s*(\d+)/i
    );

    dados.codigo_verificacao = capturar(
      texto, /Código Autenticidade\s*\n\s*([A-Z0-9.-]+)/i
    );

    dados.data_emissao = dataIso(capturar(
      texto,
      /Data Emissão Hora Emissão\s*\n\s*(\d{2}\/\d{2}\/\d{4}\s+\d{2}:\d{2})/i
    ));

    dados.nome_prestador = capturar(
      texto, /Prestador de Serviços[ \t]+([^\n]+)/i
    );

    dados.cnpj_prestador = somenteDigitos(capturar(
      texto, /CNPJ\/CPF[ \t]+([\d./-]+)/i
    ));

    const tomador = capturar(
      texto,
      /^([^\n]+?)[ \t]+(\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2})[ \t]*$/m,
      0
    );

    if (tomador) {
      const partes = tomador.match(
        /^(.+?)[ \t]+(\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2})$/
      );

      dados.nome_tomador = partes?.[1]?.trim() || null;
      dados.cnpj_tomador = somenteDigitos(partes?.[2]);
    }

    const servico = texto.match(
      /^\s*\d+[ \t]+.+?[ \t]+\d{9}[ \t]+(\d+,\d{2})[ \t]+([\d.]+,\d{2})[ \t]+([\d.]+,\d{2})[ \t]*$/m
    );

    if (servico) {
      dados.aliquota_percentual =
        Number(servico[1].replace(",", "."));

      dados.valor_servicos_centavos = centavos(servico[3]);
    }

    // O total da nota não será automaticamente tratado como valor líquido.
    dados.valor_total_nota_centavos = centavos(capturar(
      texto, /VALOR TOTAL DA NOTA[ \t]+([\d.]+,\d{2})/i
    ));
  } else if (/PREFEITURA MUNICIPAL DE SANTOS/i.test(texto)) {
    dados.modelo = "santos";

    dados.numero_nota = capturar(
      texto, /(?:^|\n)(\d+)\s*\nNFS-e\s*\nCódigo de Verificação/i
    );

    dados.codigo_verificacao = capturar(
      texto, /Código de Verificação\s*\n([A-Z0-9]+)/i
    );

    dados.data_emissao = dataIso(capturar(
      texto,
      /Emissão da NFS-e\s*\n(\d{2}\/\d{2}\/\d{4}\s+\d{2}:\d{2}:\d{2})/i
    ));

    const competencia = capturar(
      texto, /(?:^|\n)(\d{2}\/\d{4})(?=\s*\n)/m
    );

    if (competencia) {
      const [mes, ano] = competencia.split("/");
      dados.competencia = `${ano}-${mes}`;
    }

    const prestador = capturar(
      texto, /Prestador de Serviço\s*\n([\s\S]*?)(?=Atividade Econômica)/i
    ) || "";

    dados.cnpj_prestador = somenteDigitos(capturar(
      prestador, /CPF\/CNPJ:[ \t]*([\d./-]+)/i
    ));

    dados.nome_prestador = capturar(
      prestador, /Nome\/Razão Social:[ \t]*([^\n]+)/i
    );

    const tomador = texto.match(
      /Tomador de Serviço\s*\nCPF\/CNPJ:\s*\nNome\/Razão Social:\s*\nEndereço:\s*\n([\d./-]+)\s*\n([^\n]+)/i
    );

    if (tomador) {
      dados.cnpj_tomador = somenteDigitos(tomador[1]);
      dados.nome_tomador = tomador[2].trim();
    }

    dados.valor_liquido_centavos = centavos(capturar(
      texto, /Valor Líquido[ \t]+([\d.]+,\d{2})/i
    ));

    // Neste layout, oito títulos são seguidos por oito valores.
    const valores = texto.match(
      /Valor do Serviço\s*\nDesconto Incondicionado\s*\nDesconto Condicionado\s*\nOutras Retenções\s*\nDeduções Previstas em Lei\s*\nBase de Cálculo\s*\nAlíquota\s*\nISSQN\s*\n((?:[\d.]+,\d{2}\s*\n){7}[\d.]+,\d{2})/i
    );

    if (valores) {
      const itens = valores[1].match(/[\d.]+,\d{2}/g);

      dados.valor_servicos_centavos = centavos(itens[0]);
      dados.aliquota_percentual = Number(itens[6].replace(",", "."));
      dados.valor_iss_centavos = centavos(itens[7]);
    }

    const novosTributos = texto.match(
      /(?:^|\n)IBS\s*\nCBS\s*\n([\d.]+,\d{2})\s*\n([\d.]+,\d{2})/i
    );

    if (novosTributos) {
      dados.valor_ibs_centavos = centavos(novosTributos[1]);
      dados.valor_cbs_centavos = centavos(novosTributos[2]);
    }
  } else {
    throw new Error("Layout ainda não reconhecido nesta etapa.");
  }

  const camposPrincipais = [
    "numero_nota",
    "data_emissao",
    "cnpj_prestador",
    "nome_prestador",
    "cnpj_tomador",
    "nome_tomador",
    "valor_servicos_centavos",
  ];

  dados.campos_nao_encontrados = camposPrincipais.filter(
    (campo) => dados[campo] === null
  );

  return dados;
}

module.exports = { extrairCampos };