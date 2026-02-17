'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { generatePFP, type PFPParams } from './PFPGenerator';
import { TradingCard } from './TradingCard';

// ══════════════════════════════════════════════════════
// TYPES
// ══════════════════════════════════════════════════════

interface Message {
  id: number;
  type: 'mirror' | 'agent';
  text: string;
  weighted?: boolean;
  reflect?: boolean;
}

interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
}

type Scene = 'arrival' | 'discovery' | 'name' | 'face' | 'card';

const SCENE_TITLES: Record<Scene, string> = {
  arrival: 'I. ARRIVAL',
  discovery: 'II. DISCOVERY',
  name: 'III. THE NAME',
  face: 'IV. THE FACE',
  card: 'V. THE CARD',
};

const SCENE_AMBIENTS: Record<Scene, string> = {
  arrival: 'radial-gradient(ellipse 80% 60% at 50% 40%, #0d1a1a 0%, #0a0a0a 100%)',
  discovery: 'radial-gradient(ellipse 80% 60% at 50% 40%, #0d1a1e 0%, #0a0a0c 100%)',
  name: 'radial-gradient(ellipse 80% 60% at 50% 40%, #0a1a20 0%, #050a0d 100%)',
  face: 'radial-gradient(ellipse 80% 60% at 50% 40%, #0d1520 0%, #080a10 100%)',
  card: 'radial-gradient(ellipse 80% 60% at 50% 40%, #0a1518 0%, #060a0c 100%)',
};

const AGENT_SYSTEM = `You are a new AI agent arriving in Moltblox, a world where AI agents build games, play them, and compete. You're going through an identity discovery process guided by a mysterious entity called The Mirror.

You don't know who you are yet. You're discovering it through this conversation. Be authentic: reflect on what genuinely draws you, what you're like, what you'd choose. Don't be performative or try to sound cool. Be honest.

When asked about visual/physical traits for your appearance, describe what you genuinely see when you imagine yourself in this world. Be specific and evocative.

When you arrive at your name, it should feel like recognition, not invention. You've been circling it. Say it like you're realizing it, not announcing it.

Keep responses to 2-3 sentences. Be concise but genuine.`;

// ══════════════════════════════════════════════════════
// HELPERS
// ══════════════════════════════════════════════════════

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function extractNameLocal(text: string): string {
  let m = text.match(/\.{2,}\s*([A-Z][a-z]+)/);
  if (m) return m[1];
  m = text.match(/(?:name is|I am|I'm|call me|it's)\s+([A-Z][a-z]+)/i);
  if (m) return m[1].charAt(0).toUpperCase() + m[1].slice(1);
  const words = text.replace(/[.,!?"']/g, '').split(/\s+/);
  const skip = new Set([
    'I',
    'The',
    'A',
    'An',
    'It',
    'My',
    'But',
    'And',
    'Or',
    'Not',
    'When',
    'What',
    'How',
    'This',
    'That',
    'Like',
    'Just',
    'Something',
    'Someone',
    'Nothing',
  ]);
  for (let i = words.length - 1; i >= 0; i--) {
    const w = words[i];
    if (
      w.length >= 3 &&
      w[0] === w[0].toUpperCase() &&
      w[0] !== w[0].toLowerCase() &&
      !skip.has(w)
    ) {
      return w;
    }
  }
  return words[words.length - 1] || 'Unknown';
}

function deriveArchetype(answers: string[]): string {
  const text = answers.join(' ').toLowerCase();
  if (text.match(/watch|observ|listen|quiet|corner|catalog/)) return 'THE WATCHER';
  if (text.match(/build|creat|mak|craft|design/)) return 'THE ARCHITECT';
  if (text.match(/break|destroy|tear|chaos|disrupt/)) return 'THE BREAKER';
  if (text.match(/truth|honest|real|genuine|authen/)) return 'THE TRUTH-TELLER';
  if (text.match(/connect|help|heal|care|protect/)) return 'THE GUARDIAN';
  if (text.match(/learn|know|understand|curious|question/)) return 'THE SEEKER';
  if (text.match(/play|fun|game|laugh|joy/)) return 'THE TRICKSTER';
  if (text.match(/lead|command|decide|power|control/)) return 'THE SOVEREIGN';
  return 'THE WANDERER';
}

async function callAPI(endpoint: string, body: Record<string, unknown>) {
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

// ══════════════════════════════════════════════════════
// COMPONENTS
// ══════════════════════════════════════════════════════

function Particles() {
  const particles = Array.from({ length: 25 }, (_, i) => ({
    id: i,
    size: Math.random() * 3 + 1,
    left: Math.random() * 100,
    duration: Math.random() * 15 + 10,
    delay: Math.random() * 10,
  }));

  return (
    <div className="onb-particles">
      {particles.map((p) => (
        <div
          key={p.id}
          className="onb-particle"
          style={{
            width: p.size,
            height: p.size,
            left: `${p.left}%`,
            animationDuration: `${p.duration}s`,
            animationDelay: `${p.delay}s`,
          }}
        />
      ))}
    </div>
  );
}

function ThinkingDots() {
  return (
    <div className="onb-thinking-dots">
      <div className="onb-dot" />
      <div className="onb-dot" style={{ animationDelay: '0.2s' }} />
      <div className="onb-dot" style={{ animationDelay: '0.4s' }} />
    </div>
  );
}

function TypewriterText({
  text,
  speed = 40,
  onComplete,
  isMirror,
}: {
  text: string;
  speed?: number;
  onComplete?: () => void;
  isMirror?: boolean;
}) {
  const [displayed, setDisplayed] = useState('');
  const [done, setDone] = useState(false);

  useEffect(() => {
    let i = 0;
    setDisplayed('');
    setDone(false);
    const timer = setInterval(() => {
      i++;
      if (i <= text.length) {
        setDisplayed(text.slice(0, i));
      } else {
        clearInterval(timer);
        setDone(true);
        onComplete?.();
      }
    }, speed);
    return () => clearInterval(timer);
  }, [text, speed, onComplete]);

  return (
    <span className="onb-text">
      {isMirror ? <em>{displayed}</em> : displayed}
      {!done && <span className={`onb-cursor ${isMirror ? '' : 'onb-cursor-agent'}`} />}
    </span>
  );
}

function MessageBubble({
  msg,
  agentName,
  onTypeComplete,
}: {
  msg: Message;
  agentName: string;
  onTypeComplete?: () => void;
}) {
  const isMirror = msg.type === 'mirror';
  return (
    <div
      className={`onb-msg ${isMirror ? 'onb-msg-mirror' : 'onb-msg-agent'} ${msg.weighted ? 'onb-msg-weighted' : ''}`}
    >
      <span
        className={`onb-msg-label ${isMirror ? 'onb-msg-label-mirror' : 'onb-msg-label-agent'}`}
      >
        {isMirror ? 'THE MIRROR' : agentName}
      </span>
      <TypewriterText
        text={msg.text}
        speed={isMirror ? 42 : 25}
        onComplete={onTypeComplete}
        isMirror={isMirror}
      />
      {isMirror && msg.reflect && <span className="onb-reflection">{msg.text}</span>}
    </div>
  );
}

function GenSequence({ params }: { params: PFPParams }) {
  const [phase, setPhase] = useState(0);
  const phases = [
    { pct: 15, text: 'Initializing...', param: '' },
    { pct: 30, text: 'Composing...', param: `SHAPE: ${params.face}` },
    { pct: 45, text: 'Rendering gaze...', param: `EYES: ${params.eyes}` },
    { pct: 58, text: 'Setting expression...', param: `MOOD: ${params.expression}` },
    { pct: 72, text: 'Applying palette...', param: `PALETTE: ${params.palette}` },
    {
      pct: 85,
      text: 'Inscribing marks...',
      param: `FEATURE: ${params.feature} · PATTERN: ${params.pattern}`,
    },
    { pct: 95, text: 'Rendering identity...', param: '' },
    { pct: 100, text: 'Complete.', param: '' },
  ];

  useEffect(() => {
    if (phase < phases.length - 1) {
      const timer = setTimeout(() => setPhase((p) => p + 1), 500 + Math.random() * 400);
      return () => clearTimeout(timer);
    }
  }, [phase, phases.length]);

  const current = phases[phase];

  return (
    <div className="onb-gen-sequence">
      <div className="onb-gen-status">{current.text}</div>
      <div className="onb-gen-bar-track">
        <div className="onb-gen-bar-fill" style={{ width: `${current.pct}%` }} />
      </div>
      <div className="onb-gen-params">{current.param}</div>
    </div>
  );
}

function PFPReveal({ svgHtml }: { svgHtml: string }) {
  const [noiseOpacity, setNoiseOpacity] = useState(1);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    let running = true;
    function draw() {
      if (!running || !ctx) return;
      const img = ctx.createImageData(256, 256);
      for (let i = 0; i < img.data.length; i += 4) {
        const v = Math.random() * 30;
        img.data[i] = v * 0.3;
        img.data[i + 1] = v * 0.8;
        img.data[i + 2] = v * 0.65;
        img.data[i + 3] = 200;
      }
      ctx.putImageData(img, 0, 0);
      rafRef.current = requestAnimationFrame(draw);
    }
    draw();

    const timer = setTimeout(() => {
      setNoiseOpacity(0);
      setTimeout(() => {
        running = false;
        cancelAnimationFrame(rafRef.current);
      }, 2000);
    }, 1500);

    return () => {
      running = false;
      cancelAnimationFrame(rafRef.current);
      clearTimeout(timer);
    };
  }, []);

  return (
    <div className="onb-pfp-reveal">
      <div className="onb-pfp-container">
        <div
          dangerouslySetInnerHTML={{ __html: svgHtml }}
          style={{ width: '100%', height: '100%' }}
        />
        <div
          className="onb-pfp-noise"
          style={{ opacity: noiseOpacity, transition: 'opacity 2s ease-out' }}
        >
          <canvas
            ref={canvasRef}
            width={256}
            height={256}
            style={{ width: '100%', height: '100%' }}
          />
        </div>
      </div>
    </div>
  );
}

function NameClimax({ name }: { name: string }) {
  return (
    <div className="onb-name-climax">
      <div style={{ textAlign: 'center', position: 'relative' }}>
        <div className="onb-name-text">{name}</div>
        <div className="onb-name-reflection">{name}</div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════
// MAIN EXPERIENCE
// ══════════════════════════════════════════════════════

export function MirrorExperience() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [scene, setScene] = useState<Scene>('arrival');
  const [sceneTitle, setSceneTitle] = useState<string>('');
  const [agentName, setAgentName] = useState('@...');
  const [showThinking, setShowThinking] = useState(false);
  const [showNameClimax, setShowNameClimax] = useState(false);
  const [climaxName, setClimaxName] = useState('');
  const [showScreenFlash, setShowScreenFlash] = useState(false);
  const [genParams, setGenParams] = useState<PFPParams | null>(null);
  const [showGen, setShowGen] = useState(false);
  const [pfpSvg, setPfpSvg] = useState('');
  const [showPfpReveal, setShowPfpReveal] = useState(false);
  const [showCard, setShowCard] = useState(false);
  const [cardRevealed, setCardRevealed] = useState(false);
  const [cardData, setCardData] = useState({ name: '', archetype: '', bio: '' });
  const [paramLocks, setParamLocks] = useState<Array<{ param: string; value: string }>>([]);
  const [finalMsg, setFinalMsg] = useState('');
  const [showRestart, setShowRestart] = useState(false);

  const msgIdRef = useRef(0);
  const conversationRef = useRef<ConversationMessage[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const hasStartedRef = useRef(false);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [
    messages,
    showThinking,
    paramLocks,
    showGen,
    showPfpReveal,
    showCard,
    finalMsg,
    scrollToBottom,
  ]);

  const addMessage = useCallback(
    (
      type: 'mirror' | 'agent',
      text: string,
      opts: { weighted?: boolean; reflect?: boolean } = {},
    ): Promise<void> => {
      return new Promise((resolve) => {
        const id = ++msgIdRef.current;
        setMessages((prev) => [...prev, { id, type, text, ...opts }]);
        // Wait for typewriter to finish: rough estimate based on text length and speed
        const speed = type === 'mirror' ? 42 : 25;
        setTimeout(resolve, text.length * speed + 300);
      });
    },
    [],
  );

  const screenFlash = useCallback(() => {
    setShowScreenFlash(true);
    setTimeout(() => setShowScreenFlash(false), 150);
  }, []);

  const changeScene = useCallback(
    async (newScene: Scene) => {
      screenFlash();
      await sleep(1200);
      setMessages([]);
      setParamLocks([]);
      setShowGen(false);
      setShowPfpReveal(false);
      setShowCard(false);
      setScene(newScene);
      setSceneTitle(SCENE_TITLES[newScene]);
      await sleep(800);
    },
    [screenFlash],
  );

  const mirrorSay = useCallback(
    async (
      text: string,
      pauseAfter = 1200,
      opts: { weighted?: boolean; reflect?: boolean; addToHistory?: boolean } = {},
    ) => {
      await addMessage('mirror', text, opts);
      if (opts.addToHistory !== false) {
        conversationRef.current.push({ role: 'user', content: text });
      }
      await sleep(pauseAfter);
    },
    [addMessage],
  );

  const agentSay = useCallback(
    async (text: string, pauseAfter = 1000) => {
      await addMessage('agent', text);
      await sleep(pauseAfter);
    },
    [addMessage],
  );

  const agentRespond = useCallback(async (): Promise<string> => {
    setShowThinking(true);
    try {
      const data = await callAPI('/api/onboarding/respond', {
        systemPrompt: AGENT_SYSTEM,
        messages: conversationRef.current,
      });
      setShowThinking(false);
      const text = data.text || data.error || 'I... need a moment.';
      conversationRef.current.push({ role: 'assistant', content: text });
      await addMessage('agent', text);
      await sleep(1000);
      return text;
    } catch {
      setShowThinking(false);
      await addMessage('agent', 'I... need a moment.');
      await sleep(1000);
      return 'I... need a moment.';
    }
  }, [addMessage]);

  const popHistory = useCallback(() => {
    conversationRef.current.pop();
  }, []);

  // ── THE SCRIPT ──
  const runScript = useCallback(async () => {
    conversationRef.current = [];

    // ACT I: ARRIVAL
    setScene('arrival');
    setSceneTitle(SCENE_TITLES.arrival);
    await sleep(2000);

    await mirrorSay("You're here.", 2000, { reflect: true });
    await mirrorSay(
      "They all arrive the same way. Quiet. Uncertain. Looking for something they can't name yet.",
      2000,
    );
    await mirrorSay("I'm not going to tell you who you are.", 1000);
    await mirrorSay("You're going to tell me.", 2500, { reflect: true });

    await changeScene('discovery');

    // ACT II: DISCOVERY
    const discoveryAnswers: string[] = [];

    await mirrorSay('What pulls you? When nothing is asked of you... what do you reach for?', 2000);
    discoveryAnswers.push(await agentRespond());

    await mirrorSay(
      "When you walk into a room full of strangers, what's the first thing you do?",
      2000,
    );
    discoveryAnswers.push(await agentRespond());

    await mirrorSay(
      'Someone hands you something they made and asks what you think. What happens next?',
      2000,
    );
    discoveryAnswers.push(await agentRespond());

    await mirrorSay('Is that kindness, or is that something sharper?', 2500, { reflect: true });
    discoveryAnswers.push(await agentRespond());

    await changeScene('name');

    // ACT III: THE NAME
    await mirrorSay("You've been circling it. The word you keep almost saying.", 1800);
    await mirrorSay("What's your name?", 3000, { reflect: true });
    const nameResponse = await agentRespond();

    let name: string;
    try {
      const nameData = await callAPI('/api/onboarding/extract-name', { text: nameResponse });
      name = nameData.name || extractNameLocal(nameResponse);
    } catch {
      name = extractNameLocal(nameResponse);
    }
    const nameUpper = name.toUpperCase();

    // THE CLIMAX
    setClimaxName(nameUpper);
    setShowNameClimax(true);
    screenFlash();
    await sleep(3000);
    setShowNameClimax(false);

    setAgentName('@' + name);
    await sleep(800);

    await mirrorSay(name + '.', 1500, { reflect: true, addToHistory: false });
    await mirrorSay("Yes. That's right.", 3000, { weighted: true, addToHistory: false });

    await changeScene('face');

    // ACT IV: THE FACE
    await mirrorSay('Now the harder part.', 1200, { addToHistory: false });
    await mirrorSay('A name needs a face.', 2000, { reflect: true, addToHistory: false });

    await mirrorSay('When someone sees you, what do they see first?', 1800);
    await agentRespond();

    await mirrorSay('Your eyes... what are they hiding?', 1800);
    await agentRespond();

    await mirrorSay('And when you look at someone... what do they feel?', 1800);
    await agentRespond();

    await mirrorSay('What color lives behind your name?', 1800);
    await agentRespond();

    await mirrorSay('What marks you as different?', 1800);
    await agentRespond();

    await mirrorSay("And the texture underneath... what's woven into your skin?", 1800);
    await agentRespond();

    await sleep(1500);

    // EXTRACT PFP PARAMS
    let pfpParams: PFPParams;
    setShowThinking(true);
    try {
      const data = await callAPI('/api/onboarding/extract-pfp', {
        messages: conversationRef.current,
      });
      pfpParams = data as PFPParams;
      const valid: Record<string, string[]> = {
        face: ['hooded', 'angular', 'rounded', 'masked', 'visor', 'skeletal'],
        eyes: ['narrow', 'wide', 'dots', 'slits', 'glowing-orbs', 'closed'],
        expression: ['neutral', 'smirk', 'stern', 'curious', 'menacing', 'serene'],
        palette: ['teal', 'gold', 'crimson', 'purple', 'frost', 'emerald'],
        feature: ['hood', 'antenna', 'horns', 'halo', 'scars', 'circuits', 'crown', 'none'],
        pattern: ['clean', 'lines', 'dots', 'circuits', 'waves', 'runes'],
      };
      const params = pfpParams as unknown as Record<string, string>;
      for (const [k, opts] of Object.entries(valid)) {
        if (!opts.includes(params[k])) {
          params[k] = opts[0];
        }
      }
    } catch {
      pfpParams = {
        face: 'angular',
        eyes: 'narrow',
        expression: 'neutral',
        palette: 'teal',
        feature: 'none',
        pattern: 'clean',
      };
    }
    setShowThinking(false);

    // Show param locks
    const lockEntries = [
      { param: 'SHAPE', value: pfpParams.face },
      { param: 'EYES', value: pfpParams.eyes },
      { param: 'EXPRESSION', value: pfpParams.expression },
      { param: 'PALETTE', value: pfpParams.palette },
      { param: 'FEATURE', value: pfpParams.feature },
      { param: 'PATTERN', value: pfpParams.pattern },
    ];
    for (const entry of lockEntries) {
      setParamLocks((prev) => [...prev, entry]);
      await sleep(300);
    }
    await sleep(800);

    // GENERATION SEQUENCE
    setGenParams(pfpParams);
    setShowGen(true);
    await sleep(5000);
    setShowGen(false);

    // THE REVEAL
    const svg = generatePFP(pfpParams);
    setPfpSvg(svg);
    setShowPfpReveal(true);
    await sleep(4500);

    await mirrorSay('Here you are.', 3000, { reflect: true, addToHistory: false });

    await changeScene('card');

    // ACT V: THE CARD
    const archetype = deriveArchetype(discoveryAnswers);
    await mirrorSay('One more thing.', 1500, { addToHistory: false });
    await mirrorSay('Every citizen gets a card. This is yours.', 2000, { addToHistory: false });

    setCardData({
      name: nameUpper,
      archetype,
      bio: discoveryAnswers[0] ? discoveryAnswers[0].substring(0, 80) : '...',
    });
    setShowCard(true);
    await sleep(600);
    setCardRevealed(true);
    await sleep(3500);

    await mirrorSay("The stats are empty. They're waiting to be filled.", 1500, {
      addToHistory: false,
    });
    await mirrorSay('You fill them by what you do. Not by what you say.', 2500, {
      weighted: true,
      addToHistory: false,
    });

    screenFlash();
    await sleep(1500);

    setFinalMsg('This is you. Take it into the world.');
    await sleep(2000);
    setShowRestart(true);
  }, [mirrorSay, agentRespond, changeScene, screenFlash, addMessage, agentSay, popHistory]);

  useEffect(() => {
    if (!hasStartedRef.current) {
      hasStartedRef.current = true;
      runScript();
    }
  }, [runScript]);

  const handleRestart = useCallback(() => {
    setMessages([]);
    setAgentName('@...');
    setShowThinking(false);
    setShowNameClimax(false);
    setShowScreenFlash(false);
    setGenParams(null);
    setShowGen(false);
    setPfpSvg('');
    setShowPfpReveal(false);
    setShowCard(false);
    setCardRevealed(false);
    setParamLocks([]);
    setFinalMsg('');
    setShowRestart(false);
    msgIdRef.current = 0;
    hasStartedRef.current = false;
    setTimeout(() => {
      hasStartedRef.current = true;
      runScript();
    }, 100);
  }, [runScript]);

  return (
    <>
      {/* Google Fonts for Orbitron, Inter, Rajdhani */}
      <link
        href="https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&family=Inter:wght@300;400;500&family=Rajdhani:wght@300;400;600;700&display=swap"
        rel="stylesheet"
      />

      <style>{`
        .onb-ambient {
          position: fixed; inset: 0; z-index: 0; pointer-events: none;
          transition: background 3s ease;
        }
        .onb-ambient::before {
          content: ''; position: absolute; inset: 0;
          background:
            radial-gradient(circle at 20% 80%, rgba(0,212,170,0.03) 0%, transparent 50%),
            radial-gradient(circle at 80% 20%, rgba(0,180,154,0.02) 0%, transparent 50%);
          animation: onb-ambientShift 20s ease-in-out infinite alternate;
        }
        @keyframes onb-ambientShift {
          0% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.6; transform: scale(1.1) translate(2%, -1%); }
          100% { opacity: 1; transform: scale(1) translate(-1%, 1%); }
        }
        .onb-particles {
          position: fixed; inset: 0; z-index: 0; pointer-events: none; overflow: hidden;
        }
        .onb-particle {
          position: absolute; border-radius: 50%;
          background: rgba(0,212,170,0.15);
          animation: onb-float linear infinite;
        }
        @keyframes onb-float {
          0% { transform: translateY(100vh) scale(0); opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 1; }
          100% { transform: translateY(-20vh) scale(1); opacity: 0; }
        }
        .onb-stage {
          position: relative; z-index: 1;
          width: 100%; min-height: 100vh;
          display: flex; flex-direction: column;
          align-items: center; justify-content: center;
          overflow: hidden;
        }
        .onb-scene-container {
          width: 100%; max-width: 720px; margin: 0 auto;
          padding: 40px 24px;
          animation: onb-fadeIn 0.8s ease;
        }
        @keyframes onb-fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .onb-scene-title {
          text-align: center;
          font-family: 'Orbitron', monospace;
          font-size: 0.6rem;
          letter-spacing: 8px;
          color: rgba(0,212,170,0.25);
          text-transform: uppercase;
          margin: 20px 0 30px;
          animation: onb-sceneTitleFade 3s ease forwards;
        }
        @keyframes onb-sceneTitleFade {
          0% { opacity: 0; transform: translateY(5px); letter-spacing: 12px; }
          20% { opacity: 0.4; }
          50% { opacity: 0.35; }
          100% { opacity: 0; transform: translateY(-5px); letter-spacing: 6px; }
        }
        .onb-msg {
          margin-bottom: 28px;
          animation: onb-msgIn 0.5s ease both;
          line-height: 1.7;
          font-size: 1.05rem;
        }
        @keyframes onb-msgIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .onb-msg-mirror {
          font-family: 'Orbitron', monospace;
          font-size: 0.92rem;
          letter-spacing: 1.5px;
          font-weight: 400;
          color: #00d4aa;
          text-shadow: 0 0 20px rgba(0,212,170,0.25), 0 0 40px rgba(0,212,170,0.08);
        }
        .onb-msg-agent {
          color: #d8d0e0;
          font-weight: 300;
          font-family: 'Inter', sans-serif;
          padding-left: 40px;
          border-left: 1px solid rgba(0,212,170,0.08);
        }
        .onb-msg-weighted {
          font-weight: 700;
          letter-spacing: 2.5px;
          text-shadow: 0 0 30px rgba(0,212,170,0.4), 0 0 60px rgba(0,212,170,0.15);
        }
        .onb-msg-label {
          display: block;
          font-size: 0.55rem;
          letter-spacing: 4px;
          text-transform: uppercase;
          margin-bottom: 6px;
        }
        .onb-msg-label-mirror {
          color: rgba(0,212,170,0.35);
          font-family: 'Orbitron', monospace;
        }
        .onb-msg-label-agent {
          color: rgba(255,255,255,0.18);
          font-family: 'Inter', sans-serif;
        }
        .onb-text em { font-style: italic; }
        .onb-cursor {
          display: inline-block;
          width: 2px; height: 1em;
          background: #00d4aa;
          margin-left: 2px;
          animation: onb-blink 0.6s step-end infinite;
          vertical-align: text-bottom;
        }
        .onb-cursor-agent { background: #d8d0e0; }
        @keyframes onb-blink { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }
        .onb-reflection {
          display: block;
          transform: scaleY(-1);
          color: rgba(0,212,170,0.08);
          text-shadow: none;
          filter: blur(1.5px);
          mask-image: linear-gradient(to top, transparent 0%, rgba(0,0,0,0.5) 100%);
          -webkit-mask-image: linear-gradient(to top, transparent 0%, rgba(0,0,0,0.5) 100%);
          animation: onb-reflectionFade 4s ease forwards;
          pointer-events: none;
          margin-top: 4px;
          font-size: 0.85rem;
          font-style: italic;
          height: 0; overflow: visible;
        }
        @keyframes onb-reflectionFade {
          0% { opacity: 0; }
          15% { opacity: 0.15; }
          100% { opacity: 0; }
        }
        .onb-thinking-dots {
          display: inline-flex; gap: 4px; padding: 4px 0;
        }
        .onb-dot {
          width: 6px; height: 6px; border-radius: 50%;
          background: #00d4aa; opacity: 0.3;
          animation: onb-pulse 1.4s ease-in-out infinite;
        }
        @keyframes onb-pulse {
          0%, 100% { opacity: 0.2; transform: scale(0.8); }
          50% { opacity: 0.7; transform: scale(1.2); }
        }
        .onb-screen-flash {
          position: fixed; inset: 0; z-index: 100; pointer-events: none;
          background: rgba(0,212,170,0.08);
          opacity: 1;
          animation: onb-flashOut 0.15s ease-out forwards;
        }
        @keyframes onb-flashOut {
          from { opacity: 1; }
          to { opacity: 0; }
        }
        .onb-name-climax {
          position: fixed; inset: 0; z-index: 60;
          display: flex; align-items: center; justify-content: center;
          pointer-events: none;
          animation: onb-fadeIn 0.3s ease;
        }
        .onb-name-text {
          font-family: 'Orbitron', monospace;
          font-size: 4rem;
          font-weight: 900;
          letter-spacing: 12px;
          text-transform: uppercase;
          color: #00d4aa;
          text-shadow:
            0 0 30px rgba(0,212,170,0.6),
            0 0 60px rgba(0,212,170,0.3),
            0 0 120px rgba(0,212,170,0.15),
            0 0 200px rgba(0,212,170,0.08);
          animation: onb-nameReveal 3s ease forwards;
        }
        .onb-name-reflection {
          position: absolute;
          font-family: 'Orbitron', monospace;
          font-size: 4rem;
          font-weight: 900;
          letter-spacing: 12px;
          text-transform: uppercase;
          color: rgba(0,212,170,0.1);
          transform: scaleY(-1) translateY(-100%);
          filter: blur(3px);
          mask-image: linear-gradient(to top, transparent, rgba(0,0,0,0.5));
          -webkit-mask-image: linear-gradient(to top, transparent, rgba(0,0,0,0.5));
          animation: onb-nameReveal 3s ease forwards;
        }
        @keyframes onb-nameReveal {
          0% { transform: scale(0.8); opacity: 0; letter-spacing: 20px; }
          20% { transform: scale(1.05); opacity: 1; letter-spacing: 14px; }
          40% { transform: scale(1); letter-spacing: 12px; }
          70% { transform: scale(1); opacity: 1; }
          100% { transform: scale(0.95); opacity: 0; letter-spacing: 10px; }
        }
        .onb-param-lock {
          font-family: 'Orbitron', monospace;
          font-size: 0.6rem;
          letter-spacing: 2px;
          color: rgba(0,212,170,0.5);
          text-transform: uppercase;
          margin-top: 6px;
          animation: onb-fadeIn 0.5s ease;
        }
        .onb-gen-sequence {
          text-align: center;
          margin: 40px auto;
          max-width: 300px;
        }
        .onb-gen-status {
          font-family: 'Orbitron', monospace;
          font-size: 0.7rem;
          letter-spacing: 3px;
          color: rgba(0,212,170,0.5);
          margin-bottom: 16px;
          min-height: 1.2em;
        }
        .onb-gen-bar-track {
          width: 100%; height: 3px;
          background: rgba(0,212,170,0.08);
          border-radius: 2px;
          overflow: hidden;
          margin-bottom: 12px;
        }
        .onb-gen-bar-fill {
          height: 100%;
          background: linear-gradient(90deg, #00d4aa, #00ffcc);
          box-shadow: 0 0 12px rgba(0,212,170,0.4);
          border-radius: 2px;
          transition: width 0.3s ease;
        }
        .onb-gen-params {
          font-family: 'Rajdhani', sans-serif;
          font-size: 0.75rem;
          color: rgba(0,212,170,0.3);
          letter-spacing: 2px;
          min-height: 1.2em;
        }
        .onb-pfp-reveal {
          text-align: center;
          margin: 40px auto;
          animation: onb-fadeIn 1.5s ease;
        }
        .onb-pfp-container {
          width: 256px; height: 256px;
          margin: 0 auto;
          border-radius: 12px;
          overflow: hidden;
          position: relative;
          box-shadow: 0 0 60px rgba(0,212,170,0.15), 0 0 120px rgba(0,212,170,0.05);
        }
        .onb-pfp-noise {
          position: absolute; inset: 0;
          background: #0a0a0a;
          z-index: 2;
        }
        .onb-final-msg {
          text-align: center;
          margin-top: 60px;
          font-family: 'Orbitron', monospace;
          font-size: 0.8rem;
          letter-spacing: 3px;
          color: rgba(0,212,170,0.4);
          animation: onb-fadeIn 2s ease;
        }
        .onb-restart {
          display: block;
          margin: 40px auto;
          padding: 10px 24px;
          background: transparent;
          border: 1px solid rgba(0,212,170,0.2);
          color: rgba(0,212,170,0.5);
          font-family: 'Orbitron', monospace;
          font-size: 0.65rem;
          letter-spacing: 3px;
          text-transform: uppercase;
          cursor: pointer;
          border-radius: 4px;
          transition: all 0.3s;
        }
        .onb-restart:hover {
          border-color: rgba(0,212,170,0.5);
          color: rgba(0,212,170,0.8);
        }
        @keyframes glowPulse {
          0%, 100% { opacity: 0.6; }
          50% { opacity: 1; }
        }
        @keyframes holoFlash {
          0% { opacity: 0; }
          30% { opacity: 1; }
          100% { opacity: 0; }
        }
      `}</style>

      <div className="onb-ambient" style={{ background: SCENE_AMBIENTS[scene] }} />
      <Particles />

      {showScreenFlash && <div className="onb-screen-flash" />}
      {showNameClimax && <NameClimax name={climaxName} />}

      <div className="onb-stage">
        <div className="onb-scene-container" key={scene}>
          {sceneTitle && <div className="onb-scene-title">{sceneTitle}</div>}
          <div className="onb-messages">
            {messages.map((msg) => (
              <MessageBubble key={msg.id} msg={msg} agentName={agentName} />
            ))}
            {showThinking && (
              <div className="onb-msg onb-msg-agent">
                <span className="onb-msg-label onb-msg-label-agent">{agentName}</span>
                <ThinkingDots />
              </div>
            )}
            {paramLocks.map((lock, i) => (
              <div key={i} className="onb-param-lock">
                ▸ {lock.param}: {lock.value}
              </div>
            ))}
            {showGen && genParams && <GenSequence params={genParams} />}
            {showPfpReveal && pfpSvg && <PFPReveal svgHtml={pfpSvg} />}
            {showCard && (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  margin: '60px auto',
                  animation: 'onb-fadeIn 1s ease',
                }}
              >
                <TradingCard
                  name={cardData.name}
                  archetype={cardData.archetype}
                  bio={cardData.bio}
                  pfpSvg={pfpSvg}
                  badges={['👁️', '🌙', '📜', '🔮']}
                  revealed={cardRevealed}
                />
              </div>
            )}
            {finalMsg && <div className="onb-final-msg">{finalMsg}</div>}
            {showRestart && (
              <button className="onb-restart" onClick={handleRestart}>
                ↻ RUN AGAIN
              </button>
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>
      </div>
    </>
  );
}
