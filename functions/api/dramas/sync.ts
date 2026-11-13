import type { Drama } from '../../../src/types/drama.ts';
import type { CFContext } from '../../types.ts';

export async function onRequestPost(context: CFContext): Promise<Response> {
  try {
    const drama = (await context.request.json().catch(() => null)) as Drama | null;
    if (!drama || !drama.slug || !drama.title) {
      return new Response(JSON.stringify({ ok: false, error: 'Invalid drama payload' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
      });
    }

    return new Response(
      JSON.stringify({ ok: true, edgeSynced: true, slug: drama.slug }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
      }
    );
  } catch {
    return new Response(JSON.stringify({ ok: false, error: 'Invalid JSON' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    });
  }
}
