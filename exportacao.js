// Gera XML individual e ZIP em lote a partir dos dados armazenados.
const express = require("express");
const db = require("./database");
const { preencherCodigosMunicipios } = require("./municipios");

const router = express.Router();
const archiver = require("archiver");

function escapar(valor) {
  return String(valor)
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g, "")
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
  if (valor == null || String(valor).trim() === "") return null;
  return Number.isSafeInteger(Number(valor)) ? (Number(valor) / 100).toFixed(2) : null;
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
    ${tag(String(dados.cnpj_prestador || "").length === 11 ? "Cpf" : "Cnpj", dados.cnpj_prestador)}
  </CpfCnpj>
  ${tag("InscricaoMunicipal", dados.prestador_inscricao_municipal)}`;
}

function gerarXml(dados) {
  const valorAliquota = dados.aliquota_percentual;
  const aliquota = valorAliquota == null || String(valorAliquota).trim() === ""
    ? null : (Number.isFinite(Number(valorAliquota)) ? Number(valorAliquota).toFixed(4) : null);

  const rps = dados.rps_numero
    ? `<Rps>
        <IdentificacaoRps>
          ${tag("Numero", dados.rps_numero)}
          ${tag("Serie", dados.rps_serie)}
          ${tag("Tipo", dados.rps_tipo)}
        </IdentificacaoRps>
        ${tag("DataEmissao", dados.rps_data)}
        ${tag("Status", dados.rps_status)}
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
            ${tag("IssRetido", dados.iss_retido === "sim" ? "1" : dados.iss_retido === "nao" ? "2" : null)}
            ${tag("ItemListaServico", dados.item_lista_servico_xml || dados.item_lista_servico)}
            ${tag("Discriminacao", discriminacao)}
          </Servico>
          <Prestador>
            ${identificacaoPrestador(dados)}
          </Prestador>
          <Tomador>
            <IdentificacaoTomador>
              <CpfCnpj>${tag(String(dados.cnpj_tomador || "").length === 11 ? "Cpf" : "Cnpj", dados.cnpj_tomador)}</CpfCnpj>
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

router.get(["/:id/xml-teste", "/:id/xml"], (req, res) => {
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

    const dados = JSON.parse(documento.dados_json || "{}") || {};
    preencherCodigosMunicipios(dados);

    res.setHeader("Content-Type", "application/xml; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="documento-${id}-abrasf.xml"`
    );

    res.send(gerarXml(dados));
  } catch (erro) {
    console.error(erro);
    res.status(500).json({ erro: "Não foi possível gerar o XML." });
  }
});

function avisosExportacao(doc,dados) {
  const avisos=[...(dados.avisos||[])];
  for(const [campo,nome] of Object.entries({numero_nota:'Número da nota',cnpj_prestador:'CPF/CNPJ do prestador',cnpj_tomador:'CPF/CNPJ do tomador',data_emissao:'Emissão',competencia_xml:'Competência com data completa',incentivo_fiscal_xml:'Incentivo fiscal'})) {
    if(dados[campo]==null || dados[campo]==='') avisos.push(`${nome}: ausente no XML.`);
  }
  if(!dados.revisado_em) avisos.push('Documento sem revisão salva.');
  if(doc.processamento==='erro') avisos.push(doc.erro_processamento || 'Extração interrompida.');
  if(['fila','processando'].includes(doc.processamento)) avisos.push('Leitura em andamento no momento da exportação.');
  if(dados.valor_ibs_centavos!=null || dados.valor_cbs_centavos!=null) avisos.push('IBS/CBS permanecem no banco; não são exportados no perfil ABRASF atual.');
  return [...new Set(avisos)];
}
router.post('/xml-lote', async (req,res,next)=>{
  const ids=req.body?.ids;
  if(!Array.isArray(ids)||ids.length<1||ids.length>100||ids.some(id=>!Number.isSafeInteger(id)||id<1)) return res.status(400).json({erro:'Selecione de 1 a 100 documentos válidos.'});
  try {
    const registros=[...new Set(ids)].map(id=>db.prepare('SELECT * FROM documentos WHERE id=?').get(id));
    if(registros.some(d=>!d))return res.status(404).json({erro:'Um dos documentos não existe mais. Atualize a lista.'});
    const arquivos=registros.map(doc=>{
      const dados=JSON.parse(doc.dados_json||'{}');preencherCodigosMunicipios(dados);
      return {nome:`documento-${doc.id}-abrasf.xml`,xml:gerarXml(dados),avisos:avisosExportacao(doc,dados),original:doc.nome_arquivo};
    });
    res.type('application/zip');res.setHeader('Content-Disposition','attachment; filename="xml-selecionados.zip"');
    const zip=archiver('zip',{zlib:{level:6}});
    zip.on('error',next);res.on('close',()=>{if(!res.writableEnded)zip.abort()});zip.pipe(res);
    for(const arquivo of arquivos)zip.append(arquivo.xml,{name:arquivo.nome});
    zip.append('RELATÓRIO DE EXPORTAÇÃO\n\nPerfil baseado no XML ABRASF de referência. Não equivale a uma validação XSD ou à aceitação no G5. Campos ausentes são omitidos.\n\n'+arquivos.map(a=>`${a.original} → ${a.nome}\n${a.avisos.map(v=>'• '+v).join('\n')||'Sem avisos adicionais.'}`).join('\n\n'),{name:'relatorio-exportacao.txt'});
    await zip.finalize();
  } catch(erro){next(erro);}
});
module.exports = router;
module.exports.gerarXml = gerarXml;
module.exports.avisosExportacao = avisosExportacao;