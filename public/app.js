'use strict';
const $=s=>document.querySelector(s);
let documentos=[],selecionados=new Set(),pagina=1,arquivos=[],enviando=false,baixando=false,revisao=null,alterado=false,salvando=false,carregando=false;
let definicoes=[];
let excluindo=false;
const tamanhoPagina=25;
const formatoMoeda=new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'});
const dataCurta=v=>{const d=new Date(v);return Number.isNaN(d.getTime())?'':d.toLocaleDateString('pt-BR');};
function notificar(texto,erro=false){const el=$('#mensagem');el.textContent=texto;el.hidden=!texto;el.classList.toggle('error',erro);}
function el(tag,classe,texto){const n=document.createElement(tag);if(classe)n.className=classe;if(texto!=null)n.textContent=texto;return n;}
async function requisicao(url,opcoes={}){
  const controlador=new AbortController();const timer=setTimeout(()=>controlador.abort(),60000);
  try {
    const resposta=await fetch(url,{...opcoes,signal:controlador.signal});
    if(!resposta.ok){let erro;try{erro=await resposta.json()}catch{}throw new Error(erro?.erro||`O servidor retornou HTTP ${resposta.status}. Atualize a página.`);}
    return resposta;
  }catch(erro){
    if(erro.name==='AbortError')throw new Error('O servidor demorou para responder. Verifique a lista antes de reenviar o arquivo.');
    if(erro instanceof TypeError)throw new Error('Sem conexão com o servidor. Confira se o terminal com “npm start” continua aberto e use o endereço http://localhost:3000 neste computador.');
    throw erro;
  }finally{clearTimeout(timer);}
}
async function json(url,opcoes){const r=await requisicao(url,opcoes);try{return await r.json()}catch{throw new Error('Resposta inesperada do servidor. Atualize com Ctrl+F5.');}}
function status(doc){
  if(doc.processamento==='fila')return ['Na fila','blue'];
  if(doc.processamento==='processando')return ['Lendo PDF','blue'];
  if(doc.processamento==='erro')return ['Falha na leitura','red'];
  if(doc.revisado_em)return ['Revisão salva','green'];
  return ['Para revisar',''];
}
function filtrados(){
  const termo=$('#busca').value.trim().toLocaleLowerCase('pt-BR');const filtro=$('#filtro').value;
  return documentos.filter(d=>{
    if(termo&&![d.nome_arquivo,d.numero_nota,d.nome_prestador,d.nome_tomador].some(v=>String(v||'').toLocaleLowerCase('pt-BR').includes(termo)))return false;
    if(filtro==='revisados')return !!d.revisado_em;
    if(filtro==='pendentes')return !d.revisado_em&&!['fila','processando'].includes(d.processamento);
    if(filtro==='fila')return ['fila','processando'].includes(d.processamento);
    if(filtro==='erro')return d.processamento==='erro';
    return true;
  });
}
function atualizarAcoes(){
  const n=selecionados.size;
  $('#revisar-selecionado').disabled=n!==1||baixando||excluindo;
  $('#baixar-selecionado').disabled=!n||baixando||excluindo;
  const emLeitura=documentos.some(d=>selecionados.has(d.id)&&['fila','processando'].includes(d.processamento));
  $('#excluir-selecionado').disabled=!n||baixando||excluindo||emLeitura;
  $('#excluir-selecionado').textContent=excluindo?'Excluindo…':n>1?`Excluir (${n})`:'Excluir';
  $('#excluir-selecionado').title=emLeitura?'Aguarde a leitura dos documentos selecionados terminar.':'';
  $('#baixar-selecionado').textContent=baixando?'Preparando…':n>1?`Baixar XMLs (${n})`:'Baixar XML';
  $('#selecao-info').textContent=n?`${n} documento${n>1?'s':''} selecionado${n>1?'s':''}${n>1?' • Download em ZIP. Selecione apenas um para revisar.':''}`:'Selecione documentos para começar.';
  const ids=filtrados().slice((pagina-1)*tamanhoPagina,pagina*tamanhoPagina).map(d=>d.id);
  const selecionadosNaPagina=ids.filter(id=>selecionados.has(id)).length;
  $('#selecionar-todos').checked=ids.length>0&&selecionadosNaPagina===ids.length;
  $('#selecionar-todos').indeterminate=selecionadosNaPagina>0&&selecionadosNaPagina<ids.length;
  $('#selecionar-todos').disabled=!ids.length;
}
function renderizar(){
  $('#total').textContent=$('#nav-total').textContent=documentos.length;
  $('#em-fila').textContent=documentos.filter(d=>['fila','processando'].includes(d.processamento)).length;
  $('#a-revisar').textContent=documentos.filter(d=>!d.revisado_em&&!['fila','processando'].includes(d.processamento)).length;
  $('#revisados').textContent=documentos.filter(d=>d.revisado_em).length;
  const lista=filtrados(),paginas=Math.max(1,Math.ceil(lista.length/tamanhoPagina));pagina=Math.min(pagina,paginas);
  const tbody=$('#documentos');tbody.replaceChildren();
  for(const doc of lista.slice((pagina-1)*tamanhoPagina,pagina*tamanhoPagina)){
    const linha=el('tr',selecionados.has(doc.id)?'selected':'');
    const check=el('input');check.type='checkbox';check.checked=selecionados.has(doc.id);check.setAttribute('aria-label',`Selecionar ${doc.nome_arquivo}`);
    check.addEventListener('change',()=>{if(check.checked)selecionados.add(doc.id);else selecionados.delete(doc.id);linha.classList.toggle('selected',check.checked);atualizarAcoes();});
    linha.addEventListener('click',evento=>{if(evento.target!==check){check.checked=!check.checked;check.dispatchEvent(new Event('change'));}});
    const celulaCheck=el('td','check-col');celulaCheck.append(check);
    const nome=el('td'),wrap=el('div','doc-cell'),detalhes=el('div');
    const titulo=el('div','doc-name',doc.nome_arquivo);titulo.title=doc.nome_arquivo;
    detalhes.append(titulo,el('div','doc-sub',`#${doc.id} • ${dataCurta(doc.criado_em)}${doc.numero_nota?' • Nota '+doc.numero_nota:''}`));
    wrap.append(el('span','file-icon','PDF'),detalhes);nome.append(wrap);
    const empresa=el('td');const nomeEmpresa=el('div','company',doc.nome_prestador||'Não identificado');nomeEmpresa.title=doc.nome_prestador||'';empresa.append(nomeEmpresa);
    const valor=el('td','money',doc.valor_servicos_centavos==null?'—':formatoMoeda.format(doc.valor_servicos_centavos/100));
    const situacao=el('td');const [rotulo,cor]=status(doc);const badge=el('span','badge '+cor,rotulo);badge.title=doc.erro_processamento||doc.avisos.join('\n');situacao.append(badge);
    linha.append(celulaCheck,nome,empresa,valor,situacao);tbody.append(linha);
  }
  $('#vazio').hidden=lista.length!==0;
  $('#contagem').textContent=lista.length?`${(pagina-1)*tamanhoPagina+1}–${Math.min(pagina*tamanhoPagina,lista.length)} de ${lista.length} documentos`:'Nenhum documento';
  $('#pagina').textContent=`${pagina} / ${paginas}`;$('#anterior').disabled=pagina===1;$('#proxima').disabled=pagina===paginas;
  atualizarAcoes();
}
async function carregar(){
  if(carregando)return;carregando=true;
  try{
    const novos=await json('/api/documentos');const mudou=JSON.stringify(novos)!==JSON.stringify(documentos);
    documentos=novos;selecionados=new Set([...selecionados].filter(id=>documentos.some(d=>d.id===id)));
    if(mudou||!$('#contagem').textContent)renderizar();$('#conexao').textContent='● Servidor conectado';$('#conexao').classList.remove('offline');
    if(revisao && ['fila','processando'].includes(revisao.processamento) && !alterado && !salvando){
      const atual=documentos.find(d=>d.id===revisao.id);
      if(atual && !['fila','processando'].includes(atual.processamento))await abrirRevisao(atual.id,true);
    }
  }catch(erro){$('#conexao').textContent='● Sem conexão';$('#conexao').classList.add('offline');notificar(erro.message,true);}
  finally{carregando=false;}
}
for(const id of ['#busca','#filtro'])$(id).addEventListener('input',()=>{pagina=1;renderizar();});
$('#anterior').addEventListener('click',()=>{pagina--;renderizar();});$('#proxima').addEventListener('click',()=>{pagina++;renderizar();});
$('#selecionar-todos').addEventListener('change',()=>{const marcar=$('#selecionar-todos').checked;for(const d of filtrados().slice((pagina-1)*tamanhoPagina,pagina*tamanhoPagina))marcar?selecionados.add(d.id):selecionados.delete(d.id);renderizar();});
function escolherArquivos(itens){
  if(enviando)return;
  if(itens.length>50){notificar('Selecione até 50 PDFs por lote.',true);return;}
  arquivos=[...itens];$('#arquivos-escolhidos').textContent=`${arquivos.length} arquivo${arquivos.length!==1?'s':''} selecionado${arquivos.length!==1?'s':''}`;$('#upload-actions').hidden=!arquivos.length;
  $('#fila-envio').replaceChildren();
}
$('#pdf').addEventListener('change',()=>escolherArquivos($('#pdf').files));
const drop=$('#dropzone');
for(const tipo of ['dragenter','dragover'])drop.addEventListener(tipo,e=>{e.preventDefault();drop.classList.add('dragging');});
for(const tipo of ['dragleave','drop'])drop.addEventListener(tipo,e=>{e.preventDefault();drop.classList.remove('dragging');});
drop.addEventListener('drop',e=>escolherArquivos(e.dataTransfer.files));
$('#form-upload').addEventListener('submit',async e=>{
  e.preventDefault();if(enviando||!arquivos.length)return;
  enviando=true;$('#enviar').disabled=true;$('#pdf').disabled=true;$('#fila-envio').replaceChildren();
  const lote=[...arquivos];let salvos=0,duplicados=0,falhas=0;
  for(let i=0;i<lote.length;i++){
    const arquivo=lote[i],linha=el('li'),nome=el('span','',arquivo.name),resultado=el('span','','Enviando…');linha.append(nome,resultado);$('#fila-envio').append(linha);
    $('#enviar').textContent=`Enviando ${i+1}/${lote.length}`;
    try{
      if(!/\.pdf$/i.test(arquivo.name))throw new Error('Formato inválido: selecione um PDF.');
      if(arquivo.size>20*1024*1024)throw new Error('O PDF excede 20 MB.');
      const dados=new FormData();dados.append('pdf',arquivo);
      const r=await json('/api/documentos/upload',{method:'POST',body:dados});
      if(r.duplicado){duplicados++;resultado.textContent=`Já cadastrado • #${r.id}`;}else{salvos++;resultado.textContent='Salvo • leitura na fila';}
      resultado.className='success';selecionados.add(r.id);
    }catch(erro){falhas++;resultado.textContent=erro.message;resultado.className='error';}
    await carregar();renderizar();
  }
  enviando=false;$('#enviar').disabled=false;$('#enviar').textContent='Importar arquivos';$('#pdf').disabled=false;$('#pdf').value='';arquivos=[];$('#upload-actions').hidden=true;
  notificar(`Lote concluído: ${salvos} novo(s), ${duplicados} já cadastrado(s), ${falhas} falha(s). A leitura continua no servidor.`,falhas>0);
});
$('#excluir-selecionado').addEventListener('click',async()=>{
  if(excluindo||baixando||!selecionados.size)return;
  const ids=[...selecionados];
  const nomes=documentos.filter(d=>selecionados.has(d.id)).map(d=>d.nome_arquivo);
  if(!confirm(`Excluir permanentemente ${ids.length} documento(s)?\n\n${nomes.slice(0,5).join('\n')}${nomes.length>5?'\n…':''}\n\nOs PDFs armazenados e os dados de revisão serão removidos. Esta ação não pode ser desfeita.`))return;
  excluindo=true;atualizarAcoes();let removidos=0;const falhas=[];
  try {
    for(const id of ids){
      try {await json(`/api/documentos/${id}`,{method:'DELETE'});selecionados.delete(id);removidos++;}
      catch(erro){falhas.push(`#${id}: ${erro.message}`);}
    }
    await carregar();
    notificar(`${removidos} documento(s) excluído(s).${falhas.length?'\n'+falhas.join('\n'):''}`,falhas.length>0);
  } finally {excluindo=false;atualizarAcoes();}
});
async function salvarDownload(resposta,nome){
  const blob=await resposta.blob();const url=URL.createObjectURL(blob);const a=el('a');a.href=url;a.download=nome;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);
}
$('#baixar-selecionado').addEventListener('click',async()=>{
  if(baixando||!selecionados.size)return;const ids=[...selecionados];
  if(ids.length>100){notificar('Baixe até 100 XMLs por lote.',true);return;}
  baixando=true;atualizarAcoes();
  try{
    if(ids.length===1)await salvarDownload(await requisicao(`/api/documentos/${ids[0]}/xml`),`documento-${ids[0]}-abrasf.xml`);
    else await salvarDownload(await requisicao('/api/documentos/xml-lote',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({ids})}),'xml-selecionados.zip');
    notificar(ids.length===1?'XML baixado com os dados disponíveis. Confira o documento antes da importação fiscal.':'ZIP baixado. Consulte também o relatório de exportação incluído no arquivo.');
  }catch(erro){notificar(erro.message,true);}finally{baixando=false;atualizarAcoes();}
});
function grupo(campo){
  if(campo.startsWith('prestador_')||campo.endsWith('_prestador'))return 'Prestador';
  if(campo.startsWith('tomador_')||campo.endsWith('_tomador'))return 'Tomador';
  if(campo.startsWith('rps_'))return 'RPS';
  if(campo.endsWith('_xml'))return 'Campos adicionais do XML';
  if(campo.includes('_centavos')||campo==='aliquota_percentual'||campo==='iss_retido')return 'Valores e tributos';
  if(campo.includes('servico')||campo.includes('municipio')||campo.startsWith('uf_'))return 'Serviço e municípios';
  return 'Identificação da nota';
}
function renderizarCampos(dados){
  const area=$('#campos-revisao');area.replaceChildren();const grupos=new Map();
  for(const [campo,titulo] of definicoes){
    const nomeGrupo=grupo(campo);
    if(!grupos.has(nomeGrupo)){const detalhe=el('details','field-group');detalhe.open=['Identificação da nota','Valores e tributos'].includes(nomeGrupo);detalhe.append(el('summary','',nomeGrupo));const grid=el('div','fields-grid');detalhe.append(grid);area.append(detalhe);grupos.set(nomeGrupo,grid);}
    const longo=['descricao_servico','discriminacao_servicos'].includes(campo),label=el('label','field'+(longo?' full':''));label.append(el('span','',titulo));
    const opcoes=campo==='iss_retido'?[['','Não informado'],['sim','Sim'],['nao','Não']]:campo==='incentivo_fiscal_xml'?[['','Não informado'],['1','1 — Sim'],['2','2 — Não']]:null;
    const input=el(opcoes?'select':longo?'textarea':'input');
    if(opcoes)for(const [value,texto] of opcoes){const option=el('option','',texto);option.value=value;input.append(option);}
    else if(longo){input.rows=4;input.maxLength=10000;}
    else{input.type='text';input.maxLength=300;}
    input.name=campo;
    const valor=dados[campo];input.value=valor==null?'':campo.endsWith('_centavos')?(valor/100).toFixed(2).replace('.',','):String(valor);
    if(campo.endsWith('_centavos')||campo==='aliquota_percentual')input.inputMode='decimal';
    label.append(input);
    const origem=dados.origens?.[campo];if(origem){const fonte=el('small','',`Origem: ${origem.metodo}${origem.pagina?' • página '+origem.pagina:''}`);fonte.title=origem.trecho||'';label.append(fonte);}
    grupos.get(nomeGrupo).append(label);
  }
}
async function abrirRevisao(id,atualizacao=false){
  if(!definicoes.length)definicoes=await json('/campos.json');
  const resultado=await json(`/api/documentos/${id}/revisao`);
  if(atualizacao && (!revisao || revisao.id!==id || alterado || !$('#revisao-dialog').open))return;
  revisao=resultado;alterado=false;
  $('#titulo-revisao').textContent=resultado.nome_arquivo;
  $('#preview-pdf').src=`/visualizar.html?id=${id}`;
  $('#abrir-pdf').href=`/api/documentos/${id}/pdf`;
  $('#texto-extraido').textContent=resultado.texto_extraido||'Nenhum texto extraído. Você pode preencher os campos manualmente usando o PDF original.';
  const avisos=[...(resultado.dados.avisos||[])];
  if(resultado.erro_processamento)avisos.unshift(resultado.erro_processamento);
  const processando=['fila','processando'].includes(resultado.processamento);
  if(processando)avisos.unshift('A leitura está em andamento. Os campos serão preenchidos automaticamente quando terminar.');
  $('#aviso-revisao').textContent=avisos.join('\n');$('#aviso-revisao').hidden=!avisos.length;
  $('#salvar-revisao').disabled=['fila','processando'].includes(resultado.processamento);
  $('#tentar-leitura').hidden=processando||!!resultado.dados.revisado_em;
  $('#mensagem-revisao').textContent='';renderizarCampos(resultado.dados);trocarAba(false);
  for(const campo of $('#campos-revisao').querySelectorAll('input,select,textarea'))campo.disabled=processando;
  if(!$('#revisao-dialog').open)$('#revisao-dialog').showModal();
}
$('#revisar-selecionado').addEventListener('click',async()=>{
  if(selecionados.size!==1)return;$('#revisar-selecionado').disabled=true;
  try{await abrirRevisao([...selecionados][0]);}catch(erro){notificar(erro.message,true);}finally{atualizarAcoes();}
});
function fechar(){
  if(salvando)return;
  if(alterado&&!confirm('Há alterações não salvas. Fechar a revisão e descartar essas alterações?'))return;
  $('#revisao-dialog').close();$('#preview-pdf').removeAttribute('src');revisao=null;alterado=false;
}
$('#fechar-revisao').addEventListener('click',fechar);
$('#revisao-dialog').addEventListener('cancel',e=>{e.preventDefault();fechar();});
$('#form-revisao').addEventListener('input',()=>{alterado=true;});
window.addEventListener('beforeunload',e=>{if(alterado||enviando){e.preventDefault();e.returnValue='';}});
function trocarAba(texto){$('#tab-campos').setAttribute('aria-selected',String(!texto));$('#tab-texto').setAttribute('aria-selected',String(texto));$('#form-revisao').hidden=texto;$('#texto-extraido').hidden=!texto;}
$('#tab-campos').addEventListener('click',()=>trocarAba(false));$('#tab-texto').addEventListener('click',()=>trocarAba(true));
for(const seletor of ['#tab-campos','#tab-texto'])$(seletor).addEventListener('keydown',e=>{if(['ArrowLeft','ArrowRight'].includes(e.key)){e.preventDefault();const texto=seletor==='#tab-campos';trocarAba(texto);$(texto?'#tab-texto':'#tab-campos').focus();}});
$('#form-revisao').addEventListener('submit',async e=>{
  e.preventDefault();if(!revisao||salvando)return;
  salvando=true;$('#salvar-revisao').disabled=true;$('#mensagem-revisao').textContent='Salvando…';
  try{
    const campos=Object.fromEntries(new FormData(e.currentTarget));
    const r=await json(`/api/documentos/${revisao.id}/revisao`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({campos,versao:revisao.versao})});
    revisao.versao=r.versao;alterado=false;$('#mensagem-revisao').textContent=r.mensagem;$('#tentar-leitura').hidden=true;await carregar();
  }catch(erro){$('#mensagem-revisao').textContent=erro.message;}finally{salvando=false;$('#salvar-revisao').disabled=false;}
});
$('#tentar-leitura').addEventListener('click',async()=>{
  if(!revisao||alterado){$('#mensagem-revisao').textContent='Salve ou descarte suas alterações antes de tentar novamente.';return;}
  try{await json(`/api/documentos/${revisao.id}/processar`,{method:'POST'});fechar();await carregar();notificar('Documento adicionado à fila de leitura.');}catch(erro){$('#mensagem-revisao').textContent=erro.message;}
});
carregar();setInterval(()=>{if(!document.hidden)carregar();},2500);
