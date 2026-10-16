// Mede acertos, vazios, erros e tempo por campo em uma amostra com gabarito.
const fs=require('node:fs');
const path=require('node:path');
const {lerPdf,interpretar}=require('../processamento');
const arquivo=process.argv[2];
if(!arquivo){console.error('Uso: npm run avaliar-extracao -- amostra.json');process.exit(1);}
const raiz=path.dirname(path.resolve(arquivo));
const amostra=JSON.parse(fs.readFileSync(arquivo,'utf8'));
if(!Array.isArray(amostra)||!amostra.length)throw new Error('O gabarito deve ser uma lista não vazia de {pdf, esperado}.');
(async()=>{
  const campos=new Map();let tempoTotal=0;
  for(const caso of amostra){
    const inicio=performance.now();
    const leitura=await lerPdf(path.resolve(raiz,caso.pdf));
    const dados=interpretar(leitura.texto,leitura.extracao);
    const tempo=performance.now()-inicio;tempoTotal+=tempo;
    for(const [campo,esperado] of Object.entries(caso.esperado||{})){
      const m=campos.get(campo)||{acertos:0,vazios:0,erros:0};
      if(dados[campo]==null||dados[campo]==='')m.vazios++;
      else if(String(dados[campo])===String(esperado))m.acertos++;
      else m.erros++;
      campos.set(campo,m);
    }
    console.log(`${caso.pdf}: ${(tempo/1000).toFixed(2)} s`);
  }
  console.table([...campos].map(([campo,m])=>({campo,...m})));
  console.log(`Tempo médio: ${(tempoTotal/amostra.length/1000).toFixed(2)} s por PDF.`);
})().catch(erro=>{console.error(erro);process.exitCode=1;});
