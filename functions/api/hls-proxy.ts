import { proxyHlsRequest } from '../../src/services/hlsProxy.ts';

export async function onRequest(context: { request: Request }): Promise<Response> {
  const url = new URL(context.request.url);
  if (context.request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Range',
      },
    });
  }

  const result = await proxyHlsRequest({
    targetUrlRaw: url.searchParams.get('url'),
    refererRaw: url.searchParams.get('ref'),
    subHost: url.searchParams.get('subHost'),
    subRef: url.searchParams.get('subRef'),
  });

  return new Response(result.body, {
    status: result.status,
    headers: result.headers,
  });
}
