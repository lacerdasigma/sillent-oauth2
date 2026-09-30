import 'dotenv/config';
export function config(e=process.env,{webOnly=false}={}){
 for(const k of [...(!webOnly?['DISCORD_TOKEN','OWNER_IDS','SOURCE_GUILD_ID']:[]),'DISCORD_CLIENT_ID','DISCORD_CLIENT_SECRET','TOKEN_ENCRYPTION_KEY','PUBLIC_BASE_URL'])if(!e[k]?.trim())throw new Error(`Preencha ${k} no .env`);
 const ids=s=>(s||'').split(',').map(x=>x.trim()).filter(Boolean);
 const owners=ids(e.OWNER_IDS),targets=ids(e.TARGET_GUILD_IDS);
 if(![e.DISCORD_CLIENT_ID,...(webOnly?[]:[e.SOURCE_GUILD_ID]),...owners,...targets].every(x=>/^\d{17,20}$/.test(x)))throw new Error('IDs Discord inválidos');
 if(!/^[a-f\d]{64}$/i.test(e.TOKEN_ENCRYPTION_KEY))throw new Error('Chave de criptografia inválida');
 const url=new URL(e.PUBLIC_BASE_URL);
 if(url.username||url.password||url.search||url.hash||url.pathname!=='/'||!(url.protocol==='https:'||(url.protocol==='http:'&&['localhost','127.0.0.1'].includes(url.hostname))))throw new Error('Use uma origem HTTPS pública ou HTTP localhost para teste');
 const port=Number(e.PORT||3001);if(!Number.isInteger(port)||port<1||port>65535)throw new Error('Porta inválida');
 return {...e,owners,targets,base:url.origin,redirect:url.origin+'/oauth/callback',secure:url.protocol==='https:',PORT:port,HOST:e.HOST||'127.0.0.1',DATABASE_PATH:e.DATABASE_PATH||'./data/oauth2.sqlite',COMMUNITY_NAME:e.COMMUNITY_NAME||'SilentXit'};
}
