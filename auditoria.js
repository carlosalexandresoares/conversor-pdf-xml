// Trilha local de ações. O nome de usuário vem da autenticação HTTP, quando configurada.
const db=require('./database');
function ator(req){
  const credenciais=/^Basic (.+)$/i.exec(req.headers.authorization||'');
  if(!credenciais)return 'usuário local';
  try{return Buffer.from(credenciais[1],'base64').toString('utf8').split(':')[0].slice(0,100)||'usuário autenticado';}
  catch{return 'usuário autenticado';}
}
function registrar(req,id,acao,detalhes={}){
  db.prepare('INSERT INTO eventos_documento (documento_id,acao,ator,detalhes_json) VALUES (?,?,?,?)').run(id,acao,ator(req),JSON.stringify(detalhes));
}
module.exports={registrar};
