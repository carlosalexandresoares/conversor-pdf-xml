
const municipios = {
  "SP|BARUERI": "3505708",
  "SP|SANTOS": "3548500",
  "SP|ITAQUAQUECETUBA": "3523107",
};

function normalizar(valor) {
  return String(valor || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .replace(/\s+/g, " ")
    .toUpperCase();
}

function preencherCodigosMunicipios(dados) {
  for (const pessoa of ["prestador", "tomador"]) {
    const nome = normalizar(dados[`${pessoa}_municipio`]);
    const uf = normalizar(dados[`${pessoa}_uf`]);
    const chave = `${uf}|${nome}`;

    // Recalcula para não manter um código antigo
    // quando o usuário alterar o município ou a UF.
    dados[`${pessoa}_codigo_municipio`] =
      municipios[chave] || null;
  }

  return dados;
}

module.exports = { preencherCodigosMunicipios };