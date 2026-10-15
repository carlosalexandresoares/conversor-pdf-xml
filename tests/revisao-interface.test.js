const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');

test('Revisão aberta durante a leitura recebe campos automaticamente e permite salvar',async()=>{
  class Elemento {
    constructor(){this.children=[];this.value='';this.textContent='';this.open=false;this.classList={add(){},remove(){},toggle(){}};}
    addEventListener(tipo,fn){this.listeners??={};this.listeners[tipo]=fn;} setAttribute(){} removeAttribute(){}
    append(...itens){for(const item of itens)item.parentElement=this;this.children.push(...itens);}
    replaceChildren(...itens){this.children=itens;}
    showModal(){this.open=true;}
    closest(){return this.parentElement;}
    remove(){if(this.parentElement)this.parentElement.children=this.parentElement.children.filter(c=>c!==this);}
    querySelectorAll(selector){return this.children.flatMap(c=>[
      ...(selector==='.field-source,.source-link'?(/\b(?:field-source|source-link)\b/.test(c.className||'')?[c]:[]):c.name?[c]:[]),
      ...c.querySelectorAll(selector)
    ]);}
  }
  const elementos=new Map();
  const obter=s=>{if(!elementos.has(s))elementos.set(s,new Elemento());return elementos.get(s);};
  let pronto=false;
  const contexto=vm.createContext({
    document:{querySelector:obter,createElement:()=>new Elemento(),hidden:false},
    window:{addEventListener(){}},Intl,AbortController,setTimeout,clearTimeout,setInterval(){},
    fetch:async url=>({ok:true,json:async()=>{
      const processamento=pronto?'pronto':'processando';
      if(url==='/campos.json')return [['numero_nota','Número da nota'],['valor_servicos_centavos','Serviços']];
      if(url.endsWith('/sugestoes-texto'))return {dados:{numero_nota:'999',valor_servicos_centavos:268238,avisos:[]}};
      if(url==='/api/documentos')return [{id:1,nome_arquivo:'nota.pdf',processamento,avisos:[]}];
      return {id:1,nome_arquivo:'nota.pdf',texto_extraido:pronto?'Numero da Nota 765':'',processamento,dados:pronto?{numero_nota:'765',origens:{numero_nota:{metodo:'rotulo'}}}:{},versao:pronto?'nova':'antiga'};
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
  vm.runInContext("trocarAba('json')",contexto);
  assert.equal(JSON.parse(obter('#dados-estruturados').textContent).nota.numero_nota.valor,'765');
  await obter('#preencher-texto').listeners.click();
  assert.equal(obter('#campos-revisao').querySelectorAll()[0].value,'999');
  assert.equal(obter('#campos-revisao').querySelectorAll()[1].value,'2682,38');
  assert.equal(vm.runInContext('alterado',contexto),true);
  assert.equal(vm.runInContext('revisao.versao',contexto),'nova');
  assert.equal(JSON.parse(obter('#dados-estruturados').textContent).nota.numero_nota.valor,'999');
});
