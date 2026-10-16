// Banco SQLite: cria tabelas e aplica migracoes sem apagar documentos existentes.
const Database = require("better-sqlite3");
const fs = require("node:fs");
const path = require("node:path");

// Garante que a pasta do banco exista, inclusive ao baixar do GitHub.
const pastaDados = process.env.CONVERSOR_DATA_DIR || path.join(__dirname, "data");
fs.mkdirSync(pastaDados, { recursive: true });

const db = new Database(path.join(pastaDados, "conversor.db"));

db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

// Cada registro representa um documento importado.
db.exec(`
  CREATE TABLE IF NOT EXISTS documentos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,

    nome_arquivo TEXT NOT NULL,
    caminho_pdf TEXT,
    hash_pdf TEXT UNIQUE,

    modelo TEXT,
    numero_nota TEXT,
    codigo_verificacao TEXT,
    data_emissao TEXT,
    competencia TEXT,

    cnpj_prestador TEXT,
    nome_prestador TEXT,
    cnpj_tomador TEXT,
    nome_tomador TEXT,

    valor_servicos_centavos INTEGER,
    valor_liquido_centavos INTEGER,

    texto_extraido TEXT NOT NULL DEFAULT '',
    dados_json TEXT NOT NULL DEFAULT '{}',

    status TEXT NOT NULL DEFAULT 'pendente'
      CHECK (status IN ('pendente', 'conferido')),

    criado_em TEXT NOT NULL DEFAULT (
      strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
    )
  );

  CREATE INDEX IF NOT EXISTS idx_documentos_numero
    ON documentos(numero_nota);

  CREATE INDEX IF NOT EXISTS idx_documentos_prestador
    ON documentos(cnpj_prestador);

  CREATE TABLE IF NOT EXISTS eventos_documento (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    documento_id INTEGER NOT NULL,
    acao TEXT NOT NULL,
    ator TEXT NOT NULL,
    detalhes_json TEXT NOT NULL DEFAULT '{}',
    criado_em TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  );
  CREATE INDEX IF NOT EXISTS idx_eventos_documento ON eventos_documento(documento_id, id);
`);

// Additive migration: preserves existing PDFs, records and manual revisions.
const colunas = new Set(db.prepare("PRAGMA table_info(documentos)").all().map(c => c.name));
for (const [nome, tipo] of Object.entries({ processamento: "TEXT NOT NULL DEFAULT 'novo'", erro_processamento: "TEXT", processado_em: "TEXT", excluido_em: "TEXT" })) {
  if (!colunas.has(nome)) db.exec(`ALTER TABLE documentos ADD COLUMN ${nome} ${tipo}`);
}
db.pragma("busy_timeout = 5000");
module.exports = db;
