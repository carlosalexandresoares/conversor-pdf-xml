// Processo isolado: extrai texto, tenta leitura posicional e aplica OCR quando necessario.
const fs = require('node:fs/promises');
const { PDFParse } = require('pdf-parse');
const { extrairGenerico } = require('./extrator-generico');
process.on('message', async ({caminho}) => {
  let parser, ocr;
  const avisos=[];
  try {
    const buffer=await fs.readFile(caminho);
    parser=new PDFParse({data:new Uint8Array(buffer)});
    const info=await parser.getInfo();
    if(info.total>50) throw new Error('O PDF tem mais de 50 páginas. Divida-o em arquivos menores.');
    const resultado=await parser.getText();
    let extracao;
    if(info.total===1 && /NFSe Campinas - Prestador/.test(resultado.pages[0]?.text||'')){
      extracao=await require('./extrator-campinas').lerCampinas(buffer);
    }
    let posicional,documento;
    const textoNativo=resultado.pages.map(p=>p.text).join('\n');
    const conhecido=/PREFEITURA MUNICIPAL DE (?:BARUERI|SANTOS)|Prefeitura da Estância Hidromineral de Poá|DANFSe\s+v2|Notas fiscais gerenciadas pela Qive/i.test(textoNativo);
    // O modelo de posições é montado para todos os PDFs. Adaptadores conhecidos
    // continuam responsáveis pelo valor; a posição pode confirmar sua origem.
    {
      try{
        const leitura=await require('./extrator-posicional').lerPosicoes(buffer,{comDocumento:true});
        documento=leitura.documento;
        const {documento:ignorado,...campos}=leitura;
        posicional=campos;
      }
      catch{avisos.push('A leitura por posição não pôde ser concluída; usada leitura de texto e OCR.');}
    }
    const paginas=[];
    let usouOcr=false, paginasOcr=0,ocrComPosicoes=false;
    for (let i=0;i<resultado.pages.length;i++) {
      let texto=resultado.pages[i].text.trim();
      const campos={...extrairGenerico(texto).dados,...require('./extrator-poa').extrairPoa(texto),...extracao?.dados};
      for(const [campo,origem] of Object.entries(posicional?.origens||{}))if(origem.pagina===i+1)campos[campo]=posicional.dados[campo];
      const temDados=['numero_nota','cnpj_prestador','cnpj_tomador','valor_servicos_centavos'].some(c=>campos[c]!=null);
      if(texto.replace(/\s/g,'').length<40 || !temDados) {
        if(++paginasOcr>20) { avisos.push(`Página ${i+1} sem OCR: limite de 20 páginas digitalizadas por arquivo.`); paginas.push(texto); continue; }
        try {
          if(!ocr) {
            const {createWorker}=require('tesseract.js');
            const {langPath}=require('@tesseract.js-data/por');
            ocr=await createWorker('por',1,{langPath,cacheMethod:'none',gzip:true});
          }
          const imagem=await parser.getScreenshot({partial:[i+1],desiredWidth:1800,imageDataUrl:false,imageBuffer:true});
          const reconhecimento=await ocr.recognize(imagem.pages[0].data,{}, {text:true,blocks:true});
          if(reconhecimento.data.text.trim()) {
            // Keep the native text if OCR found less information.
            const novo=reconhecimento.data.text.trim();
            const contar=t=>Object.keys(extrairGenerico(t).dados).length;
            if(contar(novo)>=contar(texto) || texto.replace(/\s/g,'').length<40) {
              texto=novo;usouOcr=true;
              if(documento){
                const {paginaOcr,organizarDocumento}=require('./layout-documento');
                documento.paginas[i]=organizarDocumento([paginaOcr(reconhecimento.data,imagem.pages[0],i,documento.paginas[i])]).paginas[0];
                ocrComPosicoes=true;
              }
            }
          }
          if(reconhecimento.data.confidence<70) avisos.push(`OCR da página ${i+1} tem baixa confiança; confira com o original.`);
        } catch(erro) {avisos.push(`Não foi possível aplicar OCR à página ${i+1}. Revise o PDF e preencha os campos manualmente.`);}
      }
      paginas.push(texto);
    }
    const texto=paginas.join('\n\n');
    if(ocrComPosicoes)posicional=require('./extrator-posicional').extrairPosicoes(documento);
    if(!extracao&&!conhecido&&posicional?.vistos.length)extracao=require('./extrator-posicional').combinarPosicoes(posicional,extrairGenerico(texto));
    if(texto.length>1000000) throw new Error('Texto muito extenso. Divida o PDF em arquivos menores.');
    if(!texto.trim()) avisos.push('Não foi encontrado texto legível. O arquivo está disponível para revisão manual.');
    if(usouOcr) avisos.push('Texto obtido por OCR. Confira números, datas e valores com o PDF.');
    process.send({ok:true,texto,avisos,extracao,
      evidencias:posicional?{dados:posicional.dados,origens:posicional.origens}:null,
      metodo:usouOcr?'ocr':'texto',paginas:paginas.length});
  } catch(erro) {process.send({ok:false,erro: /password/i.test(erro.message)?'PDF protegido por senha. Envie uma cópia desbloqueada.': 'Falha na leitura do PDF: '+erro.message});}
  finally {if(ocr) await ocr.terminate().catch(()=>{});if(parser) await parser.destroy().catch(()=>{});process.disconnect();}
});
