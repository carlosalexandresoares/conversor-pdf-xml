// Gera XML individual e ZIP em lote a partir dos dados armazenados.
const express = require("express");
const db = require("./database");
const { preencherCodigosMunicipios } = require("./municipios");
const { avaliarExportacao, leituraConcluida } = require('./perfil-exportacao');
const {registrar}=require('./auditoria');

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
      SELECT * FROM documentos WHERE id = ? AND excluido_em IS NULL
    `).get(id);

    if (!documento) {
      return res.status(404).json({ erro: "Documento não encontrado." });
    }

    const avaliacao = avaliarExportacao(documento);
    const rascunho = req.query.rascunho === '1' || req.path.endsWith('/xml-teste');
    if (!leituraConcluida(documento, avaliacao.dados)) return res.status(409).json({ erro: 'Aguarde a leitura ou conclua a revisão manual do documento com falha.', pendencias: avaliacao.pendencias });
    if (!rascunho && (!avaliacao.aprovado || avaliacao.pendencias.length)) return res.status(409).json({ erro: 'Documento ainda não aprovado para exportação. Consulte as pendências.', pendencias: avaliacao.pendencias });
    const dados = avaliacao.dados;
    preencherCodigosMunicipios(dados);

    res.setHeader("Content-Type", "application/xml; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="documento-${id}-abrasf${rascunho ? '-RASCUNHO' : ''}.xml"`
    );

    registrar(req,id,rascunho?'xml_rascunho':'xml_exportado');
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
  return [...new Set([...avisos,...avaliarExportacao(doc).pendencias])];
}
// A conferência é feita antes de gerar qualquer arquivo.
router.post('/preparar-exportacao', (req, res) => {
  const ids = req.body?.ids;
  if (!Array.isArray(ids) || !ids.length || ids.length > 100 || ids.some(id => !Number.isSafeInteger(id) || id < 1)) return res.status(400).json({ erro: 'Selecione de 1 a 100 documentos válidos.' });
  const documentos = [...new Set(ids)].map(id => db.prepare('SELECT * FROM documentos WHERE id=? AND excluido_em IS NULL').get(id));
  if (documentos.some(doc => !doc)) return res.status(404).json({ erro: 'Um dos documentos não existe mais. Atualize a lista.' });
  res.json({ documentos: documentos.map(doc => {
    const avaliacao = avaliarExportacao(doc);
    return { id: doc.id, nome_arquivo: doc.nome_arquivo, aprovado: avaliacao.aprovado, pendencias: avaliacao.pendencias, avisos: avisosExportacao(doc, avaliacao.dados) };
  }) });
});
router.post('/xml-lote', async (req,res,next)=>{
  const ids=req.body?.ids;
  if(!Array.isArray(ids)||ids.length<1||ids.length>100||ids.some(id=>!Number.isSafeInteger(id)||id<1)) return res.status(400).json({erro:'Selecione de 1 a 100 documentos válidos.'});
  try {
    const registros=[...new Set(ids)].map(id=>db.prepare('SELECT * FROM documentos WHERE id=? AND excluido_em IS NULL').get(id));
    const avaliacoes=registros.filter(Boolean).map(avaliarExportacao);
    if(registros.some(d=>d&&!leituraConcluida(d)))return res.status(409).json({erro:'Aguarde a leitura ou conclua a revisão manual dos documentos com falha.',pendencias:avaliacoes.flatMap(a=>a.pendencias)});
    const rascunho=req.body?.rascunho===true;
    if(!rascunho&&avaliacoes.some(a=>!a.aprovado||a.pendencias.length))return res.status(409).json({erro:'Há documentos sem aprovação ou com pendências.',pendencias:avaliacoes.flatMap(a=>a.pendencias)});
    if(registros.some(d=>!d))return res.status(404).json({erro:'Um dos documentos não existe mais. Atualize a lista.'});
    const arquivos=registros.map(doc=>{
      const dados=JSON.parse(doc.dados_json||'{}');preencherCodigosMunicipios(dados);
      return {nome:`documento-${doc.id}-abrasf${rascunho?'-RASCUNHO':''}.xml`,xml:gerarXml(dados),avisos:avisosExportacao(doc,dados),original:doc.nome_arquivo};
    });
    for(const doc of registros)registrar(req,doc.id,rascunho?'xml_rascunho':'xml_exportado',{lote:true});
    res.type('application/zip');res.setHeader('Content-Disposition',`attachment; filename="xml-selecionados${rascunho?'-RASCUNHO':''}.zip"`);
    const zip=archiver('zip',{zlib:{level:6}});
    zip.on('error',next);res.on('close',()=>{if(!res.writableEnded)zip.abort()});zip.pipe(res);
    for(const arquivo of arquivos)zip.append(arquivo.xml,{name:arquivo.nome});
    zip.append(`${rascunho?'RASCUNHO - NÃO IMPORTAR SEM CONFERÊNCIA\n\n':''}RELATÓRIO DE EXPORTAÇÃO\n\nPerfil baseado no XML ABRASF de referência. Não equivale a uma validação XSD ou à aceitação no G5. Campos ausentes são omitidos.\n\n`+arquivos.map(a=>`${a.original} → ${a.nome}\n${a.avisos.map(v=>'• '+v).join('\n')||'Sem avisos adicionais.'}`).join('\n\n'),{name:'relatorio-exportacao.txt'});
    await zip.finalize();
  } catch(erro){next(erro);}
});
module.exports = router;
module.exports.gerarXml = gerarXml;
module.exports.avisosExportacao = avisosExportacao;
