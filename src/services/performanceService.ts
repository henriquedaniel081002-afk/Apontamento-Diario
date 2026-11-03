/** Local, opt-in diagnostics. No telemetry, tokens, payloads or query values leave the browser. */
type Sample = {stage:string;ms:number;bytes:number;rows?:number};
const samples:Sample[]=[];
export function recordPerformance(stage:string,ms:number,bytes=0,rows?:number) {
  try {if(typeof window==='undefined'||sessionStorage.getItem('itam:performance')!=='1')return;}catch{return;}
  samples.push({stage,ms,bytes,rows});
  if(samples.length>1000)samples.shift();
}
export function performanceSnapshot() {
  return [...new Set(samples.map(s=>s.stage))].map(stage=>{
    const rows=samples.filter(s=>s.stage===stage), times=rows.map(s=>s.ms).sort((a,b)=>a-b);
    return {stage,calls:rows.length,p50:times[Math.ceil(times.length*.5)-1],p95:times[Math.ceil(times.length*.95)-1],requestBytes:rows.reduce((n,s)=>n+s.bytes,0)};
  });
}
if(typeof window!=='undefined')Object.assign(window,{itamPerformance:{snapshot:performanceSnapshot,clear:()=>samples.splice(0)}});

export async function measureAsync<T>(stage:string,operation:()=>Promise<T>):Promise<T> {
  const start=performance.now();
  try{return await operation();}finally{recordPerformance(stage,performance.now()-start);}
}
