import { Terminal } from '../../components/home/terminal';

const PRIMARY = 'lab(88.4575% -1.94722 -16.9139)';

export default function HomePage() {
  return (
    <div
      className="relative min-h-screen overflow-hidden bg-gray-50 text-gray-600 dark:bg-[#0a0e18] dark:text-slate-600"
      style={{
        transition:
          'background 0.5s cubic-bezier(0.4, 0, 0.2, 1), color 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
      }}
    >
      <style>{`
        .dark {
          --color-fd-popover: #0a0e18;
          --color-fd-secondary: #0a0e18;
        }
        @keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(14px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes softFloat {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-8px); }
        }
        @keyframes grainShift {
          0%, 100% { transform: translate(0, 0); }
          10% { transform: translate(-1%, -1%); }
          30% { transform: translate(1%, 0%); }
          50% { transform: translate(-1%, 1%); }
          70% { transform: translate(1%, -1%); }
          90% { transform: translate(0%, 1%); }
        }
      `}</style>

      {/* Noise grain overlay */}
      <div
        className="pointer-events-none fixed inset-0 z-50 opacity-[0.03] transition-opacity duration-500"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
          backgroundSize: '128px 128px',
          animation: 'grainShift 0.5s steps(6) infinite',
        }}
      />

      {/* Background orbs */}
      <div
        className="pointer-events-none fixed top-[-10%] right-[10%] size-125 rounded-[50%] opacity-[0.1] blur-[60px]"
        style={{
          background: `radial-gradient(circle, ${PRIMARY} 0%, transparent 70%)`,
          animation: 'softFloat 10s ease-in-out infinite',
          transition: 'opacity 0.5s',
        }}
      />
      <div
        style={{
          position: 'fixed',
          bottom: '-15%',
          left: '5%',
          width: '400px',
          height: '400px',
          borderRadius: '50%',
          background: `radial-gradient(circle, ${PRIMARY} 0%, transparent 70%)`,
          opacity: 0.06,
          filter: 'blur(80px)',
          pointerEvents: 'none',
          animation: 'softFloat 12s ease-in-out infinite 3s',
          transition: 'opacity 0.5s',
        }}
      />

      {/* Hero */}
      <main
        style={{
          maxWidth: '760px',
          margin: '0 auto',
          padding: '88px 48px 60px',
          position: 'relative',
          zIndex: 10,
        }}
      >
        <div style={{ marginBottom: '48px' }}>
          <div
            className="border border-black/5 bg-white/70 text-[#34628c] dark:bg-white/5 dark:text-[#aac3e2]"
            style={{
              display: 'inline-block',
              padding: '4px 14px',
              marginBottom: '24px',
              backdropFilter: 'blur(8px)',
              borderRadius: '99px',
              fontSize: '11px',
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              fontWeight: 600,
              transition: 'background 0.5s, border-color 0.5s, color 0.5s',
            }}
          >
            agent-powered cli
          </div>
          <h1
            className="text-gray-950 dark:text-[#d8e0f0]"
            style={{
              fontSize: 'clamp(36px, 5vw, 54px)',
              fontWeight: 700,
              lineHeight: 1.12,
              marginBottom: '18px',
              letterSpacing: '-0.02em',
              transition: 'color 0.5s',
            }}
          >
            Ship code with
            <br />
            <span className="text-[#6f8eb1] dark:text-[#aac3e2]">autonomous agents</span>
          </h1>
          <p className="max-w-[65ch] leading-relaxed text-[#777] transition-colors duration-500 dark:text-[#5a6a88]">
            Ody is a CLI that orchestrates AI coding agents. Point it at a task, and it loops until
            the work is done. No babysitting required.
          </p>
        </div>

        {/* Frosted terminal */}
        <Terminal />

        {/* Feature grid */}
        <div className="mb-18 grid grid-cols-2 gap-3">
          {[
            { title: 'Multi-backend', desc: 'OpenCode, Claude, Codex. Pick your engine.' },
            { title: 'Auto-loop', desc: 'Set iterations and let it run to completion.' },
            { title: 'Validation', desc: 'Run shell commands to verify agent output.' },
            { title: 'Git-aware', desc: 'Optional auto-commit after each successful run.' },
          ].map((f, i) => (
            <div
              key={i}
              className="border border-[rgba(0,0,0,0.05)] bg-[rgba(255,255,255,0.5)] dark:border-[rgba(255,255,255,0.05)] dark:bg-[rgba(255,255,255,0.03)]"
              style={{
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
                borderRadius: '12px',
                padding: '22px 20px',
                animation: 'fadeInUp 0.5s ease-out',
                animationDelay: `${0.8 + i * 0.1}s`,
                animationFillMode: 'backwards',
                transition: 'background 0.5s, border-color 0.5s',
              }}
            >
              <div className="mb-1.5 text-[11px] font-semibold tracking-wider text-[#6f8eb1] dark:text-[#aac3e2]">
                0{i + 1}
              </div>
              <div className="mb-1 text-sm font-semibold text-[#1a1f2e] transition-colors duration-500 dark:text-[#c0cce0]">
                {f.title}
              </div>
              <div
                className="dark:text-gray-[#4a5878] text-xs text-gray-400 transition-colors duration-500"
                style={{
                  lineHeight: 1.6,
                }}
              >
                {f.desc}
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
