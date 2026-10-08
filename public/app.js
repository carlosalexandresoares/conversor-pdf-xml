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

    item.textContent =
      `#${documento.id} — ${documento.nome_arquivo} ` +
      `— Status: ${documento.status}`;

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