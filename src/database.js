export async function createStore(cfg){
 if(cfg.DATABASE_URL){const {PostgresStore}=await import('./postgres-store.js');return new PostgresStore(cfg.DATABASE_URL,cfg.TOKEN_ENCRYPTION_KEY).init();}
 if(process.env.VERCEL)throw new Error('DATABASE_URL obrigatório na Vercel');
 const {Store}=await import('./store.js');return new Store(cfg.DATABASE_PATH,cfg.TOKEN_ENCRYPTION_KEY);
}
