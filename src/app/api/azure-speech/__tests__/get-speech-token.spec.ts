import { test, expect, request } from '@playwright/test';

test.describe('GET /api/azure-speech/get-speech-token', () => {
  test('should return a speech token and region', async ({ baseURL }) => {
    const res = await request
      .newContext()
      .then((ctx) => ctx.get(`${baseURL}/api/azure-speech/get-speech-token`));
    expect(res.status()).toBe(200);
    const data = await res.json();
    expect(data).toHaveProperty('token');
    expect(data).toHaveProperty('region');
  });
});
