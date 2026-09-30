import {existsSync,readFileSync,writeFileSync} from 'node:fs';
import {randomBytes} from 'node:crypto';
if(existsSync('.env')){console.log('.env já existe; nenhuma configuração alterada.');}else{
writeFileSync('.env',readFileSync('.env.example','utf8').replace('TOKEN_ENCRYPTION_KEY=','TOKEN_ENCRYPTION_KEY='+randomBytes(32).toString('hex')),{mode:0o600,flag:'wx'});
console.log('.env criado com chave de criptografia. Preencha as credenciais do novo aplicativo.');}
