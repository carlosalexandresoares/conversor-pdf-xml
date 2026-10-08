const express = require("express");
const fs = require("node:fs/promises");
const path = require("node:path");
const { PDFParse } = require("pdf-parse");
const db = require("./database");

const router = express.Router();

// Consulta o texto que já está salvo.
router.get("/:id/texto", (req, res) => {
  const id = Number(req.params.id);

  if (!Number.isSafeInteger(id) || id <= 0) {
    return res.status(400).json({ erro: "ID inválido." });
  }

  try {
    const documento = db.prepare(`
      SELECT id, nome_arquivo, texto_extraido
      FROM documentos
      WHERE id = ?
    `).get(id);

    if (!documento) {
      return res.status(404).json({
        erro: "Documento não encontrado.",
      });
    }

    res.json(documento);
  } catch (erro) {
    console.error(erro);
    res.status(500).json({ erro: "Não foi possível consultar o texto." });
  }
});

// Lê o PDF original e salva o texto.
router.post("/:id/extrair-texto", async (req, res) => {
  const id = Number(req.params.id);

  if (!Number.isSafeInteger(id) || id <= 0) {
    return res.status(400).json({ erro: "ID inválido." });
  }

  let parser;

  try {
    const documento = db.prepare(`
      SELECT id, nome_arquivo, caminho_pdf
      FROM documentos
      WHERE id = ?
    `).get(id);

    if (!documento) {
      return res.status(404).json({
        erro: "Documento não encontrado.",
      });
    }

    if (!documento.caminho_pdf) {
      return res.status(404).json({
        erro: "Este registro não possui um PDF armazenado.",
      });
    }

    const pastaUploads = path.resolve(__dirname, "uploads");
    const caminho = path.resolve(__dirname, documento.caminho_pdf);
    const relativo = path.relative(pastaUploads, caminho);

    if (
      relativo === "" ||
      relativo === ".." ||
      relativo.startsWith(`..${path.sep}`) ||
      path.isAbsolute(relativo)
    ) {
      throw new Error("Caminho do documento inválido.");
    }

    const buffer = await fs.readFile(caminho);

    parser = new PDFParse({
      data: new Uint8Array(buffer),
    });

    const resultado = await parser.getText();

    // Usa o conteúdo das páginas para evitar contar marcadores
    // de página como texto em um PDF digitalizado.
    const texto = resultado.pages
      .map((pagina) => pagina.text)
      .join("\n\n")
      .trim();

    if (!texto) {
      return res.status(422).json({
        erro:
          "Não foi encontrado texto extraível. " +
          "O documento pode precisar de OCR.",
      });
    }

    db.prepare(`
      UPDATE documentos
      SET texto_extraido = ?
      WHERE id = ?
    `).run(texto, id);

    res.json({
      id,
      nome_arquivo: documento.nome_arquivo,
      texto_extraido: texto,
      mensagem: "Texto extraído e salvo no banco.",
    });
  } catch (erro) {
    console.error(erro);

    res.status(500).json({
      erro:
        "Não foi possível ler o PDF. Confira o terminal: " +
        "o arquivo pode estar ausente, protegido ou danificado.",
    });
  } finally {
    if (parser) {
      try {
        await parser.destroy();
      } catch (erro) {
        console.error("Falha ao liberar o leitor de PDF:", erro);
      }
    }
  }
});

module.exports = router;