const {test}=require('node:test');
const assert=require('node:assert/strict');
const {extrairPosicoes,combinarPosicoes}=require('../extrator-posicional');
const item=(str,x,y,width=str.length*5)=>({str,width,height:10,transform:[10,0,0,10,x,-y]});
const ler=items=>extrairPosicoes([{items}]);
test('Layout desconhecido com títulos em colunas, texto fora de ordem e valores abaixo',()=>{
 const items=[item('Número da NFS-e',20,20),item('Data de emissão',220,20),item('Competência',420,20),
 item('987',20,34),item('13/10/2026 09:30:00',220,34),item('09/2026',420,34),
 item('Fornecedor',20,65),item('CPF / CNPJ',20,85),item('Razão social',220,85),item('12.345.678/0001-90',20,100),item('Empresa Exemplo',220,100),
 item('Cidade',20,120),item('CEP',220,120),item('Curitiba / PR',20,134),item('80000-000',220,134),
 item('Cliente',20,165),item('CPF',20,185),item('Nome empresarial',220,185),item('123.456.789-09',20,199),item('Cliente Exemplo',220,199),
 item('Valores',20,225),item('Valor dos serviços (R$)',20,245),item('Base de cálculo (R$)',220,245),item('Valor do ISS (R$)',420,245),
 item('1.234,56',100,260),item('1.234,56',300,260),item('24,69',470,260)];
 const r=ler(items.slice().reverse());
 for(const [c,v] of Object.entries({numero_nota:'987',data_emissao:'2026-10-13T09:30:00',competencia:'2026-09',cnpj_prestador:'12345678000190',nome_prestador:'Empresa Exemplo',prestador_municipio:'Curitiba',prestador_uf:'PR',prestador_cep:'80000000',cnpj_tomador:'12345678909',nome_tomador:'Cliente Exemplo',valor_servicos_centavos:123456,base_calculo_centavos:123456,valor_iss_centavos:2469}))assert.equal(r.dados[c],v,c);
 assert.equal(r.origens.valor_iss_centavos.pagina,1);
 assert.deepEqual(r.dados,ler(items).dados);
});
test('Prestador e tomador lado a lado e campos com valor na mesma linha',()=>{
 const r=ler([item('Emitente',20,20),item('Destinatário',320,20),item('CNPJ:',20,40),item('12.345.678/0001-90',70,40),item('CPF:',320,40),item('123.456.789-09',360,40),item('Razão social: Empresa A',20,65),item('Nome: Cliente B',320,65),item('Valor líquido = R$ 98,50',20,100)]);
 assert.equal(r.dados.cnpj_prestador,'12345678000190');assert.equal(r.dados.cnpj_tomador,'12345678909');
 assert.equal(r.dados.nome_prestador,'Empresa A');assert.equal(r.dados.nome_tomador,'Cliente B');assert.equal(r.dados.valor_liquido_centavos,9850);
});
test('Rótulos fragmentados, data impossível e alíquota fora de faixa',()=>{
 const r=ler([item('Valor',20,20,22),item('dos',45,20,15),item('serviços',63,20,40),item('42,10',20,34),item('Data de emissão: 31/02/2026',20,65),item('Alíquota: 105%',20,95)]);
 assert.equal(r.dados.valor_servicos_centavos,4210);assert.equal(r.dados.data_emissao,undefined);assert.equal(r.dados.aliquota_percentual,undefined);
});

test('Títulos quebrados em linhas são reconstruídos para campos e seções diferentes',()=>{
 const r=ler([
  item('Número da',20,20),item('NFS-e',20,32),item('438',20,46),
  item('Data de',220,20),item('emissão',220,32),item('14/10/2026',220,46),
  item('Dados do',20,75),item('Prestador de Serviços',20,87),
  item('CNPJ',20,105),item('12.345.678/0001-90',20,119),
  item('Valor dos',20,150),item('serviços',20,162),item('321,45',20,176),
  item('Valor do',220,150),item('ISS',220,162),item('9,64',220,176)
 ]);
 assert.equal(r.dados.numero_nota,'438');
 assert.equal(r.dados.data_emissao,'2026-10-14');
 assert.equal(r.dados.cnpj_prestador,'12345678000190');
 assert.equal(r.dados.valor_servicos_centavos,32145);
 assert.equal(r.dados.valor_iss_centavos,964);
});

test('Linhas próximas que não formam título conhecido não viram campo',()=>{
 const r=ler([item('Prestador',20,20),item('Nome',20,40),item('Empresa Exemplo',20,53),item('Valor dos',20,85),item('outros itens',20,97),item('40,00',20,110)]);
 assert.equal(r.dados.nome_prestador,'Empresa Exemplo');
 assert.equal(r.dados.valor_servicos_centavos,undefined);
});
test('Não cruza títulos, não associa CNPJ sem papel e não usa valor de coluna vizinha',()=>{
 const r=ler([item('CNPJ: 12.345.678/0001-90',20,20),item('Prestador',20,50),item('Nome',20,70),item('Endereço',20,84),item('Rua Exemplo',20,98),item('Valor dos serviços',20,130),item('Valor do ISS',220,130),item('*****',20,144),item('2,00',220,144)]);
 assert.equal(r.dados.cnpj_prestador,undefined);assert.equal(r.dados.nome_prestador,undefined);assert.equal(r.dados.prestador_endereco,'Rua Exemplo');
 assert.equal(r.dados.valor_servicos_centavos,undefined);assert.equal(r.dados.valor_iss_centavos,200);
});
test('Conflitos entre páginas ficam vazios; títulos mascarados bloqueiam regex antiga',()=>{
 const r=extrairPosicoes([{items:[item('Número da nota: 111',20,20),item('Valor do ISS: *****',20,50)]},{items:[item('Número da nota: 222',20,20)]}]);
 assert.equal(r.dados.numero_nota,undefined);assert.ok(r.avisos.some(a=>a.includes('numero_nota')));
 const mesclado=combinarPosicoes(r,{dados:{numero_nota:'111',valor_iss_centavos:999},origens:{},avisos:[]});
 assert.equal(mesclado.dados.numero_nota,undefined);assert.equal(mesclado.dados.valor_iss_centavos,undefined);
});
test('Descrição multilinha para no quadro seguinte; municípios com UF',()=>{
 const r=ler([item('Descrição dos serviços',20,20),item('Primeira linha',20,34),item('Segunda linha',20,48),item('Valor dos serviços: 50,00',20,70),item('Local da prestação do serviço: Curitiba / PR',20,100)]);
 assert.equal(r.dados.discriminacao_servicos,'Primeira linha\nSegunda linha');
 assert.equal(r.dados.municipio_prestacao,'Curitiba');assert.equal(r.dados.uf_prestacao,'PR');
});
test('Campo vazio não captura conteúdo da seção seguinte',()=>{
 const r=ler([item('Tomador',20,20),item('Complemento',20,40),item('Discriminação dos Serviços',200,55),item('Serviço de armazenagem',20,70)]);
 assert.equal(r.dados.tomador_complemento,undefined);
});
