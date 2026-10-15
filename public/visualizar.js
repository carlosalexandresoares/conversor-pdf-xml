// Previa local do PDF original na janela de revisao.
import {getDocument,GlobalWorkerOptions} from '/vendor/pdfjs/build/pdf.mjs';
GlobalWorkerOptions.workerSrc='/vendor/pdfjs/build/pdf.worker.mjs';
const estado=document.querySelector('#estado');
let destaquePendente=null;
function destacar(pagina,area){
 if(!Number.isInteger(pagina)||pagina<1||!area||![area.x,area.y,area.w,area.h].every(n=>Number.isFinite(n)&&n>=0&&n<=1))return;
 const alvo=[...document.querySelectorAll('.pdf-page')].find(i=>Number(i.dataset.pagina)===pagina);
 if(!alvo){destaquePendente={pagina,area};return;}
 document.querySelectorAll('.pdf-highlight').forEach(i=>i.remove());
 const marca=document.createElement('div');marca.className='pdf-highlight';
 marca.style.left=`${area.x*100}%`;marca.style.top=`${area.y*100}%`;
 marca.style.width=`${Math.max(area.w*100,1)}%`;marca.style.height=`${Math.max(area.h*100,1)}%`;
 alvo.append(marca);alvo.scrollIntoView({behavior:'smooth',block:'center'});
 destaquePendente=null;
}
window.addEventListener('message',evento=>{
 if(evento.origin!==location.origin||evento.source!==parent||evento.data?.tipo!=='destacar-origem')return;
 destacar(evento.data.pagina,evento.data.area);
});
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
  const container=document.createElement('div');container.className='pdf-page';container.dataset.pagina=String(i);
  container.style.maxWidth=`${canvas.width}px`;container.append(canvas);document.querySelector('#paginas').append(container);
  await pagina.render({canvasContext:canvas.getContext('2d'),viewport:tamanho}).promise;
  pagina.cleanup();
  if(destaquePendente?.pagina===i)destacar(i,destaquePendente.area);
 }
 estado.textContent=`${pdf.numPages} página(s) • Documento original`;
}catch(erro){estado.textContent='Não foi possível exibir a prévia. Use “Abrir PDF” para consultar o original. '+erro.message;}
