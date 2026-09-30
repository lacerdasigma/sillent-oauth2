import {config} from '../src/config.js';
import {createStore} from '../src/database.js';
import {DiscordAPI,createService} from '../src/service.js';
import {web} from '../src/web.js';
let application;
async function initialize(){const cfg=config(process.env,{webOnly:true});if(!cfg.DATABASE_URL)throw new Error('Configure DATABASE_URL');const store=await createStore(cfg);await store.bindApplication(cfg.DISCORD_CLIENT_ID);const saved=await store.get('SELECT tokens FROM members LIMIT 1');if(saved)store.open(saved.tokens);const api=new DiscordAPI(cfg),service=createService({store,api,cfg});return web({cfg,store,api,service});}
export default async function handler(req,res){try{application??=initialize().catch(e=>{application=undefined;throw e;});const app=await application;return app(req,res);}catch{res.statusCode=503;res.setHeader('Cache-Control','no-store');res.end('Servico OAuth2 indisponivel. Confira as variaveis de ambiente e o banco de dados.');}}
