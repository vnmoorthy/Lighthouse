/**
 * Fastify API server bound to localhost.
 *
 * Auth: bearer token auto-generated on setup, stored in `kv`. The web SPA
 * reads it from a `/api/__token__` endpoint that's only reachable from the
 * same machine (we additionally check `request.ip === API_HOST`). This
 * gives us a no-friction UX on a single machine without leaving the API
 * world-readable to anything else on localhost.
 */
import Fastify, { type FastifyInstance, type FastifyRequest } from 'fastify';
import type { FastifyReply } from 'fastify';
import fastifyStatic from '@fastify/static';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { config } from '../config.js';
import { kvGet, KV_KEYS } from '../db/kv.js';
import { log } from '../logger.js';
import { registerRoutes } from './routes.js';

export interface StartedServer {
  app: FastifyInstance;
  url: string;
  bearerToken: string;
  stop: () => Promise<void>;
}

export async function startServer(): Promise<StartedServer> {
  const token = kvGet(KV_KEYS.apiBearerToken);
  if (!token) {
    throw new Error('API token missing. Run `npm run setup` first.');
  }

  const app = Fastify({ logger: false, trustProxy: false });

  // Auth gate. Allow:
  //   - /api/health
  //   - /api/__token__ from a same-machine origin (so the web app can fetch
  //     the bearer token automatically). Localhost-only.
  //   - Anything else: must include `Authorization: Bearer <token>`.
  app.addHook('onRequest', async (req: FastifyRequest, reply: FastifyReply) => {
    const url = req.url.split('?')[0] ?? '/';
    if (url === '/api/health') return;
    if (url === '/api/__token__') {
      // Only same-host requests. Trust no proxy.
      if (req.ip !== '127.0.0.1' && req.ip !== '::1') {
        return reply.code(403).send({ error: 'forbidden' });
      }
      return reply.send({ token });
    }
    if (!url.startsWith('/api/')) return; // SPA static assets — let static handler deal.
    const auth = req.headers.authorization ?? '';
    const provided = auth.startsWith('Bearer ') ? auth.slice(7) : '';
    if (provided !== token) return reply.code(401).send({ error: 'unauthorized' });
  });

  // Serve the built SPA if it exists. In dev, Vite serves the SPA on a
  // different port and proxies /api here.
  if (existsSync(config.webDistPath)) {
    await app.register(fastifyStatic, {
      root: config.webDistPath,
      prefix: '/',
    });
    // SPA fallback: any non-API URL serves index.html so client-side routing works.
    const indexPath = join(config.webDistPath, 'index.html');
    const indexHtml = existsSync(indexPath) ? readFileSync(indexPath, 'utf-8') : '<h1>Lighthouse</h1>';
    app.setNotFoundHandler((req, reply) => {
      if (req.url.startsWith('/api/')) return reply.code(404).send({ error: 'not_found' });
      return reply.type('text/html').send(indexHtml);
    });
  }

  registerRoutes(app);

  const url = `http://${config.api.host}:${config.api.port}`;
  await app.listen({ host: config.api.host, port: config.api.port });
  log.info(`API listening on ${url}`);
  return {
    app,
    url,
    bearerToken: token,
    stop: async () => {
      await app.close();
    },
  };
}
