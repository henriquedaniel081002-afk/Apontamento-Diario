/** PDF A4 horizontal, vetorial e com texto pesquisável. Sem dependências extras. */
export interface PrioridadeLinha {
  op:string; setor:string; linha:string; cliente:string; potencia:string;
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
type Grupo='ATRASADAS'|'HOJE'|'ATENDIDAS';
const cat=(r:PrioridadeLinha,today:string):Grupo=>r.pendente>0&&r.data_programada<today?'ATRASADAS':r.pendente>0&&r.data_programada===today?'HOJE':'ATENDIDAS';
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
  function filterLabel(){
    const situacao:Record<string,string>={ATRASADOS:'Com atraso',CONCLUIDOS:'Concluída',TODOS:'Todas'};
    return ['Situação: '+(situacao[filtros.situacao]||'Com atraso'),
      filtros.linha?'Linha: '+filtros.linha:'',filtros.cliente?'Cliente: '+filtros.cliente:'',
      filtros.op?'OP: '+filtros.op:'',filtros.serie?'Série: '+filtros.serie:'',
      filtros.justificativa?'Justificativa: '+(filtros.justificativa==='COM'?'Com':'Sem'):'',
      filtros.multiplos?'Múltiplos dias':'',
      `Período: ${filtros.inicio?pdfDate(filtros.inicio):'padrão'} a ${filtros.fim?pdfDate(filtros.fim):'padrão'}`
    ].filter(Boolean).join('  |  ');
  }
  function pageStart(setor:string,continua=false){
    if(cmds.length)pages.push(cmds);
    cmds=[];y=0;
    rect(0,0,W,77,C.dark);
    txt('ITAM  /  CHECKLIST DO LÍDER',30,12,18,C.white,true);
    txt('IMPRESSÃO DIÁRIA',697,17,9,[224,234,240],true);
    txt(`SETOR: ${limit(setor,52)}   •   ${pdfDate(relatorio.hoje)}${continua?'   •   CONTINUAÇÃO':''}`,30,43,9,[222,231,236]);
    txt(limit(filterLabel(),152),30,59,7,[185,201,210]);
    txt('ORDEM DE EXECUÇÃO',30,87,12,C.ink,true);
    txt('1º regularizar atrasos     2º atender produção do dia     3º registrar justificativas',30,106,8.2,C.soft);
    line(30,123,812,123,C.line);
    y=133;
  }
  const config:Record<Grupo,{label:string;light:Cor;dark:Cor}>={
    ATRASADAS:{label:'ATRASADAS  •  PRIORIDADE MÁXIMA',light:C.redPale,dark:C.red},
    HOJE:{label:'HOJE  •  PROGRAMAÇÃO ATUAL',light:C.bluePale,dark:C.blue},
    ATENDIDAS:{label:'ATENDIDAS  •  SEM PENDÊNCIA',light:C.neutral,dark:C.soft},
  };
  function section(group:Grupo,count:number,continua=false){
    const cfg=config[group];
    rect(30,y,782,25,cfg.light);
    txt(cfg.label+(continua?' (CONTINUAÇÃO)':''),39,y+5,9,cfg.dark,true);
    txt(`${num(count)} linha(s) por data programada`,631,y+7,7,cfg.dark);
    y+=29;
  }
  function card(r:PrioridadeLinha,group:Grupo){
    const cfg=config[group];
    const top=y;
    rect(30,top,782,46,C.white,C.line);
    rect(30,top,4,46,cfg.dark);
    // Checkbox para conferência do líder.
    cmds.push(`${rgb([142,160,173])} RG 0.8 w 40 ${(H-top-20).toFixed(2)} 16 16 re S`);
    txt(`OP ${r.op}`,68,top+5,11.3,C.ink,true);
    txt(limit(`${r.cliente||'Cliente não informado'}  •  ${r.linha||'—'}  •  ${r.potencia||'—'}`,46),195,top+6,8,C.soft);
    txt(`Data ${pdfDate(r.data_programada)}   |   Total OP ${num(r.qtde_total_op)}   |   Programada ${num(r.programada)}   |   Produzida ${num(r.produzida)}`,68,top+25,8.1,C.ink);
    txt(`PEND. ${num(r.pendente)}`,393,top+32,10,cfg.dark,true);
    line(494,top+5,494,top+42,C.line);
    txt('Justificativa / ação do líder:',505,top+6,8,C.soft);
    if(r.motivo){txt(`Registrada: ${limit(r.motivo.replace(/\s+/g,' '),43)}`,505,top+18,7.5,C.ink);}
    line(505,top+36,799,top+36,[145,162,177]);
    y+=50;
  }
  const ordered=[...relatorio.rows].sort((a,b)=>a.setor.localeCompare(b.setor,'pt-BR')||
    (['ATRASADAS','HOJE','ATENDIDAS'].indexOf(cat(a,relatorio.hoje)) - ['ATRASADAS','HOJE','ATENDIDAS'].indexOf(cat(b,relatorio.hoje)))||
    a.data_programada.localeCompare(b.data_programada)||a.op.localeCompare(b.op,undefined,{numeric:true}));
  const setores=[...new Set(ordered.map(r=>r.setor))];
  for(const setor of setores){
    pageStart(setor);
    const subset=ordered.filter(r=>r.setor===setor);
    for(const kind of ['ATRASADAS','HOJE','ATENDIDAS'] as const){
      const group=subset.filter(r=>cat(r,relatorio.hoje)===kind);
      if(!group.length)continue;
      if(y+29+50>H-33)pageStart(setor,true);
      section(kind,group.length);
      for(let i=0;i<group.length;i++){
        if(y+50>H-33){pageStart(setor,true);section(kind,group.length,true);}
        card(group[i],kind);
      }
      y+=9;
    }
  }
  if(cmds.length)pages.push(cmds);
  const objects:string[]=['','',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>'];
  const kids:number[]=[];
  for(let i=0;i<pages.length;i++){
    const contents=pages[i];
    // Rodapé numerado é impresso em todas as páginas.
    contents.push(`${rgb(C.line)} RG 0.7 w 30 28 m 812 28 l S`);
    contents.push(`${rgb(C.soft)} rg BT /F1 7.4 Tf 1 0 0 1 30 16 Tm (ITAM | Prioridades por OP e data | Checklist para uso interno) Tj ET`);
    contents.push(`${rgb(C.soft)} rg BT /F2 7.4 Tf 1 0 0 1 747 16 Tm (Pag. ${i+1} / ${pages.length}) Tj ET`);
    const stream=contents.join('\n')+'\n';
    const contentId=objects.push(`<< /Length ${stream.length} >>\nstream\n${stream}endstream`);
    const pageId=objects.push(`<< /Type /Page /Parent 1 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentId} 0 R >>`);
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
