// Modelo intermediário comum a texto nativo e OCR: cada trecho mantém página e caixa.
const numero=v=>Number.isFinite(Number(v))?Number(v):0;

function paginaNativa({items=[],viewport},indice){
  const fragmentos=items.filter(i=>i.str?.trim()).map(i=>{
    const p=viewport?viewport.convertToViewportPoint(i.transform[4],i.transform[5]):[i.transform[4],-i.transform[5]];
    return {s:i.str.trim(),x:p[0],y:p[1],w:i.width||i.str.length*5,h:Math.max(6,Math.abs(i.height||i.transform[0]||10)),fonte:'pdf'};
  });
  return {
    numero:indice+1,fonte:'pdf',fragmentos,
    largura:viewport?.width||Math.max(1,...fragmentos.map(i=>i.x+i.w)),
    altura:viewport?.height||Math.max(1,...fragmentos.map(i=>i.y+i.h)),
  };
}

function paginaOcr(dados,{width,height,scale},indice,dimensoes){
  const largura=dimensoes?.largura||width/scale;
  const altura=dimensoes?.altura||height/scale;
  const fragmentos=[];
  for(const bloco of dados.blocks||[]){
    for(const paragrafo of bloco.paragraphs||[]){
      for(const linha of paragrafo.lines||[]){
        for(const palavra of linha.words||[]){
          const b=palavra.bbox,s=palavra.text?.trim();
          if(!b||!s)continue;
          fragmentos.push({s,x:numero(b.x0)*largura/width,y:numero(b.y1)*altura/height,
            w:(numero(b.x1)-numero(b.x0))*largura/width,
            h:Math.max(6,(numero(b.y1)-numero(b.y0))*altura/height),fonte:'ocr'});
        }
      }
    }
  }
  return {numero:indice+1,fonte:'ocr',fragmentos,largura,altura};
}

function organizarPagina(pagina,indice){
  const p=pagina.fragmentos?pagina:paginaNativa(pagina,indice);
  const fragmentos=p.fragmentos.filter(i=>i.s?.trim()&&[i.x,i.y,i.w,i.h].every(Number.isFinite))
    .sort((a,b)=>a.y-b.y||a.x-b.x);
  const linhas=[];
  for(const item of fragmentos){
    let linha=linhas.find(l=>Math.abs(l.y-item.y)<=2);
    if(!linha){linha={y:item.y,fragmentos:[]};linhas.push(linha);}
    linha.fragmentos.push(item);
  }
  return {...p,fragmentos,linhas};
}

function organizarDocumento(paginas){return {versao:1,paginas:paginas.map(organizarPagina)};}

function areaTrechos(itens,pagina){
  if(!itens.length||!pagina?.largura||!pagina?.altura)return null;
  const x=Math.max(0,Math.min(...itens.map(i=>i.x))-2);
  const y=Math.max(0,Math.min(...itens.map(i=>i.y-i.h))-2);
  const direita=Math.min(pagina.largura,Math.max(...itens.map(i=>i.x+i.w))+2);
  const baixo=Math.min(pagina.altura,Math.max(...itens.map(i=>i.y+i.h*0.25))+2);
  return {x:x/pagina.largura,y:y/pagina.altura,w:Math.max(0,direita-x)/pagina.largura,h:Math.max(0,baixo-y)/pagina.altura};
}

module.exports={paginaNativa,paginaOcr,organizarDocumento,areaTrechos};
