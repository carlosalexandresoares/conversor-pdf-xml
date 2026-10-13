const {test}=require('node:test');
const assert=require('node:assert/strict');
const {extrairDanfse}=require('../extrator-danfse');
const texto=`DANFSe v2.0
NÚMERO DA NFS-e
304
COMPETÊNCIA
09/10/2026
EMISSÃO DA NFS-e
09/10/2026 13:34:31
NÚMERO DA DPS
304
SÉRIE DA DPS
70002
EMITENTE DA NFS-e
Prestador
PRESTADOR / FORNECEDOR DA NFS-e
CPF / CNPJ / NIF
12.345.678/0001-90
INSCRIÇÃO MUNICIPAL
123456
TELEFONE
-
NOME / NOME EMPRESARIAL
Empresa de Teste Ltda
MUNICÍPIO / UF
Ribeirão Preto / SP
CÓDIGO IBGE / CEP
3543402 / 14110-000
ENDEREÇO
Rua de Teste, 100, Centro
E-MAIL
prestador@example.com
TOMADOR / ADQUIRENTE DA OPERAÇÃO
CPF / CNPJ / NIF
123.456.789-09
INSCRIÇÃO MUNICIPAL
-
TELEFONE
11999999999
NOME / NOME EMPRESARIAL
Cliente de Teste
MUNICÍPIO / UF
Itaquaquecetuba / SP
CÓDIGO IBGE / CEP
3523107 / 08586-260
ENDEREÇO
Rua do Cliente, 200, Bairro Exemplo
E-MAIL
cliente@example.com
DESTINATÁRIO DA OPERAÇÃO
DESTINATÁRIO DA OPERAÇÃO NÃO IDENTIFICADO NA NFS-e
SERVIÇO PRESTADO
CÓD. TRIBUTAÇÃO NACIONAL / MUNICIPAL
100901
CÓDIGO NBS
102010000
LOCAL DA PRESTAÇÃO
Ribeirão Preto
Representação comercial.
DESCRIÇÃO DO SERVIÇO
Serviço de teste.
Segunda linha da descrição.
TRIBUTAÇÃO MUNICIPAL (ISSQN)
MUNICÍPIO / UF / PAÍS DA INCIDÊNCIA
Ribeirão Preto
BC ISSQN
R$ 121,35
ALÍQUOTA APLICADA
2,00%
RETENÇÃO DO ISSQN
Não Retido
ISSQN APURADO
R$ 2,43
IRRF
-
VALOR APURADO MUNICIPAL - IBS
R$ 0,00
VALOR TOTAL APURADO - IBS
R$ 0,12
VALOR TOTAL APURADO - CBS
R$ 1,07
VALOR TOTAL DA NFS-e
VALOR DO SERVIÇO
R$ 121,35
VALOR LÍQUIDO DA NFS-e
R$ 121,35`;
test('DANFSe v2 separa pessoas, endereços, serviço e tributos',()=>{
 const d=extrairDanfse(texto);
 for(const [campo,valor] of Object.entries({numero_nota:'304',cnpj_prestador:'12345678000190',cnpj_tomador:'12345678909',nome_prestador:'Empresa de Teste Ltda',nome_tomador:'Cliente de Teste',prestador_endereco:'Rua de Teste',prestador_numero:'100',prestador_bairro:'Centro',prestador_cep:'14110000',tomador_email:'cliente@example.com',tomador_telefone:'11999999999',tomador_codigo_municipio:'3523107',codigo_municipio_prestacao:'3543402',codigo_municipio_incidencia:'3543402',competencia_xml:'2026-10-09',valor_servicos_centavos:12135,valor_liquido_centavos:12135,base_calculo_centavos:12135,valor_iss_centavos:243,valor_ibs_centavos:12,valor_cbs_centavos:107,aliquota_percentual:2,iss_retido:'nao',item_lista_servico:'10.09',descricao_servico:'Representação comercial.',discriminacao_servicos:'Serviço de teste.\nSegunda linha da descrição.'}))assert.equal(d[campo],valor,campo);
 for(const campo of ['rps_numero','codigo_verificacao','codigo_servico_municipal','valor_ir_centavos','prestador_telefone','tomador_inscricao_municipal'])assert.equal(d[campo],undefined,campo);
});
test('Adaptador nacional não interfere em Barueri e mantém endereço ambíguo completo',()=>{
 assert.equal(extrairDanfse('PREFEITURA MUNICIPAL DE BARUERI'),null);
 const d=extrairDanfse(texto.replace('Rua de Teste, 100, Centro','Rua de Teste, 100, Sala 2, Centro'));
 assert.equal(d.prestador_endereco,'Rua de Teste, 100, Sala 2, Centro');
 assert.equal(d.prestador_numero,undefined);
});
