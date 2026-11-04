import os,subprocess,pathlib,sys,json,time
root=pathlib.Path(__file__).resolve().parent
folder=root/sys.argv[1]; commands=sys.argv[2:] or ['ci','run typecheck','run test','run build','run test:sql','run test:neon']
env={k:v for k,v in os.environ.items() if not any(s in k.upper() for s in ['DATABASE','SUPABASE','SESSION_SECRET','VITE_','NODE_OPTIONS','PGHOST','PGUSER','PGPASSWORD','PGPORT','PGDATABASE','PGSERVICE'])}
env['PATH']=str(root/'runtime/node_modules/node/bin')+os.pathsep+env.get('PATH','')
env.update({'CI':'true','NO_COLOR':'1','TZ':'America/Manaus'})
for command in commands:
 name=command.replace('run ','').replace(':','-').replace(' ','-').replace('/','-').replace('\\','-')
 path=root/(sys.argv[1]+'-'+name+'.log')
 start=time.perf_counter()
 with path.open('w',encoding='utf8') as out:
  r=subprocess.run(['npm.cmd',*command.split()],cwd=folder,env=env,stdout=out,stderr=subprocess.STDOUT,shell=True)
 print(json.dumps({'step':command,'code':r.returncode,'seconds':round(time.perf_counter()-start,2),'log':str(path)}),flush=True)
 if r.returncode: sys.exit(r.returncode)
