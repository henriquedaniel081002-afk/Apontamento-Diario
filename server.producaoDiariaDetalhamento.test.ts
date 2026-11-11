import { describe, expect, it } from 'vitest';
import { buildDailyProductionDetail } from './server.producaoDiariaDetalhamento';

const expand=(setor:string,linha:string,tipoBobina?:string|null)=>{
  if(setor==='ESTAMPARIA')return [];
  if(setor==='BOBINA AT/BT')return [tipoBobina==='BT'?'BOBINA BT':'BOBINA AT'];
  if(setor==='MONTAGEM FINAL'&&linha==='EPO')return ['MONTAGEM FINAL','EPOXI'];
  if(setor==='EPOXI')return ['EPOXI','MONTAGEM FINAL'];
  return [setor];
};
const planned=[
 {setor:'MONTAGEM FINAL',linha:'MON',quantidade:'10'},
 {setor:'MONTAGEM FINAL',linha:'TRI',quantidade:'8'},
 {setor:'MONTAGEM FINAL',linha:'EPO',quantidade:'2'},
 {setor:'MONTAGEM FINAL',linha:'POT',quantidade:'1'},
 {setor:'BOBINA AT/BT',linha:'MON',quantidade:'4'},
 {setor:'ESTAMPARIA',linha:'TRI',quantidade:'9'},
];
const actual=[
 {setor:'MONTAGEM FINAL',linha:'MON',potencia:'5',quantidade:'3'},
 {setor:'MONTAGEM FINAL',linha:'MON',potencia:'10',quantidade:'4'},
 {setor:'MONTAGEM FINAL',linha:'TRI',potencia:'30',quantidade:'5'},
 {setor:'MONTAGEM FINAL',linha:'TRI',potencia:'75',quantidade:'2'},
 {setor:'MONTAGEM FINAL',linha:'EPO',potencia:'15',quantidade:'1'},
 {setor:'BOBINA AT/BT',tipo_bobina:'BT',linha:'MON',potencia:'5',quantidade:'2'},
 {setor:'ESTAMPARIA',linha:'TRI',potencia:'30',quantidade:'3'},
];

describe('Detalhamento Produção Diária',()=>{
 it('preserva os totais e agrega potência apenas na produção',()=>{
  const rows=buildDailyProductionDetail(planned,actual,'ALL',expand);
  const mf=rows.find(r=>r.setor==='MONTAGEM FINAL');
  expect(mf).toMatchObject({programado:21,produzido:15});
  expect(mf?.linhas.map(l=>l.linha)).toEqual(['MON','TRI','EPO','POT']);
  expect(mf?.linhas.find(l=>l.linha==='MON')).toMatchObject({programado:10,produzido:7});
  expect(mf?.linhas.find(l=>l.linha==='TRI')?.potencias).toEqual([{potencia:'30',produzido:5},{potencia:'75',produzido:2}]);
  expect(mf?.linhas.find(l=>l.linha==='POT')?.potencias).toEqual([]);
  expect(rows.find(r=>r.setor==='EPOXI')).toMatchObject({programado:2,produzido:1});
  expect(rows.some(r=>r.setor==='ESTAMPARIA')).toBe(false);
 });
 it('reconcilia soma de linhas e potências com cada total consolidado',()=>{
  const rows=buildDailyProductionDetail(planned,actual,'ALL',expand);
  for(const row of rows){
   expect(row.linhas.reduce((n,l)=>n+l.programado,0)).toBe(row.programado);
   expect(row.linhas.reduce((n,l)=>n+l.produzido,0)).toBe(row.produzido);
   for(const l of row.linhas)expect(l.potencias.reduce((n,p)=>n+p.produzido,0)).toBe(l.produzido);
  }
 });
 it('respeita filtro MON e separação BOBINA AT / BT',()=>{
  const rows=buildDailyProductionDetail(planned,actual,'MON',expand);
  expect(rows.find(r=>r.setor==='MONTAGEM FINAL')).toMatchObject({programado:10,produzido:7});
  expect(rows.find(r=>r.setor==='BOBINA AT')).toMatchObject({programado:4,produzido:0});
  expect(rows.find(r=>r.setor==='BOBINA BT')).toMatchObject({programado:0,produzido:2});
 });
});
