// ══════════════════════════════════════════════════════
// PFP GENERATOR: Pure TypeScript, no DOM dependencies
// Ported from moltblox-citizen/onboarding/live.html
// ══════════════════════════════════════════════════════

export interface Palette {
  primary: string;
  bright: string;
  bg1: string;
  bg2: string;
  skin1: string;
  skin2: string;
  mid: string;
  dark: string;
  accent2: string;
}

export interface PFPParams {
  face: string;
  eyes: string;
  expression: string;
  palette: string;
  feature: string;
  pattern: string;
}

export const PALETTES: Record<string, Palette> = {
  teal: {
    primary: '#00d4aa',
    bright: '#00ffcc',
    bg1: '#1a0a2e',
    bg2: '#080010',
    skin1: '#1e1030',
    skin2: '#0a0515',
    mid: '#2a1245',
    dark: '#0d0518',
    accent2: '#00b89a',
  },
  gold: {
    primary: '#f0c040',
    bright: '#ffe070',
    bg1: '#1a1400',
    bg2: '#050400',
    skin1: '#2a2530',
    skin2: '#0d0a10',
    mid: '#2a2030',
    dark: '#0d0810',
    accent2: '#c09020',
  },
  crimson: {
    primary: '#ff3355',
    bright: '#ff6680',
    bg1: '#2e0a15',
    bg2: '#100008',
    skin1: '#301020',
    skin2: '#150510',
    mid: '#3a1525',
    dark: '#18080e',
    accent2: '#cc2244',
  },
  purple: {
    primary: '#b040ff',
    bright: '#d080ff',
    bg1: '#1a0a30',
    bg2: '#080015',
    skin1: '#201030',
    skin2: '#0d0518',
    mid: '#2a1550',
    dark: '#100828',
    accent2: '#8830cc',
  },
  frost: {
    primary: '#60ccff',
    bright: '#90e0ff',
    bg1: '#0a1a2e',
    bg2: '#000810',
    skin1: '#102030',
    skin2: '#050d18',
    mid: '#152a40',
    dark: '#081520',
    accent2: '#4099cc',
  },
  emerald: {
    primary: '#40e060',
    bright: '#70ff90',
    bg1: '#0a2e15',
    bg2: '#001008',
    skin1: '#103020',
    skin2: '#051510',
    mid: '#154025',
    dark: '#082010',
    accent2: '#30aa48',
  },
};

export function generatePFP({
  face,
  eyes,
  expression,
  palette,
  feature,
  pattern,
}: PFPParams): string {
  const P = PALETTES[palette] || PALETTES.teal;
  const uid = (face + eyes + palette).replace(/[^a-z]/gi, '');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="256" height="256"><defs>${buildDefs(P, uid)}</defs><rect width="256" height="256" fill="url(#bg_${uid})"/>${buildAmbient(P, uid)}${buildBody(face, P, uid)}${buildHead(face, P, uid)}${buildPattern(pattern, P, uid)}${buildEyes(eyes, P, uid)}${buildExpression(expression, P)}${buildFeature(feature, P, uid)}${buildParticles(P)}<radialGradient id="vig_${uid}" cx="50%" cy="40%" r="55%"><stop offset="65%" stop-color="transparent"/><stop offset="100%" stop-color="#000000" stop-opacity="0.75"/></radialGradient><rect width="256" height="256" fill="url(#vig_${uid})"/></svg>`;
}

export function buildDefs(P: Palette, u: string): string {
  return `<filter id="glow_${u}" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur in="SourceGraphic" stdDeviation="4" result="blur"/><feComposite in="SourceGraphic" in2="blur" operator="over"/></filter><filter id="strongGlow_${u}" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur in="SourceGraphic" stdDeviation="6" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter><filter id="smoke_${u}" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur in="SourceAlpha" stdDeviation="12" result="blur"/><feColorMatrix in="blur" type="matrix" values="0.2 0 0.3 0 0  0 0.1 0.2 0 0  0.3 0 0.4 0 0  0 0 0 0.5 0"/></filter><radialGradient id="bg_${u}" cx="50%" cy="40%" r="60%"><stop offset="0%" stop-color="${P.bg1}"/><stop offset="100%" stop-color="${P.bg2}"/></radialGradient><linearGradient id="headGrad_${u}" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="${P.mid}"/><stop offset="100%" stop-color="${P.dark}"/></linearGradient><radialGradient id="faceGrad_${u}" cx="50%" cy="35%" r="50%"><stop offset="0%" stop-color="${P.skin1}"/><stop offset="100%" stop-color="${P.skin2}"/></radialGradient><linearGradient id="bodyGrad_${u}" x1="0.5" y1="0" x2="0.5" y2="1"><stop offset="0%" stop-color="${P.dark}"/><stop offset="100%" stop-color="${P.bg2}"/></linearGradient>`;
}

export function buildAmbient(P: Palette, u: string): string {
  return `<g filter="url(#smoke_${u})" opacity="0.4"><ellipse cx="40" cy="200" rx="60" ry="80" fill="${P.bg1}"/><ellipse cx="220" cy="210" rx="55" ry="70" fill="${P.bg1}"/><ellipse cx="128" cy="20" rx="90" ry="30" fill="${P.dark}"/></g>`;
}

export function buildBody(face: string, P: Palette, u: string): string {
  const b: Record<string, string> = {
    hooded: `<path d="M50,256 Q55,180 70,160 Q85,145 100,140 L128,135 L156,140 Q171,145 186,160 Q201,180 206,256 Z" fill="url(#bodyGrad_${u})" stroke="${P.mid}" stroke-width="0.5"/><path d="M85,180 Q90,200 88,256" fill="none" stroke="${P.mid}" stroke-width="1.5" opacity="0.4"/><path d="M171,180 Q166,200 168,256" fill="none" stroke="${P.mid}" stroke-width="1.5" opacity="0.4"/>`,
    angular: `<path d="M55,256 L65,190 Q70,170 85,158 Q100,148 115,144 L128,142 L141,144 Q156,148 171,158 Q186,170 191,190 L201,256 Z" fill="url(#bodyGrad_${u})" stroke="${P.mid}" stroke-width="0.5"/><path d="M60,195 Q55,170 70,158 Q85,148 100,145 L105,170 Q85,175 70,185 Z" fill="${P.dark}" stroke="${P.primary}" stroke-width="0.5" stroke-opacity="0.3"/><path d="M196,195 Q201,170 186,158 Q171,148 156,145 L151,170 Q171,175 186,185 Z" fill="${P.dark}" stroke="${P.primary}" stroke-width="0.5" stroke-opacity="0.3"/>`,
    rounded: `<path d="M60,256 Q65,190 80,165 Q95,150 115,144 L128,142 L141,144 Q161,150 176,165 Q191,190 196,256 Z" fill="url(#bodyGrad_${u})" stroke="${P.mid}" stroke-width="0.5"/>`,
    masked: `<path d="M55,256 L68,185 Q75,165 90,155 Q105,148 120,144 L128,142 L136,144 Q151,148 166,155 Q181,165 188,185 L201,256 Z" fill="url(#bodyGrad_${u})" stroke="${P.mid}" stroke-width="0.5"/><path d="M128,155 L128,200" stroke="${P.primary}" stroke-width="0.8" opacity="0.2"/>`,
    visor: `<path d="M55,256 L65,190 Q70,170 85,158 Q100,148 115,144 L128,142 L141,144 Q156,148 171,158 Q186,170 191,190 L201,256 Z" fill="url(#bodyGrad_${u})" stroke="${P.mid}" stroke-width="0.5"/><g stroke="${P.primary}" stroke-width="0.8" fill="none" opacity="0.25"><path d="M128,155 L128,200"/><path d="M128,170 L110,180 L110,200"/><path d="M128,170 L146,180 L146,200"/><circle cx="128" cy="165" r="3" fill="${P.primary}" opacity="0.3"/></g>`,
    skeletal: `<path d="M58,256 Q62,195 72,170 Q82,155 98,148 L128,142 L158,148 Q174,155 184,170 Q194,195 198,256 Z" fill="url(#bodyGrad_${u})" stroke="${P.mid}" stroke-width="0.5"/><g stroke="${P.primary}" stroke-width="0.6" opacity="0.15"><path d="M105,165 L105,220"/><path d="M118,160 L118,230"/><path d="M138,160 L138,230"/><path d="M151,165 L151,220"/></g>`,
  };
  return b[face] || b.angular;
}

export function buildHead(face: string, P: Palette, u: string): string {
  const h: Record<string, string> = {
    hooded: `<path d="M60,150 Q58,100 68,72 Q80,45 100,32 Q115,24 128,22 Q141,24 156,32 Q176,45 188,72 Q198,100 196,150 Q185,155 170,148 Q155,138 128,135 Q101,138 86,148 Q71,155 60,150 Z" fill="url(#headGrad_${u})" stroke="${P.mid}" stroke-width="0.5"/><path d="M128,22 Q128,50 128,135" fill="none" stroke="${P.mid}" stroke-width="1.2" opacity="0.4"/><path d="M98,30 Q88,60 78,120" fill="none" stroke="${P.dark}" stroke-width="0.8" opacity="0.3"/><path d="M158,30 Q168,60 178,120" fill="none" stroke="${P.dark}" stroke-width="0.8" opacity="0.3"/><path d="M78,135 Q80,95 90,75 Q100,60 115,54 Q128,50 141,54 Q156,60 166,75 Q176,95 178,135 Q165,140 150,135 Q140,130 128,128 Q116,130 106,135 Q91,140 78,135 Z" fill="${P.bg2}"/><ellipse cx="128" cy="100" rx="35" ry="38" fill="url(#faceGrad_${u})" opacity="0.8"/>`,
    angular: `<path d="M88,120 Q86,90 90,68 Q95,48 108,36 Q118,28 128,26 Q138,28 148,36 Q161,48 166,68 Q170,90 168,120 Q165,130 155,134 Q145,138 128,140 Q111,138 101,134 Q91,130 88,120 Z" fill="url(#headGrad_${u})" stroke="${P.mid}" stroke-width="0.5"/><g stroke="${P.dark}" stroke-width="0.8" fill="none" opacity="0.5"><path d="M128,28 L128,65"/><path d="M105,40 L95,65 L92,100"/><path d="M151,40 L161,65 L164,100"/><path d="M100,110 L108,120 L118,128"/><path d="M156,110 L148,120 L138,128"/><path d="M95,78 L110,74 L128,72 L146,74 L161,78"/></g><path d="M96,80 Q100,75 115,73 L128,72 L141,73 Q156,75 160,80 L160,98 Q156,104 145,106 L128,107 L111,106 Q100,104 96,98 Z" fill="${P.bg2}" opacity="0.8"/>`,
    rounded: `<ellipse cx="128" cy="90" rx="48" ry="55" fill="url(#headGrad_${u})" stroke="${P.mid}" stroke-width="0.5"/><ellipse cx="128" cy="95" rx="38" ry="42" fill="url(#faceGrad_${u})" opacity="0.8"/>`,
    masked: `<path d="M85,125 Q83,88 90,65 Q100,42 115,33 Q128,28 141,33 Q156,42 166,65 Q173,88 171,125 Q165,135 150,138 L128,140 L106,138 Q91,135 85,125 Z" fill="url(#headGrad_${u})" stroke="${P.mid}" stroke-width="0.5"/><path d="M92,105 Q94,78 105,65 Q115,56 128,54 Q141,56 151,65 Q162,78 164,105 Q160,118 148,122 L128,124 L108,122 Q96,118 92,105 Z" fill="${P.dark}" stroke="${P.primary}" stroke-width="0.8" opacity="0.6"/><path d="M128,54 L128,124" stroke="${P.primary}" stroke-width="0.6" opacity="0.3"/><path d="M92,85 L164,85" stroke="${P.primary}" stroke-width="0.6" opacity="0.2"/>`,
    visor: `<path d="M88,120 Q86,88 90,65 Q96,44 110,34 Q120,28 128,26 Q136,28 146,34 Q160,44 166,65 Q170,88 168,120 Q164,132 152,136 L128,140 L104,136 Q92,132 88,120 Z" fill="url(#headGrad_${u})" stroke="${P.mid}" stroke-width="0.5"/><path d="M90,82 Q92,72 110,68 L128,66 L146,68 Q164,72 166,82 L166,98 Q164,108 146,112 L128,114 L110,112 Q92,108 90,98 Z" fill="${P.bg2}" stroke="${P.primary}" stroke-width="1" opacity="0.9"/><path d="M93,84 Q95,76 112,72 L128,70 L144,72 Q161,76 163,84 L163,96 Q161,104 144,108 L128,110 L112,108 Q95,104 93,96 Z" fill="${P.primary}" opacity="0.15"/>`,
    skeletal: `<path d="M90,120 Q88,90 92,68 Q98,46 112,35 Q122,28 128,26 Q134,28 144,35 Q158,46 164,68 Q168,90 166,120 Q162,132 150,136 L128,140 L106,136 Q94,132 90,120 Z" fill="url(#headGrad_${u})" stroke="${P.mid}" stroke-width="0.5"/><ellipse cx="108" cy="105" rx="10" ry="14" fill="${P.bg2}" opacity="0.5"/><ellipse cx="148" cy="105" rx="10" ry="14" fill="${P.bg2}" opacity="0.5"/><path d="M92,90 Q100,88 108,92" stroke="${P.mid}" stroke-width="1" fill="none" opacity="0.5"/><path d="M164,90 Q156,88 148,92" stroke="${P.mid}" stroke-width="1" fill="none" opacity="0.5"/><ellipse cx="110" cy="82" rx="14" ry="10" fill="${P.bg2}" opacity="0.7"/><ellipse cx="146" cy="82" rx="14" ry="10" fill="${P.bg2}" opacity="0.7"/>`,
  };
  return h[face] || h.angular;
}

export function buildEyes(eyes: string, P: Palette, u: string): string {
  const cx1 = 110,
    cx2 = 146,
    cy = eyes === 'narrow' || eyes === 'slits' ? 90 : 88;
  const m: Record<string, string> = {
    narrow: `<g filter="url(#glow_${u})"><path d="M${cx1 - 12},${cy} Q${cx1 - 4},${cy - 6} ${cx1 + 6},${cy - 4} Q${cx1 + 12},${cy} ${cx1 + 6},${cy + 4} Q${cx1 - 4},${cy + 5} ${cx1 - 12},${cy} Z" fill="${P.primary}" opacity="0.85"/><ellipse cx="${cx1}" cy="${cy}" rx="3.5" ry="3" fill="${P.bright}"/><ellipse cx="${cx1}" cy="${cy}" rx="1.8" ry="2" fill="#fff" opacity="0.7"/><ellipse cx="${cx1 - 2}" cy="${cy - 1.5}" rx="1" ry="1" fill="#fff" opacity="0.9"/><path d="M${cx2 - 6},${cy - 4} Q${cx2 + 4},${cy - 6} ${cx2 + 12},${cy} Q${cx2 + 4},${cy + 5} ${cx2 - 6},${cy + 4} Q${cx2 - 12},${cy} ${cx2 - 6},${cy - 4} Z" fill="${P.primary}" opacity="0.85"/><ellipse cx="${cx2}" cy="${cy}" rx="3.5" ry="3" fill="${P.bright}"/><ellipse cx="${cx2}" cy="${cy}" rx="1.8" ry="2" fill="#fff" opacity="0.7"/><ellipse cx="${cx2 - 2}" cy="${cy - 1.5}" rx="1" ry="1" fill="#fff" opacity="0.9"/></g>`,
    wide: `<g filter="url(#glow_${u})"><ellipse cx="${cx1}" cy="${cy}" rx="14" ry="11" fill="${P.primary}" opacity="0.8"/><ellipse cx="${cx1}" cy="${cy}" rx="6" ry="6" fill="${P.bright}"/><ellipse cx="${cx1}" cy="${cy}" rx="3" ry="3.5" fill="#fff" opacity="0.6"/><ellipse cx="${cx1 - 2}" cy="${cy - 2}" rx="1.5" ry="1.5" fill="#fff" opacity="0.9"/><ellipse cx="${cx2}" cy="${cy}" rx="14" ry="11" fill="${P.primary}" opacity="0.8"/><ellipse cx="${cx2}" cy="${cy}" rx="6" ry="6" fill="${P.bright}"/><ellipse cx="${cx2}" cy="${cy}" rx="3" ry="3.5" fill="#fff" opacity="0.6"/><ellipse cx="${cx2 - 2}" cy="${cy - 2}" rx="1.5" ry="1.5" fill="#fff" opacity="0.9"/></g>`,
    dots: `<g filter="url(#strongGlow_${u})"><circle cx="${cx1}" cy="${cy}" r="4" fill="${P.bright}"/><circle cx="${cx1}" cy="${cy}" r="2" fill="#fff" opacity="0.8"/><circle cx="${cx2}" cy="${cy}" r="4" fill="${P.bright}"/><circle cx="${cx2}" cy="${cy}" r="2" fill="#fff" opacity="0.8"/></g>`,
    slits: `<g filter="url(#glow_${u})"><path d="M${cx1 - 10},${cy} Q${cx1},${cy - 3} ${cx1 + 10},${cy} Q${cx1},${cy + 2} ${cx1 - 10},${cy} Z" fill="${P.primary}" opacity="0.9"/><path d="M${cx1 - 3},${cy} Q${cx1},${cy - 1.5} ${cx1 + 3},${cy} Q${cx1},${cy + 1} ${cx1 - 3},${cy} Z" fill="${P.bright}"/><path d="M${cx2 - 10},${cy} Q${cx2},${cy - 3} ${cx2 + 10},${cy} Q${cx2},${cy + 2} ${cx2 - 10},${cy} Z" fill="${P.primary}" opacity="0.9"/><path d="M${cx2 - 3},${cy} Q${cx2},${cy - 1.5} ${cx2 + 3},${cy} Q${cx2},${cy + 1} ${cx2 - 3},${cy} Z" fill="${P.bright}"/></g>`,
    'glowing-orbs': `<g filter="url(#strongGlow_${u})"><circle cx="${cx1}" cy="${cy}" r="8" fill="${P.primary}" opacity="0.6"/><circle cx="${cx1}" cy="${cy}" r="5" fill="${P.bright}" opacity="0.7"/><circle cx="${cx1}" cy="${cy}" r="2.5" fill="#fff" opacity="0.8"/><circle cx="${cx2}" cy="${cy}" r="8" fill="${P.primary}" opacity="0.6"/><circle cx="${cx2}" cy="${cy}" r="5" fill="${P.bright}" opacity="0.7"/><circle cx="${cx2}" cy="${cy}" r="2.5" fill="#fff" opacity="0.8"/></g><ellipse cx="128" cy="${cy + 5}" rx="30" ry="12" fill="${P.primary}" opacity="0.06"/>`,
    closed: `<g filter="url(#glow_${u})" opacity="0.7"><path d="M${cx1 - 10},${cy} Q${cx1},${cy + 4} ${cx1 + 10},${cy}" fill="none" stroke="${P.primary}" stroke-width="2" stroke-linecap="round"/><path d="M${cx2 - 10},${cy} Q${cx2},${cy + 4} ${cx2 + 10},${cy}" fill="none" stroke="${P.primary}" stroke-width="2" stroke-linecap="round"/></g><ellipse cx="128" cy="${cy + 3}" rx="25" ry="8" fill="${P.primary}" opacity="0.03"/>`,
  };
  return m[eyes] || m.narrow;
}

export function buildExpression(expr: string, P: Palette): string {
  const mo: Record<string, string> = {
    neutral: `<path d="M118,118 L138,118" fill="none" stroke="${P.primary}" stroke-width="0.7" opacity="0.2"/>`,
    smirk: `<path d="M118,118 Q128,121 138,116" fill="none" stroke="${P.primary}" stroke-width="0.7" opacity="0.25"/><path d="M120,118 Q128,122 136,117" fill="none" stroke="${P.primary}" stroke-width="0.4" opacity="0.12"/>`,
    stern: `<path d="M116,117 L140,117" fill="none" stroke="${P.primary}" stroke-width="0.9" opacity="0.25"/><path d="M118,120 L138,120" fill="none" stroke="${P.primary}" stroke-width="0.4" opacity="0.1"/>`,
    curious: `<path d="M120,117 Q128,121 136,117" fill="none" stroke="${P.primary}" stroke-width="0.7" opacity="0.2"/><circle cx="128" cy="119" r="3" fill="${P.primary}" opacity="0.05"/>`,
    menacing: `<path d="M114,120 Q120,116 128,118 Q136,116 142,120" fill="none" stroke="${P.primary}" stroke-width="0.8" opacity="0.3"/><path d="M118,118 Q128,114 138,118" fill="none" stroke="${P.primary}" stroke-width="0.4" opacity="0.15"/>`,
    serene: `<path d="M120,118 Q128,122 136,118" fill="none" stroke="${P.primary}" stroke-width="0.6" opacity="0.18"/>`,
  };
  return (
    `<path d="M128,96 L126,107 Q128,110 130,107 Z" fill="${P.dark}" opacity="0.4"/>` +
    (mo[expr] || mo.neutral)
  );
}

export function buildPattern(pat: string, P: Palette, u: string): string {
  const ps: Record<string, string> = {
    clean: '',
    lines: `<g stroke="${P.primary}" stroke-width="0.5" opacity="0.12"><path d="M92,95 L88,110 L88,130"/><path d="M164,95 L168,110 L168,130"/><path d="M100,55 L96,70"/><path d="M156,55 L160,70"/><path d="M110,45 L108,58"/><path d="M146,45 L148,58"/></g>`,
    dots: `<g fill="${P.primary}" opacity="0.15"><circle cx="95" cy="60" r="1.5"/><circle cx="161" cy="60" r="1.5"/><circle cx="90" cy="80" r="1"/><circle cx="166" cy="80" r="1"/><circle cx="88" cy="100" r="1.2"/><circle cx="168" cy="100" r="1.2"/><circle cx="92" cy="120" r="0.8"/><circle cx="164" cy="120" r="0.8"/><circle cx="110" cy="50" r="1"/><circle cx="146" cy="50" r="1"/></g>`,
    circuits: `<g stroke="${P.primary}" stroke-width="0.6" fill="none" opacity="0.2"><path d="M92,95 L88,105 L88,120"/><path d="M164,95 L168,105 L168,120"/><path d="M100,108 L96,115"/><path d="M156,108 L160,115"/><path d="M110,55 L108,62 L112,68"/><path d="M146,55 L148,62 L144,68"/><path d="M128,155 L128,200"/><path d="M128,170 L110,180"/><path d="M128,170 L146,180"/><circle cx="128" cy="165" r="3" fill="${P.primary}" opacity="0.3"/></g>`,
    waves: `<g stroke="${P.primary}" stroke-width="0.6" fill="none" opacity="0.12"><path d="M80,70 Q90,65 100,70 Q110,75 120,70"/><path d="M136,70 Q146,65 156,70 Q166,75 176,70"/><path d="M75,100 Q88,95 100,100 Q112,105 125,100"/><path d="M131,100 Q144,95 156,100 Q168,105 181,100"/><path d="M70,130 Q85,125 100,130"/><path d="M156,130 Q171,125 186,130"/></g>`,
    runes: `<g filter="url(#strongGlow_${u})" opacity="0.3"><path d="M90,55 L93,48 L96,55" fill="none" stroke="${P.primary}" stroke-width="1"/><path d="M160,55 L163,48 L166,55" fill="none" stroke="${P.primary}" stroke-width="1"/><circle cx="128" cy="38" r="2" fill="${P.primary}" opacity="0.5"/><path d="M124,38 L132,38" fill="none" stroke="${P.primary}" stroke-width="0.5" opacity="0.5"/><path d="M85,100 L82,92 L88,88" fill="none" stroke="${P.primary}" stroke-width="0.8"/><path d="M171,100 L174,92 L168,88" fill="none" stroke="${P.primary}" stroke-width="0.8"/></g>`,
  };
  return ps[pat] || '';
}

export function buildFeature(feat: string, P: Palette, u: string): string {
  const f: Record<string, string> = {
    none: '',
    hood: `<path d="M65,145 Q62,105 72,75 Q82,50 100,38 Q115,30 128,28 Q141,30 156,38 Q174,50 184,75 Q194,105 191,145 Q180,150 168,142 Q150,130 128,128 Q106,130 88,142 Q76,150 65,145 Z" fill="url(#headGrad_${u})" opacity="0.5" stroke="${P.mid}" stroke-width="0.3"/>`,
    antenna: `<g filter="url(#strongGlow_${u})" opacity="0.5"><path d="M86,72 L78,52 L82,46" fill="none" stroke="${P.primary}" stroke-width="1.5"/><circle cx="80" cy="46" r="2.5" fill="${P.primary}"/><path d="M170,72 L178,52 L174,46" fill="none" stroke="${P.primary}" stroke-width="1.5"/><circle cx="176" cy="46" r="2.5" fill="${P.primary}"/></g>`,
    horns: `<g opacity="0.85"><path d="M95,60 Q88,35 75,18 Q78,22 82,28 Q86,38 92,55" fill="${P.mid}" stroke="${P.primary}" stroke-width="0.5" stroke-opacity="0.4"/><path d="M161,60 Q168,35 181,18 Q178,22 174,28 Q170,38 164,55" fill="${P.mid}" stroke="${P.primary}" stroke-width="0.5" stroke-opacity="0.4"/><g filter="url(#strongGlow_${u})" opacity="0.4"><circle cx="75" cy="18" r="2" fill="${P.bright}"/><circle cx="181" cy="18" r="2" fill="${P.bright}"/></g></g>`,
    halo: `<g filter="url(#strongGlow_${u})" opacity="0.4"><ellipse cx="128" cy="20" rx="38" ry="8" fill="none" stroke="${P.bright}" stroke-width="2"/><ellipse cx="128" cy="20" rx="38" ry="8" fill="none" stroke="${P.primary}" stroke-width="1"/></g>`,
    scars: `<g stroke="${P.primary}" stroke-width="1.2" opacity="0.35" stroke-linecap="round"><path d="M100,78 L92,98 L96,112" fill="none"/><path d="M155,82 L162,95" fill="none"/><path d="M112,105 L108,118" fill="none"/></g>`,
    circuits: `<g stroke="${P.primary}" stroke-width="0.6" fill="none" opacity="0.25"><path d="M92,95 L88,105 L88,120"/><path d="M164,95 L168,105 L168,120"/><path d="M110,55 L108,62 L112,68"/><path d="M146,55 L148,62 L144,68"/><circle cx="88" cy="105" r="1.5" fill="${P.primary}" opacity="0.4"/><circle cx="168" cy="105" r="1.5" fill="${P.primary}" opacity="0.4"/></g><g stroke="${P.primary}" stroke-width="0.8" fill="none" opacity="0.2"><path d="M128,155 L128,200"/><path d="M128,170 L110,180 L110,200"/><path d="M128,170 L146,180 L146,200"/><circle cx="128" cy="165" r="3" fill="${P.primary}" opacity="0.3"/></g>`,
    crown: `<g filter="url(#strongGlow_${u})" opacity="0.5"><path d="M95,38 L90,15 L105,28 L118,8 L128,25 L138,8 L151,28 L166,15 L161,38" fill="none" stroke="${P.bright}" stroke-width="1.5"/><path d="M95,38 L161,38" fill="none" stroke="${P.primary}" stroke-width="1"/><circle cx="118" cy="8" r="2" fill="${P.bright}" opacity="0.6"/><circle cx="138" cy="8" r="2" fill="${P.bright}" opacity="0.6"/><circle cx="128" cy="25" r="1.5" fill="#fff" opacity="0.5"/></g>`,
  };
  const clasp = `<g filter="url(#strongGlow_${u})" opacity="0.5"><polygon points="128,140 122,148 128,156 134,148" fill="${P.primary}" opacity="0.4"/><circle cx="128" cy="148" r="2" fill="${P.bright}" opacity="0.7"/></g>`;
  return (f[feat] || '') + clasp;
}

export function buildParticles(P: Palette): string {
  return `<g opacity="0.3"><circle cx="45" cy="60" r="1" fill="${P.primary}"><animate attributeName="opacity" values="0.1;0.5;0.1" dur="4s" repeatCount="indefinite"/></circle><circle cx="200" cy="45" r="0.8" fill="${P.primary}"><animate attributeName="opacity" values="0.3;0.1;0.3" dur="3s" repeatCount="indefinite"/></circle><circle cx="30" cy="120" r="0.6" fill="${P.bright}"><animate attributeName="opacity" values="0.1;0.4;0.1" dur="5s" repeatCount="indefinite"/></circle><circle cx="225" cy="140" r="1" fill="${P.primary}"><animate attributeName="opacity" values="0.2;0.5;0.2" dur="3.5s" repeatCount="indefinite"/></circle></g>`;
}
