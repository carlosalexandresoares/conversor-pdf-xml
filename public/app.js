const formulario = document.querySelector("#form-upload");
const campoPdf = document.querySelector("#pdf");
const botaoEnviar = document.querySelector("#enviar");
const mensagem = document.querySelector("#mensagem");
const lista = document.querySelector("#documentos");

async function carregarDocumentos() {
  const resposta = await fetch("/api/documentos");
  const dados = await resposta.json();

  if (!resposta.ok) {
    throw new Error(dados.erro || "Não foi possível carregar a lista.");
  }

  lista.replaceChildren();

  if (dados.length === 0) {
    const item = document.createElement("li");
    item.textContent = "Nenhum documento cadastrado.";
    lista.appendChild(item);
    return;
  }

  for (const documento of dados) {
    const item = document.createElement("li");
    const descricao = document.createElement("span");

    descricao.textContent =
      `#${documento.id} — ${documento.nome_arquivo} ` +
      `— Status: ${documento.status} `;

    const botaoLer = document.createElement("button");
    botaoLer.type = "button";
    botaoLer.textContent = "Ler texto";
    botaoLer.addEventListener("click", () => {
      abrirTexto(documento.id, true, botaoLer);
    });

    const botaoConsultar = document.createElement("button");
    botaoConsultar.type = "button";
    botaoConsultar.textContent = "Ver texto salvo";
    botaoConsultar.addEventListener("click", () => {
      abrirTexto(documento.id, false, botaoConsultar);
    });

    item.append(descricao, botaoLer, " ", botaoConsultar);

    const botaoCampos = document.createElement("button");
    botaoCampos.type = "button";
    botaoCampos.textContent = "Identificar campos";

    botaoCampos.addEventListener("click", () => {
      identificarCampos(documento.id, botaoCampos);
    });

    const botaoRevisar = document.createElement("button");
    botaoRevisar.type = "button";
    botaoRevisar.textContent = "Revisar dados";
    botaoRevisar.addEventListener("click", () => {
      abrirRevisao(documento.id);
    });

    item.append(" ", botaoRevisar);

    item.append(" ", botaoCampos);

    const botaoComplementos = document.createElement("button");
    botaoComplementos.type = "button";
    botaoComplementos.textContent = "Incluir complementos";

    botaoComplementos.addEventListener("click", async () => {
      botaoComplementos.disabled = true;

      try {
        const resposta = await fetch(
          `/api/documentos/${documento.id}/complementos`,
          { method: "POST" }
        );

        const resultado = await resposta.json();

        if (!resposta.ok) {
          throw new Error(resultado.erro || "Erro ao incluir complementos.");
        }

        mensagem.textContent = resultado.mensagem;
      } catch (erro) {
        mensagem.textContent = erro.message;
      } finally {
        botaoComplementos.disabled = false;
      }
    });

    item.append(" ", botaoComplementos);

    const botaoPendencias = document.createElement("button");
botaoPendencias.type = "button";
botaoPendencias.textContent = "Verificar pendências";

botaoPendencias.addEventListener("click", async () => {
  botaoPendencias.disabled = true;

  try {
    const resposta = await fetch(
      `/api/documentos/${documento.id}/pendencias`
    );

    const resultado = await resposta.json();

    if (!resposta.ok) {
      throw new Error(resultado.erro || "Erro ao verificar pendências.");
    }

    document.querySelector("#titulo-texto").textContent =
      `Pendências: ${resultado.nome_arquivo}`;

    const linhas = [
      "PENDÊNCIAS",
      ...(resultado.pendencias.length
        ? resultado.pendencias.map((item) => `• ${item}`)
        : ["Nenhuma ausência encontrada nesta verificação inicial."]),
      "",
      "AVISOS PARA CONFERÊNCIA",
      ...(resultado.avisos.length
        ? resultado.avisos.map((item) => `• ${item}`)
        : ["Nenhum aviso."]),
    ];

    document.querySelector("#texto-documento").textContent =
      linhas.join("\n");

    mensagem.textContent =
      "Verificação concluída. O documento ainda não foi liberado para exportação.";
  } catch (erro) {
    mensagem.textContent = erro.message;
  } finally {
    botaoPendencias.disabled = false;
  }
});

item.append(" ", botaoPendencias);

const botaoXml = document.createElement("button");
botaoXml.type = "button";
botaoXml.textContent = "Baixar XML de teste";

botaoXml.addEventListener("click", async () => {
  botaoXml.disabled = true;

  try {
    const resposta = await fetch(
      `/api/documentos/${documento.id}/xml-teste`
    );

    if (!resposta.ok) {
      const erro = await resposta.json();
      throw new Error(erro.erro || "Erro ao gerar XML.");
    }

    const arquivo = await resposta.blob();
    const url = URL.createObjectURL(arquivo);
    const link = document.createElement("a");

    link.href = url;
    link.download = `documento-${documento.id}-abrasf-teste.xml`;
    document.body.appendChild(link);
    link.click();
    link.remove();

    setTimeout(() => URL.revokeObjectURL(url), 1000);

    mensagem.textContent =
      "XML de teste gerado. A importação no G5 ainda precisa ser validada.";
  } catch (erro) {
    mensagem.textContent = erro.message;
  } finally {
    botaoXml.disabled = false;
  }
});

item.append(" ", botaoXml);

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
  mensagem.textContent = "Enviando...";

  try {
    const formularioDados = new FormData();
    formularioDados.append("pdf", arquivo);

    const resposta = await fetch("/api/documentos/upload", {
      method: "POST",
      body: formularioDados,
    });

    const dados = await resposta.json();

    if (!resposta.ok) {
      throw new Error(dados.erro || "Erro ao enviar o PDF.");
    }

    mensagem.textContent = dados.mensagem;
    formulario.reset();

    try {
      await carregarDocumentos();
    } catch {
      mensagem.textContent += " Não foi possível atualizar a lista.";
    }
  } catch (erro) {
    mensagem.textContent = erro.message;
  } finally {
    botaoEnviar.disabled = false;
  }
});

document.querySelector("#atualizar").addEventListener("click", () => {
  carregarDocumentos().catch((erro) => {
    mensagem.textContent = erro.message;
  });
});

carregarDocumentos().catch((erro) => {
  mensagem.textContent = erro.message;
});

async function abrirTexto(id, extrair, botao) {
  const titulo = document.querySelector("#titulo-texto");
  const areaTexto = document.querySelector("#texto-documento");

  botao.disabled = true;
  titulo.textContent = `Documento #${id}`;
  areaTexto.textContent = extrair
    ? "Lendo o PDF..."
    : "Consultando o texto salvo...";

  try {
    const url = extrair
      ? `/api/documentos/${id}/extrair-texto`
      : `/api/documentos/${id}/texto`;

    const resposta = await fetch(url, {
      method: extrair ? "POST" : "GET",
    });

    const dados = await resposta.json();

    if (!resposta.ok) {
      throw new Error(dados.erro || "Não foi possível ler o texto.");
    }

    titulo.textContent = `Texto: ${dados.nome_arquivo}`;
    areaTexto.textContent =
      dados.texto_extraido ||
      'Ainda não há texto salvo. Clique em "Ler texto".';

    mensagem.textContent = extrair
      ? dados.mensagem
      : "Consulta concluída.";
  } catch (erro) {
    areaTexto.textContent = erro.message;
    mensagem.textContent = erro.message;
  } finally {
    botao.disabled = false;
  }
}

async function identificarCampos(id, botao) {
  botao.disabled = true;
  mensagem.textContent = "Identificando os campos...";

  try {
    const resposta = await fetch(
      `/api/documentos/${id}/identificar-campos`,
      { method: "POST" }
    );

    const resultado = await resposta.json();

    if (!resposta.ok) {
      throw new Error(resultado.erro || "Falha ao identificar campos.");
    }

    document.querySelector("#titulo-texto").textContent =
      `Campos identificados — Documento #${id}`;

    document.querySelector("#texto-documento").textContent =
      JSON.stringify(resultado.dados, null, 2);

    mensagem.textContent = resultado.mensagem;
  } catch (erro) {
    mensagem.textContent = erro.message;
  } finally {
    botao.disabled = false;
  }
}

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
    const resultado = await resposta.json();

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

      const resultado = await resposta.json();

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