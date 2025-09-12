import React, { useState } from 'react';
import { useAtom } from 'jotai';
import { PlayIcon, RefreshCcw, SquareIcon, Volume2 } from 'lucide-react';

import {
  avatarIdAtom,
  debugAtom,
  mediaCanvasRefAtom,
  mediaStreamActiveAtom,
  mediaStreamRefAtom,
  qualityAtom,
  voiceIdAtom,
} from '@/lib/atoms';
import { useAzureAvatarV2 } from '@/lib/useAzureAvatarV2';

import { Button } from '../ui/button';

export function StartStop() {
  const [mediaStreamActive, setMediaStreamActive] = useAtom(mediaStreamActiveAtom);
  const [quality] = useAtom(qualityAtom);
  const [avatarId] = useAtom(avatarIdAtom);
  const [voiceId] = useAtom(voiceIdAtom);
  const [mediaStreamRef] = useAtom(mediaStreamRefAtom);
  const [mediaCanvasRef] = useAtom(mediaCanvasRefAtom);
  const [, setDebug] = useAtom(debugAtom);

  // Azure Avatar integration
  const { avatarSession, isConnecting, startAvatarSession, stopAvatarSession, speakText, unmuteAvatarAudio } =
    useAzureAvatarV2();

  const [isStarting, setIsStarting] = useState(false);

  // Monitor avatar session status and update mediaStreamActive
  React.useEffect(() => {
    if (avatarSession?.status === 'connected') {
      setMediaStreamActive(true);
      setDebug('Avatar connected - status is now LIVE');

      // Unmute audio and greet the user when avatar connects
      setTimeout(() => {
        // Ensure audio is unmuted
        unmuteAvatarAudio();

        const greetingMessage =
          "Hello! My name is Diya, and I'm your virtual assistant from CoffeeCorp LLC for the Microsoft Hackathon 2025. I can help you with coffee orders, company information, weather updates, and more. How can I help you today?";
        speakText(greetingMessage, voiceId).catch((error) => {
          setDebug(`Error speaking greeting: ${error.message}`);
        });
      }, 2000); // Wait 2 seconds for avatar to fully initialize
    } else if (avatarSession?.status === 'disconnected' || avatarSession?.status === 'error') {
      setMediaStreamActive(false);
      setDebug('Avatar disconnected - status is now OFFLINE');
    }
  }, [avatarSession?.status, setMediaStreamActive, setDebug, speakText, voiceId, unmuteAvatarAudio]);

  const startAzureAvatar = async () => {
    if (isStarting || isConnecting) return;
    setIsStarting(true);

    try {
      setDebug('Starting Azure Avatar session (main.js style)...');

      // Start the Azure Avatar session following official pattern
      // Map avatarId to proper character and style
      let avatarStyle = 'casual-sitting';
      if (avatarId === 'lisa') avatarStyle = 'casual-sitting';
      else if (avatarId === 'meg') avatarStyle = 'casual';
      else if (avatarId === 'max') avatarStyle = 'formal';

      await startAvatarSession(avatarId, avatarStyle, voiceId);

      setDebug('Azure Avatar session request completed');
    } catch (error: any) {
      setDebug(`Error starting Azure Avatar: ${error.message}`);
      console.error('Error starting Azure Avatar:', error);
    } finally {
      setIsStarting(false);
    }
  };

  const stopAzureAvatar = async () => {
    try {
      setDebug('Stopping Azure Avatar session...');
      setMediaStreamActive(false);

      // Stop the real Azure Avatar session
      await stopAvatarSession();

      setDebug('Azure Avatar session stopped');
    } catch (error: any) {
      setDebug(`Error stopping Azure Avatar: ${error.message}`);
      console.error('Error stopping Azure Avatar:', error);
    }
  };

  const restartAzureAvatar = async () => {
    await stopAzureAvatar();
    setTimeout(() => startAzureAvatar(), 1000);
  };

  return (
    <div className="relative space-x-1">
      <Button
        onClick={startAzureAvatar}
        variant="ghost"
        size="icon"
        title="Start Azure Avatar"
        disabled={isStarting || isConnecting || mediaStreamActive}
      >
        <PlayIcon className="size-4" />
      </Button>
      <Button
        onClick={stopAzureAvatar}
        variant="ghost"
        size="icon"
        title="Stop Azure Avatar"
        disabled={!mediaStreamActive}
      >
        <SquareIcon className="size-4" />
      </Button>
      <Button
        onClick={restartAzureAvatar}
        variant="ghost"
        size="icon"
        title="Restart Azure Avatar"
        disabled={isStarting || isConnecting}
      >
        <RefreshCcw className="size-4" />
      </Button>
      <Button
        onClick={unmuteAvatarAudio}
        variant="ghost"
        size="icon"
        title="Unmute Avatar Audio"
        disabled={!mediaStreamActive}
      >
        <Volume2 className="size-4" />
      </Button>
    </div>
  );
}
