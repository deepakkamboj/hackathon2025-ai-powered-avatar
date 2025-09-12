import { NextRequest, NextResponse } from 'next/server';
import * as speechsdk from 'microsoft-cognitiveservices-speech-sdk';

// Store client contexts globally (in production, use Redis or database)
declare global {
  var clientContexts: Record<string, any>;
}

if (!global.clientContexts) {
  global.clientContexts = {};
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    console.log('Connect avatar API called');
    const clientId = req.headers.get('ClientId');
    if (!clientId) {
      console.log('Missing ClientId header');
      return NextResponse.json({ error: 'Missing ClientId header' }, { status: 400 });
    }
    console.log(`Client ID: ${clientId}`);

    // Get configuration from headers - following official Azure sample pattern
    const avatarCharacter = req.headers.get('AvatarCharacter') || 'lisa';
    const avatarStyle = req.headers.get('AvatarStyle') || 'casual-sitting';
    const backgroundColor = req.headers.get('BackgroundColor') || '#FFFFFFFF';
    const backgroundImageUrl = req.headers.get('BackgroundImageUrl') || '';
    const isCustomAvatar = req.headers.get('IsCustomAvatar')?.toLowerCase() === 'true';
    const transparentBackground = req.headers.get('TransparentBackground')?.toLowerCase() === 'true';
    const videoCrop = req.headers.get('VideoCrop')?.toLowerCase() === 'true';
    const ttsVoice = req.headers.get('TtsVoice') || 'en-US-JennyMultilingualV2Neural';

    // Get local SDP from request body
    const localSdp = await req.text();

    // Get Azure Speech configuration from environment
    const speechRegion = process.env.AZURE_SPEECH_REGION;
    const speechKey = process.env.AZURE_SPEECH_API_KEY;

    console.log(`Speech region: ${speechRegion}, Speech key: ${speechKey ? 'present' : 'missing'}`);

    if (!speechRegion || !speechKey) {
      console.log('Azure Speech configuration missing');
      return NextResponse.json({ error: 'Azure Speech configuration missing' }, { status: 500 });
    }

    // Create speech config - following official pattern
    const speechConfig = speechsdk.SpeechConfig.fromEndpoint(
      new URL(
        `wss://${speechRegion}.tts.speech.microsoft.com/cognitiveservices/websocket/v1?enableTalkingAvatar=true`,
      ),
      speechKey,
    );

    // Create speech synthesizer - following official pattern
    const speechSynthesizer = new speechsdk.SpeechSynthesizer(speechConfig, null);

    // Get ICE token for WebRTC - following official pattern
    let iceToken;
    try {
      const response = await fetch(
        `https://${speechRegion}.tts.speech.microsoft.com/cognitiveservices/avatar/relay/token/v1`,
        {
          headers: { 'Ocp-Apim-Subscription-Key': speechKey },
        },
      );
      iceToken = await response.json();
    } catch (error) {
      console.error('Failed to get ICE token:', error);
      return NextResponse.json({ error: 'Failed to get ICE token' }, { status: 500 });
    }

    // Configure avatar - following official pattern
    const avatarConfig = {
      synthesis: {
        video: {
          protocol: {
            name: 'WebRTC',
            webrtcConfig: {
              clientDescription: localSdp,
              iceServers: [
                {
                  urls: [iceToken.Urls[0]],
                  username: iceToken.Username,
                  credential: iceToken.Password,
                },
              ],
            },
          },
          format: {
            crop: {
              topLeft: { x: videoCrop ? 600 : 0, y: 0 },
              bottomRight: { x: videoCrop ? 1320 : 1920, y: 1080 },
            },
            bitrate: 1000000,
            codec: 'H264',
          },
          talkingAvatar: {
            customized: isCustomAvatar,
            useBuiltInVoice: false,
            character: avatarCharacter,
            style: avatarStyle,
            background: {
              color: transparentBackground ? '#00FF00FF' : backgroundColor,
              image: { url: backgroundImageUrl },
            },
          },
        },
      },
    };

    // Setup connection - following official pattern
    const connection = speechsdk.Connection.fromSynthesizer(speechSynthesizer);

    connection.connected = function () {
      console.log('TTS Avatar service connected.');
    };

    connection.disconnected = function () {
      console.log('TTS Avatar service disconnected.');
      if (global.clientContexts[clientId]) {
        global.clientContexts[clientId].speechSynthesizerConnection = null;
        global.clientContexts[clientId].speechSynthesizerConnected = false;
      }
    };

    // Set avatar configuration
    connection.setMessageProperty('speech.config', 'context', JSON.stringify(avatarConfig));

    // Store client context - following official pattern
    global.clientContexts[clientId] = {
      speechSynthesizer,
      speechSynthesizerConnection: connection,
      speechSynthesizerConnected: true,
      ttsVoice,
    };

    // Start avatar service - following official pattern
    return new Promise<NextResponse>((resolve) => {
      speechSynthesizer.speakTextAsync(' ', (result: any) => {
        if (result.reason === speechsdk.ResultReason.SynthesizingAudioCompleted) {
          console.log(`Avatar service started. Result ID: ${result.resultId}`);
          const remoteSdp = result.properties.getProperty('TalkingAvatarService_WebRTC_SDP');
          // Return remote SDP as plain text - following official pattern
          resolve(new NextResponse(remoteSdp, { status: 200, headers: { 'Content-Type': 'text/plain' } }));
        } else {
          console.log(`Unable to start avatar service. Result ID: ${result.resultId}`);
          if (result.reason === speechsdk.ResultReason.Canceled) {
            const cancellationDetails = speechsdk.CancellationDetails.fromResult(result);
            if (cancellationDetails.reason === speechsdk.CancellationReason.Error) {
              console.log(cancellationDetails.errorDetails);
            }
          }
          resolve(NextResponse.json({ error: 'Failed to start avatar service' }, { status: 500 }));
        }
      });
    });
  } catch (error: any) {
    console.error('Error in connect-avatar:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
