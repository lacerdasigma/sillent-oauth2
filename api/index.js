import {config} from '../src/config.js';
import {createStore} from '../src/database.js';
import {DiscordAPI,createService} from '../src/service.js';
import {web} from '../src/web.js';
import {diagnosticError,logSafe} from '../src/diagnostics.js';
export function createHandler({readConfig=config,openStore=createStore,buildWeb=web,env=process.env,logger=console.error}={}){
 let application;
 async function initialize(){
 let stage='configuration',store;
 try{
 const cfg=readConfig(env,{webOnly:true});
 stage='database';store=await openStore(cfg,{requirePostgres:true,onStage:value=>{stage=value;}});
 stage='bind_application';await store.bindApplication(cfg.DISCORD_CLIENT_ID);
 stage='read_saved_tokens';const saved=await store.get('SELECT tokens FROM members LIMIT 1');
 if(saved){stage='decrypt_saved_tokens';try{store.open(saved.tokens);}catch{throw diagnosticError('TOKEN_DECRYPT_FAILED');}}
 stage='http_application';const api=new DiscordAPI(cfg),service=createService({store,api,cfg});return buildWeb({cfg,store,api,service});
 }catch(e){logSafe(stage,e,logger);await store?.close().catch(()=>{});throw e;}
 }
 return async function handler(req,res){
 let app;try{application??=initialize().catch(e=>{application=undefined;throw e;});app=await application;}
 catch{res.statusCode=503;res.setHeader('Cache-Control','no-store');res.setHeader('Content-Type','text/plain; charset=utf-8');res.end('Servico OAuth2 indisponivel. Confira as variaveis de ambiente e o banco de dados.');return;}
 // Express completes asynchronously; keep the serverless invocation alive until its response finishes.
 await new Promise(resolve=>{res.once('finish',resolve);res.once('close',resolve);app(req,res);});
 };
}
export default createHandler();
