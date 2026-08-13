import { Apontamento } from '../types';
import { authService } from './authService';
async function api(path:string,init:RequestInit={}){const token=authService.getToken();const r=await fetch(path,{...init,headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{ }),...(init.headers||{})}});if(r.status===401){authService.logout();throw new Error('Sessão expirada. Entre novamente.');}const data=await r.json();if(!r.ok)throw new Error(data.error||'Erro na comunicação com o servidor.');return data;}
export const apontamentoService={
  async getAll():Promise<Apontamento[]>{return api('/api/apontamentos');},
  async getByUserSector(_userId:string,_setor:string):Promise<Apontamento[]>{return api('/api/apontamentos');},
  async getByDateAndSector(date:string,_setor:string,_userId:string):Promise<Apontamento|null>{return api(`/api/apontamentos/data/${encodeURIComponent(date)}`);},
  async save(apontamentoData:Omit<Apontamento,'id'|'createdAt'|'updatedAt'>&{id?:string}):Promise<Apontamento>{return api('/api/apontamentos',{method:'POST',body:JSON.stringify(apontamentoData)});},
  async update(id:string,apontamentoData:Pick<Apontamento,'data'|'producoes'|'faltas'|'observacoes'>):Promise<Apontamento>{return api(`/api/apontamentos/${encodeURIComponent(id)}`,{method:'PUT',body:JSON.stringify(apontamentoData)});},
  async delete(id:string):Promise<boolean>{await api(`/api/apontamentos/${encodeURIComponent(id)}`,{method:'DELETE'});return true;}
};
