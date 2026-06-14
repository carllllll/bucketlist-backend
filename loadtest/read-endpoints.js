// ================================================
// k6 LOAD TEST — public read endpoints only
// ================================================
// Safe to run against production: hits ONLY read endpoints
// (/health, /api/properties, /api/reviews/:id). It never registers,
// logs in, books, or pays — so it creates no junk data and sends no email.
//
// SETUP:
//   1. Install k6 → https://k6.io/docs/get-started/installation/
//      (Windows: `winget install k6` or `choco install k6`)
//   2. Run:   k6 run loadtest/read-endpoints.js
//      Override target: k6 run -e BASE_URL=https://your-url loadtest/read-endpoints.js
//
// WHAT TO EXPECT:
//   - /health is NOT rate-limited → this is your real capacity/latency signal.
//   - /api/* is limited to 100 requests / 15 min PER IP. From one machine you'll
//     start getting 429s quickly — that's the limiter WORKING, not a failure.
//     We count those separately (rate_limited_429) instead of treating them as errors.
//   - To simulate many *distinct* users (and bypass the per-IP limit), run from
//     k6 Cloud or a SaaS runner that uses many IPs.
// ================================================

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Rate } from 'k6/metrics';

const BASE = __ENV.BASE_URL || 'https://bucketlist-backend-jx24.onrender.com';
const SAMPLE_PROPERTY_ID = __ENV.PROPERTY_ID || 'cfa7c66c-5ffc-4836-a673-199d02937990';

const rateLimited = new Counter('rate_limited_429');
const unexpected  = new Rate('unexpected_errors');

export const options = {
  // --- k6 Cloud config (ignored on a local `k6 run`) ---
  // Distributing across regions = many source IPs, so the per-IP rate limit
  // no longer shields Supabase — real DB load gets exercised. Zones picked
  // close to East African users for realistic latency.
  cloud: {
    name: 'Bucketlist — public read endpoints',
    distribution: {
      capetown:  { loadZone: 'amazon:za:cape town', percent: 50 },
      frankfurt: { loadZone: 'amazon:de:frankfurt', percent: 50 },
    },
  },

  // Ramp 1 → 50 virtual users, then wind down
  stages: [
    { duration: '30s', target: 10 },
    { duration: '1m',  target: 30 },
    { duration: '1m',  target: 50 },
    { duration: '30s', target: 0  },
  ],
  thresholds: {
    // 95% of requests under 2s (the very first request may be slow due to Render cold start)
    http_req_duration: ['p(95)<2000'],
    unexpected_errors:  ['rate<0.05'], // under 5% unexpected (non-429) errors
  },
};

export default function () {
  // 1) /health — unlimited; measures raw server capacity under concurrency
  const h = http.get(`${BASE}/health`);
  unexpected.add(!check(h, { 'health 200': (r) => r.status === 200 }));

  // 2) /api/properties — rate-limited; 429 is expected once the limit trips
  const p = http.get(`${BASE}/api/properties`);
  if (p.status === 429) {
    rateLimited.add(1);
  } else {
    unexpected.add(!check(p, { 'properties 200': (r) => r.status === 200 }));
  }

  // 3) reviews for one property — also rate-limited
  const rev = http.get(`${BASE}/api/reviews/${SAMPLE_PROPERTY_ID}`);
  if (rev.status === 429) {
    rateLimited.add(1);
  } else {
    unexpected.add(!check(rev, { 'reviews 200': (r) => r.status === 200 }));
  }

  sleep(1); // ~1 request-set per VU per second
}
