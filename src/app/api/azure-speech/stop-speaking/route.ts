import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const clientId = req.headers.get('ClientId');
    if (!clientId) {
      return NextResponse.json({ error: 'Missing ClientId header' }, { status: 400 });
    }

    const clientContext = global.clientContexts?.[clientId];
    if (!clientContext) {
      return NextResponse.json({ error: 'Client context not found' }, { status: 404 });
    }

    const avatarConnection = clientContext.speechSynthesizerConnection;
    if (avatarConnection) {
      // Stop speaking using avatar connection - following official pattern
      await avatarConnection.sendMessageAsync('synthesis.control', '{"action":"stop"}');
      console.log(`Speaking stopped for client ${clientId}`);
    }

    return NextResponse.json({ message: 'Speaking stopped successfully' }, { status: 200 });
  } catch (error: any) {
    console.error('Error in stop-speaking API:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
