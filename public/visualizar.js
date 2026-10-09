import {getDocument,GlobalWorkerOptions} from '/vendor/pdfjs/build/pdf.mjs';
GlobalWorkerOptions.workerSrc='/vendor/pdfjs/build/pdf.worker.mjs';
const estado=document.querySelector('#estado');
try{
 const id=Number(new URLSearchParams(location.search).get('id'));
 if(!Number.isSafeInteger(id)||id<1)throw Error('Documento inválido.');
 const pdf=await getDocument({url:`/api/documentos/${id}/pdf`,cMapUrl:'/vendor/pdfjs/cmaps/',cMapPacked:true,standardFontDataUrl:'/vendor/pdfjs/standard_fonts/',wasmUrl:'/vendor/pdfjs/wasm/'}).promise;
 if(pdf.numPages>50)throw Error('PDF com mais de 50 páginas. Use “Abrir PDF” para consultar o arquivo completo.');
 for(let i=1;i<=pdf.numPages;i++){
  estado.textContent=`Carregando página ${i} de ${pdf.numPages}…`;
  const pagina=await pdf.getPage(i),viewport=pagina.getViewport({scale:1});
  const escala=Math.min(1.5,1500/viewport.width,2200/viewport.height);
  const tamanho=pagina.getViewport({scale:escala}),canvas=document.createElement('canvas');
  canvas.width=Math.ceil(tamanho.width);canvas.height=Math.ceil(tamanho.height);canvas.setAttribute('aria-label',`Página ${i} do PDF original`);canvas.setAttribute('role','img');
  document.querySelector('#paginas').append(canvas);
  await pagina.render({canvasContext:canvas.getContext('2d'),viewport:tamanho}).promise;
  pagina.cleanup();
 }
 estado.textContent=`${pdf.numPages} página(s) • Documento original`;
}catch(erro){estado.textContent='Não foi possível exibir a prévia. Use “Abrir PDF” para consultar o original. '+erro.message;}
