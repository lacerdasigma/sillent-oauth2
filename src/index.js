import {Client,GatewayIntentBits,Events,MessageFlags,EmbedBuilder,ButtonBuilder,ButtonStyle,ActionRowBuilder,PermissionFlagsBits as P} from 'discord.js';
import {randomBytes} from 'node:crypto';
import {config} from './config.js';
import {createStore} from './database.js';
import {DiscordAPI,createService} from './service.js';
import {web} from './web.js';
import {publishPanel,PanelError} from './panel.js';
import {isAdmin} from './commands.js';
let client,server,timer;
try{
const cfg=config(),store=await createStore(cfg),api=new DiscordAPI(cfg),service=createService({store,api,cfg});
await store.bindApplication(cfg.DISCORD_CLIENT_ID);
// Fail early if the database was restored without its encryption key.
const existing=await store.get('SELECT tokens FROM members LIMIT 1');if(existing)store.open(existing.tokens);
client=new Client({intents:[GatewayIntentBits.Guilds],allowedMentions:{parse:[]}});
const confirmations=new Map(),row=b=>new ActionRowBuilder().addComponents(b);
async function destination(i){
 if(!cfg.targets.includes(i.guildId))throw new Error('Adicione este servidor em TARGET_GUILD_IDS no .env e reinicie.');
 const me=await i.guild.members.fetchMe();if(!me.permissions.has(P.CreateInstantInvite))throw new Error('O bot precisa de Criar convite no servidor de destino.');
}
client.on(Events.InteractionCreate,async i=>{
 if(!i.isChatInputCommand()&&!i.isButton())return;
 try{
 await i.deferReply({flags:MessageFlags.Ephemeral});
 if(i.isChatInputCommand()&&i.commandName==='desautorizar'){await service.forget(i.user.id);return i.editReply('Sua autorização local foi apagada. Remova também o aplicativo em Configurações → Aplicativos autorizados do Discord.');}
 if(!isAdmin(i,cfg))return i.editReply('Somente administradores definidos em OWNER_IDS podem usar este controle.');
 if(i.isButton()){
 const entry=confirmations.get(i.customId);if(!entry||entry.user!==i.user.id||entry.guild!==i.guildId||entry.expires<Date.now())return i.editReply('Confirmação inválida ou expirada. Use /oauth migrar novamente.');
 confirmations.delete(i.customId);await destination(i);const job=await store.enqueue(i.guildId,i.user.id);return i.editReply(`Migração #${job} iniciada. Veja o andamento com /oauth status. Autorizações revogadas e restrições do Discord serão respeitadas.`);
 }
 if(i.commandName!=='oauth')return i.editReply('Comando desconhecido.');
 const action=i.options.getSubcommand();
 if(action==='painel'){
 if(i.guildId!==cfg.SOURCE_GUILD_ID)return i.editReply('Publique o painel no servidor configurado em SOURCE_GUILD_ID.');
 const channel=i.options.getChannel('canal',true);const me=await i.guild.members.fetchMe();
 if(!channel.permissionsFor(me)?.has([P.ViewChannel,P.SendMessages,P.EmbedLinks]))return i.editReply('Faltam permissões para publicar nesse canal.');
 return i.editReply(await publishPanel(i,{cfg,store,client}));
 }
 if(action==='status'){
 const count=(await store.get('SELECT COUNT(*) AS n FROM members')).n,job=await store.get('SELECT * FROM jobs ORDER BY id DESC LIMIT 1');
 const stats=job?(await store.all('SELECT status,COUNT(*) AS n FROM tasks WHERE job=? GROUP BY status',job.id)).map(x=>`${x.status}: ${x.n}`).join('\n'):'Nenhuma migração iniciada.';
 return i.editReply(`Autorizações salvas: ${count}\n${job?`Última migração: #${job.id} • servidor ${job.guild}\n`:''}${stats}`);
 }
 if(action==='cancelar'){await store.run("UPDATE tasks SET status='cancelled' WHERE status='pending'");return i.editReply('Fila cancelada. Uma solicitação já em andamento pode terminar.');}
 if(action==='migrar'){
 await destination(i);for(const [key,v] of confirmations)if(v.expires<Date.now())confirmations.delete(key);
 const key='migrate:'+randomBytes(16).toString('hex');confirmations.set(key,{user:i.user.id,guild:i.guildId,expires:Date.now()+120000});
 const count=store.get('SELECT COUNT(*) AS n FROM members').n;
 return i.editReply({content:`Adicionar até ${count} pessoas que autorizaram a recuperação ao servidor **${i.guild.name}** (ID ${i.guildId})?\nConfirme somente se este é o servidor substituto da mesma comunidade. Expira em 2 minutos.`,components:[row(new ButtonBuilder().setCustomId(key).setLabel('Confirmar migração').setStyle(ButtonStyle.Danger))]});
 }
 }catch(e){const known=['Já existe uma migração pendente.','Adicione este servidor em TARGET_GUILD_IDS no .env e reinicie.','O bot precisa de Criar convite no servidor de destino.'];const message=e instanceof PanelError||known.includes(e.message)?e.message:'Não foi possível concluir. Confira configuração e permissões.';if(i.deferred||i.replied)await i.editReply({content:message,components:[]}).catch(()=>{});}
});
client.on(Events.Error,()=>console.error('Erro na conexão Discord.'));
client.once(Events.ClientReady,()=>{
 if(client.user.id!==cfg.DISCORD_CLIENT_ID){console.error('Token e Client ID pertencem a aplicativos diferentes.');client.destroy();process.exitCode=1;return;}
 server=web({cfg,store,api,service}).listen(cfg.PORT,cfg.HOST,()=>console.log(`OAuth2 ativo na porta ${cfg.PORT}.`));
 server.on('error',()=>{console.error('Não foi possível abrir a porta HTTP.');shutdown(1);});
 timer=setInterval(()=>void service.tick().catch(()=>console.error('Fila pendente; nova tentativa no próximo ciclo.')),2000);
});
await client.login(cfg.DISCORD_TOKEN);
}catch{console.error('Falha ao iniciar. Confira .env, credenciais, banco e chave de criptografia.');shutdown(1);}
function shutdown(code=0){clearInterval(timer);client?.destroy();server?.close();process.exitCode=code;const deadline=setTimeout(()=>process.exit(code),25000);deadline.unref();}
for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>shutdown());
