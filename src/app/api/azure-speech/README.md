# Azure Speech API Endpoints (Next.js App Router)

## Endpoints

- `/api/azure-speech/get-speech-token` (GET): Returns Azure Speech token and region.
- `/api/azure-speech/get-ice-server-token` (GET): Returns ICE server token for WebRTC avatar.
- `/api/azure-speech/get-oai-response` (POST): Streams OpenAI agent response (function-calling enabled).

## Structure

- Each endpoint is implemented as a `route.ts` file in its own directory, per Next.js App Router conventions.
- Old single `.ts` files have been removed.

## Testing

- Playwright API tests are in `src/app/api/azure-speech/__tests__/`.
- To run tests:
  ```sh
  npm run test:e2e
  ```

## Migration Note

- This folder was migrated from HeyGen to Azure Speech API and refactored for Next.js 13+ App Router compatibility.
