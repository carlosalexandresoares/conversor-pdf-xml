// Recebe PDFs, valida o arquivo e evita duplicatas por conteudo.
const express = require("express");
const multer = require("multer");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const db = require("./database");
const {registrar}=require('./auditoria');
const {enfileirar, pastaUploads} = require("./processamento");


const router = express.Router();


fs.mkdirSync(pastaUploads, { recursive: true });

const receberPdf = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 20 * 1024 * 1024,
    files: 1,
    fields: 0,
    parts: 1,
  },
}).single("pdf");

router.post("/", (req, res) => {
  receberPdf(req, res, (erro) => {
    if (erro) {
      const tamanhoExcedido = erro.code === "LIMIT_FILE_SIZE";

      return res.status(tamanhoExcedido ? 413 : 400).json({
        erro: tamanhoExcedido
          ? "O PDF deve ter no máximo 20 MB."
          : "Envie apenas um arquivo no campo PDF.",
      });
    }

    if (!req.file) {
      return res.status(400).json({
        erro: "Selecione um PDF para enviar.",
      });
    }

    const arquivo = req.file;

    // Verificação inicial; a leitura completa será feita na próxima etapa.
    const extensao = path.extname(arquivo.originalname).toLowerCase();
    const cabecalho = arquivo.buffer.subarray(0, 5).toString("ascii");

    if (extensao !== ".pdf" || cabecalho !== "%PDF-") {
      return res.status(400).json({
        erro: "O arquivo deve ser um PDF.",
      });
    }

    const hash = crypto
      .createHash("sha256")
      .update(arquivo.buffer)
      .digest("hex");

    let caminhoCompleto;
    let arquivoGravado = false;

    try {
      const existente = db.prepare(`
        SELECT id,excluido_em FROM documentos WHERE hash_pdf = ?
      `).get(hash);

      if (existente) {
        if(existente.excluido_em){
          db.prepare('UPDATE documentos SET excluido_em=NULL WHERE id=?').run(existente.id);
          registrar(req,existente.id,'restaurado_por_reenvio');
        }
        return res.status(200).json({
          id: existente.id, duplicado: true,
          mensagem: `Este arquivo já foi cadastrado como documento ${existente.id}.`,
        });
      }

      // Nome interno independente do nome enviado pelo usuário.
      const nomeInterno = `${crypto.randomUUID()}.pdf`;
      caminhoCompleto = path.join(pastaUploads, nomeInterno);

      fs.writeFileSync(caminhoCompleto, arquivo.buffer, {
        flag: "wx",
      });
      arquivoGravado = true;

      const resultado = db.prepare(`
        INSERT INTO documentos (
          nome_arquivo,
          caminho_pdf,
          hash_pdf
        )
        VALUES (?, ?, ?)
      `).run(
        arquivo.originalname,
        `uploads/${nomeInterno}`,
        hash
      );

      arquivoGravado = false; // O arquivo já pertence ao registro salvo.
      registrar(req,Number(resultado.lastInsertRowid),'importado',{nome_arquivo:arquivo.originalname});
      enfileirar(Number(resultado.lastInsertRowid));
      return res.status(201).json({
        mensagem: "PDF salvo e adicionado à fila de leitura.",
        id: Number(resultado.lastInsertRowid),
      });
    } catch (erroSalvar) {
      console.error(erroSalvar);

      // Evita deixar um PDF sem registro se a gravação no banco falhar.
      if (arquivoGravado) {
        try {
          fs.unlinkSync(caminhoCompleto);
        } catch (erroLimpeza) {
          console.error("Falha ao remover arquivo:", erroLimpeza);
        }
      }

      return res.status(500).json({
        erro: "Não foi possível salvar o documento.",
      });
    }
  });
});

module.exports = router;
