import test from 'node:test';
import assert from 'node:assert/strict';
import {Store,hash} from '../src/store.js';
import {createService,ApiError} from '../src/service.js';
import {web} from '../src/web.js';
import {isAdmin,commands} from '../src/commands.js';
import {PermissionFlagsBits as P,PermissionsBitField} from 'discord.js';
const key='a'.repeat(64),id='123456789012345678';
const tokens={access_token:'access-secret',refresh_token:'refresh-secret',expires_in:3600,scope:'identify guilds.join'};
const cfg={targets:['dest'],owners:[id],base:'http://localhost:3001',redirect:'http://localhost:3001/oauth/callback',DISCORD_CLIENT_ID:id,COMMUNITY_NAME:'SilentXit',secure:false};
function setup(api={}){const store=new Store(':memory:',key);store.save(id,tokens);return {store,service:createService({store,api,cfg})};}
test('tokens criptografados, autenticados e recuperáveis somente com a chave correta',()=>{
 const {store}=setup();const raw=store.get('SELECT tokens FROM members').tokens;assert.ok(!raw.includes('secret'));assert.deepEqual(store.open(raw),tokens);store.key=Buffer.alloc(32);assert.throws(()=>store.open(raw));store.db.close();
});
test('state é de uso único e expira',()=>{const store=new Store(':memory:',key),s=store.state();assert.equal(store.consume(s),true);assert.equal(store.consume(s),false);const expired=store.state();store.run('UPDATE states SET expires=0 WHERE id=?',hash(expired));assert.equal(store.consume(expired),false);store.db.close();});
test('fila não duplica trabalho e distingue membros existentes',async()=>{
 let calls=0;const {store,service}=setup({join:async()=>{calls++;return {status:204};}});store.enqueue('dest','admin');assert.throws(()=>store.enqueue('dest','admin'));await service.tick();await service.tick();assert.equal(calls,1);assert.equal(store.get('SELECT status FROM tasks').status,'already_member');store.db.close();
});
test('refresh rotaciona tokens antes da entrada e guarda o novo segredo',async()=>{
 const refreshed={...tokens,access_token:'new-access',refresh_token:'new-refresh'};
 const {store,service}=setup({token:async values=>{assert.equal(values.refresh_token,tokens.refresh_token);return refreshed;},join:async(_g,_u,t)=>{assert.equal(t,'new-access');return {status:201,data:{pending:true}};}});
 store.run('UPDATE members SET expires=0');store.enqueue('dest','admin');await service.tick();assert.equal(store.open(store.get('SELECT tokens FROM members').tokens).refresh_token,'new-refresh');assert.equal(store.get('SELECT status FROM tasks').status,'screening');store.db.close();
});
test('revogação remove tokens e impede novas entradas mesmo se Discord indisponível',async()=>{
 let calls=0;const {store,service}=setup({join:async()=>{calls++;},revoke:async()=>{throw new Error('offline');}});store.enqueue('dest','admin');await service.forget(id);await service.tick();assert.equal(calls,0);assert.equal(store.get('SELECT * FROM members'),undefined);assert.equal(store.get('SELECT status FROM tasks').status,'revoked');store.db.close();
});
test('429 mantém fila pendente; credencial de bot inválida não apaga autorização do usuário',async()=>{
 for(const code of [429,401]){const {store,service}=setup({join:async()=>{throw new ApiError(code,'',10);}});store.enqueue('dest','admin');await service.tick();assert.equal(store.get('SELECT status FROM tasks').status,code===429?'pending':'blocked');assert.ok(store.get('SELECT * FROM members'));store.db.close();}
});
test('refresh revogado remove autorização e destino fora da lista não é chamado',async()=>{
 const {store,service}=setup({token:async()=>{throw new ApiError(400,'invalid_grant');}});store.run('UPDATE members SET expires=0');store.enqueue('dest','admin');await service.tick();assert.equal(store.get('SELECT * FROM members'),undefined);store.save(id,tokens);store.enqueue('other','admin');await service.tick();assert.equal(store.get('SELECT status FROM tasks ORDER BY job DESC LIMIT 1').status,'destination_disabled');store.db.close();
});
test('controles administrativos exigem ID autorizado E Gerenciar servidor',()=>{
 assert.ok(isAdmin({user:{id},guildId:'g',memberPermissions:new PermissionsBitField(P.ManageGuild)},cfg));
 assert.ok(!isAdmin({user:{id:'other'},guildId:'g',memberPermissions:new PermissionsBitField(P.Administrator)},cfg));
 assert.ok(!isAdmin({user:{id},guildId:'g',memberPermissions:new PermissionsBitField()},cfg));
 assert.equal(commands.length,2);
});
test('callback exige cookie correspondente, salva consentimento e rejeita replay',async t=>{
 const store=new Store(':memory:',key);let exchanges=0;
 const api={token:async()=>{exchanges++;return tokens;},me:async()=>({id})},service=createService({store,api,cfg});
 const server=web({cfg,store,api,service}).listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));t.after(()=>{server.close();store.db.close();});
 const base='http://127.0.0.1:'+server.address().port;
 const start=await fetch(base+'/oauth/start',{redirect:'manual'});const url=new URL(start.headers.get('location')),cookie=start.headers.get('set-cookie').split(';')[0];
 assert.equal(url.searchParams.get('scope'),'identify guilds.join');
 const callback=base+'/oauth/callback?code=test&state='+url.searchParams.get('state');
 assert.equal((await fetch(callback)).status,400);assert.equal(exchanges,0);
 assert.equal((await fetch(callback,{headers:{cookie}})).status,200);assert.equal(exchanges,1);assert.ok(store.get('SELECT * FROM members WHERE id=?',id));
 assert.equal((await fetch(callback,{headers:{cookie}})).status,400);assert.equal(exchanges,1);
});

test('banco não pode ser reutilizado por outro aplicativo e refresh preserva data de consentimento',()=>{
 const {store}=setup();store.bindApplication('app1');store.bindApplication('app1');assert.throws(()=>store.bindApplication('app2'));
 store.run('UPDATE members SET consented=100');store.refresh(id,tokens);assert.equal(store.get('SELECT consented FROM members').consented,100);store.db.close();
});
test('banimento de um usuário não cancela toda a migração',async()=>{
 const {store,service}=setup({join:async()=>{throw new ApiError(403,40007);}});store.enqueue('dest','admin');await service.tick();assert.equal(store.get('SELECT status FROM tasks').status,'failed');assert.ok(store.get('SELECT * FROM members'));store.db.close();
});
