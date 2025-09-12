import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const speech_key = process.env.AZURE_SPEECH_API_KEY;
  const speech_region = process.env.AZURE_SPEECH_REGION;
  if (!speech_key || !speech_region) {
    return NextResponse.json({ error: 'Speech API key or region not set.' }, { status: 500 });
  }
  const fetch_url = `https://${speech_region}.api.cognitive.microsoft.com/sts/v1.0/issueToken`;
  const headers = { 'Ocp-Apim-Subscription-Key': speech_key, 'Content-Length': '0' };
  const response = await fetch(fetch_url, { method: 'POST', headers });
  if (response.ok) {
    const token = await response.text();
    return NextResponse.json({ token, region: speech_region });
  } else {
    return NextResponse.json(
      { error: 'Failed to fetch speech token.', status: response.status },
      { status: response.status },
    );
  }
}
