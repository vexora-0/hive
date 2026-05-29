import http from 'k6/http';
import { check } from 'k6';
import { Trend } from 'k6/metrics';
import { authHeaders } from './auth.js';

const API = __ENV.API_URL || 'http://localhost:4000';

/**
 * Feed page transfer size.
 *
 * This is the headline number for the report. Before Plan 03 no thumbnails
 * existed, so the feed served full-resolution originals — a 20-photo page
 * could exceed 100 MB. Tracking it here gives a measured before/after rather
 * than an asserted one.
 */
export const feedPayloadBytes = new Trend('feed_payload_bytes');

export function parentFeed(token) {
  const res = http.get(`${API}/api/v1/feed?limit=20`, {
    ...authHeaders(token),
    tags: { name: 'GET /feed' },
  });
  check(res, {
    'feed 200': (r) => r.status === 200,
    'feed returns data': (r) => r.status === 200 && Array.isArray(JSON.parse(r.body).data),
  });
  if (res.status === 200) feedPayloadBytes.add(res.body.length);

  // Second page, exercising the cursor path rewritten in Plan 05.
  const cursor = res.status === 200 ? JSON.parse(res.body).cursor : null;
  if (cursor) {
    const page2 = http.get(`${API}/api/v1/feed?limit=20&cursor=${encodeURIComponent(cursor)}`, {
      ...authHeaders(token),
      tags: { name: 'GET /feed (page 2)' },
    });
    check(page2, { 'feed page 2 200': (r) => r.status === 200 });
  }
  return res;
}

export function photoDetail(token, photoId) {
  const res = http.get(`${API}/api/v1/feed/photos/${photoId}`, {
    ...authHeaders(token),
    tags: { name: 'GET /feed/photos/:id' },
  });
  check(res, { 'photo detail 200 or 404': (r) => r.status === 200 || r.status === 404 });
  return res;
}

export function teacherPhotos(token, classId) {
  const res = http.get(`${API}/api/v1/photos?classId=${classId}&limit=20`, {
    ...authHeaders(token),
    tags: { name: 'GET /photos' },
  });
  check(res, { 'teacher photos 200': (r) => r.status === 200 });
  return res;
}

export function adminDashboard(token) {
  const res = http.get(`${API}/api/v1/admin/dashboard`, {
    ...authHeaders(token),
    tags: { name: 'GET /admin/dashboard' },
  });
  check(res, { 'dashboard 200': (r) => r.status === 200 });
  return res;
}

export function createOrder(token, photoId) {
  // A fresh key per iteration — reusing one would exercise the idempotency
  // cache rather than order creation.
  const key = `load-${__VU}-${__ITER}-${Date.now()}`;
  const res = http.post(
    `${API}/api/v1/orders`,
    JSON.stringify({
      items: [{ photoId, productType: 'print_4x6', quantity: 1 }],
      shippingAddress: '1 Load Test Road, Bangalore 560001',
    }),
    { ...authHeaders(token, { 'X-Idempotency-Key': key }), tags: { name: 'POST /orders' } },
  );
  check(res, { 'order created': (r) => r.status === 201 });
  return res;
}

export function health() {
  const res = http.get(`${API}/health`, { tags: { name: 'GET /health' } });
  check(res, { 'health ok': (r) => r.status === 200 });
  return res;
}
