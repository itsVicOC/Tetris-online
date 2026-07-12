import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };
const encoder = new TextEncoder();
function json(data: unknown, status = 200): Response { return new Response(JSON.stringify(data), { status, headers: { ...cors, 'Content-Type': 'application/json' } }); }
function base64(value: Uint8Array | string): string { const bytes = typeof value === 'string' ? encoder.encode(value) : value; return btoa(String.fromCharCode(...bytes)).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', ''); }
async function sign(payload: string): Promise<string> { const key = await crypto.subtle.importKey('raw', encoder.encode(Deno.env.get('SCORE_TOKEN_SECRET')!), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']); return base64(new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(payload)))); }
async function makeToken(data: object): Promise<string> { const payload = base64(JSON.stringify(data)); return `${payload}.${await sign(payload)}`; }
async function readToken(token: string): Promise<Record<string, unknown> | null> { const [payload, signature] = token.split('.'); if (!payload || !signature || await sign(payload) !== signature) return null; try { const normalized = payload.replaceAll('-', '+').replaceAll('_', '/').padEnd(Math.ceil(payload.length / 4) * 4, '='); return JSON.parse(atob(normalized)); } catch { return null; } }

Deno.serve(async request => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const body = await request.json();
    if (body.action === 'start') {
      if (!body.game_id || !body.player_id || !Number.isInteger(body.seed)) return json({ error: 'invalid session' }, 400);
      const issued_at = Date.now(); return json({ seed: body.seed, token: await makeToken({ game_id: body.game_id, player_id: body.player_id, seed: body.seed, issued_at }) });
    }
    const token = typeof body.token === 'string' ? await readToken(body.token) : null;
    const actions = Array.isArray(body.actions) ? body.actions : [];
    const duration = Number(body.duration_ms);
    const tokenValid = token && token.game_id === body.game_id && token.player_id === body.player_id && token.seed === body.seed && typeof token.issued_at === 'number' && Date.now() - token.issued_at >= 1000 && Date.now() - token.issued_at <= 86400000;
    const fieldsValid = typeof body.nickname === 'string' && [...body.nickname.trim()].length >= 2 && [...body.nickname.trim()].length <= 16 && Number.isInteger(body.score) && body.score >= 0 && Number.isInteger(body.lines) && body.lines >= 0 && Number.isInteger(body.level) && body.level === Math.floor(body.lines / 10) + 1 && Number.isInteger(duration) && duration >= 1000 && duration <= 86400000;
    let previous = -1; let timelineValid = actions.length < 20000;
    for (const action of actions) { if (!action || !Number.isInteger(action.at) || action.at < previous || action.at > duration || !['left', 'right', 'rotate', 'soft', 'hard', 'hold'].includes(action.type)) { timelineValid = false; break; } previous = action.at; }
    const drops = actions.filter((item: { type: string }) => item.type === 'soft' || item.type === 'hard').length;
    const scorePlausible = body.score <= body.lines * 800 * body.level + drops * 40 + 5000 && actions.length <= Math.max(120, Math.ceil(duration / 12));
    if (!tokenValid || !fieldsValid || !timelineValid || !scorePlausible) return json({ error: 'score verification failed' }, 400);
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { error } = await admin.from('scores').insert({ game_id: body.game_id, player_id: body.player_id, nickname: body.nickname.trim(), score: body.score, level: body.level, lines: body.lines, duration_ms: duration, verified: true });
    if (error) return json({ error: error.code === '23505' ? 'game already submitted' : error.message }, error.code === '23505' ? 409 : 500);
    return json({ ok: true });
  } catch { return json({ error: 'bad request' }, 400); }
});
