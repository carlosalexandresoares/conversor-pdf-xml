const express=require('express');
const db=require('./database');
const router=express.Router();
const campos=['cnpj_tomador','nome_tomador','tomador_codigo_municipio','tomador_endereco','tomador_numero','tomador_complemento','tomador_bairro','tomador_cep','tomador_municipio','tomador_uf','tomador_inscricao_municipal','tomador_email','tomador_telefone'];

router.get('/',(req,res)=>{
  const lista=db.prepare('SELECT id,documento,nome,dados_json FROM tomadores ORDER BY nome COLLATE NOCASE').all();
  res.json(lista.map(({dados_json,...item})=>({...item,dados:JSON.parse(dados_json)})));
});
router.post('/',(req,res)=>{
  const entrada=req.body?.dados;
  if(!entrada||typeof entrada!=='object'||Array.isArray(entrada))return res.status(400).json({erro:'Dados do tomador inválidos.'});
  const dados={};
  for(const campo of campos){
    const valor=entrada[campo];
    if(valor!=null&&typeof valor!=='string')return res.status(400).json({erro:`Campo inválido: ${campo}.`});
    dados[campo]=(valor||'').trim().slice(0,300);
  }
  dados.cnpj_tomador=dados.cnpj_tomador.replace(/\D/g,'');
  dados.tomador_cep=dados.tomador_cep.replace(/\D/g,'');
  dados.tomador_uf=dados.tomador_uf.toUpperCase();
  if(!/^(\d{11}|\d{14})$/.test(dados.cnpj_tomador)||!dados.nome_tomador)
    return res.status(400).json({erro:'Informe o CPF/CNPJ e o nome do tomador para cadastrá-lo.'});
  if(dados.tomador_cep&&!/^\d{8}$/.test(dados.tomador_cep))return res.status(400).json({erro:'CEP do tomador inválido.'});
  if(dados.tomador_uf&&!/^[A-Z]{2}$/.test(dados.tomador_uf))return res.status(400).json({erro:'UF do tomador inválida.'});
  db.prepare(`INSERT INTO tomadores (documento,nome,dados_json) VALUES (?,?,?)
    ON CONFLICT(documento) DO UPDATE SET nome=excluded.nome,dados_json=excluded.dados_json,
    atualizado_em=strftime('%Y-%m-%dT%H:%M:%fZ','now')`).run(dados.cnpj_tomador,dados.nome_tomador,JSON.stringify(dados));
  res.json({mensagem:'Tomador cadastrado.',documento:dados.cnpj_tomador});
});
router.delete('/:id',(req,res)=>{
  const id=Number(req.params.id);
  if(!Number.isSafeInteger(id)||id<1)return res.status(400).json({erro:'ID inválido.'});
  const removido=db.prepare('DELETE FROM tomadores WHERE id=?').run(id);
  if(!removido.changes)return res.status(404).json({erro:'Tomador não encontrado.'});
  res.json({mensagem:'Tomador removido do cadastro.'});
});
module.exports=router;
