// API Testing utility functions
export interface APIEndpoint {
  name: string;
  path: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  expectedStatus?: number;
  testPayload?: any;
  description: string;
}

export const API_ENDPOINTS: APIEndpoint[] = [
  {
    name: 'Azure Speech Token',
    path: '/api/azure-speech/get-speech-token',
    method: 'GET',
    expectedStatus: 200,
    description: 'Get Azure Speech Service authentication token',
  },
  {
    name: 'Azure ICE Server Token',
    path: '/api/azure-speech/get-ice-server-token',
    method: 'GET',
    expectedStatus: 200,
    description: 'Get ICE server configuration for WebRTC',
  },
  {
    name: 'Azure OpenAI Response',
    path: '/api/azure-speech/get-oai-response',
    method: 'POST',
    expectedStatus: 200,
    testPayload: { messages: [{ role: 'user', content: 'Hello, test message' }] },
    description: 'Test Azure OpenAI chat completion with function calling',
  },
  {
    name: 'Chat Model Info',
    path: '/api/chat-model',
    method: 'POST',
    expectedStatus: 200,
    testPayload: { providerModel: 'mistral:mistral-large-latest', prompt: 'Hello world test' },
    description: 'Test chat model with a simple prompt',
  },
  {
    name: 'Chat Endpoint',
    path: '/api/chat',
    method: 'POST',
    expectedStatus: 200,
    testPayload: { messages: [{ role: 'user', content: 'Hello' }] },
    description: 'Test the main chat endpoint',
  },
  {
    name: 'Deprecated HeyGen Endpoint',
    path: '/api/grab',
    method: 'POST',
    expectedStatus: 410,
    testPayload: {},
    description: 'Should return 410 Gone status (deprecated endpoint)',
  },
];

export async function testAPIEndpoint(endpoint: APIEndpoint): Promise<{
  success: boolean;
  status: number;
  responseTime: number;
  error?: string;
  data?: any;
}> {
  const startTime = Date.now();

  try {
    const response = await fetch(endpoint.path, {
      method: endpoint.method,
      headers: {
        'Content-Type': 'application/json',
      },
      body: endpoint.method !== 'GET' ? JSON.stringify(endpoint.testPayload || {}) : undefined,
    });

    const responseTime = Date.now() - startTime;
    const expectedStatus = endpoint.expectedStatus || 200;
    const success = response.status === expectedStatus;

    let data: any = null;
    let error: string | undefined = undefined;

    if (success) {
      // Check if this is a streaming response
      const contentType = response.headers.get('content-type') || '';

      if (
        contentType.includes('text/plain') ||
        contentType.includes('text/event-stream') ||
        endpoint.name === 'Azure OpenAI Response' ||
        endpoint.name === 'Chat Endpoint'
      ) {
        // For streaming endpoints, just read a small portion to verify it's working
        const text = await response.text();
        data = {
          message: 'Streaming response received successfully',
          preview: text.substring(0, 100) + (text.length > 100 ? '...' : ''),
          contentType: contentType,
        };
      } else {
        // Regular JSON response
        try {
          data = await response.json();
        } catch (jsonError) {
          // If JSON parsing fails, try to get text content
          const text = await response.text();
          data = {
            message: 'Non-JSON response received',
            content: text.substring(0, 200) + (text.length > 200 ? '...' : ''),
            contentType: contentType,
          };
        }
      }
    } else {
      try {
        data = await response.json();
        error = `Expected ${expectedStatus}, got ${response.status}`;
      } catch (jsonError) {
        const text = await response.text();
        error = `Expected ${expectedStatus}, got ${response.status}. Response: ${text.substring(0, 100)}`;
      }
    }

    return {
      success,
      status: response.status,
      responseTime,
      data,
      error,
    };
  } catch (error) {
    const responseTime = Date.now() - startTime;
    return {
      success: false,
      status: 0,
      responseTime,
      error: (error as Error).message,
    };
  }
}

export async function testAllAPIs(): Promise<
  Array<{
    endpoint: APIEndpoint;
    result: Awaited<ReturnType<typeof testAPIEndpoint>>;
  }>
> {
  const results = [];

  for (const endpoint of API_ENDPOINTS) {
    const result = await testAPIEndpoint(endpoint);
    results.push({ endpoint, result });

    // Small delay between tests to avoid overwhelming the server
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  return results;
}
