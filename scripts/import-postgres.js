import {existsSync} from 'node:fs';
import {config} from '../src/config.js';
import {Store} from '../src/store.js';
import {PostgresStore} from '../src/postgres-store.js';
let local,remote;
try{
 const cfg=config();if(!cfg.DATABASE_URL)throw new Error();if(!existsSync(cfg.DATABASE_PATH))throw new Error();
 local=new Store(cfg.DATABASE_PATH,cfg.TOKEN_ENCRYPTION_KEY);local.bindApplication(cfg.DISCORD_CLIENT_ID);
 remote=await new PostgresStore(cfg.DATABASE_URL,cfg.TOKEN_ENCRYPTION_KEY).init();await remote.bindApplication(cfg.DISCORD_CLIENT_ID);
 const saved=await remote.get('SELECT tokens FROM members LIMIT 1');if(saved)remote.open(saved.tokens);
 if(local.get("SELECT 1 FROM tasks WHERE status='pending'"))throw new Error();
 await remote.locked('oauth-import',async()=>{
 for(const member of local.all('SELECT * FROM members')){local.open(member.tokens);await remote.run('INSERT INTO members(id,tokens,expires,consented) VALUES(?,?,?,?) ON CONFLICT(id) DO NOTHING',member.id,member.tokens,member.expires,member.consented);}
 for(const setting of local.all("SELECT * FROM settings WHERE key LIKE 'panel:%'"))await remote.run('INSERT INTO settings VALUES(?,?) ON CONFLICT(key) DO NOTHING',setting.key,setting.value);
 });
 console.log('Autorizações e configurações de painéis importadas. O banco SQLite original foi preservado.');
}catch{console.error('Importação não concluída. Confira DATABASE_URL, chave, aplicativo e banco local; cancele migrações pendentes antes de importar.');process.exitCode=1;}
finally{local?.db.close();await remote?.close();}
