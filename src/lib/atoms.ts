import { RefObject } from 'react';
import { atom } from 'jotai';
import { APP_NAME } from './constants';
import { NavItem } from './types';

// Type definitions for better type safety
export type AvatarSession = {
  sessionId: string;
  avatarId: string;
  voiceId: string;
  quality: string;
  token: string;
  iceServers?: any;
  status: string;
};

// Stream Atoms - explicitly define as writable atoms with default values
export const mediaStreamActiveAtom = atom(false);
export const sessionDataAtom = atom<AvatarSession | undefined>(undefined);
export const streamAtom = atom<MediaStream | undefined>(undefined);
export const debugAtom = atom('');
export const inputTextAtom = atom('');
export const avatarIdAtom = atom('lisa'); // Set default avatar
export const voiceIdAtom = atom('en-US-JennyNeural'); // Set default voice
export const qualityAtom = atom('medium');
export const mediaStreamRefAtom = atom<RefObject<HTMLVideoElement> | null>(null);
export const mediaCanvasRefAtom = atom<RefObject<HTMLCanvasElement> | null>(null);
export const azureSpeechTokenAtom = atom('');
export const azureAvatarSessionAtom = atom<AvatarSession | undefined>(undefined);

//UI Atoms
export const selectedNavItemAtom = atom<NavItem>({
  label: APP_NAME,
  icon: '',
  ariaLabel: APP_NAME,
  content: '',
});
export const publicAvatarsAtom = atom([]);
export const removeBGAtom = atom(false);
export const isRecordingAtom = atom(false);
export const chatModeAtom = atom(true);
export const customBgPicAtom = atom<string>('');

//LLMs Atoms
export const providerModelAtom = atom('openai:gpt-4-turbo');
export const temperatureAtom = atom(1);
export const maxTokensAtom = atom(256);
