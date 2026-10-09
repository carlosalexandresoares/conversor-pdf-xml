
// Fonte: API de Localidades do IBGE; cópia local de 09/10/2026.
const municipios = require("./municipios-ibge.json");

function normalizar(valor) {
  return String(valor || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .replace(/\s+/g, " ")
    .toUpperCase();
}

function preencherCodigosMunicipios(dados) {
  const grupos = [
    {
      municipio: "prestador_municipio",
      uf: "prestador_uf",
      codigo: "prestador_codigo_municipio",
    },
    {
      municipio: "tomador_municipio",
      uf: "tomador_uf",
      codigo: "tomador_codigo_municipio",
    },
    {
      municipio: "municipio_prestacao",
      uf: "uf_prestacao",
      codigo: "codigo_municipio_prestacao",
    },
    {
      municipio: "municipio_incidencia",
      uf: "uf_incidencia",
      codigo: "codigo_municipio_incidencia",
    },
  ];

  for (const grupo of grupos) {
    const nome = normalizar(dados[grupo.municipio]);
    const uf = normalizar(dados[grupo.uf]);

    dados[grupo.codigo] = municipios[`${uf}|${nome}`] || dados[grupo.codigo] || null;
  }

  return dados;
}

module.exports = { preencherCodigosMunicipios };