// This route is deprecated - use Azure Speech API endpoints instead
// Keeping for backward compatibility but returning error

export async function POST() {
  return Response.json(
    {
      error:
        'This endpoint is deprecated. Use /api/azure-speech/get-speech-token for Azure Speech API integration.',
    },
    { status: 410 },
  );
}

export async function GET() {
  return Response.json(
    {
      error:
        'This endpoint is deprecated. Use /api/azure-speech/get-speech-token for Azure Speech API integration.',
    },
    { status: 410 },
  );
}
