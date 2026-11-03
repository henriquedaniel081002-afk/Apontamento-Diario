import { AsyncLocalStorage } from 'node:async_hooks';
import type { Express } from 'express';
import type { Pool } from 'pg';

/** Opt-in timings only: never logs SQL, parameters, identities or connection strings. */
export function installPerformanceMetrics(app:Express,pools:Pool[],enabled=process.env.ITAM_PERF==='1') {
  if(!enabled)return;
  const context=new AsyncLocalStorage<{start:number;queries:number;sqlMs:number}>();
  const wrapped=new WeakSet<object>();
  const instrument=(client:any)=>{
    if(wrapped.has(client))return client;
    wrapped.add(client);
    const original=client.query.bind(client);
    client.query=(...args:any[])=>{
      const current=context.getStore();
      if(!current)return original(...args);
      const start=performance.now();
      const finish=()=>{current.queries++;current.sqlMs+=performance.now()-start;};
      const cb=args.at(-1);
      if(typeof cb==='function') {
        args[args.length-1]=(...result:any[])=>{finish();cb(...result);};
        try{return original(...args);}catch(e){finish();throw e;}
      }
      try {return Promise.resolve(original(...args)).finally(finish);}catch(e){finish();throw e;}
    };
    return client;
  };
  for(const pool of new Set(pools)) {
    const original=pool.connect.bind(pool) as any;
    (pool as any).connect=(callback?:any)=>{
      if(callback)return original((error:any,client:any,release:any)=>callback(error,client?instrument(client):client,release));
      return original().then(instrument);
    };
  }
  app.use('/api',(_req,res,next)=>context.run({start:performance.now(),queries:0,sqlMs:0},()=>{
    const original=res.json.bind(res);
    res.json=(body:any)=>{
      const sample=context.getStore()!;
      res.setHeader('Server-Timing',`app;dur=${(performance.now()-sample.start).toFixed(2)}, sql;dur=${sample.sqlMs.toFixed(2)}, queries;desc="${sample.queries}"`);
      return original(body);
    };
    next();
  }));
}
