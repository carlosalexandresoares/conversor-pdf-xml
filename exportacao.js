const express = require("express");
const db = require("./database");
const { preencherCodigosMunicipios } = require("./municipios");

const router = express.Router();

function escapar(valor) {
  return String(valor)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function tag(nome, valor) {
  if (valor == null || valor === "") return "";
  return `<${nome}>${escapar(valor)}</${nome}>`;
}

function dinheiro(valor) {
  return valor == null ? null : (valor / 100).toFixed(2);
}

function endereco(dados, pessoa) {
  const campo = (nome) => dados[`${pessoa}_${nome}`];

  return `<Endereco>
    ${tag("Endereco", campo("endereco"))}
    ${tag("Numero", campo("numero"))}
    ${tag("Complemento", campo("complemento"))}
    ${tag("Bairro", campo("bairro"))}
    ${tag("CodigoMunicipio", campo("codigo_municipio"))}
    ${tag("Uf", campo("uf"))}
    ${tag("Cep", campo("cep"))}
  </Endereco>`;
}

function contato(dados, pessoa) {
  const email = dados[`${pessoa}_email`];

  // Telefone permanece no banco nesta primeira versão.
  if (!email) return "";

  return `<Contato>${tag("Email", email)}</Contato>`;
}

function identificacaoPrestador(dados) {
  return `<CpfCnpj>
    ${tag("Cnpj", dados.cnpj_prestador)}
  </CpfCnpj>
  ${tag("InscricaoMunicipal", dados.prestador_inscricao_municipal)}`;
}

function verificar(dados) {
  const faltantes = [];

  const obrigatoriosDoTeste = [
    "numero_nota",
    "codigo_verificacao",
    "data_emissao",
    "competencia_xml",
    "cnpj_prestador",
    "nome_prestador",
    "prestador_inscricao_municipal",
    "prestador_endereco",
    "prestador_numero",
    "prestador_codigo_municipio",
    "prestador_uf",
    "prestador_cep",
    "cnpj_tomador",
    "nome_tomador",
    "tomador_endereco",
    "tomador_numero",
    "tomador_codigo_municipio",
    "tomador_uf",
    "tomador_cep",
    "valor_servicos_centavos",
    "valor_liquido_centavos",
    "base_calculo_centavos",
    "aliquota_percentual",
    "valor_iss_centavos",
    "item_lista_servico_xml",
    "revisado_em",
  ];

  for (const campo of obrigatoriosDoTeste) {
    if (dados[campo] == null || dados[campo] === "") {
      faltantes.push(campo);
    }
  }

  if (!["sim", "nao"].includes(dados.iss_retido)) {
    faltantes.push("iss_retido");
  }

  if (!["1", "2"].includes(dados.incentivo_fiscal_xml)) {
    faltantes.push("incentivo_fiscal_xml");
  }

  if (dados.rps_numero) {
    for (const campo of ["rps_serie", "rps_data"]) {
      if (!dados[campo]) faltantes.push(campo);
    }
  }

  return faltantes;
}

function gerarXml(dados) {
  const aliquota = Number(dados.aliquota_percentual).toFixed(4);

  const rps = dados.rps_numero
    ? `<Rps>
        <IdentificacaoRps>
          ${tag("Numero", dados.rps_numero)}
          ${tag("Serie", dados.rps_serie)}
          ${tag("Tipo", dados.rps_tipo)}
        </IdentificacaoRps>
        ${tag("DataEmissao", dados.rps_data)}
        <Status>1</Status>
      </Rps>`
    : "";

  const valoresServico = [
    ["Aliquota", aliquota],
    ["ValorCofins", dinheiro(dados.valor_cofins_centavos)],
    ["ValorCsll", dinheiro(dados.valor_csll_centavos)],
    ["ValorInss", dinheiro(dados.valor_inss_centavos)],
    ["ValorIr", dinheiro(dados.valor_ir_centavos)],
    ["ValorIss", dinheiro(dados.valor_iss_centavos)],
    ["ValorPis", dinheiro(dados.valor_pis_centavos)],
    ["ValorServicos", dinheiro(dados.valor_servicos_centavos)],
  ].map(([nome, valor]) => tag(nome, valor)).join("\n");

  const descricao = [
    dados.descricao_servico,
    dados.discriminacao_servicos,
  ].filter(Boolean);

  const discriminacao = [...new Set(descricao)].join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<CompNfse xmlns="http://www.abrasf.org.br/nfse.xsd">
  <Nfse versao="2.02">
    <InfNfse>
      ${tag("Numero", dados.numero_nota)}
      ${tag("CodigoVerificacao", dados.codigo_verificacao)}
      ${tag("DataEmissao", dados.data_emissao)}
      <ValoresNfse>
        ${tag("BaseCalculo", dinheiro(dados.base_calculo_centavos))}
        ${tag("Aliquota", aliquota)}
        ${tag("ValorIss", dinheiro(dados.valor_iss_centavos))}
        ${tag("ValorLiquidoNfse", dinheiro(dados.valor_liquido_centavos))}
      </ValoresNfse>
      <PrestadorServico>
        <IdentificacaoPrestador>
          ${identificacaoPrestador(dados)}
        </IdentificacaoPrestador>
        ${tag("RazaoSocial", dados.nome_prestador)}
        ${endereco(dados, "prestador")}
        ${contato(dados, "prestador")}
      </PrestadorServico>
      <DeclaracaoPrestacaoServico>
        <InfDeclaracaoPrestacaoServico>
          ${rps}
          ${tag("Competencia", dados.competencia_xml)}
          <Servico>
            <Valores>${valoresServico}</Valores>
            ${tag("IssRetido", dados.iss_retido === "sim" ? "1" : "2")}
            ${tag("ItemListaServico", dados.item_lista_servico_xml)}
            ${tag("Discriminacao", discriminacao)}
          </Servico>
          <Prestador>
            ${identificacaoPrestador(dados)}
          </Prestador>
          <Tomador>
            <IdentificacaoTomador>
              <CpfCnpj>${tag("Cnpj", dados.cnpj_tomador)}</CpfCnpj>
              ${tag("InscricaoMunicipal", dados.tomador_inscricao_municipal)}
            </IdentificacaoTomador>
            ${tag("RazaoSocial", dados.nome_tomador)}
            ${endereco(dados, "tomador")}
            ${contato(dados, "tomador")}
          </Tomador>
          ${tag("IncentivoFiscal", dados.incentivo_fiscal_xml)}
        </InfDeclaracaoPrestacaoServico>
      </DeclaracaoPrestacaoServico>
    </InfNfse>
  </Nfse>
</CompNfse>`;
}

router.get("/:id/xml-teste", (req, res) => {
  const id = Number(req.params.id);

  if (!Number.isSafeInteger(id) || id <= 0) {
    return res.status(400).json({ erro: "ID inválido." });
  }

  try {
    const documento = db.prepare(`
      SELECT dados_json FROM documentos WHERE id = ?
    `).get(id);

    if (!documento) {
      return res.status(404).json({ erro: "Documento não encontrado." });
    }

    const dados = JSON.parse(documento.dados_json);
    preencherCodigosMunicipios(dados);

    const faltantes = verificar(dados);

    if (!dados.descricao_servico && !dados.discriminacao_servicos) {
      faltantes.push("descricao_servico");
    }

    if (faltantes.length) {
      return res.status(422).json({
        erro: `Complete e confira estes campos: ${faltantes.join(", ")}.`,
      });
    }

    res.setHeader("Content-Type", "application/xml; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="documento-${id}-abrasf-teste.xml"`
    );

    res.send(gerarXml(dados));
  } catch (erro) {
    console.error(erro);
    res.status(500).json({ erro: "Não foi possível gerar o XML." });
  }
});

module.exports = router;