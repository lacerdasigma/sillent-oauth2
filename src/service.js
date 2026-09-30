export class ApiError extends Error{constructor(status,code,retry=0){super('Falha na API Discord');this.status=status;this.code=code;this.retry=retry;}}
export class DiscordAPI{
 constructor(cfg,fetcher=fetch){this.cfg=cfg;this.fetcher=fetcher;}
 async request(path,options={}){
 const r=await this.fetcher('https://discord.com/api/v10'+path,{...options,signal:AbortSignal.timeout(20000)});
 const data=r.status===204?null:await r.json().catch(()=>null);
 if(!r.ok)throw new ApiError(r.status,data?.error||data?.code,Number(data?.retry_after)||0);
 return {status:r.status,data};
 }
 async token(values){const {data}=await this.request('/oauth2/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:this.cfg.DISCORD_CLIENT_ID,client_secret:this.cfg.DISCORD_CLIENT_SECRET,...values})});
 if(!data?.access_token||!data.refresh_token||!Number.isFinite(data.expires_in)||!['identify','guilds.join'].every(s=>data.scope?.split(' ').includes(s)))throw new ApiError(400,'missing_scope');return data;}
 async me(token){return (await this.request('/users/@me',{headers:{Authorization:'Bearer '+token}})).data;}
 async join(guild,user,token){return this.request(`/guilds/${guild}/members/${user}`,{method:'PUT',headers:{Authorization:'Bot '+this.cfg.DISCORD_TOKEN,'Content-Type':'application/json'},body:JSON.stringify({access_token:token})});}
 async revoke(token){await this.request('/oauth2/token/revoke',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:this.cfg.DISCORD_CLIENT_ID,client_secret:this.cfg.DISCORD_CLIENT_SECRET,token})});}
}
export function createService({store,api,cfg}){
 let busy=false,next=0;const locks=new Map();
 const withUser=(id,fn)=>{const previous=locks.get(id)||Promise.resolve();const task=previous.catch(()=>{}).then(()=>store.withUser?store.withUser(id,fn):fn());locks.set(id,task);return task.finally(()=>{if(locks.get(id)===task)locks.delete(id);});};
 return {withUser,
 async forget(id){return withUser(id,async()=>{const row=await store.get('SELECT * FROM members WHERE id=?',id);await store.forget(id);if(row)try{await api.revoke(store.open(row.tokens).access_token);}catch{/* Local removal already blocks future migrations. */}});},
 async tick(){if(busy||Date.now()<next)return;busy=true;try{
 const task=await store.get("SELECT t.*,j.guild FROM tasks t JOIN jobs j ON j.id=t.job WHERE t.status='pending' ORDER BY t.job,t.user LIMIT 1");if(!task)return;
 if(!cfg.targets.includes(task.guild)){await store.run("UPDATE tasks SET status='destination_disabled' WHERE job=? AND status='pending'",task.job);return;}
 await withUser(task.user,async()=>{
 if((await store.get('SELECT status FROM tasks WHERE job=? AND user=?',task.job,task.user))?.status!=='pending')return;
 const member=await store.get('SELECT * FROM members WHERE id=?',task.user);let status;
 if(!member)status='revoked';else try{
 let tokens=store.open(member.tokens);
 if(member.expires<Date.now()+60000){tokens=await api.token({grant_type:'refresh_token',refresh_token:tokens.refresh_token});await store.refresh(task.user,tokens);}
 const result=await api.join(task.guild,task.user,tokens.access_token);status=result.status===204?'already_member':result.data?.pending?'screening':'added';
 }catch(e){
 if(e.status===429){next=Date.now()+Math.max(1000,e.retry*1000);return;}
 if(e.status>=500||!e.status){next=Date.now()+30000;return;}
 if(e.code==='invalid_grant'){await store.forget(task.user);status='revoked';}
 else if(e.code===50025){await store.forget(task.user);status='revoked';}
 else if(e.code===40007)status='failed';
 else if(e.status===403||e.status===401){await store.run("UPDATE tasks SET status='blocked' WHERE job=? AND status='pending'",task.job);return;}
 else status='failed';
 }
 await store.run('UPDATE tasks SET status=? WHERE job=? AND user=?',status,task.job,task.user);
 });
 }finally{busy=false;}}
 };
}
