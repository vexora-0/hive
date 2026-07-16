// Expected peak: 50 concurrent users for 5 minutes.
//
// Weighting reflects real traffic shape — parents scrolling a feed dominate;
// teachers upload occasionally; orders and admin views are rare.
import { sleep } from 'k6';
import { signIn } from './lib/auth.js';
import { parentFeed, photoDetail, teacherPhotos, adminDashboard } from './lib/scenarios.js';

export const options = {
  stages: [
    { duration: '1m', target: 50 },
    { duration: '3m', target: 50 },
    { duration: '1m', target: 0 },
  ],
  thresholds: {
    'http_req_duration{name:GET /feed}': ['p(50)<200', 'p(95)<800', 'p(99)<2000'],
    http_req_failed: ['rate<0.01'],
    feed_payload_bytes: ['p(95)<2097152'], // 2 MB per page — see docs/performance.md
  },
};

export function setup() {
  return {
    parent: signIn(__ENV.PARENT_EMAIL, __ENV.DEMO_PASSWORD),
    teacher: signIn(__ENV.TEACHER_EMAIL, __ENV.DEMO_PASSWORD),
    admin: signIn(__ENV.ADMIN_EMAIL, __ENV.ADMIN_PASSWORD),
  };
}

export default function (d) {
  const roll = Math.random();
  if (roll < 0.6) {
    parentFeed(d.parent);
  } else if (roll < 0.8) {
    photoDetail(d.parent, __ENV.SAMPLE_PHOTO_ID);
  } else if (roll < 0.9) {
    teacherPhotos(d.teacher, __ENV.SAMPLE_CLASS_ID);
  } else {
    adminDashboard(d.admin);
  }
  sleep(Math.random() * 2 + 1);
}
