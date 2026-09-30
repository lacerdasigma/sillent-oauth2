import {SlashCommandBuilder,PermissionFlagsBits as P} from 'discord.js';
export const commands=[
 new SlashCommandBuilder().setName('oauth').setDescription('Administrar autorizações da comunidade').setDefaultMemberPermissions(P.ManageGuild).setContexts(0)
 .addSubcommand(s=>s.setName('painel').setDescription('Publicar painel de autorização').addChannelOption(o=>o.setName('canal').setDescription('Canal do painel').addChannelTypes(0).setRequired(true)).addStringOption(o=>o.setName('titulo').setDescription('Título do painel').setMaxLength(200)).addStringOption(o=>o.setName('descricao').setDescription('Texto adicional do painel').setMaxLength(1500))
 .addStringOption(o=>o.setName('mensagem').setDescription('ID de um painel existente neste canal para editar').setMaxLength(20))
 .addStringOption(o=>o.setName('cor').setDescription('Cor hexadecimal, exemplo #7664ED').setMaxLength(7))
 .addStringOption(o=>o.setName('banner').setDescription('URL HTTPS da imagem grande; - para remover').setMaxLength(1000))
 .addStringOption(o=>o.setName('miniatura').setDescription('URL HTTPS da miniatura; - para remover').setMaxLength(1000))
 .addStringOption(o=>o.setName('rodape').setDescription('Texto do rodapé; - para remover').setMaxLength(500))
 .addStringOption(o=>o.setName('botao').setDescription('Texto do botão de autorização').setMaxLength(80))
 .addStringOption(o=>o.setName('texto').setDescription('Mensagem fora da embed; - para remover').setMaxLength(2000)))
 .addSubcommand(s=>s.setName('status').setDescription('Quantidade de autorizações e resultado da última migração'))
 .addSubcommand(s=>s.setName('migrar').setDescription('Preparar migração para ESTE servidor'))
 .addSubcommand(s=>s.setName('cancelar').setDescription('Cancelar tarefas pendentes da migração')),
 new SlashCommandBuilder().setName('desautorizar').setDescription('Apagar minha autorização de recuperação da comunidade').setContexts(0,1,2)
].map(c=>c.toJSON());
export function isAdmin(i,cfg){return cfg.owners.includes(i.user.id)&&i.guildId&&i.memberPermissions?.has(P.ManageGuild);}
