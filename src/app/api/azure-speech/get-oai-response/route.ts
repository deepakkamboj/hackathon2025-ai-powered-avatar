import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const AZURE_OPENAI_ENDPOINT = process.env.AZURE_OPENAI_ENDPOINT;
  const AZURE_OPENAI_API_KEY = process.env.AZURE_OPENAI_API_KEY;
  const AZURE_OPENAI_CHAT_DEPLOYMENT = process.env.AZURE_OPENAI_CHAT_DEPLOYMENT;
  const AZURE_OPENAI_API_VERSION = process.env.AZURE_OPENAI_API_VERSION || '2023-07-01-preview';

  if (!AZURE_OPENAI_ENDPOINT || !AZURE_OPENAI_API_KEY || !AZURE_OPENAI_CHAT_DEPLOYMENT) {
    return NextResponse.json({ error: 'Azure OpenAI config missing.' }, { status: 500 });
  }

  const body = await req.json();
  const messages = body.messages || [];

  const functions = [
    {
      name: 'order_coffee',
      description: 'Place a coffee order for a customer.',
      parameters: {
        type: 'object',
        properties: {
          customerName: { type: 'string', description: 'Name of the customer.' },
          coffeeItems: { type: 'array', items: { type: 'object' }, description: 'List of coffee items.' },
        },
        required: ['customerName', 'coffeeItems'],
      },
    },
    {
      name: 'get_menu',
      description: 'Get the coffee menu.',
      parameters: { type: 'object', properties: {} },
    },
    {
      name: 'company_info',
      description: 'Get information about the coffee company.',
      parameters: {
        type: 'object',
        properties: { query: { type: 'string', description: 'Query about company info.' } },
      },
    },
  ];

  const url = `${AZURE_OPENAI_ENDPOINT}/openai/deployments/${AZURE_OPENAI_CHAT_DEPLOYMENT}/chat/completions?api-version=${AZURE_OPENAI_API_VERSION}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-key': AZURE_OPENAI_API_KEY,
    },
    body: JSON.stringify({
      messages,
      functions,
      stream: true,
    }),
  });

  if (!response.body) {
    return NextResponse.json({ error: 'No response body from OpenAI.' }, { status: 500 });
  }

  // Stream the response
  return new Response(response.body, {
    headers: {
      'Content-Type': 'application/json',
      'Transfer-Encoding': 'chunked',
    },
  });
}
