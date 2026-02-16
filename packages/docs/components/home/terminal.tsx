'use client';

import { useState, useEffect } from 'react';

const PRIMARY_MID = 'lab(58% -2 -22)';

const COMMANDS = [
  { prompt: '$ ody init', output: 'Initializing project...' },
  { prompt: '$ ody plan', output: 'Generating new task plan...' },
  { prompt: '$ ody run', output: 'Agent loop started. Implementing tasks...' },
];

function TypingText({
  text,
  delay = 0,
  speed = 45,
}: {
  text: string;
  delay?: number;
  speed?: number;
}) {
  const [displayed, setDisplayed] = useState('');
  const [started, setStarted] = useState(false);

  useEffect(() => {
    const timeout = setTimeout(() => setStarted(true), delay);
    return () => clearTimeout(timeout);
  }, [delay]);

  useEffect(() => {
    if (!started) return;
    if (displayed.length < text.length) {
      const timeout = setTimeout(() => setDisplayed(text.slice(0, displayed.length + 1)), speed);
      return () => clearTimeout(timeout);
    }
  }, [displayed, started, text, speed]);

  return <span>{displayed}</span>;
}

function BlinkingCursor() {
  return (
    <span
      style={{
        display: 'inline-block',
        width: '9px',
        height: '1.1em',
        background: PRIMARY_MID,
        marginLeft: '2px',
        verticalAlign: 'text-bottom',
        animation: 'blink 1s step-end infinite',
      }}
    />
  );
}

export function Terminal() {
  const [visibleLines, setVisibleLines] = useState(0);

  useEffect(() => {
    const timeouts: ReturnType<typeof setTimeout>[] = [];
    COMMANDS.forEach((_, i) => {
      timeouts.push(setTimeout(() => setVisibleLines((v) => Math.max(v, i + 1)), i * 2200));
    });
    return () => timeouts.forEach(clearTimeout);
  }, []);

  return (
    <div
      className="bg-white/55 dark:bg-black/5 border border-black/5 dark:border-white/5"
      style={{
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderRadius: '14px',
        overflow: 'hidden',
        marginBottom: '56px',
        boxShadow: '0 8px 40px rgba(0,0,0,0.04), 0 1px 3px rgba(0,0,0,0.03)',
        transition: 'background 0.5s, border-color 0.5s, box-shadow 0.5s',
      }}
    >
      {/* Title bar */}
      <div
        className="border border-[rgba(0,0,0,0.05)] dark:border-[rgba(255,255,255,0.04)]"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '7px',
          padding: '14px 18px',
          transition: 'border-color 0.5s',
        }}
      >
        <div
          className="bg-[#ff6259] dark:bg-[#5a3a3a]"
          style={{
            width: '11px',
            height: '11px',
            borderRadius: '50%',
            transition: 'background 0.5s',
          }}
        />
        <div
          className="bg-[#ffbf2e] dark:bg-[#5a4e30]"
          style={{
            width: '11px',
            height: '11px',
            borderRadius: '50%',
            transition: 'background 0.5s',
          }}
        />
        <div
          className="bg-[#29ce42] dark:bg-[#2e4a36]"
          style={{
            width: '11px',
            height: '11px',
            borderRadius: '50%',
            transition: 'background 0.5s',
          }}
        />
        <span
          className="text-[#aaa] dark:text-[#3a4a68]"
          style={{
            marginLeft: '12px',
            fontSize: '11px',
            transition: 'color 0.5s',
          }}
        >
          ~/.ody
        </span>
      </div>
      {/* Content */}
      <div className="min-h-65 pt-5 px-5.5 pb-6.5 text-sm leading-loose">
        {COMMANDS.slice(0, visibleLines).map((cmd, i) => (
          <div key={i} style={{ animation: 'fadeInUp 0.3s ease-out' }}>
            <div>
              <span
                className="text-[#6f8eb1] dark:text-[#aac3e2]"
                style={{
                  fontWeight: 500,
                }}
              >
                <TypingText text={cmd.prompt} delay={i * 2200} speed={40} />
              </span>
            </div>
            <div
              className="text-[#aaa] dark:text-[#4a5878]"
              style={{
                paddingLeft: '16px',
                transition: 'color 0.5s',
              }}
            >
              <TypingText text={cmd.output} delay={i * 2200 + 900} speed={20} />
            </div>
          </div>
        ))}
        <div style={{ marginTop: '4px' }}>
          <span className="text-[#6f8eb1] dark:text-[#aac3e2]">$ </span>
          <BlinkingCursor />
        </div>
      </div>
    </div>
  );
}
