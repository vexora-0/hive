// Where does it break? Ramp to 300 VUs.
//
// Expect the free-tier host to bind before the application does. That is a
// legitimate finding — report the constraint honestly rather than claiming an
// unconstrained result.
import { sleep } from 'k6';
import { signIn } from './lib/auth.js';
import { parentFeed } from './lib/scenarios.js';

export const options = {
  stages: [
    { duration: '2m', target: 100 },
    { duration: '2m', target: 200 },
    { duration: '2m', target: 300 },
    { duration: '1m', target: 0 },
  ],
  thresholds: { http_req_failed: ['rate<0.10'] },
};

export function setup() {
  return { token: signIn(__ENV.PARENT_EMAIL, __ENV.DEMO_PASSWORD) };
}

export default function (d) {
  parentFeed(d.token);
  sleep(1);
}
