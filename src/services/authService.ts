import { User } from '../types';
import { MOCK_USERS } from '../mocks/mockData';

const CURRENT_USER_KEY='itam_current_user_v2';
const TOKEN_KEY='itam_auth_token_v1';

export const authService={
  getUsers():User[]{return MOCK_USERS;},
  getCurrentUser():User|null{
    try{
      const s=localStorage.getItem(CURRENT_USER_KEY);
      if(!s)return null;
      const user=JSON.parse(s) as User;
      if(!user.perfil) user.perfil='APONTADOR';
      if(!Array.isArray(user.linhas)) user.linhas=[];
      return user;
    }catch{return null;}
  },
  async login(userId:string,passwordAttempt:string):Promise<{success:boolean;user?:User;error?:string}>{
    const selected=MOCK_USERS.find(u=>u.id===userId);
    if(!selected)return{success:false,error:'Usuário não encontrado.'};
    try{
      const r=await fetch('/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({login:selected.name,password:passwordAttempt})});
      const j=await r.json();
      if(!r.ok)return{success:false,error:j.error||'Usuário ou senha incorretos.'};
      localStorage.setItem(CURRENT_USER_KEY,JSON.stringify(j.user));
      localStorage.setItem(TOKEN_KEY,j.token);
      return{success:true,user:j.user};
    }catch{return{success:false,error:'Não foi possível conectar ao servidor.'};}
  },
  logout(){localStorage.removeItem(CURRENT_USER_KEY);localStorage.removeItem(TOKEN_KEY);},
  getToken(){return localStorage.getItem(TOKEN_KEY);}
};
