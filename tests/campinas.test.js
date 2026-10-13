const {test}=require('node:test');
const assert=require('node:assert/strict');
const {extrairPaginaCampinas}=require('../extrator-campinas');
function itens(){
 const a=[];const add=(str,x,y)=>a.push({str,transform:[1,0,0,1,x,y]});
 const linha=(y,campos)=>campos.forEach(([x,t,v])=>{add(t,x,y);add(v,x,y-9);});
 add('NFSe Campinas - Prestador',200,760);add('ABcd12345',510,755);
 add('DADOS DA NFSe Campinas',16,740);
 linha(730,[[16,'Data e hora de emissão','01/01/2026 09:56:36'],[111,'Competência','01/2026'],[181,'Número / Série','9405 / E'],[246,'Data do RPS','01/01/2026'],[375,'Número / Série do RPS','9415 / 1']]);
 add('EMITENTE PRESTADOR DO SERVIÇO',94,703);
 linha(692,[[94,'CPF / CNPJ / NIF','12.345.678/0001-90'],[391,'Inscrição Municipal','12345'],[507,'Telefone','(19) 9999-9999']]);
 linha(673,[[94,'Nome / Nome Empresarial','Prestador de teste'],[391,'E-mail','prestador@example.com']]);
 linha(654,[[94,'Endereço','Rua Exemplo 100 Sala 2 Centro'],[391,'Município','CAMPINAS / SP BRASIL'],[507,'CEP','13090-615']]);
 add('TOMADOR DO SERVIÇO',16,621);
 linha(610,[[16,'CPF / CNPJ / NIF','98.765.432/0001-10'],[391,'Inscrição Municipal','-'],[507,'Telefone','-']]);
 linha(591,[[16,'Nome / Nome Empresarial','Cliente de teste'],[391,'E-mail','-']]);
 linha(572,[[16,'Endereço','Rua Cliente 252 Centro'],[391,'Município','ITAQUAQUECETUBA / SP BRASIL'],[507,'CEP','08580-290']]);
 add('SERVIÇO PRESTADO',16,539);
 linha(509,[[16,'Serviço','17.01 - ASSESSORIA']]);
 linha(490,[[16,'Local da prestação do serviço','CAMPINAS / SP'],[216,'País da prestação do serviço','BRASIL']]);
 add('DESCRIÇÃO DO SERVIÇO PRESTADO (EM ACORDO COM A CNAE/CBO',16,462);
 add('PRESTADO, ESPECIFICANDO A QUANTIDADE E O PREÇO UNITÁRIO)',16,451);
 add('Serviço de teste',16,441);
 add('TRIBUTAÇÃO MUNICIPAL',16,297);
 linha(286,[[16,'Exigibilidade do ISSQN','EXIGÍVEL'],[221,'Município da Incidência do ISSQN','CAMPINAS - SP'],[392,'Responsável pelo recolhimento do ISSQN','PRESTADOR DO SERVIÇO']]);
 linha(267,[[16,'Retenção do ISSQN','NÃO RETIDO']]);
 add('CÁLCULO DO ISSQN',16,241);
 // Valores alinhados à direita, com pequena diferença de altura entre rótulos.
 add('Valor total da NFSe Campinas (R$)',17,229);add('56,27',114,221);
 add('Total das deduções (R$)',156,231);add('0,00',223,221);
 add('Desc. incondicionado (R$)',254,231);add('0,00',328,221);
 add('Base de cálculo do ISSQN (R$)',354,231);add('56,27',439,221);
 add('Alíq. (%)',471,231);add('*****',485,221);
 add('Valor do ISSQN (R$)',512,231);add('*****',565,221);
 add('RETENÇÕES',16,204);
 linha(194,[[54,'ISSQN (R$)','0,00'],[134,'IRRF (R$)','0,00'],[214,'PIS (R$)','0,00'],[274,'COFINS (R$)','0,00'],[359,'INSS (R$)','0,00'],[432,'CSLL (R$)','0,00']]);
 add('VALOR TOTAL',16,167);
 linha(156,[[35,'Base de cálculo do ISSQN (R$)','56,27'],[170,'Retenções (R$)','0,00'],[453,'Valor Líquido da NFSe Campinas (R$)','56,27']]);
 return a;
}
test('Campinas associa valores pela posição mesmo com texto fora de ordem',()=>{
 const original=itens();const {dados:d,avisos}=extrairPaginaCampinas(original.slice().reverse());
 assert.deepEqual(d,extrairPaginaCampinas(original).dados);
 for(const [campo,valor] of Object.entries({numero_nota:'9405',data_emissao:'2026-01-01T09:56:36',competencia:'2026-01',codigo_verificacao:'ABcd12345',rps_numero:'9415',rps_serie:'1',cnpj_prestador:'12345678000190',cnpj_tomador:'98765432000110',nome_prestador:'Prestador de teste',nome_tomador:'Cliente de teste',prestador_telefone:'(19) 9999-9999',prestador_email:'prestador@example.com',prestador_cep:'13090615',tomador_cep:'08580290',prestador_endereco:'Rua Exemplo 100 Sala 2 Centro',valor_servicos_centavos:5627,valor_liquido_centavos:5627,base_calculo_centavos:5627,valor_pis_centavos:0,valor_cofins_centavos:0,valor_ir_centavos:0,valor_inss_centavos:0,valor_csll_centavos:0,iss_retido:'nao',item_lista_servico:'17.01',discriminacao_servicos:'Serviço de teste'}))assert.equal(d[campo],valor,campo);
 assert.equal(d.valor_iss_centavos,undefined);assert.equal(d.aliquota_percentual,undefined);
 assert.equal(d.tomador_email,undefined);assert.equal(d.tomador_inscricao_municipal,undefined);
 assert.ok(avisos.some(a=>a.includes('asteriscos')));
});
test('Campinas não substitui o ISS apurado pela retenção de ISS',()=>{
 const a=itens();a.find(i=>i.str==='*****'&&i.transform[4]===565).str='1,13';
 a.find(i=>i.str==='*****').str='2,00';
 const d=extrairPaginaCampinas(a).dados;
 assert.equal(d.valor_iss_centavos,113);assert.equal(d.aliquota_percentual,2);
 assert.equal(extrairPaginaCampinas([]),null);
});
