import { test as base } from '@playwright/test';
import { execFile, spawn } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:net';
import { resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { promisify } from 'node:util';
import { sourceTree, writeHolding, writePost } from '../fixtures';

const exec = promisify(execFile);

export const test = base.extend<{}, { performanceURL: string }>({
  performanceURL: [async ({}, use) => {
    const { root, cleanup } = await sourceTree();
    try {
      await writeHolding(root, 'fixture', {
        label: '固定收益图测试', basis: '仅供自动化测试，不代表真实收益',
        points: [
          { date: '2026-09-30', returnPercent: -8.44 },
          { date: '2026-10-01', returnPercent: 0 },
          { date: '2026-10-02', returnPercent: 3 },
          { date: '2026-10-04', returnPercent: 5 },
        ],
      });
      await writePost(root, 'performance-multi', { performance: 'fixture' });
      await writePost(root, 'performance-single', { performance: { holding: 'fixture', until: '2026-09-30' } });
      try {
        await exec(process.execPath, [resolve('node_modules/astro/bin/astro.mjs'), 'build'], { cwd: root, timeout: 30_000 });
      } catch (error) {
        const result = error as Error & { stdout?: string; stderr?: string };
        throw new Error([result.message, result.stdout, result.stderr].filter(Boolean).join('\n'));
      }

      const socket = createServer();
      socket.listen(0, '127.0.0.1');
      await once(socket, 'listening');
      const port = (socket.address() as { port: number }).port;
      await new Promise<void>((done) => socket.close(() => done()));
      const origin = `http://127.0.0.1:${port}`;
      const server = spawn(process.execPath, [resolve('node_modules/astro/bin/astro.mjs'), 'preview', '--host', '127.0.0.1', '--port', String(port), '--ignore-lock'], {
        cwd: root, stdio: ['ignore', 'pipe', 'pipe'],
      });
      let logs = '';
      server.stdout.on('data', (chunk) => { logs = (logs + String(chunk)).slice(-6000); });
      server.stderr.on('data', (chunk) => { logs = (logs + String(chunk)).slice(-6000); });
      const exited = once(server, 'exit');
      try {
        const deadline = Date.now() + 20_000;
        let ready = false;
        while (Date.now() < deadline) {
          if (server.exitCode !== null || server.signalCode !== null) break;
          try {
            const response = await fetch(`${origin}/posts/performance-multi/`, { signal: AbortSignal.timeout(1000) });
            if (response.ok && (await response.text()).includes('固定收益图测试')) { ready = true; break; }
          } catch { /* The preview process may still be starting. */ }
          await delay(100);
        }
        if (!ready) throw new Error(`收益图测试预览未就绪：${logs}`);
        await use(origin);
      } finally {
        server.kill('SIGTERM');
        const kill = setTimeout(() => server.kill('SIGKILL'), 3000);
        try { await exited; } finally { clearTimeout(kill); }
      }
    } finally { await cleanup(); }
  }, { scope: 'worker', timeout: 60_000 }],
});
