import {DatabaseSync} from 'node:sqlite';
import {mkdirSync} from 'node:fs';
import {dirname} from 'node:path';
import {createCipheriv,createDecipheriv,randomBytes,createHash} from 'node:crypto';
export const hash=s=>createHash('sha256').update(s).digest('hex');
export class Store{
 constructor(path,key){if(path!==':memory:')mkdirSync(dirname(path),{recursive:true});this.key=Buffer.from(key,'hex');this.db=new DatabaseSync(path);this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
 CREATE TABLE IF NOT EXISTS settings(key TEXT PRIMARY KEY,value TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS members(id TEXT PRIMARY KEY,tokens TEXT NOT NULL,expires INTEGER NOT NULL,consented INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS states(id TEXT PRIMARY KEY,expires INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS jobs(id INTEGER PRIMARY KEY,guild TEXT NOT NULL,actor TEXT NOT NULL,created INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS tasks(job INTEGER,user TEXT,status TEXT NOT NULL DEFAULT 'pending',PRIMARY KEY(job,user));`);}
 run(q,...p){return this.db.prepare(q).run(...p);}get(q,...p){return this.db.prepare(q).get(...p);}all(q,...p){return this.db.prepare(q).all(...p);}
 seal(value){const iv=randomBytes(12),c=createCipheriv('aes-256-gcm',this.key,iv);const data=Buffer.concat([c.update(JSON.stringify(value)),c.final()]);return Buffer.concat([iv,c.getAuthTag(),data]).toString('base64');}
 open(value){const b=Buffer.from(value,'base64'),d=createDecipheriv('aes-256-gcm',this.key,b.subarray(0,12));d.setAuthTag(b.subarray(12,28));return JSON.parse(Buffer.concat([d.update(b.subarray(28)),d.final()]).toString());}
 save(id,t){this.run('INSERT INTO members VALUES(?,?,?,?) ON CONFLICT(id) DO UPDATE SET tokens=excluded.tokens,expires=excluded.expires,consented=excluded.consented',id,this.seal(t),Date.now()+t.expires_in*1000,Date.now());}
 bindApplication(id){const saved=this.get("SELECT value FROM settings WHERE key='application'")?.value;if(saved&&saved!==id)throw new Error('Banco pertence a outro aplicativo');this.run("INSERT OR IGNORE INTO settings VALUES('application',?)",id);}
 refresh(id,t){this.run('UPDATE members SET tokens=?,expires=? WHERE id=?',this.seal(t),Date.now()+t.expires_in*1000,id);}
 state(){this.run('DELETE FROM states WHERE expires<?',Date.now());const s=randomBytes(32).toString('hex');this.run('INSERT INTO states VALUES(?,?)',hash(s),Date.now()+600000);return s;}
 consume(s){return this.run('DELETE FROM states WHERE id=? AND expires>?',hash(s),Date.now()).changes===1;}
 forget(id){this.run('DELETE FROM members WHERE id=?',id);this.run("UPDATE tasks SET status='revoked' WHERE user=? AND status='pending'",id);}
 enqueue(guild,actor){this.db.exec('BEGIN IMMEDIATE');try{if(this.get("SELECT 1 FROM tasks WHERE status='pending'"))throw new Error('Já existe uma migração pendente.');const id=Number(this.run('INSERT INTO jobs(guild,actor,created) VALUES(?,?,?)',guild,actor,Date.now()).lastInsertRowid);this.run('INSERT INTO tasks(job,user) SELECT ?,id FROM members',id);this.db.exec('COMMIT');return id;}catch(e){this.db.exec('ROLLBACK');throw e;}}
}
