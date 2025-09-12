import { useEffect, useRef, useState } from 'react';

import { useChat } from 'ai/react';

import { useAtom } from 'jotai';
import { ArrowUp, BotMessageSquareIcon, Mic, Paperclip, PauseIcon, SpeechIcon } from 'lucide-react';

import {
  chatModeAtom,
  debugAtom,
  inputTextAtom,
  mediaStreamActiveAtom,
  providerModelAtom,
  sessionDataAtom,
  voiceIdAtom,
} from '@/lib/atoms';

import { useAzureSpeech } from '@/lib/useAzureSpeech';
import { useAzureAvatarV2 } from '@/lib/useAzureAvatarV2';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Switch } from '../ui/switch';
import { Textarea } from '../ui/textarea';
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip';
import { INITIAL_PROMPT } from '@/lib/constants';

export function Chat() {
  const [voiceId] = useAtom(voiceIdAtom);
  const { isRecording, recognizedText, startRecognition, stopRecognition, speakText, clearRecognizedText } =
    useAzureSpeech(voiceId);
  const { avatarSession, speakText: avatarSpeakText } = useAzureAvatarV2();
  const [sessionData] = useAtom(sessionDataAtom);
  const [mediaStreamActive] = useAtom(mediaStreamActiveAtom);
  const [, setDebug] = useAtom(debugAtom);
  const [chatMode, setChatMode] = useAtom(chatModeAtom);
  const [providerModel, setProviderModel] = useAtom(providerModelAtom);
  const [isLoadingChat, setIsLoadingChat] = useState(false);
  const [lastSpokenMessageId, setLastSpokenMessageId] = useState<string>('');
  const [isCurrentlySpeaking, setIsCurrentlySpeaking] = useState(false);

  // Generate a consistent session ID for this chat session
  const [sessionId] = useState(() => `session-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`);

  const { input, setInput, handleSubmit, handleInputChange, messages, isLoading, error, stop } = useChat({
    api: '/api/chat',
    body: {
      provider: 'mistral', // Can be changed to 'anthropic', 'groq', or 'mistral'
      temperature: 0.7,
      maxTokens: 4096,
      sessionId, // Pass the session ID for coffee ordering
    },
    onResponse: (response) => {
      console.log('AI Response:', response);
    },
    onFinish: async () => {
      setIsLoadingChat(false);
    },
    onError: (error) => {
      console.error('Chat error:', error);
      // Add your error handling UI here
    },
    initialMessages: [
      {
        id: '1',
        role: 'system',
        content: INITIAL_PROMPT,
      },
    ],
  });

  // Speak the last assistant message using Avatar TTS if avatar is connected, otherwise regular TTS
  useEffect(() => {
    const lastMsg = messages[messages.length - 1];
    if (
      lastMsg &&
      lastMsg.role === 'assistant' &&
      lastMsg.content &&
      lastMsg.id !== lastSpokenMessageId &&
      !isCurrentlySpeaking
    ) {
      setIsCurrentlySpeaking(true);
      setLastSpokenMessageId(lastMsg.id);

      // If avatar is connected, use avatar speakText, otherwise use regular TTS
      if (avatarSession?.status === 'connected') {
        console.log(`Speaking assistant response with avatar voice: ${voiceId}`);
        avatarSpeakText(lastMsg.content, voiceId)
          .then(() => {
            console.log('Avatar speech completed');
            setIsCurrentlySpeaking(false);
            // Auto-restart recording after avatar finishes speaking (with longer delay)
            setTimeout(() => {
              if (!isRecording && !isCurrentlySpeaking) {
                console.log('[Auto] Starting recording after avatar finished speaking');
                startRecognition();
              }
            }, 1000); // Increased delay to ensure speech is fully complete
          })
          .catch((error) => {
            console.log(`Avatar speak error: ${error.message}`);
            // Fallback to regular TTS if avatar fails
            speakText(lastMsg.content);
            setIsCurrentlySpeaking(false);
            // Auto-restart recording even on error
            setTimeout(() => {
              if (!isRecording && !isCurrentlySpeaking) {
                console.log('[Auto] Starting recording after avatar error');
                startRecognition();
              }
            }, 2500); // Longer delay for TTS fallback
          });
      } else {
        console.log(`Speaking assistant response with regular TTS voice: ${voiceId}`);
        speakText(lastMsg.content);
        // Auto-restart recording after regular TTS
        setTimeout(() => {
          setIsCurrentlySpeaking(false);
          if (!isRecording && !isCurrentlySpeaking) {
            console.log('[Auto] Starting recording after regular TTS');
            startRecognition();
          }
        }, 3000); // Longer delay for regular TTS since we can't track completion accurately
      }
    }
  }, [
    messages,
    avatarSession?.status,
    lastSpokenMessageId,
    isCurrentlySpeaking,
    voiceId,
    isRecording,
    startRecognition,
    avatarSpeakText,
    speakText,
  ]);

  // When recognizedText changes, send it to the agent/chat endpoint
  useEffect(() => {
    if (recognizedText && recognizedText.trim()) {
      console.log(`Processing recognized text: "${recognizedText}" (Chat mode: ${chatMode})`);
      setInput(recognizedText);

      // Clear the recognized text to prevent loops
      clearRecognizedText();

      // Handle based on mode
      setTimeout(() => {
        if (chatMode) {
          // Chat mode: submit to AI
          const submitEvent = { preventDefault: () => {} } as React.FormEvent;
          handleSubmit(submitEvent);
          // Auto-restart will happen after assistant response is spoken (handled in TTS useEffect)
        } else {
          // Repeat mode: just speak the input
          console.log(`Repeat mode: Speaking "${recognizedText}"`);
          if (avatarSession?.status === 'connected') {
            avatarSpeakText(recognizedText, voiceId)
              .then(() => {
                // Auto-restart recording after repeat mode speaking completes
                setTimeout(() => {
                  if (!isRecording) {
                    console.log('[Auto] Starting recording after repeat mode');
                    startRecognition();
                  }
                }, 1000);
              })
              .catch(() => {
                // Fallback and restart
                speakText(recognizedText);
                setTimeout(() => {
                  if (!isRecording) {
                    console.log('[Auto] Starting recording after repeat mode fallback');
                    startRecognition();
                  }
                }, 2000);
              });
          } else {
            speakText(recognizedText);
            // Auto-restart recording after regular TTS in repeat mode
            setTimeout(() => {
              if (!isRecording) {
                console.log('[Auto] Starting recording after repeat mode regular TTS');
                startRecognition();
              }
            }, 3000);
          }
          // Clear input after speaking
          setInput('');
        }
      }, 200); // Slightly longer delay to ensure processing is clean
    }
  }, [recognizedText, chatMode]);

  // TODO: Add logic to stream assistant messages to Azure Speech TTS

  async function handleInterrupt() {
    stopRecognition();
    stop();
    setDebug('Speech recognition interrupted');
  }

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    setDebug(`Submitting message: ${input}`);

    if (chatMode) {
      // Chat mode: send to AI and get response
      await handleSubmit(e);
    } else {
      // Repeat mode: just speak the input text
      setDebug(`Repeat mode: Speaking "${input}"`);
      if (avatarSession?.status === 'connected') {
        avatarSpeakText(input, voiceId);
      } else {
        speakText(input);
      }
      // Clear input after speaking
      setInput('');
    }
  };

  return (
    <form onSubmit={handleFormSubmit}>
      <div className="mb-2 flex w-full items-center justify-end space-x-2">
        <Tooltip>
          <TooltipTrigger asChild>
            <Label htmlFor="chat-mode" className="flex flex-row items-center space-x-1">
              <SpeechIcon className="size-5" />
              <p>Repeat</p>
            </Label>
          </TooltipTrigger>
          <TooltipContent side="top">Repeat the input text</TooltipContent>
        </Tooltip>

        <Switch
          id="chat-mode"
          className="data-[state=unchecked]:bg-primary"
          defaultChecked={chatMode}
          onCheckedChange={() => {
            setChatMode(!chatMode);
            // Only auto-start recording when switching TO chat mode, not away from it
            setTimeout(() => {
              if (!chatMode && !isRecording && !isCurrentlySpeaking) {
                console.log('[Auto] Starting recording after switching to chat mode');
                startRecognition();
              }
            }, 1000);
          }}
        />

        <Tooltip>
          <TooltipTrigger asChild>
            <Label htmlFor="chat-mode" className="flex flex-row items-center space-x-1">
              <p>Chat</p>
              <BotMessageSquareIcon className="size-5" />
            </Label>
          </TooltipTrigger>
          <TooltipContent side="top">Chat</TooltipContent>
        </Tooltip>
      </div>

      <div className="flex w-full items-center">
        <div className="bg-default flex w-full flex-col gap-1.5 rounded-[26px] border bg-background p-1.5 transition-colors">
          <div className="flex items-center gap-1.5 md:gap-2">
            <div className="flex flex-col">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button type="button" variant="ghost" size="icon" className="rounded-full">
                    <Paperclip className="size-5" />
                    <Input multiple={false} type="file" className="hidden" />
                    <span className="sr-only">Attach file</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top">Attach File</TooltipContent>
              </Tooltip>
            </div>

            <div className="flex min-w-0 flex-1 flex-col">
              <Textarea
                id="prompt-textarea"
                data-id="root"
                name="prompt"
                value={input}
                onChange={handleInputChange}
                dir="auto"
                rows={1}
                className="h-[40px] min-h-[40px] resize-none overflow-y-hidden rounded-none border-0 px-0 shadow-none focus:ring-0 focus-visible:ring-0"
              />
            </div>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant={isRecording ? 'default' : 'ghost'}
                  size="icon"
                  className="rounded-full"
                  onClick={isRecording ? stopRecognition : startRecognition}
                  aria-pressed={isRecording}
                >
                  <Mic className="size-5" />
                  <span className="sr-only">{isRecording ? 'Stop Recording' : 'Use Microphone'}</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">{isRecording ? 'Stop Recording' : 'Use Microphone'}</TooltipContent>
            </Tooltip>

            <Button
              // disabled={!isLoading}
              size="icon"
              type="button"
              className="rounded-full"
              onClick={handleInterrupt}
            >
              <PauseIcon className="size-5" />
            </Button>

            {/* ArrowUp button is not needed for voice-only, but can be kept for manual send if desired */}
            <Button size="icon" type="submit" className="rounded-full" disabled={!input.trim() || isLoading}>
              <ArrowUp className="size-5" />
            </Button>
          </div>
        </div>
      </div>
    </form>
  );
}
