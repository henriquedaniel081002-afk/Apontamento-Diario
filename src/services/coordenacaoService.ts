import { Apontamento } from '../types';
import { authService } from './authService';

async function api(path:string,init:RequestInit={}){
  const token=authService.getToken();
  const r=await fetch(path,{
    ...init,
    headers:{
      'Content-Type':'application/json',
      ...(token?{Authorization:`Bearer ${token}`}:{ }),
      ...(init.headers||{}),
    },
  });
  if(r.status===401){
    authService.logout();
    throw new Error('Sessão expirada. Entre novamente.');
  }
  const data=await r.json();
  if(!r.ok)throw new Error(data.error||'Erro na comunicação com o servidor.');
  return data;
}

export const coordenacaoService={
  async getAll():Promise<Apontamento[]>{
    return api('/api/coordenacao/apontamentos');
  },
  async update(id:string,data:Pick<Apontamento,'data'|'producoes'|'faltas'|'observacoes'>):Promise<Apontamento>{
    return api(`/api/coordenacao/apontamentos/${encodeURIComponent(id)}`,{
      method:'PUT',
      body:JSON.stringify(data),
    });
  },
  async delete(id:string):Promise<boolean>{
    await api(`/api/coordenacao/apontamentos/${encodeURIComponent(id)}`,{method:'DELETE'});
    return true;
  },
};
