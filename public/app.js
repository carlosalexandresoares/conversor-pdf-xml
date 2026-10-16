'use strict';
// Interface principal: estado da biblioteca, envio, revisão e exportação.
// Os IDs consultados aqui são definidos em index.html; os campos vêm de campos.json.
// A revisão só é persistida quando o usuário aciona Salvar revisão.

// Estado compartilhado pela tela e utilitários de requisição/renderização.
const $=s=>document.querySelector(s);
let documentos=[],selecionados=new Set(),pagina=1,arquivos=[],enviando=false,baixando=false,revisao=null,alterado=false,salvando=false,carregando=false;
let definicoes=[];
let excluindo=false;
let recarregarDepois=false;
let listagem={total:0,paginas:1,resumo:{total:0,fila:0,pendentes:0,revisados:0}};
const tamanhoPagina=25;
const formatoMoeda=new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'});
const dataCurta=v=>{const d=new Date(v);return Number.isNaN(d.getTime())?'':d.toLocaleDateString('pt-BR');};
function notificar(texto,erro=false){const el=$('#mensagem');el.textContent=texto;el.hidden=!texto;el.classList.toggle('error',erro);}
function el(tag,classe,texto){const n=document.createElement(tag);if(classe)n.className=classe;if(texto!=null)n.textContent=texto;return n;}
async function requisicao(url,opcoes={}){
  const controlador=new AbortController();const timer=setTimeout(()=>controlador.abort(),60000);
  try {
    const resposta=await fetch(url,{...opcoes,signal:controlador.signal});
    if(!resposta.ok){let erro;try{erro=await resposta.json()}catch{}throw new Error([erro?.erro||`O servidor retornou HTTP ${resposta.status}. Atualize a página.`,...(erro?.pendencias||[])].join('\n'));}
    return resposta;
  }catch(erro){
    if(erro.name==='AbortError')throw new Error('O servidor demorou para responder. Verifique a lista antes de reenviar o arquivo.');
    if(erro instanceof TypeError)throw new Error('Sem conexão com o servidor. Confira se o terminal com “npm start” continua aberto e use o endereço http://localhost:3000 neste computador.');
    throw erro;
  }finally{clearTimeout(timer);}
}
async function json(url,opcoes){const r=await requisicao(url,opcoes);try{return await r.json()}catch{throw new Error('Resposta inesperada do servidor. Atualize com Ctrl+F5.');}}
function status(doc){
  if(doc.excluido_em)return ['Na lixeira',''];
  if(doc.processamento==='fila')return ['Na fila','blue'];
  if(doc.processamento==='processando')return ['Lendo PDF','blue'];
  if(doc.status==='conferido'&&doc.aprovado_em)return ['Aprovado','green'];
  if(doc.concluido_manual_em)return ['Conferência manual concluída','green'];
  if(doc.processamento==='erro')return ['Falha na leitura','red'];
  if(doc.revisado_em)return ['Revisão salva','green'];
  return ['Para revisar',''];
}
// Biblioteca: filtros, seleção, paginação e atualização periódica dos documentos.
function filtrados(){
  return documentos;
}
function atualizarAcoes(){
  const n=selecionados.size;
  const lixeira=$('#filtro').value==='lixeira';
  $('#revisar-selecionado').disabled=n!==1||baixando||excluindo||lixeira;
  $('#baixar-selecionado').disabled=!n||baixando||excluindo||lixeira;
  const emLeitura=documentos.some(d=>selecionados.has(d.id)&&['fila','processando'].includes(d.processamento));
  $('#excluir-selecionado').disabled=!n||baixando||excluindo||emLeitura;
  $('#excluir-selecionado').textContent=excluindo?(lixeira?'Restaurando…':'Movendo…'):lixeira?(n>1?`Restaurar (${n})`:'Restaurar'):(n>1?`Excluir (${n})`:'Excluir');
  $('#excluir-selecionado').title=emLeitura?'Aguarde a leitura dos documentos selecionados terminar.':'';
  $('#baixar-selecionado').textContent=baixando?'Preparando…':n>1?`Baixar XMLs (${n})`:'Baixar XML';
  $('#selecao-info').textContent=n?`${n} documento${n>1?'s':''} selecionado${n>1?'s':''}${n>1?' • Download em ZIP. Selecione apenas um para revisar.':''}`:'Selecione documentos para começar.';
  const ids=filtrados().map(d=>d.id);
  const selecionadosNaPagina=ids.filter(id=>selecionados.has(id)).length;
  $('#selecionar-todos').checked=ids.length>0&&selecionadosNaPagina===ids.length;
  $('#selecionar-todos').indeterminate=selecionadosNaPagina>0&&selecionadosNaPagina<ids.length;
  $('#selecionar-todos').disabled=!ids.length;
}
function renderizar(){
  $('#total').textContent=$('#nav-total').textContent=listagem.resumo.total||0;
  $('#em-fila').textContent=listagem.resumo.fila||0;
  $('#a-revisar').textContent=listagem.resumo.pendentes||0;
  $('#revisados').textContent=listagem.resumo.revisados||0;
  const lista=filtrados(),paginas=listagem.paginas;pagina=Math.min(pagina,paginas);
  const tbody=$('#documentos');tbody.replaceChildren();
  for(const doc of lista){
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
  $('#vazio').hidden=listagem.total!==0;
  $('#contagem').textContent=listagem.total?`${(pagina-1)*tamanhoPagina+1}–${Math.min(pagina*tamanhoPagina,listagem.total)} de ${listagem.total} documentos`:'Nenhum documento';
  $('#pagina').textContent=`${pagina} / ${paginas}`;$('#anterior').disabled=pagina===1;$('#proxima').disabled=pagina===paginas;
  atualizarAcoes();
}
async function carregar(){
  if(carregando){recarregarDepois=true;return;}carregando=true;
  try{
    const busca=encodeURIComponent($('#busca').value.trim());
    const resultado=await json(`/api/documentos?pagina=${pagina}&filtro=${encodeURIComponent($('#filtro').value)}&busca=${busca}`);
    const novos=resultado.documentos;const mudou=JSON.stringify(novos)!==JSON.stringify(documentos)||JSON.stringify(resultado.resumo)!==JSON.stringify(listagem.resumo)||resultado.total!==listagem.total||resultado.pagina!==pagina;
    documentos=novos;listagem=resultado;pagina=resultado.pagina;
    if(mudou||!$('#contagem').textContent)renderizar();$('#conexao').textContent='● Servidor conectado';$('#conexao').classList.remove('offline');
    if(revisao && ['fila','processando'].includes(revisao.processamento) && !alterado && !salvando){
      const atual=documentos.find(d=>d.id===revisao.id);
      if(!atual || !['fila','processando'].includes(atual.processamento))await abrirRevisao(revisao.id,true);
    }
  }catch(erro){$('#conexao').textContent='● Sem conexão';$('#conexao').classList.add('offline');notificar(erro.message,true);}
  finally{carregando=false;if(recarregarDepois){recarregarDepois=false;carregar();}}
}
let esperaBusca;
let filtroAnterior=$('#filtro').value;
for(const id of ['#busca','#filtro'])$(id).addEventListener('input',()=>{
  if(id==='#filtro'&&($('#filtro').value==='lixeira')!==(filtroAnterior==='lixeira'))selecionados.clear();
  filtroAnterior=$('#filtro').value;pagina=1;clearTimeout(esperaBusca);esperaBusca=setTimeout(carregar,250);
});
$('#anterior').addEventListener('click',()=>{pagina--;carregar();});$('#proxima').addEventListener('click',()=>{pagina++;carregar();});
$('#selecionar-todos').addEventListener('change',()=>{const marcar=$('#selecionar-todos').checked;for(const d of filtrados())marcar?selecionados.add(d.id):selecionados.delete(d.id);renderizar();});
// Importação: escolhe arquivos, recebe arrastar/soltar e envia cada PDF do lote.
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
// Ações da biblioteca: exclusão confirmada e download individual ou em ZIP.
$('#excluir-selecionado').addEventListener('click',async()=>{
  if(excluindo||baixando||!selecionados.size)return;
  const ids=[...selecionados];
  const lixeira=$('#filtro').value==='lixeira';
  const nomes=documentos.filter(d=>selecionados.has(d.id)).map(d=>d.nome_arquivo);
  if(!lixeira&&!confirm(`Mover ${ids.length} documento(s) para a lixeira?\n\n${nomes.slice(0,5).join('\n')}${nomes.length>5?'\n…':''}\n\nVocê poderá restaurá-los pelo filtro Lixeira.`))return;
  excluindo=true;atualizarAcoes();let removidos=0;const falhas=[];let senhaExclusao;
  try {
    for(const id of ids){
      try {
        const executar=()=>json(`/api/documentos/${id}${lixeira?'/restaurar':''}`,{method:lixeira?'POST':'DELETE',headers:senhaExclusao?{'X-Delete-Password':senhaExclusao}:{}});
        try{await executar();}
        catch(erro){
          if(lixeira||!erro.message.includes('Senha de exclusão necessária'))throw erro;
          senhaExclusao=prompt('Digite a senha de exclusão configurada no servidor:');
          if(!senhaExclusao)throw new Error('Exclusão cancelada.');
          await executar();
        }
        selecionados.delete(id);removidos++;
      }
      catch(erro){falhas.push(`#${id}: ${erro.message}`);}
    }
    await carregar();
    notificar(`${removidos} documento(s) ${lixeira?'restaurado(s)':'movido(s) para a lixeira'}.${falhas.length?'\n'+falhas.join('\n'):''}`,falhas.length>0);
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
    const previa=await json('/api/documentos/preparar-exportacao',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({ids})});
    const emLeitura=previa.documentos.filter(d=>d.pendencias.some(p=>p.includes('Leitura do PDF')));
    if(emLeitura.length)throw new Error('Aguarde o processamento terminar: '+emLeitura.map(d=>d.nome_arquivo).join(', '));
    const incompletos=previa.documentos.filter(d=>!d.aprovado||d.pendencias.length);
    const aviso=previa.documentos.flatMap(d=>d.avisos.map(v=>`${d.nome_arquivo}: ${v}`));
    const rascunho=incompletos.length>0;
    if(rascunho){
      const lista=incompletos.flatMap(d=>[d.nome_arquivo,...d.pendencias.map(v=>'  • '+v)]).join('\n');
      if(!confirm(`Documentos ainda não aprovados ou com pendências:\n\n${lista.slice(0,3000)}\n\nBaixar somente como RASCUNHO para conferência?`))return;
    }else if(aviso.length&&!confirm(`Avisos antes da exportação:\n\n${aviso.slice(0,3000)}\n\nContinuar?`))return;
    if(ids.length===1)await salvarDownload(await requisicao(`/api/documentos/${ids[0]}/xml${rascunho?'?rascunho=1':''}`),`documento-${ids[0]}-abrasf${rascunho?'-RASCUNHO':''}.xml`);
    else await salvarDownload(await requisicao('/api/documentos/xml-lote',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({ids,rascunho})}),`xml-selecionados${rascunho?'-RASCUNHO':''}.zip`);
    notificar(rascunho?'Rascunho baixado. Confira e aprove os documentos antes da importação.':'XML exportado. Confira os avisos e valide o perfil no sistema de destino.');
  }catch(erro){notificar(erro.message,true);}finally{baixando=false;atualizarAcoes();}
});
// Revisão: gera o formulário a partir das definições, mostra o PDF e salva edições.
function grupo(campo){
  if(campo.startsWith('prestador_')||campo.endsWith('_prestador'))return 'Prestador';
  if(campo.startsWith('tomador_')||campo.endsWith('_tomador'))return 'Tomador';
  if(campo.startsWith('rps_'))return 'RPS';
  if(campo.endsWith('_xml'))return 'Campos adicionais do XML';
  if(campo.includes('_centavos')||campo==='aliquota_percentual'||campo==='iss_retido')return 'Valores e tributos';
  if(campo.includes('servico')||campo.includes('municipio')||campo.startsWith('uf_'))return 'Serviço e municípios';
  return 'Identificação da nota';
}
// O JSON é uma visão dos campos da revisão, com origem e valor ainda não salvo.
function atualizarDadosOrganizados(){
  if(!revisao)return;
  const nomes={'Identificação da nota':'nota','Prestador':'prestador','Tomador':'tomador','RPS':'rps',
    'Serviço e municípios':'servico','Valores e tributos':'valores_e_tributos','Campos adicionais do XML':'xml'};
  const entradas=new Map([...$('#campos-revisao').querySelectorAll('input,select,textarea')].map(i=>[i.name,i.value]));
  const documento={versao:1,arquivo:revisao.nome_arquivo,modelo:revisao.dados.modelo||null};
  for(const [campo] of definicoes){
    const secao=nomes[grupo(campo)];documento[secao]??={};
    const digitado=entradas.get(campo)??'';
    const original=revisao.dados[campo];
    const anterior=original==null?'':campo.endsWith('_centavos')?(original/100).toFixed(2).replace('.',','):String(original);
    let valor=digitado.trim()||null;
    if(valor!=null&&campo.endsWith('_centavos')&&/^\d+(?:[.,]\d{1,2})?$/.test(valor))valor=Math.round(Number(valor.replace(',','.'))*100);
    documento[secao][campo]={valor,origem:digitado!==anterior?{metodo:'edição pendente'}:revisao.dados.origens?.[campo]||null};
  }
  $('#dados-estruturados').textContent=JSON.stringify(documento,null,2);
}
function mostrarOrigemNoPdf(origem){
  if(!origem?.area||!origem.pagina)return;
  if(matchMedia('(max-width: 850px)').matches){window.open(`${$('#abrir-pdf').href}#page=${origem.pagina}`,'_blank','noopener');return;}
  $('#preview-pdf').contentWindow?.postMessage({tipo:'destacar-origem',pagina:origem.pagina,area:origem.area},location.origin);
}
function mostrarOrigemCampo(label,origem){
  label.querySelectorAll('.field-source,.source-link').forEach(i=>i.remove());
  if(!origem)return;
  const fonte=el('small','field-source',`Origem: ${origem.metodo}${origem.pagina?' • página '+origem.pagina:''}`);
  fonte.title=origem.trecho||'';label.append(fonte);
  if(origem.area){const ver=el('button','source-link','Ver no PDF');ver.type='button';
    ver.title=origem.trecho||'Mostrar trecho no documento original';
    ver.addEventListener('click',e=>{e.preventDefault();mostrarOrigemNoPdf(origem);});label.append(ver);}
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
    mostrarOrigemCampo(label,dados.origens?.[campo]);
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
  $('#salvar-revisao').disabled ||= resultado.status==='conferido';
  $('#aprovar-revisao').disabled=processando;
  $('#aprovar-revisao').textContent=resultado.status==='conferido'?'Reabrir revisão':'Aprovar para exportar';
  $('#concluir-manual').hidden=resultado.processamento!=='erro'||resultado.status==='conferido'||!!resultado.dados.concluido_manual_em;
  $('#tentar-leitura').hidden=processando||!!resultado.dados.revisado_em;
  $('#preencher-texto').disabled=processando||!resultado.texto_extraido;
  $('#mensagem-revisao').textContent='';renderizarCampos(resultado.dados);atualizarDadosOrganizados();trocarAba(false);
  for(const campo of $('#campos-revisao').querySelectorAll('input,select,textarea'))campo.disabled=processando||resultado.status==='conferido';
  if(!$('#revisao-dialog').open)$('#revisao-dialog').showModal();
  json(`/api/documentos/${id}/historico`).then(eventos=>{
    if(revisao?.id!==id)return;
    $('#historico-documento').textContent=eventos.length?eventos.map(e=>`${dataCurta(e.criado_em)} • ${e.ator} • ${e.acao}${Object.keys(e.detalhes).length?'\n'+JSON.stringify(e.detalhes,null,2):''}`).join('\n\n'):'Nenhum evento registrado.';
  }).catch(()=>{$('#historico-documento').textContent='Histórico indisponível.';});
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
$('#form-revisao').addEventListener('input',()=>{alterado=true;atualizarDadosOrganizados();});
window.addEventListener('beforeunload',e=>{if(alterado||enviando){e.preventDefault();e.returnValue='';}});
function trocarAba(destino){
  const aba=destino===true?'texto':destino===false?'campos':destino;
  for(const nome of ['campos','json','texto'])$('#tab-'+nome).setAttribute('aria-selected',String(nome===aba));
  $('#form-revisao').hidden=aba!=='campos';$('#dados-estruturados').hidden=aba!=='json';$('#texto-extraido').hidden=aba!=='texto';
  if(aba==='json')atualizarDadosOrganizados();
}
for(const nome of ['campos','json','texto']){
  $('#tab-'+nome).addEventListener('click',()=>trocarAba(nome));
  $('#tab-'+nome).addEventListener('keydown',e=>{if(!['ArrowLeft','ArrowRight'].includes(e.key))return;
    e.preventDefault();const abas=['campos','json','texto'];const indice=(abas.indexOf(nome)+(e.key==='ArrowRight'?1:2))%3;
    trocarAba(abas[indice]);$('#tab-'+abas[indice]).focus();});
}
$('#form-revisao').addEventListener('submit',async e=>{
  e.preventDefault();if(!revisao||salvando)return;
  salvando=true;$('#salvar-revisao').disabled=true;$('#mensagem-revisao').textContent='Salvando…';
  try{
    const campos=Object.fromEntries(new FormData(e.currentTarget));
    const r=await json(`/api/documentos/${revisao.id}/revisao`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({campos,versao:revisao.versao})});
    alterado=false;
    await abrirRevisao(revisao.id);
    $('#mensagem-revisao').textContent=r.mensagem;
    await carregar();
  }catch(erro){$('#mensagem-revisao').textContent=erro.message;}finally{salvando=false;$('#salvar-revisao').disabled=false;}
});
$('#aprovar-revisao').addEventListener('click',async()=>{
  if(!revisao||salvando)return;
  if(alterado){$('#mensagem-revisao').textContent='Salve as alterações antes de aprovar.';return;}
  const reabrir=revisao.status==='conferido';
  try{
    const resposta=await json(`/api/documentos/${revisao.id}/${reabrir?'reabrir':'aprovar'}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({versao:revisao.versao})});
    await abrirRevisao(revisao.id);await carregar();
    $('#mensagem-revisao').textContent=resposta.mensagem;
  }catch(erro){$('#mensagem-revisao').textContent=erro.message;}
});
$('#concluir-manual').addEventListener('click',async()=>{
  if(!revisao||salvando)return;
  if(alterado){$('#mensagem-revisao').textContent='Salve as alterações antes de concluir manualmente.';return;}
  if(!confirm('Você conferiu os campos com o PDF original? A falha de leitura será preservada no histórico. Após concluir, ainda será necessário aprovar para exportar.'))return;
  salvando=true;
  try{
    const resposta=await json(`/api/documentos/${revisao.id}/concluir-manual`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({versao:revisao.versao})});
    await abrirRevisao(revisao.id);await carregar();
    $('#mensagem-revisao').textContent=resposta.mensagem;
  }catch(erro){$('#mensagem-revisao').textContent=erro.message;}
  finally{salvando=false;}
});
$('#tentar-leitura').addEventListener('click',async()=>{
  if(!revisao||alterado){$('#mensagem-revisao').textContent='Salve ou descarte suas alterações antes de tentar novamente.';return;}
  try{await json(`/api/documentos/${revisao.id}/processar`,{method:'POST'});fechar();await carregar();notificar('Documento adicionado à fila de leitura.');}catch(erro){$('#mensagem-revisao').textContent=erro.message;}
});
// Sugestões automáticas preservam qualquer campo já alterado manualmente na tela.
$('#preencher-texto').addEventListener('click',async()=>{
  if(!revisao||salvando)return;
  const atual=revisao;$('#preencher-texto').disabled=true;
  try{
    const {dados}=await json(`/api/documentos/${atual.id}/sugestoes-texto`);
    if(revisao!==atual||salvando)return;
    let quantidade=0;
    for(const campo of $('#campos-revisao').querySelectorAll('input,select,textarea')){
      if(campo.disabled||dados[campo.name]==null)continue;
      const origem=atual.dados.origens?.[campo.name];
      if(origem?.metodo==='revisão manual'&&campo.value.trim())continue;
      const valor=dados[campo.name];
      const antigo=atual.dados[campo.name];
      const formatar=v=>v==null?'':campo.name.endsWith('_centavos')?(v/100).toFixed(2).replace('.',','):String(v);
      if(campo.value.trim()&&campo.value!==formatar(antigo))continue;
      const novo=formatar(valor);
      if(campo.value===novo)continue;
      campo.value=novo;
      atual.dados[campo.name]=valor;
      atual.dados.origens??={};
      if(dados.origens?.[campo.name])atual.dados.origens[campo.name]=dados.origens[campo.name];
      mostrarOrigemCampo(campo.closest('label'),atual.dados.origens[campo.name]);
      quantidade++;
    }
    if(quantidade){alterado=true;atualizarDadosOrganizados();trocarAba(false);}
    $('#mensagem-revisao').textContent=quantidade?`${quantidade} campo(s) preenchido(s) ou corrigido(s) pelo texto. Confira e clique em Salvar revisão.`:'Nenhum campo pôde ser preenchido com segurança a partir do texto.';
    if(dados.avisos?.length){$('#aviso-revisao').hidden=false;$('#aviso-revisao').textContent=dados.avisos.join('\n');}
  }catch(erro){if(revisao===atual)$('#mensagem-revisao').textContent=erro.message;}
  finally{if(revisao===atual)$('#preencher-texto').disabled=false;}
});
// Mantém status e resultados da fila atualizados enquanto a página está visível.
carregar();setInterval(()=>{if(!document.hidden&&(listagem.resumo.fila||revisao?.processamento==='fila'||revisao?.processamento==='processando'))carregar();},2500);
setInterval(()=>{if(!document.hidden)carregar();},30000);
