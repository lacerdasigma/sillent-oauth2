import {diagnosticError} from './diagnostics.js';
export async function createStore(cfg,{requirePostgres=false,onStage=()=>{}}={}){
 if(cfg.DATABASE_URL){
 let u;try{u=new URL(cfg.DATABASE_URL);}catch{throw diagnosticError('DATABASE_URL_INVALID','DATABASE_URL');}
 if(!['postgres:','postgresql:'].includes(u.protocol)||!u.hostname||u.pathname.length<2)throw diagnosticError('DATABASE_URL_INVALID','DATABASE_URL');
 onStage('database_module');const {PostgresStore}=await import('./postgres-store.js');
 const store=new PostgresStore(cfg.DATABASE_URL,cfg.TOKEN_ENCRYPTION_KEY);
 try{return await store.init(onStage);}catch(e){await store.close().catch(()=>{});throw e;}
 }
 if(requirePostgres||process.env.VERCEL)throw diagnosticError('DATABASE_REQUIRED','DATABASE_URL');
 const {Store}=await import('./store.js');return new Store(cfg.DATABASE_PATH,cfg.TOKEN_ENCRYPTION_KEY);
}
