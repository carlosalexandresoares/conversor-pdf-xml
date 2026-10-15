const {test}=require('node:test');
const assert=require('node:assert/strict');
const {paginaOcr,organizarDocumento}=require('../layout-documento');
const {extrairPosicoes}=require('../extrator-posicional');

test('OCR e PDF nativo produzem o mesmo modelo de trechos e origens verificáveis',()=>{
  const palavras=[];
  const adicionar=(texto,x,y)=>palavras.push({text:texto,bbox:{x0:x*3,y0:(y-9)*3,x1:(x+texto.length*5)*3,y1:y*3}});
  for(const [texto,x,y] of [
    ['Número',20,20],['da',65,20],['Nota',85,20],['456',20,35],
    ['Prestador',20,65],['CNPJ:',20,85],['12.345.678/0001-90',20,100],
    ['Valor',20,130],['dos',51,130],['serviços',72,130],['123,45',20,145]
  ])adicionar(texto,x,y);
  const linhas=new Map();
  for(const palavra of palavras){const y=palavra.bbox.y1;if(!linhas.has(y))linhas.set(y,[]);linhas.get(y).push(palavra);}
  const dados={blocks:[{paragraphs:[{lines:[...linhas.values()].map(words=>({words}))}]}]};
  const pagina=paginaOcr(dados,{width:1800,height:2400,scale:3},0,{largura:600,altura:800});
  const documento=organizarDocumento([pagina]);
  assert.equal(documento.versao,1);
  assert.equal(documento.paginas[0].fonte,'ocr');
  assert.ok(documento.paginas[0].linhas.length>=4);
  const r=extrairPosicoes(documento);
  assert.equal(r.dados.numero_nota,'456');
  assert.equal(r.dados.cnpj_prestador,'12345678000190');
  assert.equal(r.dados.valor_servicos_centavos,12345);
  assert.equal(r.origens.numero_nota.metodo,'OCR, posição e rótulo');
  assert.ok(r.origens.numero_nota.area.x>0&&r.origens.numero_nota.area.x<1);
});

test('Se a coluna à direita tiver valor inválido, tenta a célula abaixo',()=>{
  const item=(str,x,y)=>({str,width:str.length*5,height:10,transform:[10,0,0,10,x,-y]});
  const r=extrairPosicoes([{items:[item('Valor do ISS',20,20),item('não informado',130,20),item('7,38',20,35)]}]);
  assert.equal(r.dados.valor_iss_centavos,738);
});

test('Cabeçalho em várias colunas aceita valor centralizado sem alcançar a coluna vizinha',()=>{
  const item=(str,x,y)=>({str,width:str.length*5,height:10,transform:[10,0,0,10,x,-y]});
  const r=extrairPosicoes([{items:[item('Nota Nº:',69,20),item('Emissão:',142,20),item('Série:',221,20),
    item('0000028658',59,38),item('21/10/2025',136,38),item('E',229,38)]}]);
  assert.equal(r.dados.numero_nota,'0000028658');
  assert.ok(Math.abs(r.origens.numero_nota.area.x-57/251)<0.001);
});

test('Grade financeira reconhece abreviação e valor em reais sem misturar a próxima coluna',()=>{
  const item=(str,x,y)=>({str,width:str.length*4,height:8,transform:[8,0,0,8,x,-y]});
  const r=extrairPosicoes([{items:[item('Vl. Total dos Serviços',31,20),item('Desconto Incondicionado',108,20),
    item('Base de Cálculo',273,20),item('R$',51,31),item('6.000,00',66,31),item('R$',152,31),item('0,00',166,31)]}]);
  assert.equal(r.dados.valor_servicos_centavos,600000);
  assert.equal(r.dados.base_calculo_centavos,undefined);
});

test('Cabeçalho em colunas e empresa sem título explícito preservam as duas partes',()=>{
  const item=(str,x,y)=>({str,width:str.length*3,height:8,transform:[8,0,0,8,x,-y]});
  const r=extrairPosicoes([{items:[
    item('Número RPS:',260,76),item('Número Nota',324,76),item('Data Emissão:',410,76),item('Chave:',501,76),
    item('833759',286,88),item('933206',368,88),item('05/08/2025',417,88),item('EENY-YMNI',504,88),
    item('EXEMPLO TECNOLOGIA LTDA',260,104),item('16200-065 - R NILO PEÇANHA, 507',260,131),
    item('SALA 08 - CENTRO',400,131),item('BIRIGUI - SP - CEP: 16200-065',260,142),
    item('CNPJ/CPF:',268,153),item('05.009.138/0001-75',305,153),item('CCM 18530',375,175),
    item('Dados do Tomador de Serviço',225,252),item('CLIENTE COMERCIO LTDA',40,266),
    item('Estrada Alberto Hinoto 7085 - Jardim Nascente',40,276),
    item('Itaquaquecetuba - SP - Brasil - CEP: 08586415',40,286),
    item('CNPJ/CPF:',40,296),item('00790751000310',83,296),item('Inscrição',183,296),
    item('145359036114',266,296),item('Inscrição Municipal:',381,296)
  ]}]);
  assert.equal(r.dados.numero_nota,'933206');
  assert.equal(r.dados.data_emissao,'2025-08-05');
  assert.equal(r.dados.codigo_verificacao,'EENY-YMNI');
  assert.equal(r.dados.nome_prestador,'EXEMPLO TECNOLOGIA LTDA');
  assert.equal(r.dados.cnpj_prestador,'05009138000175');
  assert.equal(r.dados.prestador_inscricao_municipal,'18530');
  assert.equal(r.dados.prestador_endereco,'R NILO PEÇANHA');
  assert.equal(r.dados.prestador_complemento,'SALA 08');
  assert.equal(r.dados.nome_tomador,'CLIENTE COMERCIO LTDA');
  assert.equal(r.dados.cnpj_tomador,'00790751000310');
  assert.equal(r.dados.tomador_endereco,'Estrada Alberto Hinoto');
  assert.equal(r.dados.tomador_municipio,'Itaquaquecetuba');
});

test('DANFSe em grade associa CNPJ e telefone à seção correta e ignora títulos vizinhos',()=>{
  const item=(str,x,y)=>({str,width:Math.min(str.length*3,130),height:8,transform:[8,0,0,8,x,-y]});
  const r=extrairPosicoes([{items:[
    item('EMITENTE DA NFS-e',14,133),item('CNPJ / CPF / NIF',156,133),
    item('Inscrição Municipal',298,133),item('Telefone',439,133),
    item('Prestador do Serviço',14,142),item('12.345.678/0001-90',156,142),
    item('56069301',298,142),item('(92) 8125-3782',439,142),
    item('TOMADOR DO SERVIÇO',14,220),item('CNPJ / CPF / NIF',156,220),item('Telefone',439,220),
    item('123.456.789-09',156,229),item('(61) 3215-5782',439,229),
    item('Endereço',14,262),item('Município',298,262),item('CEP',439,262),
    item('PC DOS TRES PODERES S/N, 782, Anexo III, ZONA CIVICO-',14,271),
    item('Brasília - DF',298,271),item('70160-900',439,271),item('ADMINISTRATIVA',14,280),
    item('SERVIÇO PRESTADO',14,303),
    item('Código de Tributação Municipal',156,318),item('Local da Prestação',298,318),item('País da Prestação',439,318),
    item('100 - Propaganda e publicidade',156,327),item('Brasília - DF',298,327),item('-',439,327),
    item('Descrição do Serviço',14,348),item('Prestação de serviço de teste.',14,357),
    item('TRIBUTAÇÃO MUNICIPAL',14,389),
    item('Município de Incidência do ISSQN',298,402),item('Regime Especial de Tributação',439,402),
    item('Manaus - AM',298,411),item('Nenhum',439,411)
  ]}]);
  assert.equal(r.dados.cnpj_prestador,'12345678000190');
  assert.equal(r.dados.prestador_inscricao_municipal,'56069301');
  assert.equal(r.dados.prestador_telefone,'(92) 8125-3782');
  assert.equal(r.dados.cnpj_tomador,'12345678909');
  assert.equal(r.dados.tomador_telefone,'(61) 3215-5782');
  assert.equal(r.dados.tomador_endereco,'PC DOS TRES PODERES');
  assert.equal(r.dados.tomador_numero,'S/N');
  assert.equal(r.dados.tomador_bairro,'ZONA CIVICO-ADMINISTRATIVA');
  assert.equal(r.dados.codigo_servico_municipal,'100');
  assert.equal(r.dados.municipio_prestacao,'Brasília');
  assert.equal(r.dados.municipio_incidencia,'Manaus');
  assert.equal(r.dados.discriminacao_servicos,'Prestação de serviço de teste.');
});
