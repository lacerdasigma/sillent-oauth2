# Publicar a autorização na Vercel

A Vercel hospeda somente o HTTP OAuth2 (`api/index.js`). O bot Discord e a fila continuam em `npm start` no computador ou em uma hospedagem contínua. Ambos acessam o mesmo PostgreSQL. As autorizações podem ser recebidas pela Vercel mesmo com o bot desligado; comandos e migrações exigem o bot ligado.

## 1. Criar o projeto

Crie sua conta em https://vercel.com e importe um repositório contendo este projeto. Se o repositório contém os dois bots, escolha **Root Directory: bot-oauth2**. Não inclua `.env`, `data`, `.tools` nem `node_modules` no repositório. O `.gitignore` e `.vercelignore` já excluem esses arquivos.

Alternativamente, após instalar a CLI oficial da Vercel e fazer login, execute `vercel` dentro de `bot-oauth2`. Não execute na pasta da loja.

Use Node.js **24.x**, Framework Preset **Other** e as configurações do `vercel.json`; não configure `npm start` como Build Command. Não publique como site estático. O projeto contém uma função Node para executar o callback.

Escolha um nome de projeto e use o domínio de produção estável que a Vercel atribuir, por exemplo `https://seu-projeto.vercel.app`. Evite URLs de preview que mudam a cada publicação. Antes de preencher as variáveis, a função retorna 503 sem exibir credenciais.

## 2. Criar o PostgreSQL

No projeto Vercel, abra **Storage / Marketplace**, escolha **Neon (Postgres)**, crie um banco e conecte-o ao projeto no ambiente Production. Confira o plano e eventuais cobranças mostradas pela plataforma antes de contratar.

Obtenha a conexão PostgreSQL com pooling e TLS, normalmente disponibilizada como `DATABASE_URL`. Se a integração usar outro nome, crie `DATABASE_URL` com o mesmo valor. Não compartilhe essa URL: ela contém a senha do banco.

## 3. Variáveis de ambiente

Em Settings → Environment Variables da Vercel, configure para Production:

| Variável | Valor |
| --- | --- |
| `DATABASE_URL` | Conexão do banco Neon |
| `DISCORD_CLIENT_ID` | ID do aplicativo OAuth2, o mesmo do bot local |
| `DISCORD_CLIENT_SECRET` | Client Secret desse aplicativo |
| `TOKEN_ENCRYPTION_KEY` | Copie a chave já gerada no `.env` do bot OAuth2 |
| `PUBLIC_BASE_URL` | `https://seu-projeto.vercel.app`, sem caminho |
| `COMMUNITY_NAME` | Nome da comunidade, opcional |

A Vercel não precisa de `DISCORD_TOKEN`, `OWNER_IDS` nem `TARGET_GUILD_IDS` para atender os callbacks. Essas configurações continuam no bot local. Não crie uma nova chave de criptografia: a Vercel e o bot precisam da mesma chave para ler os mesmos tokens.

No `.env` local de `bot-oauth2`, preencha a mesma `DATABASE_URL`, `PUBLIC_BASE_URL`, Client ID, Client Secret e chave. Mantenha as outras configurações do bot.

## 4. Publicar e configurar o Discord

Faça um redeploy após configurar as variáveis. Garanta que o domínio de produção e as rotas `/oauth/start` e `/oauth/callback` estejam acessíveis sem login da Vercel. Caso Deployment Protection esteja exigindo login, ajuste a proteção da produção no projeto.

No Discord Developer Portal → seu aplicativo → OAuth2 → Redirects, adicione e salve exatamente:

```text
https://seu-projeto.vercel.app/oauth/callback
```

Substitua pelo domínio real atribuído à sua conta. Não use o exemplo literalmente nem localhost.

## 5. Preservar autorizações já recebidas

Se já houve autorizações no SQLite local, pare o bot e execute, após preencher `DATABASE_URL`:

```powershell
npm run import-postgres
```

O importador copia autorizações e configurações de painéis, sem sobrescrever membros já existentes no PostgreSQL. O banco SQLite original é preservado. Histórico e filas locais não são transferidos; cancele migrações pendentes antes. Faça essa importação uma vez, antes de começar a receber novas autorizações na Vercel, para não restaurar registros removidos depois.

## 6. Iniciar e testar

```powershell
npm start
```

Atualize cada painel já criado usando `/oauth painel canal:#canal mensagem:ID`. Isso troca o botão localhost pelo domínio público sem perder a personalização. Para criar outro painel, omita mensagem.

Teste o botão em outro dispositivo, autorize e confira `/oauth status`. Se aparecer `redirect_uri inválido`, compare o domínio e o caminho cadastrados no Discord com `PUBLIC_BASE_URL` + `/oauth/callback`. Se aparecer 503, confira as variáveis e a conexão do banco na Vercel. Os logs nunca devem conter tokens.

O código e as consultas PostgreSQL foram testados localmente. A publicação e o teste real dependem de criar o projeto, o banco e preencher suas variáveis. Nenhum recurso pago ou conta foi criado automaticamente.

Referências: https://vercel.com/docs/storage e https://vercel.com/docs/functions/configuring-functions/duration
