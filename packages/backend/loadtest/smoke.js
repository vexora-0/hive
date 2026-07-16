// Smoke: does it work at all? Run this before any other profile.
import { sleep } from 'k6';
import { signIn } from './lib/auth.js';
import { parentFeed, health } from './lib/scenarios.js';

export const options = {
  vus: 1,
  duration: '30s',
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<2000'],
  },
};

export function setup() {
  return { token: signIn(__ENV.PARENT_EMAIL, __ENV.DEMO_PASSWORD) };
}

export default function (data) {
  health();
  parentFeed(data.token);
  sleep(1);
}
