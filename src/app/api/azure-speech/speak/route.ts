import { NextRequest, NextResponse } from 'next/server';
import * as speechsdk from 'microsoft-cognitiveservices-speech-sdk';

// Access the same client contexts from connect-avatar
declare global {
  var clientContexts: Record<string, any>;
}

if (!global.clientContexts) {
  global.clientContexts = {};
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const clientId = req.headers.get('ClientId');
    if (!clientId) {
      return NextResponse.json({ error: 'Missing ClientId header' }, { status: 400 });
    }

    const clientContext = global.clientContexts[clientId];
    if (!clientContext) {
      return NextResponse.json({ error: 'Client context not found' }, { status: 404 });
    }

    // Get SSML from request body
    const ssml = await req.text();

    if (!ssml) {
      return NextResponse.json({ error: 'Missing SSML content' }, { status: 400 });
    }

    const speechSynthesizer = clientContext.speechSynthesizer;
    if (!speechSynthesizer) {
      return NextResponse.json({ error: 'Speech synthesizer not available' }, { status: 400 });
    }

    // Speak SSML using avatar - following official pattern
    return new Promise<NextResponse>((resolve) => {
      speechSynthesizer.speakSsmlAsync(
        ssml,
        (result: any) => {
          if (result.reason === speechsdk.ResultReason.SynthesizingAudioCompleted) {
            console.log(`Speech synthesized successfully. Result ID: ${result.resultId}`);
            // Return result ID as plain text - following official pattern
            resolve(
              new NextResponse(result.resultId, { status: 200, headers: { 'Content-Type': 'text/plain' } }),
            );
          } else if (result.reason === speechsdk.ResultReason.Canceled) {
            const cancellationDetails = speechsdk.CancellationDetails.fromResult(result);
            console.log(`Speech synthesis canceled: ${cancellationDetails.reason}`);
            if (cancellationDetails.reason === speechsdk.CancellationReason.Error) {
              console.log(`Error details: ${cancellationDetails.errorDetails}`);
            }
            resolve(
              NextResponse.json(
                { error: 'Speech synthesis canceled', details: cancellationDetails.errorDetails },
                { status: 400 },
              ),
            );
          } else {
            resolve(
              NextResponse.json({ error: 'Speech synthesis failed', reason: result.reason }, { status: 400 }),
            );
          }
        },
        (error: any) => {
          console.error('Speech synthesis error:', error);
          resolve(NextResponse.json({ error: error.message }, { status: 500 }));
        },
      );
    });
  } catch (error: any) {
    console.error('Error in speak API:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
