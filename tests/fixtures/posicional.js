function pdfPosicional(){
 const itens=[
  ['Número da NFS-e',20,760],['Competência',230,760],['772',20,744],['10/2026',230,744],
  ['Identificação do fornecedor',20,700],['CPF / CNPJ',20,680],['Razão social',230,680],
  ['12.345.678/0001-90',20,664],['Empresa de Teste',230,664],
  ['Cliente',20,620],['CPF',20,600],['Nome empresarial',230,600],['123.456.789-09',20,584],['Cliente de Teste',230,584],
  ['Valores',20,540],['Valor dos serviços (R$)',20,520],['Valor do ISS (R$)',230,520],['1.234,56',100,504],['24,69',300,504],
 ];
 // Ordem interna invertida: a leitura deve obedecer às posições na página.
 const stream=itens.reverse().map(([s,x,y])=>`BT /F1 10 Tf 1 0 0 1 ${x} ${y} Tm (${s.replace(/[\\()]/g,'\\$&')}) Tj ET`).join('\n');
 const objetos=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 600 800] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>','<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',`<< /Length ${Buffer.byteLength(stream,'latin1')} >>\nstream\n${stream}\nendstream`];
 let pdf='%PDF-1.4\n';const offsets=[];
 objetos.forEach((obj,i)=>{offsets.push(Buffer.byteLength(pdf,'latin1'));pdf+=`${i+1} 0 obj\n${obj}\nendobj\n`;});
 const xref=Buffer.byteLength(pdf,'latin1');
 pdf+=`xref\n0 6\n0000000000 65535 f \n${offsets.map(n=>String(n).padStart(10,'0')+' 00000 n ').join('\n')}\ntrailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
 return Buffer.from(pdf,'latin1');
}
module.exports={pdfPosicional};
