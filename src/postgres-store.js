import { diagnosticError, logSafe } from './diagnostics.js';
import pg from 'pg';
import { AsyncLocalStorage } from 'node:async_hooks';
import { randomBytes, createHash } from 'node:crypto';
import { seal, open } from './token-crypto.js';

export function postgresSql(q) {
    let n = 0;

    return q
        .replace(/\buser\b/g, '"user"')
        .replace(/\?/g, () => '$' + (++n));
}

export class PostgresStore {
    constructor(url, key, pool) {
        this.key = Buffer.from(key, 'hex');

        this.pool = pool || new pg.Pool({
            connectionString: url,
            max: 3,
            idleTimeoutMillis: 1000,
            connectionTimeoutMillis: 10000,
            allowExitOnIdle: true,
            query_timeout: 20000
        });

        this.context = new AsyncLocalStorage();

        this.pool.on?.('error', (e) => {
            logSafe('database_idle_connection', e);
        });
    }

    seal = seal;
    open = open;

    async init(onStage = () => {}) {
        onStage('database_connect');

        await this.pool.query('SELECT 1');

        onStage('database_schema');

        await this.locked('oauth-schema', async () => {
            await this.query(`
                CREATE TABLE IF NOT EXISTS settings(
                    key TEXT PRIMARY KEY,
                    value TEXT NOT NULL
                )
            `);

            await this.query(`
                CREATE TABLE IF NOT EXISTS members(
                    id TEXT PRIMARY KEY,
                    tokens TEXT NOT NULL,
                    expires BIGINT NOT NULL,
                    consented BIGINT NOT NULL
                )
            `);

            await this.query(`
                CREATE TABLE IF NOT EXISTS states(
                    id TEXT PRIMARY KEY,
                    expires BIGINT NOT NULL
                )
            `);

            await this.query(`
                CREATE TABLE IF NOT EXISTS jobs(
                    id SERIAL PRIMARY KEY,
                    guild TEXT NOT NULL,
                    actor TEXT NOT NULL,
                    created BIGINT NOT NULL
                )
            `);

            await this.query(`
                CREATE TABLE IF NOT EXISTS tasks(
                    job INTEGER,
                    user TEXT,
                    status TEXT NOT NULL DEFAULT 'pending',
                    PRIMARY KEY(job, user)
                )
            `);
        });

        return this;
    }

    async query(q, p) {
        return (this.context.getStore() || this.pool).query(
            postgresSql(q),
            p
        );
    }

    async run(q, ...p) {
        const r = await this.query(q, p);

        return {
            changes: r.rowCount
        };
    }

    async get(q, ...p) {
        return (await this.query(q, p)).rows[0];
    }

    async all(q, ...p) {
        return (await this.query(q, p)).rows;
    }

    async locked(key, fn) {
        const c = await this.pool.connect();

        try {
            await c.query('BEGIN');

            await c.query(
                "SET LOCAL statement_timeout='15s'"
            );

            await c.query(
                "SET LOCAL lock_timeout='5s'"
            );

            await c.query(
                'SELECT pg_advisory_xact_lock(hashtext($1))',
                [key]
            );

            const result = await this.context.run(c, fn);

            await c.query('COMMIT');

            return result;
        } catch (e) {
            await c.query('ROLLBACK').catch(() => {});
            throw e;
        } finally {
            c.release();
        }
    }

    withUser(id, fn) {
        return this.locked('oauth-user:' + id, fn);
    }

    async bindApplication(id) {
        await this.locked('oauth-application', async () => {
            const saved = await this.get(
                "SELECT value FROM settings WHERE key='application'"
            );

            if (saved && saved.value !== id) {
                throw diagnosticError('APP_MISMATCH');
            }

            await this.run(
                "INSERT INTO settings VALUES('application',?) ON CONFLICT(key) DO NOTHING",
                id
            );
        });
    }

    async save(id, t) {
        await this.run(
            'INSERT INTO members VALUES(?,?,?,?) ON CONFLICT(id) DO UPDATE SET tokens=excluded.tokens,expires=excluded.expires,consented=excluded.consented',
            id,
            this.seal(t),
            Date.now() + t.expires_in * 1000,
            Date.now()
        );
    }

    async refresh(id, t) {
        await this.run(
            'UPDATE members SET tokens=?,expires=? WHERE id=?',
            this.seal(t),
            Date.now() + t.expires_in * 1000,
            id
        );
    }

    async state() {
        await this.run(
            'DELETE FROM states WHERE expires<?',
            Date.now()
        );

        const s = randomBytes(32).toString('hex');

        await this.run(
            'INSERT INTO states VALUES(?,?)',
            createHash('sha256')
                .update(s)
                .digest('hex'),
            Date.now() + 600000
        );

        return s;
    }

    async consume(s) {
        return (
            await this.run(
                'DELETE FROM states WHERE id=? AND expires>?',
                createHash('sha256')
                    .update(s)
                    .digest('hex'),
                Date.now()
            )
        ).changes === 1;
    }

    async forget(id) {
        await this.run(
            'DELETE FROM members WHERE id=?',
            id
        );

        await this.run(
            "UPDATE tasks SET status='revoked' WHERE user=? AND status='pending'",
            id
        );
    }

    async enqueue(guild, actor) {
        return this.locked('oauth-migration', async () => {
            if (
                await this.get(
                    "SELECT 1 FROM tasks WHERE status='pending'"
                )
            ) {
                throw new Error(
                    'Já existe uma migração pendente.'
                );
            }

            const { id } = await this.get(
                'INSERT INTO jobs(guild,actor,created) VALUES(?,?,?) RETURNING id',
                guild,
                actor,
                Date.now()
            );

            await this.run(
                'INSERT INTO tasks(job,user) SELECT ?,id FROM members',
                id
            );

            return id;
        });
    }

    async close() {
        await this.pool.end();
    }
}