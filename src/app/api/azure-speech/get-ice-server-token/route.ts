import { NextRequest, NextResponse } from 'next/server';

async function getIceServerToken() {
  const region = process.env.AZURE_SPEECH_REGION;
  const subscription_key = process.env.AZURE_SPEECH_API_KEY;
  if (!region || !subscription_key) {
    return { error: 'Speech API key or region not set.', status: 500 };
  }
  const token_endpoint = `https://${region}.tts.speech.microsoft.com/cognitiveservices/avatar/relay/token/v1`;
  const response = await fetch(token_endpoint, {
    method: 'GET',
    headers: { 'Ocp-Apim-Subscription-Key': subscription_key },
  });
  if (response.ok) {
    const data = await response.json();
    return { data, status: 200 };
  } else {
    return { error: `Failed to fetch ICE server token: ${response.status}`, status: response.status };
  }
}

export async function GET(req: NextRequest) {
  const result = await getIceServerToken();
  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json(result.data);
}

export async function POST(req: NextRequest) {
  const result = await getIceServerToken();
  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json(result.data);
}
