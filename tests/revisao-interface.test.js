const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');

test('Revisão aberta durante a leitura recebe campos automaticamente e permite salvar',async()=>{
  class Elemento {
    constructor(){this.children=[];this.value='';this.textContent='';this.open=false;this.classList={add(){},remove(){},toggle(){}};}
    addEventListener(){} setAttribute(){} removeAttribute(){}
    append(...itens){this.children.push(...itens);}
    replaceChildren(...itens){this.children=itens;}
    showModal(){this.open=true;}
    querySelectorAll(){return this.children.flatMap(c=>[...(c.name?[c]:[]),...c.querySelectorAll()]);}
  }
  const elementos=new Map();
  const obter=s=>{if(!elementos.has(s))elementos.set(s,new Elemento());return elementos.get(s);};
  let pronto=false;
  const contexto=vm.createContext({
    document:{querySelector:obter,createElement:()=>new Elemento(),hidden:false},
    window:{addEventListener(){}},Intl,AbortController,setTimeout,clearTimeout,setInterval(){},
    fetch:async url=>({ok:true,json:async()=>{
      const processamento=pronto?'pronto':'processando';
      if(url==='/campos.json')return [['numero_nota','Número da nota']];
      if(url==='/api/documentos')return [{id:1,nome_arquivo:'nota.pdf',processamento,avisos:[]}];
      return {id:1,nome_arquivo:'nota.pdf',processamento,dados:pronto?{numero_nota:'765'}:{},versao:pronto?'nova':'antiga'};
    }})
  });
  vm.runInContext(fs.readFileSync(path.join(__dirname,'../public/app.js'),'utf8'),contexto);
  await new Promise(r=>setImmediate(r));
  await vm.runInContext('abrirRevisao(1)',contexto);
  assert.equal(obter('#salvar-revisao').disabled,true);
  assert.equal(obter('#campos-revisao').querySelectorAll()[0].disabled,true);
  pronto=true;
  await vm.runInContext('carregar()',contexto);
  assert.equal(obter('#campos-revisao').querySelectorAll()[0].value,'765');
  assert.equal(obter('#campos-revisao').querySelectorAll()[0].disabled,false);
  assert.equal(obter('#salvar-revisao').disabled,false);
  assert.equal(vm.runInContext('revisao.versao',contexto),'nova');
});
