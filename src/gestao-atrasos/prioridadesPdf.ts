/** PDF A4 horizontal, vetorial e com texto pesquisável. Sem dependências extras. */
export interface PrioridadeLinha {
  op:string; setor:string; linha:string; cliente:string; potencia:string; referencia?:string;
  data_programada:string; qtde_total_op:number;
  programada:number; produzida:number; pendente:number;
  concluida:boolean; motivo:string|null; previsao_regularizacao:string|null;
}
export interface RelatorioPrioridades {hoje:string;rows:PrioridadeLinha[]}
export interface FiltrosPrioridades {
  op:string;serie:string;setor:string;linha:string;cliente:string;
  inicio:string;fim:string;situacao:string;justificativa:string;multiplos:boolean;
}

type Cor=[number,number,number];
const C={dark:[19,34,43] as Cor,red:[189,30,44] as Cor,blue:[25,62,90] as Cor,
  ink:[22,36,45] as Cor,soft:[96,111,125] as Cor,line:[211,221,228] as Cor,
  redPale:[251,233,235] as Cor,bluePale:[231,242,247] as Cor,
  neutral:[242,245,247] as Cor,white:[255,255,255] as Cor};
const W=841.89,H=595.28;
const pdfDate=(value:string)=>/^\d{4}-\d\d-\d\d/.test(value)?`${value.slice(8,10)}/${value.slice(5,7)}/${value.slice(0,4)}`:value;
const num=(value:number)=>Number(value||0).toLocaleString('pt-BR');
const limit=(s:string,n:number)=>s.length>n?s.slice(0,n-3)+'...':s;
const CP:Record<string,number>={'€':128,'‚':130,'ƒ':131,'„':132,'…':133,'†':134,'‡':135,'ˆ':136,
  '‰':137,'Š':138,'‹':139,'Œ':140,'Ž':142,'‘':145,'’':146,'“':147,'”':148,'•':149,'–':150,'—':151,
  '˜':152,'™':153,'š':154,'›':155,'œ':156,'ž':158,'Ÿ':159};
/** Sequências octais tornam o conteúdo do PDF ASCII e suportam acentos pt-BR em WinAnsi. */
function encodeText(s:string){
  let result='';
  for(const ch of s){
    const code=ch.codePointAt(0)??63;
    if(ch==='('||ch===')'||ch==='\\'){result+='\\'+ch;continue;}
    if(code===10||code===13){result+=' ';continue;}
    if(code>=32&&code<=126){result+=ch;continue;}
    const v=code>=160&&code<=255?code:CP[ch];
    result+=v===undefined?'?':'\\'+v.toString(8).padStart(3,'0');
  }
  return result;
}
const rgb=(c:Cor)=>c.map(n=>(n/255).toFixed(3)).join(' ');
// Largura fixa das linhas de conteúdo em Courier. Quebra palavras extensas
// e conserva quebras explícitas, inclusive em uma observação de várias páginas.
function wrap(text:string, columns:number):string[] {
  const lines:string[]=[];
  for (const paragraph of text.replace(/\r\n?/g,'\n').replace(/\t/g,'    ').split('\n')) {
    let chars=Array.from(paragraph);
    while(chars.length>columns) {
      const space=chars.lastIndexOf(' ',columns);
      const cut=space>0?space:columns;
      lines.push(chars.slice(0,cut).join(''));
      chars=chars.slice(space>0?cut+1:cut);
    }
    lines.push(chars.join(''));
  }
  return lines;
}
export function gerarPdfPrioridades(relatorio:RelatorioPrioridades,filtros:FiltrosPrioridades):Uint8Array {
  if(!relatorio.rows.length)throw new Error('Sem dados para gerar o PDF.');
  const pages:string[][]=[];let cmds:string[]=[],y=0;
  function rect(x:number,top:number,w:number,h:number,fill:Cor,stroke?:Cor){
    cmds.push(`${rgb(fill)} rg ${x.toFixed(2)} ${(H-top-h).toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)} re f`);
    if(stroke)cmds.push(`${rgb(stroke)} RG 0.6 w ${x.toFixed(2)} ${(H-top-h).toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)} re S`);
  }
  function line(x:number,top:number,x2:number,top2:number,c:Cor=C.line,width=0.8){
    cmds.push(`${rgb(c)} RG ${width} w ${x.toFixed(2)} ${(H-top).toFixed(2)} m ${x2.toFixed(2)} ${(H-top2).toFixed(2)} l S`);
  }
  function txt(value:string,x:number,top:number,size=10,color:Cor=C.ink,bold=false){
    cmds.push(`${rgb(color)} rg BT /F${bold?2:1} ${size} Tf 1 0 0 1 ${x.toFixed(2)} ${(H-top-size).toFixed(2)} Tm (${encodeText(value)}) Tj ET`);
  }
  const bottom=H-38;
  function bodyLine(value:string,top:number) {
    const size=9;
    // WinAnsi cobre português. Para outros alfabetos, o navegador desenha a
    // linha com fontes locais e o PDF conserva o texto Unicode em ActualText.
    if (Array.from(value).every(c=>c.codePointAt(0)!<=255 || CP[c]!==undefined)) {
      cmds.push(`${rgb(C.ink)} rg BT /F3 ${size} Tf 1 0 0 1 42 ${(H-top-size).toFixed(2)} Tm (${encodeText(value)}) Tj ET`);
      return;
    }
    const canvas=document.createElement('canvas');
    canvas.width=2250; canvas.height=42;
    const ctx=canvas.getContext('2d');
    if(!ctx) throw new Error('O navegador não conseguiu renderizar a observação no PDF.');
    ctx.fillStyle='white';ctx.fillRect(0,0,canvas.width,canvas.height);
    ctx.fillStyle='#16242d';ctx.font='27px monospace';ctx.fillText(value,0,29,canvas.width);
    const bytes=atob(canvas.toDataURL('image/jpeg',0.95).split(',')[1]);
    const hex=Array.from(bytes,c=>c.charCodeAt(0).toString(16).padStart(2,'0')).join('');
    const unicode=value.split('').map(c=>c.charCodeAt(0).toString(16).padStart(4,'0')).join('');
    cmds.push(`/Span << /ActualText <FEFF${unicode}> >> BDC q 750 0 0 14 42 ${(H-top-13).toFixed(2)} cm BI /W 2250 /H 42 /CS /RGB /BPC 8 /F [/ASCIIHexDecode /DCTDecode] ID\n${hex}>\nEI Q EMC`);
  }
  const hasToday=relatorio.rows.some(r=>r.data_programada===relatorio.hoje);
  function pageStart() {
    if(cmds.length)pages.push(cmds);
    cmds=[];
    rect(0,0,W,64,C.dark);
    txt('ITAM  /  Prioridades de produção',30,11,18,C.white,true);
    txt(`${hasToday?'Atrasos + dia atual':'Atrasos pendentes'}  |  Manaus, ${pdfDate(relatorio.hoje)}`,30,39,10,C.white);
    y=76;
    const context=[filtros.setor,filtros.linha,filtros.op&&'OP '+filtros.op,filtros.serie&&'Série '+filtros.serie,
      filtros.cliente,filtros.justificativa&&(filtros.justificativa==='COM'?'Com observação':'Sem observação'),
      filtros.multiplos&&'Vários dias',filtros.inicio&&filtros.fim&&`Período ${pdfDate(filtros.inicio)} a ${pdfDate(filtros.fim)}`].filter(Boolean);
    if(context.length){txt(limit(context.join('  ·  '),115),30,y,7.5,C.soft);y+=17;}
  }
  function section(today:boolean,continued=false) {
    const label=today?'HOJE  ·  PROGRAMAÇÃO DO DIA':'ATRASADAS  ·  PENDÊNCIAS ANTERIORES';
    rect(30,y,782,23,today?C.bluePale:C.redPale);
    txt(label+(continued?'  /  continuação':''),40,y+5,9,today?C.blue:C.red,true);
    y+=30;
  }
  const ordered=relatorio.rows.filter(r=>r.data_programada===relatorio.hoje ||
    (r.data_programada<relatorio.hoje && r.pendente>0)).sort((a,b)=>
    a.data_programada.localeCompare(b.data_programada)||a.op.localeCompare(b.op,'pt-BR',{numeric:true})||
    a.setor.localeCompare(b.setor,'pt-BR'));
  if(!ordered.length)throw new Error('Sem dados para gerar o PDF.');
  pageStart();
  let previous:boolean|undefined;
  for(const r of ordered) {
    const today=r.data_programada===relatorio.hoje;
    const newPage=y+85>bottom;
    if(newPage)pageStart();
    if(newPage||previous!==today)section(today,newPage&&previous===today);
    previous=today;
    const heading=`OP ${r.op}   |   ${pdfDate(r.data_programada)}   |   ${r.setor}`;
    function headingLines(continued=false) {
      for(const part of wrap(heading+(continued?'   (continuação)':''),96)) {
        bodyLine(part,y); y+=14;
      }
    }
    line(30,y,812,y,C.line); y+=5;
    rect(30,y+2,8,8,C.white,C.soft);
    headingLines();
    const metrics=`Total OP ${num(r.qtde_total_op)}   Programada ${num(r.programada)}   Produzida ${num(r.produzida)}   Pendente ${num(r.pendente)}   Progresso ${Math.round(100*r.produzida/Math.max(1,r.programada))}%`;
    const state=r.pendente===0?'Concluída':today?'Programada para hoje':'Atraso pendente';
    const fields=[`Cliente: ${r.cliente||'—'}   Linha: ${r.linha||'—'}   Potência: ${r.potencia||'—'}   Referência: ${r.referencia||'—'}`,
      metrics,`Situação: ${state}   Prazo: ${r.previsao_regularizacao?pdfDate(r.previsao_regularizacao):'—'}`,
      'Observação: '+(r.motivo||'—')];
    for(const field of fields) {
      for(const part of wrap(field,135)) {
        if(y+14>bottom){pageStart();section(today,true);headingLines(true);}
        bodyLine(part,y); y+=14;
      }
    }
    if(y+16<=bottom){
      txt('Conferência do líder',42,y,7,C.soft);
      line(117,y+8,795,y+8);
      y+=14;
    }
    y+=8;
  }
  if(cmds.length)pages.push(cmds);
  const objects:string[]=['','',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Courier /Encoding /WinAnsiEncoding >>'];
  const kids:number[]=[];
  for(let i=0;i<pages.length;i++){
    const contents=pages[i];
    // Rodapé numerado é impresso em todas as páginas.
    contents.push(`${rgb(C.line)} RG 0.7 w 30 28 m 812 28 l S`);
    contents.push(`${rgb(C.soft)} rg BT /F1 7.4 Tf 1 0 0 1 30 16 Tm (ITAM | Prioridades por OP e data | Checklist para uso interno) Tj ET`);
    contents.push(`${rgb(C.soft)} rg BT /F2 7.4 Tf 1 0 0 1 747 16 Tm (Pag. ${i+1} / ${pages.length}) Tj ET`);
    const stream=contents.join('\n')+'\n';
    const contentId=objects.push(`<< /Length ${stream.length} >>\nstream\n${stream}endstream`);
    const pageId=objects.push(`<< /Type /Page /Parent 1 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /Font << /F1 3 0 R /F2 4 0 R /F3 5 0 R >> >> /Contents ${contentId} 0 R >>`);
    kids.push(pageId);
  }
  objects[0]=`<< /Type /Pages /Kids [${kids.map(id=>`${id} 0 R`).join(' ')}] /Count ${kids.length} >>`;
  objects[1]='<< /Type /Catalog /Pages 1 0 R >>';
  let raw='%PDF-1.4\n%ITAM\n';const offsets=[0];
  for(let i=0;i<objects.length;i++){
    offsets.push(raw.length);
    raw+=`${i+1} 0 obj\n${objects[i]}\nendobj\n`;
  }
  const xref=raw.length;
  raw+=`xref\n0 ${objects.length+1}\n0000000000 65535 f \n`;
  for(const offset of offsets.slice(1))raw+=`${String(offset).padStart(10,'0')} 00000 n \n`;
  raw+=`trailer\n<< /Size ${objects.length+1} /Root 2 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return new TextEncoder().encode(raw);
}
