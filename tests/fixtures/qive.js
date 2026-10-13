// Dados sintéticos: reproduzem o formato, sem nomes ou contatos dos PDFs reais.
function textoQive(opcoes={}){
  const o={numero:'101',servicos:'376,99',base:'376,99',aliquota:'2,00 %',iss:'7,54',liquido:'376,99',ibsMunicipio:'0,00',ibsUf:'0,36',cbs:'3,20',csll:'0,00',...opcoes};
  const moeda=v=>v==='-'?'-':`R$ ${v}`;
  return `Data de Emissão 01/10/2026 21:09:38 Competência 09/2026 Numero da NFS-e:
${o.numero}
Série RPS: A
Pag. 1/1
Código de Verificação ABCD1234 Número RPS 501
Município da Prestação 4205407 - Florianópolis - SC NFS-e Substituída -
Notas fiscais gerenciadas pela Qive - www.qive.com.br
Dados do Prestador de Serviços
Nome / Nome Empresarial Empresa Sintética Ltda
CPF/CNPJ 12.345.678/0001-90 Inscrição Municipal 12345 Município 4205407 - Florianópolis - SC
Endereço e CEP RUA DE TESTE, 181 - CENTRO - 4205407 - Florianópolis - SC - CEP: 88015-190
Complemento SALA 2 Telefone 48999999999 E-mail prestador@example.com
Dados do Tomador de Serviços
Nome / Nome Empresarial Cliente Sintético Ltda
CPF/CNPJ 98.765.432/0001-10 Inscrição Municipal - Município 3523107 - Itaquaquecetuba - SP
Endereço e CEP RUA DO CLIENTE 252 - 3523107 - Itaquaquecetuba - SP - CEP: 08580-290
Complemento - Telefone - E-mail -
Discriminação dos Serviços
Serviço de teste.
PIS(0.65%) = 3.6751
COFINS(3.00%) = 16.962
Código do Serviço
2684
VALOR DO SERVIÇO = ${moeda(o.servicos)}
PIS R$ 0,00 COFINS R$ 0,00 IR - INSS - CSLL ${moeda(o.csll)}
B. Cálculo (R$)
${moeda(o.base)}
Alíquota (%)
${o.aliquota}
ISS Retido
2 - Não
V. do ISS (R$)
${moeda(o.iss)}
V. Líquido (R$)
${moeda(o.liquido)}
Código NBS
111032200
Informações IBS/CBS
Valor do IBS no Município(R$)
${moeda(o.ibsMunicipio)}
Alíquota do IBS Município (%)
0,00 %
Valor do IBS da UF(R$)
${moeda(o.ibsUf)}
Alíquota do IBS da UF (%)
0,10 %
Valor total CBS(R$)
${moeda(o.cbs)}
Valor total da BC do IBS e da CBS (R$)
R$ 355,69
Município de Incidência do IBS/CBS
3523107 Itaquaquecetuba`;
}
function pdfQive(){
  const texto=textoQive().split('\n').map(l=>'('+l.replace(/[\\()]/g,'\\$&')+') Tj 0 -10 Td').join('\n');
  const conteudo=`BT /F1 7 Tf 20 780 Td\n${texto}\nET`;
  const objetos=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 800 820] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>','<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',`<< /Length ${Buffer.byteLength(conteudo,'latin1')} >>\nstream\n${conteudo}\nendstream`];
  let pdf='%PDF-1.4\n';const offsets=[0];
  objetos.forEach((obj,i)=>{offsets.push(Buffer.byteLength(pdf,'latin1'));pdf+=`${i+1} 0 obj\n${obj}\nendobj\n`;});
  const xref=Buffer.byteLength(pdf,'latin1');
  pdf+=`xref\n0 6\n0000000000 65535 f \n${offsets.slice(1).map(n=>String(n).padStart(10,'0')+' 00000 n ').join('\n')}\ntrailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(pdf,'latin1');
}
module.exports={textoQive,pdfQive};
