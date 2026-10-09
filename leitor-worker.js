const fs = require('node:fs/promises');
const { PDFParse } = require('pdf-parse');
process.on('message', async ({caminho}) => {
  let parser, ocr;
  const avisos=[];
  try {
    parser=new PDFParse({data:new Uint8Array(await fs.readFile(caminho))});
    const info=await parser.getInfo();
    if(info.total>50) throw new Error('O PDF tem mais de 50 páginas. Divida-o em arquivos menores.');
    const resultado=await parser.getText();
    const paginas=[];
    let usouOcr=false, paginasOcr=0;
    for (let i=0;i<resultado.pages.length;i++) {
      let texto=resultado.pages[i].text.trim();
      if(texto.replace(/\s/g,'').length<40) {
        if(++paginasOcr>20) { avisos.push(`Página ${i+1} sem OCR: limite de 20 páginas digitalizadas por arquivo.`); paginas.push(texto); continue; }
        try {
          if(!ocr) {
            const {createWorker}=require('tesseract.js');
            const {langPath}=require('@tesseract.js-data/por');
            ocr=await createWorker('por',1,{langPath,cacheMethod:'none',gzip:true});
          }
          const imagem=await parser.getScreenshot({partial:[i+1],desiredWidth:1800,imageDataUrl:false,imageBuffer:true});
          const reconhecimento=await ocr.recognize(imagem.pages[0].data);
          if(reconhecimento.data.text.trim()) {texto=reconhecimento.data.text.trim();usouOcr=true;}
          if(reconhecimento.data.confidence<70) avisos.push(`OCR da página ${i+1} tem baixa confiança; confira com o original.`);
        } catch(erro) {avisos.push(`Não foi possível aplicar OCR à página ${i+1}. Revise o PDF e preencha os campos manualmente.`);}
      }
      paginas.push(texto);
    }
    const texto=paginas.join('\n\n');
    if(texto.length>1000000) throw new Error('Texto muito extenso. Divida o PDF em arquivos menores.');
    if(!texto.trim()) avisos.push('Não foi encontrado texto legível. O arquivo está disponível para revisão manual.');
    if(usouOcr) avisos.push('Texto obtido por OCR. Confira números, datas e valores com o PDF.');
    process.send({ok:true,texto,avisos,metodo:usouOcr?'ocr':'texto',paginas:paginas.length});
  } catch(erro) {process.send({ok:false,erro: /password/i.test(erro.message)?'PDF protegido por senha. Envie uma cópia desbloqueada.': 'Falha na leitura do PDF: '+erro.message});}
  finally {if(ocr) await ocr.terminate().catch(()=>{});if(parser) await parser.destroy().catch(()=>{});process.disconnect();}
});
