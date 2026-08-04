/**
 * Gen2 callables need Cloud Run invoker=allUsers for browser clients.
 * Firebase deploy with invoker:'public' sometimes leaves IAM empty — run after first deploy.
 *
 *   node scripts/set-functions-invoker.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const configPath = path.join(
  os.homedir(),
  '.config',
  'configstore',
  'firebase-tools.json',
);
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
const token = config.access_token ?? config.tokens?.access_token;
if (!token) {
  console.error('No Firebase access token. Run: firebase login');
  process.exit(1);
}

const services = [
  'createreservation',
  'getmyreservations',
  'cancelreservation',
  'changereservationstatus',
  'callnextwaitlist',
  'updateboothsettings',
];

const body = JSON.stringify({
  policy: {
    bindings: [
      {
        role: 'roles/run.invoker',
        members: ['allUsers'],
      },
    ],
  },
});

for (const svc of services) {
  const setUrl = `https://run.googleapis.com/v1/projects/boardgame-a06d1/locations/asia-northeast3/services/${svc}:setIamPolicy`;
  const res = await fetch(setUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body,
  });
  console.log(svc, res.status, (await res.text()).slice(0, 200));
}
