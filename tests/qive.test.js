const {test}=require('node:test');
const assert=require('node:assert/strict');
const {extrairQive}=require('../extrator-qive');
const {textoQive}=require('./fixtures/qive');
test('Qive separa pessoas, endereços e campos no cabeçalho',()=>{
 const {dados:d}=extrairQive(textoQive());
 for(const [campo,esperado] of Object.entries({numero_nota:'101',data_emissao:'2026-10-01T21:09:38',competencia:'2026-09',codigo_verificacao:'ABCD1234',rps_numero:'501',rps_serie:'A',cnpj_prestador:'12345678000190',cnpj_tomador:'98765432000110',nome_prestador:'Empresa Sintética Ltda',nome_tomador:'Cliente Sintético Ltda',prestador_endereco:'RUA DE TESTE',prestador_numero:'181',prestador_bairro:'CENTRO',prestador_complemento:'SALA 2',prestador_inscricao_municipal:'12345',prestador_email:'prestador@example.com',prestador_telefone:'48999999999',prestador_cep:'88015190',tomador_endereco:'RUA DO CLIENTE',tomador_numero:'252',tomador_codigo_municipio:'3523107',codigo_municipio_prestacao:'4205407',uf_prestacao:'SC',codigo_servico_municipal:'2684'}))assert.equal(d[campo],esperado,campo);
 for(const campo of ['tomador_bairro','tomador_email','tomador_telefone','tomador_inscricao_municipal','tomador_complemento','item_lista_servico','codigo_municipio_incidencia'])assert.equal(d[campo],undefined,campo);
 assert.equal(d.discriminacao_servicos,'Serviço de teste.\nPIS(0.65%) = 3.6751\nCOFINS(3.00%) = 16.962');
});
const cenarios=[
 [{},[37699,37699,754,37699,36,320,0]],
 [{servicos:'2.200,00',base:'-',iss:'-',aliquota:'-',liquido:'2.200,00',ibsMunicipio:'-',ibsUf:'-',cbs:'-'},[220000,undefined,undefined,220000,undefined,undefined,0]],
 [{servicos:'235,49',base:'-',iss:'-',aliquota:'-',liquido:'235,49',ibsUf:'0,24',cbs:'2,12'},[23549,undefined,undefined,23549,24,212,0]],
 [{servicos:'98,00',base:'98,00',iss:'2,84',liquido:'-',ibsMunicipio:'-',ibsUf:'-',cbs:'0,77'},[9800,9800,284,undefined,undefined,77,0]],
 [{servicos:'2.098,83',base:'2.098,83',iss:'60,86',liquido:'-',ibsMunicipio:'-',ibsUf:'-',cbs:'16,59'},[209883,209883,6086,undefined,undefined,1659,0]],
 [{servicos:'2.004,60',base:'2.004,60',iss:'58,13',liquido:'-',ibsMunicipio:'-',ibsUf:'-',cbs:'16,86'},[200460,200460,5813,undefined,undefined,1686,0]],
 [{servicos:'565,40',base:'565,40',iss:'16,39',liquido:'-',ibsMunicipio:'-',ibsUf:'-',cbs:'4,76',csll:'26,29'},[56540,56540,1639,undefined,undefined,476,2629]],
];
cenarios.forEach(([opcoes,esperados],i)=>test(`Qive: quadro financeiro, variação ${i+1}`,()=>{
 const {dados:d,avisos}=extrairQive(textoQive(opcoes));
 ['valor_servicos_centavos','base_calculo_centavos','valor_iss_centavos','valor_liquido_centavos','valor_ibs_centavos','valor_cbs_centavos','valor_csll_centavos'].forEach((c,j)=>assert.equal(d[c],esperados[j],c));
 assert.equal(d.valor_pis_centavos,0);assert.equal(d.valor_cofins_centavos,0);
 assert.equal(d.valor_ir_centavos,undefined);assert.equal(d.valor_inss_centavos,undefined);
 assert.equal(d.iss_retido,'nao');assert.equal(avisos.length,opcoes.liquido==='-'?1:0);
}));
test('Qive não completa parcelas ausentes do IBS nem identifica outros layouts',()=>{
 assert.equal(extrairQive(textoQive({ibsUf:'-'})).dados.valor_ibs_centavos,undefined);
 assert.equal(extrairQive('DANFSe v2.0'),null);
 assert.equal(extrairQive('PREFEITURA MUNICIPAL DE BARUERI'),null);
 const d=extrairQive(textoQive().replace('Município da Prestação 4205407 - Florianópolis - SC','Município da Prestação')).dados;
 assert.equal(d.municipio_prestacao,undefined);
});
