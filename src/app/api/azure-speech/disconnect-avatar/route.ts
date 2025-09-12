import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const clientId = req.headers.get('ClientId');
    if (!clientId) {
      return NextResponse.json({ error: 'Missing ClientId header' }, { status: 400 });
    }

    const clientContext = global.clientContexts?.[clientId];
    if (!clientContext) {
      return NextResponse.json(
        { message: 'Client context not found, already disconnected' },
        { status: 200 },
      );
    }

    // Stop speaking first - following official pattern
    const avatarConnection = clientContext.speechSynthesizerConnection;
    if (avatarConnection) {
      try {
        await avatarConnection.sendMessageAsync('synthesis.control', '{"action":"stop"}');
        await new Promise((resolve) => setTimeout(resolve, 2000)); // Wait 2 seconds
        avatarConnection.close();
      } catch (error) {
        console.log('Error closing avatar connection:', error);
      }
    }

    // Close speech synthesizer - following official pattern
    const speechSynthesizer = clientContext.speechSynthesizer;
    if (speechSynthesizer) {
      try {
        speechSynthesizer.close();
      } catch (error) {
        console.log('Error closing speech synthesizer:', error);
      }
    }

    // Clean up client context - following official pattern
    delete global.clientContexts[clientId];

    console.log(`Avatar disconnected for client ${clientId}`);
    return NextResponse.json({ message: 'Avatar disconnected successfully' }, { status: 200 });
  } catch (error: any) {
    console.error('Error in disconnect-avatar API:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
