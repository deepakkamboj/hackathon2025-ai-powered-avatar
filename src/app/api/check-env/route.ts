import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // Check environment variables and return their status (but not their values for security)
    const envStatus = {
      // Required Azure Speech API
      AZURE_SPEECH_API_KEY: !!process.env.AZURE_SPEECH_API_KEY,
      AZURE_SPEECH_REGION: !!process.env.AZURE_SPEECH_REGION,

      // Required Azure OpenAI
      AZURE_OPENAI_ENDPOINT: !!process.env.AZURE_OPENAI_ENDPOINT,
      AZURE_OPENAI_API_KEY: !!process.env.AZURE_OPENAI_API_KEY,
      AZURE_OPENAI_CHAT_DEPLOYMENT: !!process.env.AZURE_OPENAI_CHAT_DEPLOYMENT,
      AZURE_OPENAI_API_VERSION: !!process.env.AZURE_OPENAI_API_VERSION,

      // Optional AI providers
      OPENAI_API_KEY: !!process.env.OPENAI_API_KEY,
      ANTHROPIC_API_KEY: !!process.env.ANTHROPIC_API_KEY,
      MISTRAL_API_KEY: !!process.env.MISTRAL_API_KEY,
      GROQ_API_KEY: !!process.env.GROQ_API_KEY,
      GEMINI_API_KEY: !!process.env.GEMINI_API_KEY,
    };

    return NextResponse.json(envStatus);
  } catch (error) {
    console.error('Error checking environment variables:', error);
    return NextResponse.json({ error: 'Failed to check environment variables' }, { status: 500 });
  }
}
