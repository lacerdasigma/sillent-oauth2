# Bot OAuth2 — SilentXit

Aplicativo separado do bot da loja. Publica um painel de consentimento e permite adicionar usuários que autorizaram a recuperação a um servidor substituto da mesma comunidade. Não recupera membros que nunca autorizaram, autorizações revogadas, mensagens, cargos ou canais. Não deve ser usado para contornar banimentos ou medidas do Discord.

## Preparar

Requer Node.js 24 ou superior. Execute dentro desta pasta:

```powershell
npm install
npm run setup
```

O setup cria `.env` com chave aleatória de criptografia, sem sobrescrever configuração existente. Nunca envie o `.env` a outras pessoas.

1. Crie **outro aplicativo** no [Discord Developer Portal](https://discord.com/developers/applications). Em Bot, obtenha o token para `DISCORD_TOKEN`. Não use o token da loja.
2. Preencha `DISCORD_CLIENT_ID` com o Application ID e `DISCORD_CLIENT_SECRET` com o Client Secret da seção OAuth2.
3. Preencha `OWNER_IDS` com seus IDs de administrador, separados por vírgula, e `SOURCE_GUILD_ID` com o servidor original.
4. Configure `PUBLIC_BASE_URL` com a origem HTTPS pública do serviço, sem caminho. Exemplo: `https://auth.seudominio.com`. Em OAuth2 → Redirects, cadastre **exatamente** `https://auth.seudominio.com/oauth/callback`.
5. Para testar somente no seu computador, use `http://localhost:3001` e cadastre `http://localhost:3001/oauth/callback`. Esse endereço não funciona para outras pessoas. Para uso público, hospede este serviço com HTTPS ou um proxy/túnel HTTPS confiável; o hostname do `.env` deve corresponder ao redirect cadastrado.
6. Em Installation, habilite Guild Install e instale com os escopos `bot` e `applications.commands`. Conceda Ver canal, Enviar mensagens, Inserir links e Criar convite. A permissão Criar convite é necessária para adicionar membros ao destino. Não precisa de intents privilegiadas nem permissão Administrador.
7. Execute:

```powershell
npm run register
npm start
```

O registro é global para permitir usar o bot no futuro servidor. O Discord pode levar algum tempo para exibir os comandos. O serviço escuta `127.0.0.1:3001` por padrão. Em hospedagens que exigem interface pública, configure `HOST=0.0.0.0`, mantendo HTTPS no proxy. Não registra URLs de callback, códigos ou tokens em logs. O limitador usa o IP direto: atrás de proxy, o limite é compartilhado, por segurança; não confia arbitrariamente em X-Forwarded-For.

## Uso

- `/oauth painel canal:#canal`: publica a embed e o botão de autorização. Título e descrição são opcionais. A explicação de consentimento permanece visível mesmo com texto personalizado.
- O membro clica, lê a finalidade, autoriza `identify` e `guilds.join` no Discord e recebe confirmação no navegador.
- `/oauth status`: quantidade de autorizações e resultado da última migração, em resposta privada.
- `/desautorizar`: remove os tokens locais do próprio usuário e tenta revogar no Discord. Também é possível remover o aplicativo em Configurações → Aplicativos autorizados. A revogação feita apenas no Discord é detectada no próximo uso do token.

## Migrar para outro servidor

1. Instale **este mesmo aplicativo** no servidor substituto. Criar um terceiro aplicativo não transfere as autorizações.
2. Adicione o ID do destino em `TARGET_GUILD_IDS` no `.env` e reinicie o bot. A lista começa vazia, para nenhum destino ser usado por engano.
3. No servidor de destino, use `/oauth migrar`. Você deve estar em `OWNER_IDS` e ter Gerenciar servidor naquele servidor.
4. Confira nome, ID e quantidade e confirme no botão privado em até dois minutos.
5. A fila persistente processa um membro por ciclo, renova tokens expirados quando necessário e respeita respostas de limitação de taxa. `/oauth cancelar` cancela os itens pendentes; uma chamada já em andamento pode terminar.

`/oauth status` mostra: `pending` aguardando; `added` adicionado; `already_member` já presente; `screening` precisa aceitar regras do servidor; `revoked` autorização indisponível; `blocked` erro de permissão/credencial; `failed` falha individual; `destination_disabled` destino removido da configuração; `cancelled` cancelado. Corrija a configuração antes de iniciar nova migração. Restrições, limites e regras de entrada do Discord continuam valendo. Não há garantia de recuperar todos os membros.

## Dados e backup

SQLite em `data/oauth2.sqlite`, com ID, data de consentimento e tokens AES-256-GCM. `TOKEN_ENCRYPTION_KEY` deve ser preservada: perder a chave impede usar os tokens. Mantenha backup protegido do banco **e da chave**, separados de repositórios públicos. Encerre o processo antes de copiar o banco, para não perder dados no WAL. Autorizações permanecem até revogação local ou detecção de revogação pelo Discord. Histórico da fila guarda IDs e resultados administrativos, sem tokens; revogar apaga os tokens, não esse histórico.

O bot não envia DMs nem faz entradas sem o comando de migração confirmado. Reiniciar retoma uma fila já confirmada. Execute somente uma instância por banco. O bot da loja continua independente na pasta vizinha.

## Validação

```powershell
npm run check
npm test
```

Testes locais usam Discord simulado; o teste real exige credenciais do novo aplicativo e redirect válido.

Referências oficiais: [OAuth2](https://discord.com/developers/docs/topics/oauth2) e [Add Guild Member](https://discord.com/developers/docs/resources/guild#add-guild-member).

## Personalizar e editar painel

Use `/oauth painel canal:#canal` e as opções `titulo`, `descricao`, `cor` (ex.: #7664ED), `banner`, `miniatura`, `rodape`, `botao` e `texto` (fora da embed). Imagens devem ser links HTTPS públicos. Use `\n` para quebras de linha e `-` para remover campos opcionais. A explicação de autorização permanece visível.

Para editar, use o mesmo comando com `mensagem:ID_DA_MENSAGEM`, o canal e apenas os campos que deseja alterar. Ative o modo desenvolvedor do Discord para copiar o ID da mensagem. O bot precisa de Ler histórico de mensagens para buscar o painel existente. Não há botão administrativo na embed pública.

O botão abre `/oauth/start`, que redireciona imediatamente para a autorização do Discord, sem página inicial. Painéis antigos que apontam à raiz também redirecionam automaticamente. O servidor de callback continua obrigatório para receber e salvar a autorização. A política de dados continua disponível em `/privacidade`.

### Erro redirect_uri de OAuth2 inválido

Em Developer Portal → seu aplicativo → OAuth2 → Redirects, salve exatamente `PUBLIC_BASE_URL` + `/oauth/callback`. Para a configuração local padrão: `http://localhost:3001/oauth/callback`. Para compradores em outros dispositivos, configure uma origem HTTPS pública e registre seu callback correspondente. Alterar o botão não corrige uma URL ausente ou divergente no Developer Portal.

## Testar com pessoas fora do seu computador (Windows)

1. Em um terminal nesta pasta, execute `npm run tunnel`. O script baixa o cloudflared oficial, confere o SHA-256 publicado no GitHub e abre somente o serviço HTTP local na porta PORT do .env. Mantenha esse terminal aberto.
2. Copie o endereço `https://....trycloudflare.com` exibido e execute em outro terminal: `npm run public-url -- https://....trycloudflare.com`.
3. Cadastre o callback exibido em Developer Portal → OAuth2 → Redirects. É necessário salvar essa configuração no aplicativo correto.
4. Reinicie o bot e atualize o painel: `/oauth painel canal:#canal mensagem:ID`. O botão precisa usar o endereço público novo.

O link muda quando o túnel reinicia. Esse modo é para testes, sem garantia de disponibilidade. Para uso contínuo, use hospedagem HTTPS ou um túnel nomeado com domínio fixo. O computador, o bot e o túnel precisam continuar ligados. Ctrl+C no terminal do túnel encerra o acesso público. Nenhuma pasta ou arquivo .env é publicado pelo túnel.

## Vercel (endereço público fixo)

Veja **VERCEL.md** para criar um projeto e um banco Neon. A função HTTP é publicada na Vercel; o processo Discord continua separado. Preencha a mesma DATABASE_URL e TOKEN_ENCRYPTION_KEY na Vercel e no bot. Sem DATABASE_URL, o modo local ainda usa SQLite. A função Vercel exige PostgreSQL e nunca tenta salvar tokens em um arquivo temporário.
#   s i l l e n t - o a u t h 2  
 