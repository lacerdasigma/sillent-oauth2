const hints={
 '28P01':'Credenciais PostgreSQL recusadas.', '28000':'Autenticacao PostgreSQL recusada.',
 '3D000':'Banco PostgreSQL inexistente.', '42501':'Usuario PostgreSQL sem permissao para schema/tabelas.',
 '42P01':'Tabela ausente no schema PostgreSQL.', '42703':'Schema existente incompativel: coluna ausente.',
 '53300':'Limite de conexoes PostgreSQL atingido.', '57014':'Consulta PostgreSQL excedeu o prazo.',
 '55P03':'Timeout aguardando bloqueio no banco.', ECONNREFUSED:'Conexao com banco recusada.',
 ENOTFOUND:'DNS do banco nao resolveu.', EAI_AGAIN:'Falha temporaria no DNS do banco.',
 ETIMEDOUT:'Tempo limite de conexao com o banco.', ECONNRESET:'Conexao com o banco interrompida.',
 DEPTH_ZERO_SELF_SIGNED_CERT:'Certificado TLS nao confiavel.', SELF_SIGNED_CERT_IN_CHAIN:'Cadeia TLS nao confiavel.',
 UNABLE_TO_VERIFY_LEAF_SIGNATURE:'Certificado TLS nao verificavel.', ERR_TLS_CERT_ALTNAME_INVALID:'Hostname nao corresponde ao certificado TLS.',
 APP_MISMATCH:'Banco vinculado a outro DISCORD_CLIENT_ID.', CONFIG_INVALID:'Configuracao ausente ou invalida.',
 TOKEN_DECRYPT_FAILED:'Chave nao decifra tokens existentes ou dados criptografados danificados.',
 DATABASE_REQUIRED:'DATABASE_URL obrigatoria para a funcao Vercel.', DATABASE_URL_INVALID:'DATABASE_URL deve ser uma conexao postgres/postgresql valida.',
 ERR_MODULE_NOT_FOUND:'Dependencia de runtime ausente na publicacao.', ERR_UNKNOWN_BUILTIN_MODULE:'Versao Node incompativel.'
};
export function diagnosticError(code,field){const e=new Error(code);e.code=code;e.field=field;return e;}
const fields=new Set(['DATABASE_URL','DISCORD_CLIENT_ID','DISCORD_CLIENT_SECRET','TOKEN_ENCRYPTION_KEY','PUBLIC_BASE_URL','DISCORD_TOKEN','OWNER_IDS','SOURCE_GUILD_ID','TARGET_GUILD_IDS','PORT']);
export function safeError(error){
 let e=error,code;for(let depth=0;e&&depth<4;depth++,e=e.cause){if(Object.hasOwn(hints,e.code)){code=e.code;break;}}
 if(!code&&/timeout|timed out|connection terminated due to connection timeout/i.test(String(error?.message||'')))code='ETIMEDOUT';
 const result={code:code||'UNKNOWN',reason:hints[code]||'Falha nao classificada; mensagem original omitida para proteger segredos.'};
 if(fields.has(error?.field))result.field=error.field;
 return result;
}
export function logSafe(stage,error,logger=console.error){logger(JSON.stringify({event:'oauth_failure',stage,...safeError(error)}));}
