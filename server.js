const express = require("express");
const path = require("node:path");
const db = require("./database");
const uploadRouter = require("./upload");
const leituraRouter = require("./leitura");
const camposRouter = require("./campos");
const revisaoRouter = require("./revisao");
const complementosRouter = require("./complementos");
const pendenciasRouter = require("./pendencias");
const exportacaoRouter = require("./exportacao");


const app = express();
const PORT = 3000;

app.use(express.json({ limit: "1mb" }));
app.use(express.static(path.join(__dirname, "public")));

app.get("/api/status", (req, res) => {
  try {
    db.prepare("SELECT 1").get();

    res.json({
      funcionando: true,
      sistema: "Conversor PDF para XML",
      banco: "conectado",
    });
  } catch (erro) {
    console.error(erro);

    res.status(500).json({
      funcionando: false,
      erro: "Não foi possível acessar o banco.",
    });
  }
});

// Consulta inicial, limitada aos 100 registros mais recentes.
app.get("/api/documentos", (req, res) => {
  try {
    const documentos = db.prepare(`
      SELECT
        id,
        nome_arquivo,
        modelo,
        numero_nota,
        nome_prestador,
        nome_tomador,
        valor_servicos_centavos,
        status,
        criado_em
      FROM documentos
      ORDER BY id DESC
      LIMIT 100
    `).all();

    res.json(documentos);
  } catch (erro) {
    console.error(erro);

    res.status(500).json({
      erro: "Não foi possível consultar os documentos.",
    });
  }
});

app.use("/api/documentos/upload", uploadRouter);
app.use("/api/documentos", leituraRouter);
app.use("/api/documentos", camposRouter);
app.use("/api/documentos", revisaoRouter);
app.use("/api/documentos", complementosRouter);
app.use("/api/documentos", pendenciasRouter);
app.use("/api/documentos", exportacaoRouter);

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Sistema disponível em http://localhost:${PORT}`);
  console.log("Banco SQLite conectado.");
});