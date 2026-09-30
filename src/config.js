import 'dotenv/config';
import {diagnosticError} from './diagnostics.js';
export function config(input=process.env,{webOnly=false}={}){
 const e={...input};for(const k of ['DISCORD_TOKEN','DISCORD_CLIENT_ID','DISCORD_CLIENT_SECRET','OWNER_IDS','SOURCE_GUILD_ID','TARGET_GUILD_IDS','TOKEN_ENCRYPTION_KEY','PUBLIC_BASE_URL','DATABASE_URL','PORT'])if(typeof e[k]==='string')e[k]=e[k].trim();
 const invalid=field=>{throw diagnosticError('CONFIG_INVALID',field);};
 for(const k of [...(!webOnly?['DISCORD_TOKEN','OWNER_IDS','SOURCE_GUILD_ID']:[]),'DISCORD_CLIENT_ID','DISCORD_CLIENT_SECRET','TOKEN_ENCRYPTION_KEY','PUBLIC_BASE_URL'])if(!e[k])invalid(k);
 const ids=s=>(s||'').split(',').map(x=>x.trim()).filter(Boolean);
 const owners=webOnly?[]:ids(e.OWNER_IDS),targets=webOnly?[]:ids(e.TARGET_GUILD_IDS);
 for(const [field,values] of [['DISCORD_CLIENT_ID',[e.DISCORD_CLIENT_ID]],...(!webOnly?[['SOURCE_GUILD_ID',[e.SOURCE_GUILD_ID]],['OWNER_IDS',owners],['TARGET_GUILD_IDS',targets]]:[])])if(!values.every(x=>/^\d{17,20}$/.test(x)))invalid(field);
 if(!/^[a-f\d]{64}$/i.test(e.TOKEN_ENCRYPTION_KEY))invalid('TOKEN_ENCRYPTION_KEY');
 let url;try{url=new URL(e.PUBLIC_BASE_URL);}catch{invalid('PUBLIC_BASE_URL');}
 if(url.username||url.password||url.search||url.hash||url.pathname!=='/'||!(url.protocol==='https:'||(url.protocol==='http:'&&['localhost','127.0.0.1'].includes(url.hostname))))invalid('PUBLIC_BASE_URL');
 const port=webOnly?3001:Number(e.PORT||3001);if(!Number.isInteger(port)||port<1||port>65535)invalid('PORT');
 return {...e,owners,targets,base:url.origin,redirect:url.origin+'/oauth/callback',secure:url.protocol==='https:',PORT:port,HOST:e.HOST||'127.0.0.1',DATABASE_PATH:e.DATABASE_PATH||'./data/oauth2.sqlite',COMMUNITY_NAME:e.COMMUNITY_NAME||'SilentXit'};
}
