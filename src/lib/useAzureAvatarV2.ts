import { useRef, useCallback, useState } from 'react';
import { useAtom } from 'jotai';
import { debugAtom } from './atoms';
import * as speechsdk from 'microsoft-cognitiveservices-speech-sdk';

interface ICEToken {
  Urls: string[];
  Username: string;
  Password: string;
}

interface AvatarSession {
  clientId: string;
  speechSynthesizer: any;
  speechSynthesizerConnection: any;
  speechSynthesizerConnected: boolean;
  peerConnection: RTCPeerConnection | null;
  status: 'starting' | 'connected' | 'disconnected' | 'error';
}

export function useAzureAvatarV2() {
  const [, setDebug] = useAtom(debugAtom);

  // Global variables following official Azure sample pattern
  const clientIdRef = useRef<string>('');
  const iceServerUrlRef = useRef<string>('');
  const iceServerUsernameRef = useRef<string>('');
  const iceServerCredentialRef = useRef<string>('');
  const peerConnectionQueueRef = useRef<RTCPeerConnection[]>([]);
  const previousAnimationFrameTimestampRef = useRef<number>(0);

  // Session state
  const [avatarSession, setAvatarSession] = useState<AvatarSession | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);

  // Generate client ID like official Azure sample
  const initializeClient = useCallback(() => {
    const clientId = 'client-' + Math.random().toString(36).substring(2, 15);
    clientIdRef.current = clientId;
    setDebug(`Initialized client ID: ${clientId}`);
    return clientId;
  }, [setDebug]);

  // Fetch ICE token from server - following official pattern
  const fetchIceToken = useCallback(async (): Promise<ICEToken> => {
    const response = await fetch('/api/azure-speech/get-ice-server-token', {
      method: 'POST',
      headers: {
        ClientId: clientIdRef.current,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed fetching ICE token: ${response.status} ${response.statusText}`);
    }

    const iceToken = await response.json();
    iceServerUrlRef.current = iceToken.Urls[0];
    iceServerUsernameRef.current = iceToken.Username;
    iceServerCredentialRef.current = iceToken.Password;

    setDebug(`ICE token fetched: ${iceToken.Urls[0]}`);
    return iceToken;
  }, [setDebug]);

  // Prepare peer connection for WebRTC - following official pattern
  const preparePeerConnection = useCallback(async () => {
    const peerConnection = new RTCPeerConnection({
      iceServers: [
        {
          urls: [iceServerUrlRef.current],
          username: iceServerUsernameRef.current,
          credential: iceServerCredentialRef.current,
        },
      ],
      iceTransportPolicy: 'relay',
    });

    // Fetch WebRTC video stream and mount it to HTML video element - following official pattern
    peerConnection.ontrack = function (event: RTCTrackEvent) {
      setDebug(`Received ${event.track.kind} track`);

      // Clean up existing video element if there is any
      const remoteVideoDiv = document.getElementById('remoteVideo');
      if (!remoteVideoDiv) {
        setDebug('Error: remoteVideo element not found');
        return;
      }

      // Remove all existing elements of the same track kind to prevent duplicates
      const existingElements = remoteVideoDiv.querySelectorAll(event.track.kind);
      existingElements.forEach((el) => remoteVideoDiv.removeChild(el));

      const mediaPlayer = document.createElement(event.track.kind) as HTMLVideoElement | HTMLAudioElement;
      mediaPlayer.id = event.track.kind;
      mediaPlayer.srcObject = event.streams[0];
      mediaPlayer.autoplay = false;

      mediaPlayer.addEventListener('loadeddata', () => {
        mediaPlayer.play();
      });

      remoteVideoDiv.appendChild(mediaPlayer);

      if (event.track.kind === 'video') {
        const videoElement = mediaPlayer as HTMLVideoElement;
        videoElement.playsInline = true;

        // Hide the raw video element since we'll show the processed canvas
        videoElement.style.display = 'none';

        const canvas = document.getElementById('canvas') as HTMLCanvasElement;
        if (canvas) {
          canvas.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height);
          canvas.hidden = false;
        }

        videoElement.addEventListener('play', () => {
          // Start background processing
          window.requestAnimationFrame(makeBackgroundTransparent);
          setDebug('Video started playing, background processing started');
        });
      } else {
        // Audio track - handle audio properly
        const audioElement = mediaPlayer as HTMLAudioElement;
        audioElement.muted = true; // Start muted for autoplay policy
        audioElement.volume = 1.0; // Set full volume

        // Unmute after a short delay to ensure autoplay works
        audioElement.addEventListener('loadeddata', () => {
          setTimeout(() => {
            audioElement.muted = false;
            setDebug('Avatar audio unmuted and ready to play');
          }, 500);
        });

        // Handle audio play events
        audioElement.addEventListener('play', () => {
          setDebug('Avatar audio started playing');
        });

        audioElement.addEventListener('pause', () => {
          setDebug('Avatar audio paused');
        });

        audioElement.addEventListener('ended', () => {
          setDebug('Avatar audio ended');
        });
      }
    };

    // Listen to data channel for events from server - following official pattern
    peerConnection.addEventListener('datachannel', (event: RTCDataChannelEvent) => {
      const dataChannel = event.channel;
      dataChannel.onmessage = (e: MessageEvent) => {
        setDebug(`WebRTC event received: ${e.data}`);

        if (e.data.includes('EVENT_TYPE_SWITCH_TO_IDLE')) {
          setDebug('Avatar switched to idle state');
        }
      };
    });

    // Create data channel from client side - following official pattern
    peerConnection.createDataChannel('eventChannel');

    // Connection state changes - following official pattern
    peerConnection.oniceconnectionstatechange = () => {
      const state = peerConnection.iceConnectionState;
      setDebug(`WebRTC status: ${state}`);

      if (state === 'connected') {
        setAvatarSession((prev) => (prev ? { ...prev, status: 'connected' } : null));
      }

      if (state === 'disconnected' || state === 'failed') {
        setAvatarSession((prev) => (prev ? { ...prev, status: 'disconnected' } : null));
      }
    };

    // Offer to receive 1 audio and 1 video track - following official pattern
    peerConnection.addTransceiver('video', { direction: 'sendrecv' });
    peerConnection.addTransceiver('audio', { direction: 'sendrecv' });

    // ICE gathering - following official pattern
    let iceGatheringDone = false;

    peerConnection.onicecandidate = (e: RTCPeerConnectionIceEvent) => {
      if (!e.candidate && !iceGatheringDone) {
        iceGatheringDone = true;
        peerConnectionQueueRef.current.push(peerConnection);
        setDebug('ICE gathering done, peer connection prepared');

        if (peerConnectionQueueRef.current.length > 1) {
          peerConnectionQueueRef.current.shift();
        }
      }
    };

    // Create offer - following official pattern
    const sdp = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(sdp);

    // Timeout for ICE gathering - following official pattern
    setTimeout(() => {
      if (!iceGatheringDone) {
        iceGatheringDone = true;
        peerConnectionQueueRef.current.push(peerConnection);
        setDebug('ICE gathering done (timeout), peer connection prepared');

        if (peerConnectionQueueRef.current.length > 1) {
          peerConnectionQueueRef.current.shift();
        }
      }
    }, 10000);

    return peerConnection;
  }, [setDebug]);

  // Connect to avatar service - following official pattern
  const connectToAvatarService = useCallback(
    async (peerConnection: RTCPeerConnection, avatarCharacter: string, avatarStyle: string) => {
      if (!peerConnection.localDescription) {
        throw new Error('No local description available');
      }

      const localSdp = btoa(JSON.stringify(peerConnection.localDescription));

      const headers = {
        ClientId: clientIdRef.current,
        AvatarCharacter: avatarCharacter,
        AvatarStyle: avatarStyle,
        BackgroundColor: '#00FF00FF', // Green screen for transparency
        TransparentBackground: 'true',
        VideoCrop: 'true',
      };

      const response = await fetch('/api/azure-speech/connect-avatar', {
        method: 'POST',
        headers,
        body: localSdp,
      });

      if (!response.ok) {
        throw new Error(`Failed connecting to avatar service: ${response.status} ${response.statusText}`);
      }

      const remoteSdp = await response.text();
      const remoteDescription = new RTCSessionDescription(JSON.parse(atob(remoteSdp)));
      await peerConnection.setRemoteDescription(remoteDescription);

      setDebug('Successfully connected to avatar service');
    },
    [setDebug],
  );

  // Make video background transparent - following official pattern
  const makeBackgroundTransparent = useCallback((timestamp: number) => {
    // Throttle to 30 FPS - following official pattern
    if (timestamp - previousAnimationFrameTimestampRef.current > 30) {
      // Look for the WebRTC video element created in ontrack
      const remoteVideoDiv = document.getElementById('remoteVideo');
      const video = remoteVideoDiv?.querySelector('video') as HTMLVideoElement;
      let tmpCanvas = document.getElementById('tmpCanvas') as HTMLCanvasElement;

      // Create tmpCanvas if it doesn't exist
      if (!tmpCanvas) {
        tmpCanvas = document.createElement('canvas');
        tmpCanvas.id = 'tmpCanvas';
        tmpCanvas.style.display = 'none';
        document.body.appendChild(tmpCanvas);
      }

      const tmpCanvasContext = tmpCanvas.getContext('2d', { willReadFrequently: true });

      if (video && tmpCanvasContext && video.videoWidth > 0) {
        tmpCanvas.width = video.videoWidth;
        tmpCanvas.height = video.videoHeight;
        tmpCanvasContext.drawImage(video, 0, 0, video.videoWidth, video.videoHeight);

        const frame = tmpCanvasContext.getImageData(0, 0, video.videoWidth, video.videoHeight);

        // Green screen removal - following official pattern
        for (let i = 0; i < frame.data.length / 4; i++) {
          let r = frame.data[i * 4 + 0];
          let g = frame.data[i * 4 + 1];
          let b = frame.data[i * 4 + 2];

          if (g - 150 > r + b) {
            // Set alpha to 0 for green pixels
            frame.data[i * 4 + 3] = 0;
          } else if (g + g > r + b) {
            // Reduce green for edge smoothing
            const adjustment = (g - (r + b) / 2) / 3;
            r += adjustment;
            g -= adjustment * 2;
            b += adjustment;
            frame.data[i * 4 + 0] = r;
            frame.data[i * 4 + 1] = g;
            frame.data[i * 4 + 2] = b;

            // Reduce alpha for smoother edges
            const a = Math.max(0, 255 - adjustment * 4);
            frame.data[i * 4 + 3] = a;
          }
        }

        const canvas = document.getElementById('canvas') as HTMLCanvasElement;
        const canvasContext = canvas?.getContext('2d');
        if (canvas && canvasContext) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          canvasContext.putImageData(frame, 0, 0);
        }
      }

      previousAnimationFrameTimestampRef.current = timestamp;
    }

    window.requestAnimationFrame(makeBackgroundTransparent);
  }, []);

  // Wait for peer connection and start session - following official pattern
  const waitForPeerConnectionAndStartSession = useCallback(
    async (avatarCharacter: string, avatarStyle: string) => {
      if (peerConnectionQueueRef.current.length > 0) {
        const peerConnection = peerConnectionQueueRef.current.shift()!;
        await connectToAvatarService(peerConnection, avatarCharacter, avatarStyle);

        if (peerConnectionQueueRef.current.length === 0) {
          preparePeerConnection();
        }
      } else {
        setDebug('Waiting for peer connection to be ready...');
        setTimeout(() => waitForPeerConnectionAndStartSession(avatarCharacter, avatarStyle), 1000);
      }
    },
    [connectToAvatarService, preparePeerConnection, setDebug],
  );

  // Enable audio context for browsers (user interaction required)
  const enableAudioContext = useCallback(() => {
    // Try to resume audio context if it's suspended
    if (typeof window !== 'undefined') {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      if (audioContext.state === 'suspended') {
        audioContext.resume().then(() => {
          setDebug('Audio context resumed for avatar playback');
        });
      }
    }
  }, [setDebug]);

  // Main function to start avatar session - following official pattern
  const startAvatarSession = useCallback(
    async (avatarCharacter: string, avatarStyle: string, voiceName: string) => {
      if (isConnecting || avatarSession?.status === 'connected') {
        setDebug('Avatar session already starting or connected');
        return;
      }
      setIsConnecting(true);

      try {
        setDebug('Starting Azure Avatar session...');

        // Enable audio context for browser audio playback
        enableAudioContext();

        // Clean up any existing session first
        if (avatarSession) {
          await stopAvatarSession();
        }

        // Initialize client ID
        const clientId = initializeClient();

        // Create session object
        const session: AvatarSession = {
          clientId,
          speechSynthesizer: null,
          speechSynthesizerConnection: null,
          speechSynthesizerConnected: false,
          peerConnection: null,
          status: 'starting',
        };
        setAvatarSession(session);

        // Fetch ICE token and prepare peer connection
        await fetchIceToken();
        await preparePeerConnection();

        // Wait for peer connection and start session
        await waitForPeerConnectionAndStartSession(avatarCharacter, avatarStyle);

        setDebug('Avatar session started successfully');
      } catch (error: any) {
        setDebug(`Error starting avatar session: ${error.message}`);
        setAvatarSession((prev) => (prev ? { ...prev, status: 'error' } : null));
      } finally {
        setIsConnecting(false);
      }
    },
    [
      isConnecting,
      setDebug,
      initializeClient,
      fetchIceToken,
      preparePeerConnection,
      waitForPeerConnectionAndStartSession,
    ],
  );

  // Speak text using avatar - following official pattern
  const speakText = useCallback(
    async (text: string, voiceName: string) => {
      if (!avatarSession || avatarSession.status !== 'connected') {
        throw new Error('Avatar not connected');
      }

      const spokenSsml = `<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xmlns:mstts='http://www.w3.org/2001/mstts' xml:lang='en-US'><voice name='${voiceName}'><mstts:leadingsilence-exact value='0'/>${text}</voice></speak>`;

      const response = await fetch('/api/azure-speech/speak', {
        method: 'POST',
        headers: {
          ClientId: clientIdRef.current,
          'Content-Type': 'application/ssml+xml',
        },
        body: spokenSsml,
      });

      if (!response.ok) {
        throw new Error(`Speech synthesis failed: ${response.status} ${response.statusText}`);
      }

      const resultId = await response.text();
      setDebug(`Speech synthesized successfully. Result ID: ${resultId}`);
    },
    [avatarSession, setDebug],
  );

  // Stop avatar session - following official pattern
  const stopAvatarSession = useCallback(async () => {
    if (!avatarSession) return;

    try {
      setDebug('Stopping avatar session...');

      // Stop speaking
      await fetch('/api/azure-speech/stop-speaking', {
        method: 'POST',
        headers: {
          ClientId: clientIdRef.current,
        },
      });

      // Disconnect avatar
      await fetch('/api/azure-speech/disconnect-avatar', {
        method: 'POST',
        headers: {
          ClientId: clientIdRef.current,
        },
      });

      // Clean up peer connections
      peerConnectionQueueRef.current.forEach((pc) => pc.close());
      peerConnectionQueueRef.current = [];

      // Clean up video elements
      const remoteVideoDiv = document.getElementById('remoteVideo');
      if (remoteVideoDiv) {
        // Stop all media streams first
        const mediaElements = remoteVideoDiv.querySelectorAll('video, audio');
        mediaElements.forEach((element: Element) => {
          const mediaElement = element as HTMLVideoElement | HTMLAudioElement;
          if (mediaElement.srcObject) {
            const stream = mediaElement.srcObject as MediaStream;
            stream.getTracks().forEach((track) => track.stop());
            mediaElement.srcObject = null;
          }
        });
        remoteVideoDiv.innerHTML = '';
      }

      const canvas = document.getElementById('canvas') as HTMLCanvasElement;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
        canvas.hidden = true;
      }

      // Clean up temporary canvas
      const tmpCanvas = document.getElementById('tmpCanvas');
      if (tmpCanvas) {
        tmpCanvas.remove();
      }

      setAvatarSession(null);
      setDebug('Avatar session stopped successfully');
    } catch (error: any) {
      setDebug(`Error stopping avatar session: ${error.message}`);
    }
  }, [avatarSession, setDebug]);

  // Function to unmute avatar audio (call this from UI if needed)
  const unmuteAvatarAudio = useCallback(() => {
    const remoteVideoDiv = document.getElementById('remoteVideo');
    if (remoteVideoDiv) {
      const audioElements = remoteVideoDiv.querySelectorAll('audio');
      audioElements.forEach((audio) => {
        audio.muted = false;
        audio.volume = 1.0;
        setDebug('Avatar audio manually unmuted');
      });
    }
  }, [setDebug]);

  return {
    avatarSession,
    isConnecting,
    startAvatarSession,
    stopAvatarSession,
    speakText,
    unmuteAvatarAudio,
  };
}
