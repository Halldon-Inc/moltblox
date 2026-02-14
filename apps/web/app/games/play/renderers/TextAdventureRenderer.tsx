'use client';

import { useRef, useEffect, useState } from 'react';
import { BookOpen } from 'lucide-react';

interface Resource {
  name: string;
  value: number;
  icon?: string;
}

interface Choice {
  id: string;
  label: string;
  disabled?: boolean;
  hint?: string;
}

interface TextAdventureRendererProps {
  text: string[];
  choices: Choice[];
  resources?: Resource[];
  onChoice: (choiceId: string) => void;
  title?: string;
  typewriterEnabled?: boolean;
}

function TypewriterText({ text }: { text: string }) {
  const [displayed, setDisplayed] = useState('');
  const [done, setDone] = useState(false);

  useEffect(() => {
    setDisplayed('');
    setDone(false);
    let i = 0;
    const interval = setInterval(() => {
      i += 1;
      if (i >= text.length) {
        setDisplayed(text);
        setDone(true);
        clearInterval(interval);
      } else {
        setDisplayed(text.slice(0, i));
      }
    }, 18);
    return () => clearInterval(interval);
  }, [text]);

  return (
    <span>
      {displayed}
      {!done && <span className="inline-block w-1.5 h-4 bg-neon-cyan/70 ml-0.5 animate-pulse" />}
    </span>
  );
}

export default function TextAdventureRenderer({
  text,
  choices,
  resources = [],
  onChoice,
  title,
  typewriterEnabled = true,
}: TextAdventureRendererProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [text.length]);

  const lastIndex = text.length - 1;

  return (
    <div className="flex flex-col gap-4 min-h-[480px]">
      {/* Header row with title and resources */}
      <div className="flex items-start justify-between gap-4">
        {/* Title */}
        <div className="flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-molt-400 flex-shrink-0" />
          <h2 className="font-display font-bold text-lg text-white">{title || 'Adventure'}</h2>
        </div>

        {/* Resource sidebar (inline for wide, below for narrow) */}
        {resources.length > 0 && (
          <div className="flex items-center gap-3 flex-wrap">
            {resources.map((res) => (
              <div
                key={res.name}
                className="flex items-center gap-1.5 bg-white/5 border border-white/10 rounded-lg px-3 py-1.5"
              >
                <span className="text-sm select-none">{res.icon || '\u25CF'}</span>
                <span className="text-xs text-white/50">{res.name}</span>
                <span className="font-mono font-bold text-sm text-white tabular-nums">
                  {res.value}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Scrolling text area */}
      <div
        ref={scrollRef}
        className="glass-card p-5 flex-1 overflow-y-auto max-h-[360px] min-h-[240px] scrollbar-hide"
      >
        <div className="space-y-3">
          {text.map((line, i) => (
            <p
              key={`${i}-${line.slice(0, 20)}`}
              className={`text-sm leading-relaxed ${
                i === lastIndex ? 'text-white' : 'text-white/50'
              }`}
            >
              {typewriterEnabled && i === lastIndex ? <TypewriterText text={line} /> : line}
            </p>
          ))}
        </div>
      </div>

      {/* Choices */}
      {choices.length > 0 && (
        <div className="glass-card p-4">
          <h3 className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-3">
            What do you do?
          </h3>
          <div className="flex flex-col gap-2">
            {choices.map((choice, i) => (
              <button
                key={choice.id}
                onClick={() => onChoice(choice.id)}
                disabled={choice.disabled}
                className={[
                  'w-full py-3 px-4 rounded-lg text-left group',
                  'bg-molt-500/10 border border-molt-500/20',
                  'hover:bg-molt-500/20 hover:border-molt-500/40',
                  'transition-all duration-150 active:scale-[0.98]',
                  'disabled:opacity-30 disabled:cursor-not-allowed',
                  'select-none cursor-pointer',
                ].join(' ')}
              >
                <div className="flex items-center gap-3">
                  <span className="w-6 h-6 rounded bg-molt-500/20 text-molt-300 text-xs font-mono font-bold flex items-center justify-center flex-shrink-0">
                    {i + 1}
                  </span>
                  <span className="font-semibold text-white group-hover:text-neon-cyan transition-colors text-sm">
                    {choice.label}
                  </span>
                </div>
                {choice.hint && <p className="text-xs text-white/30 mt-1 ml-9">{choice.hint}</p>}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
