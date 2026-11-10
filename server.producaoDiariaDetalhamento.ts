/** Detalhes gerados com os mesmos critérios de soma do dashboard diário existente. */
export interface DailyLineProductionDetail {
  linha: string;
  programado: number;
  produzido: number;
  potencias: { potencia: string; produzido: number }[];
}
export interface DailySectorProductionDetail {
  setor: string;
  programado: number;
  produzido: number;
  linhas: DailyLineProductionDetail[];
}
export interface DailyProgramRow {
  setor: string; linha: string; quantidade: string | number;
}
export interface DailyProducedRow extends DailyProgramRow {
  tipo_bobina?: string | null; potencia: string | number | null;
}
type MutableLine = Omit<DailyLineProductionDetail,'potencias'> & { potencias: Map<string,number> };
type MutableSector = Omit<DailySectorProductionDetail,'linhas'> & { linhas: Map<string,MutableLine> };

export function buildDailyProductionDetail(
  programming: DailyProgramRow[],
  produced: DailyProducedRow[],
  requestedLine: string,
  expandSectors: (setor: string, linha: string, tipoBobina?: string | null) => string[],
): DailySectorProductionDetail[] {
  const sectors = new Map<string,MutableSector>();
  const getSector = (name: string): MutableSector => {
    let row = sectors.get(name);
    if (!row) { row = { setor:name, programado:0, produzido:0, linhas:new Map() }; sectors.set(name,row); }
    return row;
  };
  const getLine = (row: MutableSector, name: string): MutableLine => {
    let line = row.linhas.get(name);
    if (!line) { line={linha:name,programado:0,produzido:0,potencias:new Map()}; row.linhas.set(name,line); }
    return line;
  };
  const normalized = (value: string) => String(value || '').trim().toUpperCase();
  const selected = normalized(requestedLine);

  for (const row of programming) {
    const line=normalized(row.linha);
    if(selected!=='ALL' && selected!==line) continue;
    const qty=Number(row.quantidade)||0;
    for(const sectorName of expandSectors(String(row.setor||''),line)) {
      const sector=getSector(sectorName);
      sector.programado+=qty;
      getLine(sector,line).programado+=qty;
    }
  }
  for (const row of produced) {
    const line=normalized(row.linha);
    if(selected!=='ALL' && selected!==line) continue;
    const qty=Number(row.quantidade)||0;
    const power=String(row.potencia??'').trim()||'NÃO INFORMADA';
    for(const sectorName of expandSectors(String(row.setor||''),line,row.tipo_bobina)) {
      const sector=getSector(sectorName);
      sector.produzido+=qty;
      const lineRow=getLine(sector,line);
      lineRow.produzido+=qty;
      lineRow.potencias.set(power,(lineRow.potencias.get(power)||0)+qty);
    }
  }
  const lineOrder=(a:string,b:string) => {
    const rank=(name:string)=>name==='MON'?0:name==='TRI'?1:2;
    return rank(a)-rank(b)||a.localeCompare(b,'pt-BR');
  };
  const powerOrder=(a:string,b:string)=>{
    const n1=Number(a),n2=Number(b);
    return a && b && Number.isFinite(n1)&&Number.isFinite(n2)
      ? n1-n2 : a.localeCompare(b,'pt-BR',{numeric:true});
  };
  return [...sectors.values()].map((sector)=>({
    setor:sector.setor,
    programado:sector.programado,
    produzido:sector.produzido,
    linhas:[...sector.linhas.values()].sort((a,b)=>lineOrder(a.linha,b.linha)).map(line=>({
      linha:line.linha,
      programado:line.programado,
      produzido:line.produzido,
      potencias:[...line.potencias.entries()].sort(([a],[b])=>powerOrder(a,b))
        .map(([potencia,produzido])=>({potencia,produzido})),
    })),
  })).sort((a,b)=>a.setor.localeCompare(b.setor,'pt-BR'));
}
