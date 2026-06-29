import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '2m', target: 400 }, // ramp up to 400 users
    { duration: '3h', target: 400 }, // stay at 400 for ~4 hours
    { duration: '2m', target: 0 }, // scale down.
  ],
};

export default function () {
  const res = http.get('http://localhost:3000/api/health');
  check(res, {
    'status is 200': (r) => r.status === 200,
  });
  sleep(1);
}
