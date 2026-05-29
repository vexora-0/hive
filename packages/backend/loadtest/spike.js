// Recovery: does it come back after a sudden burst?
import { sleep } from 'k6';
import { signIn } from './lib/auth.js';
import { parentFeed } from './lib/scenarios.js';

export const options = {
  stages: [
    { duration: '30s', target: 10 },
    { duration: '20s', target: 200 },
    { duration: '1m', target: 200 },
    { duration: '30s', target: 10 },
    { duration: '1m', target: 10 },
  ],
  thresholds: { http_req_failed: ['rate<0.15'] },
};

export function setup() {
  return { token: signIn(__ENV.PARENT_EMAIL, __ENV.DEMO_PASSWORD) };
}

export default function (d) {
  parentFeed(d.token);
  sleep(1);
}
