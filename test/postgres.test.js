import test from 'node:test';
import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import {PostgresStore} from '../src/postgres-store.js';
import {createService} from '../src/service.js';
import {config} from '../src/config.js';
const key='b'.repeat(64),tokens={access_token:'test-access',refresh_token:'test-refresh',expires_in:1000,scope:'identify guilds.join'};
async function setup(t){const db=new PGlite();const pool={async query(q,p){const result=!p&&q.includes(';')?(await db.exec(q)).at(-1):await db.query(q,p);return {...result,rowCount:result.affectedRows??result.rows?.length??0};},async connect(){return {...this,release(){}};},async end(){await db.close();}};const store=await new PostgresStore('',key,pool).init();t.after(()=>store.close());return store;}
test('PostgreSQL executa schema, criptografia, callback state e vinculação de aplicativo',async t=>{
 const store=await setup(t);await store.bindApplication('app');await assert.rejects(()=>store.bindApplication('other'));await store.save('123',tokens);assert.deepEqual(store.open((await store.get('SELECT tokens FROM members WHERE id=?','123')).tokens),tokens);const state=await store.state();assert.equal(await store.consume(state),true);assert.equal(await store.consume(state),false);
});
test('PostgreSQL executa fila de migração e revogação com consultas assíncronas',async t=>{
 const store=await setup(t);await store.save('123',tokens);await store.enqueue('target','admin');await assert.rejects(()=>store.enqueue('target','admin'));const service=createService({store,cfg:{targets:['target']},api:{join:async()=>({status:201,data:{pending:false}}),revoke:async()=>{}}});await service.tick();assert.equal((await store.get('SELECT status FROM tasks')).status,'added');await service.forget('123');assert.equal(await store.get('SELECT * FROM members'),undefined);
});
test('Vercel valida configuração web sem exigir token do bot',()=>{
 const cfg=config({DISCORD_CLIENT_ID:'123456789012345678',DISCORD_CLIENT_SECRET:'test-secret',TOKEN_ENCRYPTION_KEY:key,PUBLIC_BASE_URL:'https://example.vercel.app',DATABASE_URL:'postgresql://example/test'},{webOnly:true});assert.equal(cfg.redirect,'https://example.vercel.app/oauth/callback');assert.equal(cfg.DISCORD_TOKEN,undefined);
});
