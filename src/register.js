import {REST,Routes} from 'discord.js';
import {config} from './config.js';
import {commands} from './commands.js';
try{const cfg=config(),rest=new REST({version:'10'}).setToken(cfg.DISCORD_TOKEN);const app=await rest.get('/oauth2/applications/@me');if(app.id!==cfg.DISCORD_CLIENT_ID)throw new Error('Aplicativo divergente');await rest.put(Routes.applicationCommands(cfg.DISCORD_CLIENT_ID),{body:commands});console.log('Comandos /oauth e /desautorizar registrados.');}catch{console.error('Falha ao registrar: confira token e Client ID do novo aplicativo.');process.exitCode=1;}
