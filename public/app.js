const formulario = document.querySelector("#form-upload");
const campoPdf = document.querySelector("#pdf");
const botaoEnviar = document.querySelector("#enviar");
const mensagem = document.querySelector("#mensagem");
const lista = document.querySelector("#documentos");

async function lerResposta(resposta) {
  const texto = await resposta.text();
  let dados;
  try { dados = JSON.parse(texto); }
  catch { throw new Error(`O servidor retornou uma resposta inesperada (HTTP ${resposta.status}).`); }
  if (!resposta.ok) throw new Error(dados.erro || `Falha na operação (HTTP ${resposta.status}).`);
  return dados;
}

const processamentos = new Map();
function prepararDocumento(id, novo = false) {
  if (processamentos.has(id)) return processamentos.get(id);
  const tarefa = (async () => {
    let temModelo = false;
    if (!novo) {
      const resposta = await fetch(`/api/documentos/${id}/revisao`);
      if (resposta.ok) {
        const revisao = await lerResposta(resposta);
        // Nunca reidentifica os campos de um documento já revisado.
        if (revisao.dados.revisado_em) return;
        temModelo = Boolean(revisao.dados.modelo);
      } else if (resposta.status !== 400) {
        await lerResposta(resposta);
      }
    }
    const etapas = temModelo ? ["complementos"] : [
      "extrair-texto", "identificar-campos", "complementos"
    ];
    for (const etapa of etapas) {
      mensagem.textContent = `Processando documento #${id}...`;
      await lerResposta(await fetch(`/api/documentos/${id}/${etapa}`, { method: "POST" }));
    }
  })();
  processamentos.set(id, tarefa);
  tarefa.finally(() => processamentos.delete(id)).catch(() => {});
  return tarefa;
}

async function baixarXml(id) {
  let aviso = "";
  try { await prepararDocumento(id); }
  catch (erro) { aviso = ` Extração não concluída: ${erro.message}`; }
  const resposta = await fetch(`/api/documentos/${id}/xml-teste`);
  if (!resposta.ok) await lerResposta(resposta);
  const url = URL.createObjectURL(await resposta.blob());
  const link = document.createElement("a");
  link.href = url;
  link.download = `documento-${id}-abrasf.xml`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  mensagem.textContent = "XML baixado com os dados disponíveis. Campos ausentes foram omitidos." + aviso;
}

async function carregarDocumentos() {
  const dados = await lerResposta(await fetch("/api/documentos"));
  lista.replaceChildren();
  if (!dados.length) {
    const item = document.createElement("li");
    item.textContent = "Nenhum documento cadastrado.";
    lista.appendChild(item);
    return;
  }
  for (const documento of dados) {
    const item = document.createElement("li");
    const descricao = document.createElement("span");
    descricao.textContent = `#${documento.id} — ${documento.nome_arquivo} — Status: ${documento.status} `;
    const revisar = document.createElement("button");
    revisar.type = "button";
    revisar.textContent = "Revisar dados";
    const baixar = document.createElement("button");
    baixar.type = "button";
    baixar.textContent = "Baixar XML";
    async function executar(acao) {
      revisar.disabled = baixar.disabled = true;
      try { await acao(); }
      catch (erro) { mensagem.textContent = erro.message; }
      finally { revisar.disabled = baixar.disabled = false; }
    }
    revisar.addEventListener("click", () => executar(async () => {
      let aviso = "";
      try { await prepararDocumento(documento.id); }
      catch (erro) { aviso = ` Extração não concluída: ${erro.message}`; }
      await abrirRevisao(documento.id);
      mensagem.textContent += aviso;
    }));
    baixar.addEventListener("click", () => executar(() => baixarXml(documento.id)));
    item.append(descricao, revisar, " ", baixar);
    lista.appendChild(item);
  }
}

formulario.addEventListener("submit", async (evento) => {
  evento.preventDefault();
  const arquivo = campoPdf.files[0];
  if (!arquivo) return;
  if (arquivo.size > 10 * 1024 * 1024) {
    mensagem.textContent = "O PDF deve ter no máximo 10 MB.";
    return;
  }
  botaoEnviar.disabled = true;
  mensagem.textContent = "Enviando e processando PDF...";
  try {
    const envio = new FormData();
    envio.append("pdf", arquivo);
    const dados = await lerResposta(await fetch("/api/documentos/upload", { method: "POST", body: envio }));
    formulario.reset();
    try {
      await prepararDocumento(dados.id, true);
      mensagem.textContent = "PDF salvo e processado. Você pode revisar os dados ou baixar o XML.";
    } catch (erro) {
      mensagem.textContent = `PDF salvo, mas a extração não foi concluída: ${erro.message} O XML pode ser baixado com os dados disponíveis.`;
    }
    try { await carregarDocumentos(); }
    catch (erro) { mensagem.textContent += ` ${erro.message}`; }
  } catch (erro) { mensagem.textContent = erro.message; }
  finally { botaoEnviar.disabled = false; }
});

let documentoEmRevisao = null;


let versaoRevisao = null;



const definicoesRevisao = [
  ["numero_nota", "Número da nota"],
  ["codigo_verificacao", "Código de verificação"],
  ["data_emissao", "Emissão — AAAA-MM-DDTHH:MM:SS"],
  ["competencia", "Competência — AAAA-MM"],
  ["cnpj_prestador", "CNPJ do prestador"],
  ["nome_prestador", "Nome do prestador"],
  ["cnpj_tomador", "CNPJ do tomador"],
  ["nome_tomador", "Nome do tomador"],
  ["valor_servicos_centavos", "Valor dos serviços (R$)"],
  ["valor_liquido_centavos", "Valor líquido (R$)"],
  ["valor_total_nota_centavos", "Valor total da nota (R$)"],
  ["aliquota_percentual", "Alíquota (%)"],
  ["valor_iss_centavos", "ISS (R$)"],
  ["valor_ibs_centavos", "IBS (R$)"],
  ["valor_cbs_centavos", "CBS (R$)"],
  ["rps_numero", "Número do RPS"],
  ["rps_serie", "Série do RPS"],
  ["rps_tipo", "Tipo do RPS"],
  ["rps_data", "Data do RPS — AAAA-MM-DD"],
  ["codigo_servico_municipal", "Código municipal do serviço"],
  ["item_lista_servico", "Item da lista de serviços"],
  ["descricao_servico", "Descrição do serviço"],
  ["discriminacao_servicos", "Discriminação e informações relevantes"],
];

definicoesRevisao.push(
  ["competencia_xml", "Competência para XML — AAAA-MM-DD"],
  ["item_lista_servico_xml", "Código confirmado para ItemListaServico do XML"],
  ["incentivo_fiscal_xml", "Incentivo fiscal — código XML confirmado (1 ou 2)"]
);

definicoesRevisao.push(
  ["codigo_municipio_prestacao", "Prestação — Código IBGE"],
  ["codigo_municipio_incidencia", "Incidência do ISS — Código IBGE"]
);

definicoesRevisao.push(
  ["base_calculo_centavos", "Base de cálculo (R$)"],
  ["valor_pis_centavos", "PIS (R$)"],
  ["valor_cofins_centavos", "COFINS (R$)"],
  ["valor_inss_centavos", "INSS (R$)"],
  ["valor_ir_centavos", "IR (R$)"],
  ["valor_csll_centavos", "CSLL (R$)"],
  ["iss_retido", "ISS retido — sim / nao / vazio"],
  ["municipio_prestacao", "Município de prestação"],
  ["uf_prestacao", "UF de prestação"],
  ["municipio_incidencia", "Município de incidência do ISS"],
  ["uf_incidencia", "UF de incidência do ISS"]
);

definicoesRevisao.push(
  ["prestador_codigo_municipio", "Prestador — Código IBGE"],
  ["tomador_codigo_municipio", "Tomador — Código IBGE"]
);

const camposEndereco = [
  ["endereco", "Endereço"],
  ["numero", "Número"],
  ["complemento", "Complemento"],
  ["bairro", "Bairro"],
  ["cep", "CEP"],
  ["municipio", "Município"],
  ["uf", "UF"],
  ["inscricao_municipal", "Inscrição municipal"],
  ["email", "E-mail"],
  ["telefone", "Telefone"],
];

for (const [pessoa, titulo] of [
  ["prestador", "Prestador"],
  ["tomador", "Tomador"],
]) {
  for (const [campo, rotulo] of camposEndereco) {
    definicoesRevisao.push([
      `${pessoa}_${campo}`,
      `${titulo} — ${rotulo}`,
    ]);
  }
}

async function abrirRevisao(id) {
  const secao = document.querySelector("#secao-revisao");
  const area = document.querySelector("#campos-revisao");
  const aviso = document.querySelector("#mensagem-revisao");

  // Fecha a revisão anterior enquanto carrega a nova.
  documentoEmRevisao = null;
  secao.hidden = true;
  mensagem.textContent = "Abrindo revisão...";

  try {
    const resposta = await fetch(`/api/documentos/${id}/revisao`);
    const resultado = await lerResposta(resposta);

    if (!resposta.ok) {
      throw new Error(resultado.erro || "Erro ao abrir revisão.");
    }

    documentoEmRevisao = id;
    versaoRevisao = resultado.versao;

    document.querySelector("#titulo-revisao").textContent =
      `Revisar: ${resultado.nome_arquivo}`;

    area.replaceChildren();

    for (const [campo, titulo] of definicoesRevisao) {
      const label = document.createElement("label");
      label.textContent = titulo;

      const campoLongo = [
        "descricao_servico",
        "discriminacao_servicos",
      ].includes(campo);

      const input = document.createElement(
        campoLongo ? "textarea" : "input"
      );

      if (campoLongo) {
        input.rows = 5;
      } else {
        input.type = "text";
      }

      input.name = campo;
      if (
  campo.endsWith("_codigo_municipio") ||
  campo.startsWith("codigo_municipio_")
) {
        input.readOnly = true;
        input.placeholder = "Município ainda não cadastrado";
      }
      
      input.maxLength = campoLongo ? 10000 : 300;

      const valor = resultado.dados[campo];

      if (campo.endsWith("_centavos")) {
        input.inputMode = "decimal";
        input.value = valor == null
          ? ""
          : (valor / 100).toFixed(2).replace(".", ",");
      } else {
        input.value = valor == null ? "" : String(valor);
      }

      label.appendChild(input);
      area.appendChild(label);
    }

    aviso.textContent = "";
    mensagem.textContent = "Dados carregados para revisão.";
    secao.hidden = false;
    secao.scrollIntoView({ behavior: "smooth" });
  } catch (erro) {
    mensagem.textContent = erro.message;
  }
}

document.querySelector("#form-revisao").addEventListener(
  "submit",
  async (evento) => {
    evento.preventDefault();

    if (!documentoEmRevisao) return;

    const botao = document.querySelector("#salvar-revisao");
    const aviso = document.querySelector("#mensagem-revisao");

    const campos = Object.fromEntries(
      new FormData(evento.currentTarget).entries()
    );

    botao.disabled = true;
    aviso.textContent = "Salvando...";

    try {
      const resposta = await fetch(
        `/api/documentos/${documentoEmRevisao}/revisao`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            campos,
            versao: versaoRevisao,
          }),
        }
      );

      const resultado = await lerResposta(resposta);

      if (!resposta.ok) {
        throw new Error(resultado.erro || "Erro ao salvar revisão.");
      }

      versaoRevisao = resultado.versao;
      aviso.textContent = resultado.mensagem;

      try {
        await carregarDocumentos();
      } catch {
        aviso.textContent += " Não foi possível atualizar a lista.";
      }
    } catch (erro) {
      aviso.textContent = erro.message;
    } finally {
      botao.disabled = false;
    }
  }
);

carregarDocumentos().catch((erro) => { mensagem.textContent = erro.message; });
