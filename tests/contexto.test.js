const {test}=require('node:test');
const assert=require('node:assert/strict');
const {extrairGenerico}=require('../extrator-generico');
const texto=`PREFEITURA DO MUNICÍPIO DE EXEMPLO
CNPJ: 99.999.999/0001-99
Número RPS: | Número Nota Data Emissão: Chave:
13] 26/11/2025 TZGT-QMTF
EMPRESA DE TESTE LTDA
07435-720 - RUA DAS FLORES, 879 - CENTRO
ARUJÁ - SP - CEP: 07435-720
CNPJ/CPF:12.345.678/0001-90 Inscr. Estadual/RG:
Email: TESTEGQHOTMAIL.COM
Telefone: (11) 99999999 CCM 1234 Inscr. Municipal: 12345
Local do Serviço: 1 - SERVIÇO PRESTADO NO MUNICÍPIO
Competência: 11/2025
Atividade: 17.02 - Descrição de teste
Dados do Tomador de Serviço
CLIENTE EXEMPLO
RUA DO CLIENTE, 252
CENTRO - ITAQUAQUECETUBA - SP - BRASIL - CEP: 08580290
CNPJ/CPF: 98.765.432/0001-10 Inscrição Municipal:
E-mail:
Qtd Un Discriminação dos Serviços Valor Valor Total
1 Serviço de assessoria 2.682,38 2.682,38
Observação: Total dos Serviços 2.682,38
ISS SEM RETENÇÃO| 2,00% 53,65
Total da Nota RETENÇÕES Total Liquido
9 Ro) ag|IsSS n an IRRF naAntPIS n An`;
test('Texto completo recupera dados por contexto sem inventar trechos corrompidos',()=>{
 const {dados:d,avisos}=extrairGenerico(texto);
 for(const [c,v] of Object.entries({nome_prestador:'EMPRESA DE TESTE LTDA',cnpj_prestador:'12345678000190',nome_tomador:'CLIENTE EXEMPLO',cnpj_tomador:'98765432000110',data_emissao:'2025-11-26',codigo_verificacao:'TZGT-QMTF',competencia:'2025-11',prestador_endereco:'RUA DAS FLORES',prestador_numero:'879',tomador_municipio:'ITAQUAQUECETUBA',valor_servicos_centavos:268238,valor_iss_centavos:5365,aliquota_percentual:2,iss_retido:'nao'}))assert.equal(d[c],v,c);
 for(const c of ['numero_nota','prestador_email','tomador_inscricao_municipal','valor_liquido_centavos'])assert.equal(d[c],undefined,c);
 assert.ok(avisos.some(a=>a.includes('OCR')));
});
test('Cabeçalho íntegro e totais conflitantes recebem tratamento distinto',()=>{
 const d=extrairGenerico(texto.replace('13] 26/11','13 26/11')+'\nTotal dos Serviços 1.000,00').dados;
 assert.equal(d.numero_nota,'13');assert.equal(d.valor_servicos_centavos,undefined);
});
test('Não escolhe prestador quando há duas empresas no cabeçalho',()=>{
 const d=extrairGenerico(texto.replace('EMPRESA DE TESTE LTDA','OUTRA EMPRESA LTDA\nEMPRESA DE TESTE LTDA')).dados;
 assert.equal(d.cnpj_prestador,undefined);assert.equal(d.nome_prestador,undefined);
});
