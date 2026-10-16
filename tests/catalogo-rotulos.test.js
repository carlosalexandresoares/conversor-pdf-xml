const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {normalizarRotulo,canonicalizarRotulo,padraoRotulos}=require('../catalogo-rotulos');
const {extrairGenerico}=require('../extrator-generico');
const {extrairContexto}=require('../extrator-contexto');
const {lerPdf,interpretar}=require('../processamento');
const {cpfValido,cnpjValido,avisosValidacao}=require('../validacao-extracao');
const {pdfPosicional}=require('./fixtures/posicional');

test('Catálogo identifica abreviações sem alterar o valor extraído',()=>{
  assert.equal(normalizarRotulo('Cód. de Autenticidade:'),'codigo de autenticidade');
  assert.equal(canonicalizarRotulo('Vl. Total dos Serviços (R$)'),'valor dos servicos');
  assert.match('cod. de autenticidade',new RegExp('^'+padraoRotulos('codigo de verificacao')+'$'));
  const texto='Número da Nota: 304\nData de Geração da NFS-e: 09/10/2026\nCód. de Autenticidade: ABCD-1234\nVl. Total dos Serviços: 157,00';
  const {dados}=extrairGenerico(texto);
  assert.equal(dados.numero_nota,'304');
  assert.equal(dados.data_emissao,'2026-10-09');
  assert.equal(dados.codigo_verificacao,'ABCD-1234');
  assert.equal(dados.valor_servicos_centavos,15700);
});

test('Nome contaminado por documento numérico fica pendente e gera aviso',()=>{
  const texto='Dados do Prestador de Serviços\nEMPRESA EXEMPLO LTDA12345678901\nCNPJ: 04.252.011/0001-10\nDados do Tomador de Serviços\nCLIENTE EXEMPLO';
  const r=extrairContexto(texto);
  assert.equal(r.dados.nome_prestador,undefined);
  assert.ok(r.avisos.some(a=>a.includes('documento numérico colado')));
});

test('Validação avisa sobre documento e ISS incoerentes sem apagar valores',()=>{
  assert.equal(cpfValido('111.444.777-35'),true);
  assert.equal(cnpjValido('04.252.011/0001-10'),true);
  assert.equal(cpfValido('11111111111'),false);
  const dados={cnpj_prestador:'11111111111111',cnpj_tomador:'11144477735',
    base_calculo_centavos:10000,aliquota_percentual:2,valor_iss_centavos:350};
  const avisos=avisosValidacao(dados);
  assert.equal(dados.cnpj_prestador,'11111111111111');
  assert.equal(avisos.length,2);
  assert.ok(avisos.some(a=>a.includes('dígitos verificadores')));
  assert.ok(avisos.some(a=>a.includes('base × alíquota')));
  const interpretado=interpretar('',{dados:{modelo:'teste',...dados},origens:{},avisos:[]});
  assert.equal(interpretado.cnpj_prestador,dados.cnpj_prestador);
  assert.ok(interpretado.avisos.some(a=>a.includes('dígitos verificadores')));
});

test('PDF completo com abreviações atravessa worker e revisão sem serviço externo',{timeout:30000},async()=>{
  const pasta=fs.mkdtempSync(path.join(os.tmpdir(),'catalogo-pdf-'));
  const arquivo=path.join(pasta,'nota.pdf');
  const itens=[
    ['Número da Nota',20,760],['Data de Geracao da NFS-e',180,760],['Cod. de Autenticidade',370,760],
    ['304',20,744],['09/10/2026',180,744],['ABCD-1234',370,744],
    ['Vl. Total dos Servicos',20,700],['157,00',20,684]
  ];
  try{
    fs.writeFileSync(arquivo,pdfPosicional(itens));
    const leitura=await lerPdf(arquivo);
    const dados=interpretar(leitura.texto,leitura.extracao);
    assert.equal(dados.numero_nota,'304');
    assert.equal(dados.data_emissao,'2026-10-09');
    assert.equal(dados.codigo_verificacao,'ABCD-1234');
    assert.equal(dados.valor_servicos_centavos,15700);
    assert.ok(leitura.evidencias?.origens.valor_servicos_centavos?.area);
  }finally{fs.rmSync(arquivo,{force:true});fs.rmdirSync(pasta);}
});
