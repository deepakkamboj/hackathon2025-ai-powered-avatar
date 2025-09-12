import { test, expect, request } from '@playwright/test';

test.describe('GET /api/azure-speech/get-ice-server-token', () => {
  test('should return ICE server token data', async ({ baseURL }) => {
    const res = await request
      .newContext()
      .then((ctx) => ctx.get(`${baseURL}/api/azure-speech/get-ice-server-token`));
    expect(res.status()).toBe(200);
    const data = await res.json();
    expect(data).toHaveProperty('Urls');
    expect(data).toHaveProperty('Username');
    expect(data).toHaveProperty('Password');
  });
});
