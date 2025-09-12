import { test, expect, request } from '@playwright/test';

test.describe('POST /api/azure-speech/get-oai-response', () => {
  test('should return a streaming response from OpenAI', async ({ baseURL }) => {
    const res = await request.newContext().then((ctx) =>
      ctx.post(`${baseURL}/api/azure-speech/get-oai-response`, {
        data: { messages: [{ role: 'user', content: 'Hello' }] },
      }),
    );
    expect(res.status()).toBe(200);
    // Streaming response: check content-type
    expect(res.headers()['content-type']).toContain('application/json');
    // Optionally, check for a chunked transfer encoding
    expect(res.headers()['transfer-encoding']).toContain('chunked');
  });
});
