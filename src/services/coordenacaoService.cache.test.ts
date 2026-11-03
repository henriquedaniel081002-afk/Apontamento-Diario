import {beforeEach,describe,expect,it,vi} from 'vitest';
import {coordenacaoService,invalidateRecordsCache} from './coordenacaoService';
import {apiRequest} from './apiClient';
import {readStoredToken} from './sessionStore';
vi.mock('./apiClient',()=>({apiRequest:vi.fn()}));
vi.mock('./sessionStore',()=>({readStoredToken:vi.fn(()=> 'user-a')}));
beforeEach(()=>{invalidateRecordsCache();vi.mocked(apiRequest).mockReset();vi.mocked(readStoredToken).mockReturnValue('user-a');});
describe('Coordenação — cache e identidade',()=>{
 it('reutiliza GET em andamento mas não repovoa cache após invalidação',async()=>{
  let resolveOld:any;vi.mocked(apiRequest).mockImplementationOnce(()=>new Promise(r=>{resolveOld=r;}));
  const first=coordenacaoService.getAll(),second=coordenacaoService.getAll();
  expect(apiRequest).toHaveBeenCalledTimes(1);
  invalidateRecordsCache();vi.mocked(apiRequest).mockResolvedValueOnce([{id:'new'}]);
  await coordenacaoService.getAll();resolveOld([{id:'old'}]);await Promise.all([first,second]);
  expect(await coordenacaoService.getAll()).toEqual([{id:'new'}]);
 });
 it('não compartilha os dados de duas sessões',async()=>{
  vi.mocked(apiRequest).mockResolvedValueOnce([{id:'a'}]).mockResolvedValueOnce([{id:'b'}]);
  await coordenacaoService.getAll();vi.mocked(readStoredToken).mockReturnValue('user-b');
  expect(await coordenacaoService.getAll()).toEqual([{id:'b'}]);expect(apiRequest).toHaveBeenCalledTimes(2);
 });
});
