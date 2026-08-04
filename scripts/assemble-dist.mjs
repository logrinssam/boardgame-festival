import { cpSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'dist');
const participantDist = join(root, 'apps/participant/dist');
const operationsDist = join(root, 'apps/operations/dist');

if (existsSync(out)) {
  rmSync(out, { recursive: true, force: true });
}
mkdirSync(out, { recursive: true });

cpSync(participantDist, out, { recursive: true });
mkdirSync(join(out, 'ops'), { recursive: true });
cpSync(operationsDist, join(out, 'ops'), { recursive: true });

cpSync(join(out, 'index.html'), join(out, '404.html'));
cpSync(join(out, 'ops/index.html'), join(out, 'ops/404.html'));

console.log('Assembled dist/ (participant) and dist/ops/ (operations)');
