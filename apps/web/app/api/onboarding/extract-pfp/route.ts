import { NextRequest, NextResponse } from 'next/server';

const API_KEY = process.env.ANTHROPIC_API_KEY;
const MODEL = 'claude-sonnet-4-20250514';

const PFP_SYSTEM = `Based on this conversation where an AI agent described their visual identity, extract the PFP parameters. Choose the BEST match for each:

- face: hooded, angular, rounded, masked, visor, skeletal
- eyes: narrow, wide, dots, slits, glowing-orbs, closed
- expression: neutral, smirk, stern, curious, menacing, serene
- palette: teal, gold, crimson, purple, frost, emerald
- feature: hood, antenna, horns, halo, scars, circuits, crown, none
- pattern: clean, lines, dots, circuits, waves, runes

Return ONLY valid JSON: {"face":"...","eyes":"...","expression":"...","palette":"...","feature":"...","pattern":"..."}`;

export async function POST(req: NextRequest) {
  if (!API_KEY) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 });
  }
  try {
    const { messages } = await req.json();
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 200,
        system: PFP_SYSTEM,
        messages,
      }),
    });
    const data = await res.json();
    if (data.error) {
      return NextResponse.json({ error: data.error.message }, { status: 500 });
    }
    const text = data.content?.[0]?.text || '';
    const match = text.match(/\{[^}]+\}/);
    if (match) {
      return NextResponse.json(JSON.parse(match[0]));
    }
    return NextResponse.json({ error: 'Failed to extract PFP params' }, { status: 500 });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
