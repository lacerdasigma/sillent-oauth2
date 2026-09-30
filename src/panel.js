import {EmbedBuilder,ActionRowBuilder,ButtonBuilder,ButtonStyle} from 'discord.js';
export const consent='Ao autorizar, você permite que a equipe adicione sua conta ao servidor substituto desta comunidade. A autorização é opcional. Guardamos seu ID e tokens criptografados. Cancele com /desautorizar ou em Aplicativos autorizados do Discord.';
export class PanelError extends Error{}
export function panelDesign(options,previous={}){
 const d={titulo:'Proteja seu acesso à comunidade',descricao:'Autorize sua conta para continuar com a comunidade caso precisemos mudar de servidor.',cor:'#7664ED',botao:'Autorizar conta',...previous};
 for(const name of ['titulo','descricao','cor','banner','miniatura','rodape','botao','texto']){
 const v=options.getString(name);if(v!==null&&v!==undefined)d[name]=v==='-'?'':v.replace(/\\n/g,'\n');
 }
 if(!d.titulo||!d.botao)throw new PanelError('Título e texto do botão não podem ficar vazios.');
 if(!/^#[a-f\d]{6}$/i.test(d.cor))throw new PanelError('Use uma cor hexadecimal, como #7664ED.');
 for(const name of ['banner','miniatura'])if(d[name]){try{const u=new URL(d[name]);if(u.protocol!=='https:'||u.username||u.password)throw 0;}catch{throw new PanelError('Banner e miniatura devem ser links HTTPS públicos.');}}
 return d;
}
export function panelView(d,cfg){
 const embed=new EmbedBuilder().setTitle(d.titulo).setColor(d.cor).setDescription((d.descricao?d.descricao+'\n\n':'')+consent);
 if(d.banner)embed.setImage(d.banner);if(d.miniatura)embed.setThumbnail(d.miniatura);if(d.rodape)embed.setFooter({text:d.rodape});
 return {content:d.texto||null,embeds:[embed],components:[new ActionRowBuilder().addComponents(new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel(d.botao).setURL(cfg.base+'/oauth/start'))],allowedMentions:{parse:[]}};
}
export async function publishPanel(i,{cfg,store,client}){
 const channel=i.options.getChannel('canal',true),messageId=i.options.getString('mensagem');
 let message,previous={};
 if(messageId){
 if(!/^\d{17,20}$/.test(messageId))throw new PanelError('Informe o ID da mensagem do painel.');
 message=await channel.messages.fetch(messageId);
 const saved=await store.get('SELECT value FROM settings WHERE key=?','panel:'+messageId);
 if(message.author.id!==client.user.id||(!saved&&!message.components.some(row=>row.components.some(c=>c.url===cfg.base||c.url===cfg.base+'/oauth/start'))))throw new PanelError('Esta mensagem não é um painel de autorização deste bot.');
 if(saved)previous=JSON.parse(saved.value);
 else{const e=message.embeds[0];previous={titulo:e?.title||'Autorize sua conta',descricao:e?.description||'',cor:'#'+(e?.color??0x7664ed).toString(16).padStart(6,'0'),banner:e?.image?.url,miniatura:e?.thumbnail?.url,rodape:e?.footer?.text,texto:message.content,botao:message.components[0]?.components[0]?.label||'Autorizar conta'};}
 }
 const d=panelDesign(i.options,previous),payload=panelView(d,cfg);
 const sent=message?await message.edit(payload):await channel.send(payload);
 await store.run('INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value','panel:'+sent.id,JSON.stringify(d));
 return message?'Painel atualizado.':'Painel publicado.';
}
