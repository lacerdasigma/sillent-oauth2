import {readFileSync,writeFileSync} from 'node:fs';
const input=process.argv[2];
try{
 const url=new URL(input);
 if(url.protocol!=='https:'||url.username||url.password||url.pathname!=='/'||url.search||url.hash)throw new Error();
 let env=readFileSync('.env','utf8');
 env=/^PUBLIC_BASE_URL=.*$/m.test(env)?env.replace(/^PUBLIC_BASE_URL=.*$/m,'PUBLIC_BASE_URL='+url.origin):env.trimEnd()+'\nPUBLIC_BASE_URL='+url.origin+'\n';
 writeFileSync('.env',env);
 console.log('Endereço salvo. Cadastre em OAuth2 > Redirects: '+url.origin+'/oauth/callback');
 console.log('Reinicie o bot e atualize os painéis existentes com /oauth painel canal:... mensagem:ID.');
}catch{console.error('Informe somente uma origem HTTPS pública: npm run public-url -- https://seu-endereco');process.exitCode=1;}
