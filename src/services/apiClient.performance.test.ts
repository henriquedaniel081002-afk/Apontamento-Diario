import {afterEach,describe,expect,it,vi} from 'vitest';
import {apiRequest} from './apiClient';
import {subscribeLoadingProgress} from './loadingProgressService';
afterEach(()=>vi.unstubAllGlobals());
describe('HTTP — bloqueio e limites',()=>{
 it('GET não bloqueia a tela; mutation mantém progresso e erro',async()=>{
   const events:any[]=[];const off=subscribeLoadingProgress(e=>events.push(e));
   vi.stubGlobal('fetch',vi.fn(async()=>new Response('{}',{status:200})));
   await apiRequest('/api/exemplo');expect(events).toHaveLength(0);
   await apiRequest('/api/exemplo',{method:'POST',body:'{}'});expect(events.map(e=>e.action)).toEqual(['start','finish']);
   off();
 });
 it('cancela resposta obsoleta e não cancela mutation por outra requisição',async()=>{
   const c=new AbortController();
   vi.stubGlobal('fetch',vi.fn(async()=>{c.abort();return new Response('{}');}));
   await expect(apiRequest('/api/exemplo',{signal:c.signal})).rejects.toMatchObject({name:'AbortError'});
   await expect(apiRequest('/api/exemplo',{method:'POST',body:'{}'})).resolves.toEqual({});
 });
 it('rejeita JSON acima de 5 MB antes da rede',async()=>{
   const fetch=vi.fn();vi.stubGlobal('fetch',fetch);
   await expect(apiRequest('/api/importar',{method:'POST',body:'a'.repeat(5*1024*1024+1)})).rejects.toMatchObject({status:413});
   expect(fetch).not.toHaveBeenCalled();
 });
 it('compartilha somente GETs simultâneos, sem cache de resultado',async()=>{
   let resolve:any;const fetch=vi.fn(()=>new Promise<Response>(r=>{resolve=r;}));vi.stubGlobal('fetch',fetch);
   const a=apiRequest('/api/same'),b=apiRequest('/api/same');expect(fetch).toHaveBeenCalledTimes(1);
   resolve(new Response('{}'));await Promise.all([a,b]);
   const c=apiRequest('/api/same');expect(fetch).toHaveBeenCalledTimes(2);resolve(new Response('{}'));await c;
 });

});
