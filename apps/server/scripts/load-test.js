import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '30s', target: 20 }, // ramp up to 20 users
    { duration: '1m', target: 20 },  // stay at 20 users
    { duration: '30s', target: 0 },  // ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'], // 95% of requests must be below 500ms
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:4000/api';

export default function () {
  // Check health endpoint
  const healthRes = http.get(`${BASE_URL}/health`);
  check(healthRes, {
    'health status is 200': (r) => r.status === 200,
  });

  // Get public quizzes
  const quizzesRes = http.get(`${BASE_URL}/quizzes`);
  check(quizzesRes, {
    'quizzes status is 200': (r) => r.status === 200,
  });

  sleep(1);
}
