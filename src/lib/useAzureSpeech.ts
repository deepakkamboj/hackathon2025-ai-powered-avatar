import { useEffect, useRef, useState } from 'react';
import { useAtom } from 'jotai';
import { debugAtom } from '@/lib/atoms';
import * as speechsdk from 'microsoft-cognitiveservices-speech-sdk';

// This hook manages Azure Speech TTS and STT for voice-only chat
export function useAzureSpeech(voiceName?: string) {
  const [speechToken, setSpeechToken] = useState<string | null>(null);
  const [speechRegion, setSpeechRegion] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recognizedText, setRecognizedText] = useState('');
  const [, setDebug] = useAtom(debugAtom);
  const recognizerRef = useRef<speechsdk.SpeechRecognizer | null>(null);

  // Fetch speech token from API
  const fetchSpeechToken = async () => {
    try {
      setDebug('Fetching Azure Speech token...');
      const res = await fetch('/api/azure-speech/get-speech-token');
      const data = await res.json();
      setSpeechToken(data.token);
      setSpeechRegion(data.region);
      setDebug(`Azure Speech token acquired for region: ${data.region}`);
      return { token: data.token, region: data.region };
    } catch (error) {
      setDebug(`Error fetching speech token: ${error}`);
      throw error;
    }
  };

  // Start speech recognition (STT)
  const startRecognition = async () => {
    try {
      setDebug('Initializing Azure Speech Recognition...');

      let currentToken = speechToken;
      let currentRegion = speechRegion;

      if (!currentToken || !currentRegion) {
        const tokenData = await fetchSpeechToken();
        currentToken = tokenData.token;
        currentRegion = tokenData.region;
      }

      if (!currentToken || !currentRegion) {
        throw new Error('Failed to acquire speech token');
      }

      const speechConfig = speechsdk.SpeechConfig.fromAuthorizationToken(currentToken, currentRegion);
      speechConfig.speechRecognitionLanguage = 'en-US';
      const audioConfig = speechsdk.AudioConfig.fromDefaultMicrophoneInput();
      const recognizer = new speechsdk.SpeechRecognizer(speechConfig, audioConfig);
      recognizerRef.current = recognizer;

      // Add event handlers for better debugging
      recognizer.recognizing = (s, e) => {
        setDebug(`Recognizing: ${e.result.text}`);
      };

      recognizer.recognized = (s, e) => {
        if (e.result.reason === speechsdk.ResultReason.RecognizedSpeech) {
          const text = e.result.text.trim();
          if (text && text.length > 0) {
            setRecognizedText(text);
            setDebug(`Recognized: ${text}`);
            // Stop recognition after getting a meaningful result to process it
            setTimeout(() => {
              setIsRecording(false);
              recognizer.stopContinuousRecognitionAsync();
            }, 100);
          }
        } else if (e.result.reason === speechsdk.ResultReason.NoMatch) {
          setDebug('No speech recognized');
        }
      };

      recognizer.canceled = (s, e) => {
        setDebug(`Recognition canceled: ${e.reason}`);
        setIsRecording(false);
      };

      recognizer.sessionStarted = (s, e) => {
        setDebug('Speech recognition session started');
      };

      setIsRecording(true);
      recognizer.startContinuousRecognitionAsync(
        () => setDebug('Continuous recognition started'),
        (err) => {
          setDebug(`Error starting recognition: ${err}`);
          setIsRecording(false);
        },
      );
    } catch (error) {
      setDebug(`Error in startRecognition: ${error}`);
      setIsRecording(false);
    }
  };

  // Stop speech recognition
  const stopRecognition = () => {
    if (recognizerRef.current) {
      setDebug('Stopping speech recognition...');
      recognizerRef.current.stopContinuousRecognitionAsync(
        () => {
          setIsRecording(false);
          setDebug('Speech recognition stopped');
        },
        (err: any) => {
          setDebug(`Error stopping recognition: ${err}`);
        },
      );
    }
  };

  // Speak text using Azure Speech TTS
  const speakText = async (text: string) => {
    try {
      setDebug(`Speaking text: ${text.substring(0, 50)}...`);

      let currentToken = speechToken;
      let currentRegion = speechRegion;

      if (!currentToken || !currentRegion) {
        const tokenData = await fetchSpeechToken();
        currentToken = tokenData.token;
        currentRegion = tokenData.region;
      }

      if (!currentToken || !currentRegion) {
        throw new Error('Failed to acquire speech token');
      }

      const speechConfig = speechsdk.SpeechConfig.fromAuthorizationToken(currentToken, currentRegion);
      speechConfig.speechSynthesisVoiceName = voiceName || 'en-US-AvaMultilingualNeural';
      const audioConfig = speechsdk.AudioConfig.fromDefaultSpeakerOutput();
      const synthesizer = new speechsdk.SpeechSynthesizer(speechConfig, audioConfig);

      synthesizer.speakTextAsync(
        text,
        (result) => {
          if (result.reason === speechsdk.ResultReason.SynthesizingAudioCompleted) {
            setDebug('Speech synthesis completed');
          }
          synthesizer.close();
        },
        (error) => {
          setDebug(`TTS Error: ${error}`);
          synthesizer.close();
        },
      );
    } catch (error) {
      setDebug(`Error in speakText: ${error}`);
    }
  };

  // Clear recognized text
  const clearRecognizedText = () => {
    setRecognizedText('');
  };

  return {
    isRecording,
    recognizedText,
    startRecognition,
    stopRecognition,
    speakText,
    fetchSpeechToken,
    speechToken,
    speechRegion,
    clearRecognizedText,
  };
}
