import type { CFContext } from '../types.ts';
import { relayPlayerRequest } from '../../src/services/playerRelay.ts';

async function handleRelay(context: CFContext): Promise<Response> {
  const reqUrl = new URL(context.request.url);
  const targetUrlRaw = reqUrl.searchParams.get('url') || '';
  const method = context.request.method.toUpperCase();
  const bodyText = method === 'POST' ? await context.request.text().catch(() => null) : null;
  const contentType = context.request.headers.get('content-type');

  const result = await relayPlayerRequest({
    method,
    targetUrlRaw,
    bodyText,
    contentType,
  });

  return new Response(result.body, {
    status: result.status,
    headers: result.headers,
  });
}

export async function onRequestGet(context: CFContext): Promise<Response> {
  return handleRelay(context);
}

export async function onRequestPost(context: CFContext): Promise<Response> {
  return handleRelay(context);
}
