import {logSafe} from './diagnostics.js';
import express from 'express';
import {rateLimit} from 'express-rate-limit';
import {timingSafeEqual} from 'node:crypto';
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function web({cfg,store,api,service}){
 const app=express();app.disable('x-powered-by');
 app.use((_q,r,n)=>{r.set({'Cache-Control':'no-store','Referrer-Policy':'no-referrer','Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'none'; form-action 'self'",'X-Content-Type-Options':'nosniff'});n();});
 app.use(rateLimit({windowMs:60000,limit:30,standardHeaders:'draft-8',legacyHeaders:false}));
 const page=(r,title,body)=>r.type('html').send(`<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(title)}</title><style>body{background:#11111b;color:#eee;font:18px system-ui;max-width:680px;margin:10vh auto;padding:24px;line-height:1.6}a{color:#b9adff}h1{line-height:1.2}a.button{display:inline-block;padding:12px 20px;background:#6653dc;color:white;border-radius:10px;text-decoration:none}</style><h1>${escape(title)}</h1>${body}</html>`);
 app.get('/',(_q,r)=>r.redirect('/oauth/start'));
 app.get('/privacidade',(_q,r)=>page(r,cfg.COMMUNITY_NAME,`<p>Autorize a recuperação da comunidade. Se este servidor precisar ser substituído, a equipe poderá adicionar você ao novo servidor desta mesma comunidade.</p><p>Guardamos seu ID Discord, a data da autorização e tokens criptografados para renovar essa permissão. Não acessamos suas mensagens nem sua senha. A autorização é opcional.</p><p>Para cancelar, use <b>/desautorizar</b> no bot ou remova o aplicativo em <b>Configurações do Discord → Aplicativos autorizados</b>. Os dados locais são apagados pelo comando; uma revogação no Discord será detectada na próxima tentativa de uso.</p><a class="button" href="/oauth/start">Concordar e autorizar no Discord</a>`));
 app.get('/oauth/start',async(_q,r)=>{
 const state=await store.state();r.cookie('oauth_state',state,{httpOnly:true,sameSite:'lax',secure:cfg.secure,maxAge:600000,path:'/oauth'});
 const u=new URL('https://discord.com/oauth2/authorize');u.search=new URLSearchParams({client_id:cfg.DISCORD_CLIENT_ID,redirect_uri:cfg.redirect,response_type:'code',scope:'identify guilds.join',state,prompt:'consent'}).toString();r.redirect(u.href);
 });
 app.get('/oauth/callback',async(q,r)=>{
 const state=q.query.state,cookie=q.headers.cookie?.split(';').map(x=>x.trim()).find(x=>x.startsWith('oauth_state='))?.slice(12);
 r.clearCookie('oauth_state',{path:'/oauth',secure:cfg.secure,httpOnly:true,sameSite:'lax'});
 if(typeof state!=='string'||!cookie||!/^[a-f0-9]{64}$/.test(state)||!/^[a-f0-9]{64}$/.test(cookie)||!timingSafeEqual(Buffer.from(state),Buffer.from(cookie))||!await store.consume(state))return page(r.status(400),'Link expirado','<p>Volte ao painel e inicie a autorização novamente.</p>');
 if(q.query.error)return page(r,'Autorização cancelada','<p>Nenhuma autorização foi salva.</p>');
 if(typeof q.query.code!=='string'||q.query.code.length>2048)return r.sendStatus(400);
 try{const tokens=await api.token({grant_type:'authorization_code',code:q.query.code,redirect_uri:cfg.redirect});const user=await api.me(tokens.access_token);if(!/^\d{17,20}$/.test(user.id)||user.bot)throw new Error('Conta inválida');await service.withUser(user.id,()=>store.save(user.id,tokens));return page(r,'Autorização concluída','<p>Você autorizou a recuperação desta comunidade. Pode fechar esta página e voltar ao Discord.</p>');}
 catch(e){logSafe('oauth_callback',e);return page(r.status(502),'Não foi possível autorizar','<p>Tente novamente pelo painel. Nenhuma credencial será exibida aqui.</p>');}
 });
 app.use((e,q,r,_n)=>{const route=['/','/oauth/start','/oauth/callback','/privacidade'].includes(q.path)?q.path:'other';logSafe('http_route:'+route,e);r.status(500).type('text').send('Não foi possível concluir a solicitação.');});
 return app;
}
