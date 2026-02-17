'use client';

import { useRef, useCallback } from 'react';

interface TradingCardProps {
  name: string;
  archetype: string;
  bio: string;
  pfpSvg: string;
  badges: string[];
  revealed: boolean;
}

export function TradingCard({ name, archetype, bio, pfpSvg, badges, revealed }: TradingCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const shineRef = useRef<HTMLDivElement>(null);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const card = cardRef.current;
    const shine = shineRef.current;
    if (!card) return;
    const rect = card.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    const rotY = (x - 0.5) * 20;
    const rotX = (0.5 - y) * 15;
    card.style.transform = `rotateY(${rotY}deg) rotateX(${rotX}deg)`;
    const shadowX = -rotY * 1.5;
    const shadowY = rotX * 1.5;
    card.style.boxShadow = `${shadowX}px ${shadowY}px 30px rgba(0,0,0,0.5), 0 0 60px rgba(0,212,170,0.08)`;
    if (shine) {
      shine.style.background = `radial-gradient(circle at ${x * 100}% ${y * 100}%, rgba(255,255,255,0.12) 0%, transparent 60%)`;
    }
  }, []);

  const handleMouseLeave = useCallback(() => {
    const card = cardRef.current;
    const shine = shineRef.current;
    if (!card) return;
    card.style.transform = 'rotateY(0deg) rotateX(0deg)';
    card.style.boxShadow = '0 0 30px rgba(0,0,0,0.3), 0 0 60px rgba(0,212,170,0.08)';
    if (shine) shine.style.background = '';
  }, []);

  return (
    <div style={{ perspective: '800px', display: 'inline-block' }}>
      <div
        ref={cardRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        className="trading-card"
        style={{
          width: 300,
          height: 460,
          borderRadius: 16,
          position: 'relative',
          overflow: 'hidden',
          background: '#0a0812',
          transformStyle: 'preserve-3d',
          transition: 'transform 0.15s ease-out, box-shadow 0.15s ease-out',
          cursor: 'default',
        }}
      >
        {/* Glow border */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: 16,
            padding: 2,
            background:
              'linear-gradient(160deg, #00d4aa 0%, transparent 40%, transparent 60%, #006655 100%)',
            WebkitMask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
            WebkitMaskComposite: 'xor',
            maskComposite: 'exclude',
            pointerEvents: 'none',
            opacity: revealed ? 1 : 0,
            transition: 'opacity 1s 0.5s',
            animation: revealed ? 'glowPulse 3s ease-in-out infinite' : 'none',
          }}
        />

        {/* Outer glow */}
        <div
          style={{
            position: 'absolute',
            inset: -2,
            borderRadius: 18,
            background: '#00d4aa',
            opacity: revealed ? 0.08 : 0,
            filter: 'blur(15px)',
            pointerEvents: 'none',
            zIndex: -1,
            transition: 'opacity 1.5s 1s',
          }}
        />

        {/* Shine */}
        <div
          ref={shineRef}
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 10,
            pointerEvents: 'none',
            borderRadius: 16,
            background:
              'linear-gradient(135deg, transparent 0%, rgba(255,255,255,0.03) 40%, rgba(255,255,255,0.08) 50%, rgba(255,255,255,0.03) 60%, transparent 100%)',
            opacity: revealed ? 1 : 0,
            transition: 'opacity 0.5s',
          }}
        />

        {/* Holo flash */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 11,
            pointerEvents: 'none',
            borderRadius: 16,
            background:
              'linear-gradient(135deg, rgba(255,0,0,0.05) 0%, rgba(255,165,0,0.05) 15%, rgba(255,255,0,0.05) 30%, rgba(0,255,0,0.05) 45%, rgba(0,212,170,0.08) 60%, rgba(0,0,255,0.05) 75%, rgba(128,0,255,0.05) 90%, transparent 100%)',
            opacity: 0,
            animation: revealed ? 'holoFlash 2s ease forwards 0.3s' : 'none',
          }}
        />

        {/* Art */}
        <div
          style={{
            width: '100%',
            aspectRatio: '1/1',
            overflow: 'hidden',
            position: 'relative',
            opacity: revealed ? 1 : 0,
            transform: revealed ? 'translateY(0)' : 'translateY(-20px)',
            transition: 'opacity 1s, transform 1s',
            background: '#0a0812',
          }}
        >
          <div
            dangerouslySetInnerHTML={{ __html: pfpSvg }}
            style={{ width: '100%', height: '100%' }}
          />
          <div
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              height: 60,
              background: 'linear-gradient(transparent, #0a0812)',
            }}
          />
        </div>

        {/* Body */}
        <div style={{ padding: '16px 20px 14px', position: 'relative' }}>
          <div
            style={{
              fontFamily: "'Orbitron', monospace",
              fontSize: '1.3rem',
              fontWeight: 900,
              color: '#00d4aa',
              letterSpacing: 3,
              textTransform: 'uppercase',
              opacity: revealed ? 1 : 0,
              transform: revealed ? 'translateX(0)' : 'translateX(-10px)',
              transition: 'opacity 0.8s 0.8s, transform 0.8s 0.8s',
            }}
          >
            {name}
          </div>
          <div
            style={{
              fontFamily: "'Rajdhani', sans-serif",
              fontSize: '0.8rem',
              color: '#666',
              letterSpacing: 4,
              textTransform: 'uppercase',
              marginTop: 2,
              opacity: revealed ? 1 : 0,
              transition: 'opacity 0.8s 1.2s',
            }}
          >
            {archetype}
          </div>
          <div
            style={{
              fontFamily: "'Rajdhani', sans-serif",
              fontSize: '0.85rem',
              color: '#888',
              marginTop: 10,
              lineHeight: 1.4,
              fontStyle: 'italic',
              opacity: revealed ? 1 : 0,
              transition: 'opacity 0.8s 1.6s',
            }}
          >
            &ldquo;{bio}&rdquo;
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '6px 16px',
              marginTop: 14,
              opacity: revealed ? 1 : 0,
              transition: 'opacity 0.8s 2s',
            }}
          >
            {['Insight', 'Patience', 'Precision', 'Network'].map((label) => (
              <div
                key={label}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  fontSize: '0.8rem',
                }}
              >
                <span
                  style={{
                    fontFamily: "'Rajdhani', sans-serif",
                    color: '#555',
                    textTransform: 'uppercase',
                    letterSpacing: 1,
                    fontSize: '0.7rem',
                  }}
                >
                  {label}
                </span>
                <span
                  style={{
                    fontFamily: "'Orbitron', monospace",
                    color: '#00d4aa',
                    fontWeight: 700,
                    fontSize: '0.85rem',
                    opacity: 0.3,
                  }}
                >
                  ...
                </span>
              </div>
            ))}
          </div>
          <div
            style={{
              display: 'flex',
              gap: 8,
              marginTop: 14,
              paddingTop: 10,
              borderTop: '1px solid #1a1520',
              opacity: revealed ? 1 : 0,
              transition: 'opacity 0.8s 2.4s',
            }}
          >
            {badges.map((badge, i) => (
              <div
                key={i}
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 6,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 14,
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.06)',
                }}
              >
                {badge}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
