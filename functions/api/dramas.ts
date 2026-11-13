import baseDramas from '../../src/data/dramas.json';
import type { CFContext } from '../types.ts';

export async function onRequestGet(_context: CFContext): Promise<Response> {
  return new Response(JSON.stringify({ dramas: baseDramas }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=3600',
    },
  });
}
