import { useState, useRef, useEffect } from 'react';
import {
  Mic,
  MicOff,
  Play,
  Square,
  CheckCircle,
  XCircle,
  Loader2,
  Volume2,
  AlertCircle,
  Info,
  Key,
} from 'lucide-react';
import { Button } from '../ui/button';
import { Label } from '../ui/label';
import { Badge } from '../ui/badge';
import { Separator } from '../ui/separator';
import { API_ENDPOINTS, testAPIEndpoint, testAllAPIs, type APIEndpoint } from '@/lib/api-testing';

interface APITestResult {
  endpoint: APIEndpoint;
  status: 'idle' | 'testing' | 'success' | 'error';
  message?: string;
  responseTime?: number;
  data?: any;
}

export function Settings() {
  // Microphone testing state
  const [isRecording, setIsRecording] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [microphoneStatus, setMicrophoneStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [selectedTab, setSelectedTab] = useState<'microphone' | 'api' | 'environment'>('microphone');

  // API testing state
  const [apiTests, setApiTests] = useState<APITestResult[]>(
    API_ENDPOINTS.map((endpoint) => ({
      endpoint,
      status: 'idle' as const,
    })),
  );

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []);

  const startMicrophoneTest = async () => {
    try {
      setMicrophoneStatus('testing');
      setIsRecording(true);

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // Create audio context for level monitoring
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      audioContextRef.current = audioContext;

      const analyser = audioContext.createAnalyser();
      analyserRef.current = analyser;
      analyser.fftSize = 256;

      const microphone = audioContext.createMediaStreamSource(stream);
      microphone.connect(analyser);

      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      // Monitor audio levels
      const monitorAudio = () => {
        if (analyser && isRecording) {
          analyser.getByteFrequencyData(dataArray);
          const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
          setAudioLevel(Math.round((average / 255) * 100));
          requestAnimationFrame(monitorAudio);
        }
      };

      monitorAudio();
      setMicrophoneStatus('success');
    } catch (error) {
      console.error('Microphone test failed:', error);
      setMicrophoneStatus('error');
      setIsRecording(false);
    }
  };

  const stopMicrophoneTest = () => {
    setIsRecording(false);
    setAudioLevel(0);
    setMicrophoneStatus('idle');

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
  };

  const testSingleAPI = async (endpoint: APIEndpoint) => {
    setApiTests((prev) =>
      prev.map((test) =>
        test.endpoint.name === endpoint.name
          ? { ...test, status: 'testing', message: undefined, responseTime: undefined, data: undefined }
          : test,
      ),
    );

    const result = await testAPIEndpoint(endpoint);

    setApiTests((prev) =>
      prev.map((test) =>
        test.endpoint.name === endpoint.name
          ? {
              ...test,
              status: result.success ? 'success' : 'error',
              message: result.error || `Status: ${result.status}`,
              responseTime: result.responseTime,
              data: result.data,
            }
          : test,
      ),
    );
  };

  const runAllAPITests = async () => {
    // Set all to testing state
    setApiTests((prev) =>
      prev.map((test) => ({
        ...test,
        status: 'testing' as const,
        message: undefined,
        responseTime: undefined,
        data: undefined,
      })),
    );

    const results = await testAllAPIs();

    setApiTests((prev) =>
      prev.map((test) => {
        const result = results.find((r) => r.endpoint.name === test.endpoint.name);
        if (result) {
          return {
            ...test,
            status: result.result.success ? 'success' : 'error',
            message: result.result.error || `Status: ${result.result.status}`,
            responseTime: result.result.responseTime,
            data: result.result.data,
          };
        }
        return test;
      }),
    );
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'testing':
        return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />;
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'error':
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <div className="h-4 w-4 rounded-full bg-gray-300" />;
    }
  };

  // Check environment variables from API endpoint
  const [envStatus, setEnvStatus] = useState<{ [key: string]: boolean }>({});
  const [envLoading, setEnvLoading] = useState(false);

  const checkEnvironmentVariables = async () => {
    setEnvLoading(true);
    try {
      const response = await fetch('/api/check-env');
      const data = await response.json();
      setEnvStatus(data);
    } catch (error) {
      console.error('Failed to check environment variables:', error);
    } finally {
      setEnvLoading(false);
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto p-6 space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold">System Settings & Testing</h1>
        <p className="text-muted-foreground mt-2">Test your microphone and verify API integrations</p>
      </div>

      {/* Tab Navigation */}
      <div className="flex space-x-1 bg-muted p-1 rounded-lg">
        <button
          onClick={() => setSelectedTab('microphone')}
          className={`flex-1 py-2 px-4 rounded-md font-medium transition-colors ${
            selectedTab === 'microphone'
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Mic className="h-4 w-4 inline mr-2" />
          Microphone Test
        </button>
        <button
          onClick={() => setSelectedTab('api')}
          className={`flex-1 py-2 px-4 rounded-md font-medium transition-colors ${
            selectedTab === 'api'
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <CheckCircle className="h-4 w-4 inline mr-2" />
          API Testing
        </button>
        <button
          onClick={() => setSelectedTab('environment')}
          className={`flex-1 py-2 px-4 rounded-md font-medium transition-colors ${
            selectedTab === 'environment'
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Key className="h-4 w-4 inline mr-2" />
          Environment
        </button>
      </div>

      {/* Microphone Test Tab */}
      {selectedTab === 'microphone' && (
        <div className="space-y-6 p-6 border rounded-lg">
          <div className="text-center space-y-4">
            <h2 className="text-xl font-semibold">Microphone Testing</h2>
            <p className="text-sm text-muted-foreground">
              Test your microphone to ensure it's working properly for voice interactions
            </p>

            <div className="flex justify-center space-x-4">
              <Button
                onClick={startMicrophoneTest}
                disabled={isRecording}
                variant={microphoneStatus === 'success' ? 'default' : 'outline'}
              >
                {microphoneStatus === 'testing' ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Mic className="h-4 w-4 mr-2" />
                )}
                Start Test
              </Button>

              <Button onClick={stopMicrophoneTest} disabled={!isRecording} variant="outline">
                <Square className="h-4 w-4 mr-2" />
                Stop Test
              </Button>
            </div>

            {/* Audio Level Meter */}
            {isRecording && (
              <div className="space-y-2">
                <Label>Audio Level: {audioLevel}%</Label>
                <div className="w-full max-w-md mx-auto bg-gray-200 rounded-full h-4">
                  <div
                    className="bg-green-500 h-4 rounded-full transition-all duration-100"
                    style={{ width: `${Math.min(audioLevel, 100)}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Speak into your microphone to see the audio levels
                </p>
              </div>
            )}

            {/* Status */}
            <div className="flex items-center justify-center space-x-2">
              {getStatusIcon(microphoneStatus)}
              <span className="text-sm">
                {microphoneStatus === 'idle' && 'Ready to test'}
                {microphoneStatus === 'testing' && 'Testing microphone...'}
                {microphoneStatus === 'success' && 'Microphone working correctly'}
                {microphoneStatus === 'error' && 'Microphone test failed'}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* API Testing Tab */}
      {selectedTab === 'api' && (
        <div className="space-y-6 p-6 border rounded-lg">
          <div className="text-center space-y-4">
            <h2 className="text-xl font-semibold">API Testing</h2>
            <p className="text-sm text-muted-foreground">
              Test all API endpoints to ensure proper integration
            </p>

            <Button onClick={runAllAPITests} className="mb-6">
              <Play className="h-4 w-4 mr-2" />
              Test All APIs
            </Button>
          </div>

          <div className="space-y-4">
            {apiTests.map((test, index) => (
              <div key={index} className="p-4 border rounded-lg space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    {getStatusIcon(test.status)}
                    <div>
                      <h3 className="font-medium">{test.endpoint.name}</h3>
                      <p className="text-xs text-muted-foreground">{test.endpoint.description}</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    {test.responseTime && <Badge variant="outline">{test.responseTime}ms</Badge>}
                    <Badge variant="secondary">{test.endpoint.method}</Badge>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => testSingleAPI(test.endpoint)}
                      disabled={test.status === 'testing'}
                    >
                      {test.status === 'testing' ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Test'}
                    </Button>
                  </div>
                </div>

                {test.message && (
                  <div className="flex items-start space-x-2">
                    <Info className="h-4 w-4 mt-0.5 text-muted-foreground flex-shrink-0" />
                    <p className="text-sm text-muted-foreground">{test.message}</p>
                  </div>
                )}

                {test.data && test.status === 'success' && (
                  <details className="text-xs">
                    <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                      Response Data
                    </summary>
                    <pre className="mt-2 p-2 bg-muted rounded text-xs overflow-auto max-h-32">
                      {JSON.stringify(test.data, null, 2)}
                    </pre>
                  </details>
                )}
              </div>
            ))}
          </div>

          <Separator />

          <div className="text-center space-y-4">
            <h3 className="font-medium">Test Summary</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div className="flex flex-col items-center space-y-1">
                <span className="text-muted-foreground">Total Tests</span>
                <Badge variant="outline">{apiTests.length}</Badge>
              </div>
              <div className="flex flex-col items-center space-y-1">
                <span className="text-muted-foreground">Passed</span>
                <Badge variant="default">{apiTests.filter((t) => t.status === 'success').length}</Badge>
              </div>
              <div className="flex flex-col items-center space-y-1">
                <span className="text-muted-foreground">Failed</span>
                <Badge variant="destructive">{apiTests.filter((t) => t.status === 'error').length}</Badge>
              </div>
              <div className="flex flex-col items-center space-y-1">
                <span className="text-muted-foreground">Pending</span>
                <Badge variant="secondary">
                  {apiTests.filter((t) => t.status === 'idle' || t.status === 'testing').length}
                </Badge>
              </div>
            </div>

            <p className="text-xs text-muted-foreground">
              Run API tests to verify your Azure integrations are working correctly
            </p>
          </div>
        </div>
      )}

      {/* Environment Variables Tab */}
      {selectedTab === 'environment' && (
        <div className="space-y-6 p-6 border rounded-lg">
          <div className="text-center space-y-4">
            <h2 className="text-xl font-semibold">Environment Variables</h2>
            <p className="text-sm text-muted-foreground">
              Check that all required API keys and configuration are properly set
            </p>

            <Button onClick={checkEnvironmentVariables} disabled={envLoading}>
              {envLoading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Key className="h-4 w-4 mr-2" />
              )}
              Check Environment
            </Button>
          </div>

          {Object.keys(envStatus).length > 0 && (
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-center">Configuration Status</h3>

              <div className="grid gap-4">
                <div className="space-y-3">
                  <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">
                    Azure Speech API (Required)
                  </h4>
                  <div className="grid gap-2">
                    <div className="flex items-center justify-between p-3 border rounded-lg">
                      <span className="font-medium">Azure Speech API Key</span>
                      <div className="flex items-center space-x-2">
                        {envStatus.AZURE_SPEECH_API_KEY ? (
                          <CheckCircle className="h-4 w-4 text-green-500" />
                        ) : (
                          <XCircle className="h-4 w-4 text-red-500" />
                        )}
                        <Badge variant={envStatus.AZURE_SPEECH_API_KEY ? 'default' : 'destructive'}>
                          {envStatus.AZURE_SPEECH_API_KEY ? 'Set' : 'Missing'}
                        </Badge>
                      </div>
                    </div>
                    <div className="flex items-center justify-between p-3 border rounded-lg">
                      <span className="font-medium">Azure Speech Region</span>
                      <div className="flex items-center space-x-2">
                        {envStatus.AZURE_SPEECH_REGION ? (
                          <CheckCircle className="h-4 w-4 text-green-500" />
                        ) : (
                          <XCircle className="h-4 w-4 text-red-500" />
                        )}
                        <Badge variant={envStatus.AZURE_SPEECH_REGION ? 'default' : 'destructive'}>
                          {envStatus.AZURE_SPEECH_REGION ? 'Set' : 'Missing'}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </div>

                <Separator />

                <div className="space-y-3">
                  <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">
                    Azure OpenAI (Required for Chat)
                  </h4>
                  <div className="grid gap-2">
                    <div className="flex items-center justify-between p-3 border rounded-lg">
                      <span className="font-medium">Azure OpenAI Endpoint</span>
                      <div className="flex items-center space-x-2">
                        {envStatus.AZURE_OPENAI_ENDPOINT ? (
                          <CheckCircle className="h-4 w-4 text-green-500" />
                        ) : (
                          <XCircle className="h-4 w-4 text-red-500" />
                        )}
                        <Badge variant={envStatus.AZURE_OPENAI_ENDPOINT ? 'default' : 'destructive'}>
                          {envStatus.AZURE_OPENAI_ENDPOINT ? 'Set' : 'Missing'}
                        </Badge>
                      </div>
                    </div>
                    <div className="flex items-center justify-between p-3 border rounded-lg">
                      <span className="font-medium">Azure OpenAI API Key</span>
                      <div className="flex items-center space-x-2">
                        {envStatus.AZURE_OPENAI_API_KEY ? (
                          <CheckCircle className="h-4 w-4 text-green-500" />
                        ) : (
                          <XCircle className="h-4 w-4 text-red-500" />
                        )}
                        <Badge variant={envStatus.AZURE_OPENAI_API_KEY ? 'default' : 'destructive'}>
                          {envStatus.AZURE_OPENAI_API_KEY ? 'Set' : 'Missing'}
                        </Badge>
                      </div>
                    </div>
                    <div className="flex items-center justify-between p-3 border rounded-lg">
                      <span className="font-medium">Chat Deployment</span>
                      <div className="flex items-center space-x-2">
                        {envStatus.AZURE_OPENAI_CHAT_DEPLOYMENT ? (
                          <CheckCircle className="h-4 w-4 text-green-500" />
                        ) : (
                          <XCircle className="h-4 w-4 text-red-500" />
                        )}
                        <Badge variant={envStatus.AZURE_OPENAI_CHAT_DEPLOYMENT ? 'default' : 'destructive'}>
                          {envStatus.AZURE_OPENAI_CHAT_DEPLOYMENT ? 'Set' : 'Missing'}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </div>

                <Separator />

                <div className="space-y-3">
                  <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">
                    Optional AI Providers
                  </h4>
                  <div className="grid gap-2">
                    <div className="flex items-center justify-between p-3 border rounded-lg">
                      <span className="font-medium">OpenAI API Key</span>
                      <div className="flex items-center space-x-2">
                        {envStatus.OPENAI_API_KEY ? (
                          <CheckCircle className="h-4 w-4 text-green-500" />
                        ) : (
                          <AlertCircle className="h-4 w-4 text-yellow-500" />
                        )}
                        <Badge variant={envStatus.OPENAI_API_KEY ? 'default' : 'secondary'}>
                          {envStatus.OPENAI_API_KEY ? 'Set' : 'Optional'}
                        </Badge>
                      </div>
                    </div>
                    <div className="flex items-center justify-between p-3 border rounded-lg">
                      <span className="font-medium">Anthropic API Key</span>
                      <div className="flex items-center space-x-2">
                        {envStatus.ANTHROPIC_API_KEY ? (
                          <CheckCircle className="h-4 w-4 text-green-500" />
                        ) : (
                          <AlertCircle className="h-4 w-4 text-yellow-500" />
                        )}
                        <Badge variant={envStatus.ANTHROPIC_API_KEY ? 'default' : 'secondary'}>
                          {envStatus.ANTHROPIC_API_KEY ? 'Set' : 'Optional'}
                        </Badge>
                      </div>
                    </div>
                    <div className="flex items-center justify-between p-3 border rounded-lg">
                      <span className="font-medium">Mistral API Key</span>
                      <div className="flex items-center space-x-2">
                        {envStatus.MISTRAL_API_KEY ? (
                          <CheckCircle className="h-4 w-4 text-green-500" />
                        ) : (
                          <AlertCircle className="h-4 w-4 text-yellow-500" />
                        )}
                        <Badge variant={envStatus.MISTRAL_API_KEY ? 'default' : 'secondary'}>
                          {envStatus.MISTRAL_API_KEY ? 'Set' : 'Optional'}
                        </Badge>
                      </div>
                    </div>
                    <div className="flex items-center justify-between p-3 border rounded-lg">
                      <span className="font-medium">Groq API Key</span>
                      <div className="flex items-center space-x-2">
                        {envStatus.GROQ_API_KEY ? (
                          <CheckCircle className="h-4 w-4 text-green-500" />
                        ) : (
                          <AlertCircle className="h-4 w-4 text-yellow-500" />
                        )}
                        <Badge variant={envStatus.GROQ_API_KEY ? 'default' : 'secondary'}>
                          {envStatus.GROQ_API_KEY ? 'Set' : 'Optional'}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </div>

                <Separator />

                <div className="text-center space-y-2">
                  <h4 className="font-medium">Configuration Summary</h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div className="flex flex-col items-center space-y-1">
                      <span className="text-muted-foreground">Required Keys</span>
                      <Badge
                        variant={
                          envStatus.AZURE_SPEECH_API_KEY &&
                          envStatus.AZURE_SPEECH_REGION &&
                          envStatus.AZURE_OPENAI_ENDPOINT &&
                          envStatus.AZURE_OPENAI_API_KEY &&
                          envStatus.AZURE_OPENAI_CHAT_DEPLOYMENT
                            ? 'default'
                            : 'destructive'
                        }
                      >
                        {envStatus.AZURE_SPEECH_API_KEY &&
                        envStatus.AZURE_SPEECH_REGION &&
                        envStatus.AZURE_OPENAI_ENDPOINT &&
                        envStatus.AZURE_OPENAI_API_KEY &&
                        envStatus.AZURE_OPENAI_CHAT_DEPLOYMENT
                          ? 'Complete'
                          : 'Incomplete'}
                      </Badge>
                    </div>
                    <div className="flex flex-col items-center space-y-1">
                      <span className="text-muted-foreground">Optional Keys</span>
                      <Badge variant="outline">
                        {
                          [
                            envStatus.OPENAI_API_KEY,
                            envStatus.ANTHROPIC_API_KEY,
                            envStatus.MISTRAL_API_KEY,
                            envStatus.GROQ_API_KEY,
                          ].filter(Boolean).length
                        }{' '}
                        / 4
                      </Badge>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    All required Azure keys must be set for full functionality
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
