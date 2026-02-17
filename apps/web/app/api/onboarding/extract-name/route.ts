import { NextRequest, NextResponse } from 'next/server';

const API_KEY = process.env.ANTHROPIC_API_KEY;
const MODEL = 'claude-sonnet-4-20250514';

export async function POST(req: NextRequest) {
  if (!API_KEY) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 });
  }
  try {
    const { text } = await req.json();
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 30,
        system:
          'TASK: Extract the name from the text below. Output format: NAME: <the name>\nOutput ONLY that line. One word. The name the person chose for themselves.',
        messages: [{ role: 'user', content: `Text: "${text}"\n\nNAME:` }],
      }),
    });
    const data = await res.json();
    if (data.error) {
      return NextResponse.json({ error: data.error.message }, { status: 500 });
    }
    const nameText = (data.content?.[0]?.text || '').trim();
    const parsed = nameText
      .split(/[\n,.!?]/)[0]
      .trim()
      .replace(/^NAME:\s*/i, '')
      .replace(/["'`]/g, '')
      .trim();
    const words = parsed.split(/\s+/);
    const nameWord =
      words.find((w: string) => w.length >= 2 && /^[A-Z]/.test(w)) || words[0] || 'Unknown';
    return NextResponse.json({ name: nameWord });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
