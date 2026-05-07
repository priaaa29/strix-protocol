'use client';

/* Chrome 4-pointed star with glass ring orbit.
   References: metallic dice (smooth reflective), glass torus (ring orbit),
   chrome star (lens flares, chromatic aberration) */

export function GlowStar({ className }: { className?: string }) {
  return (
    <div className={className} aria-hidden>
      {/* Outer float wrapper */}
      <div className="glow-star-float" style={{ width: '100%', height: '100%' }}>
        <svg
          viewBox="-280 -280 560 560"
          width="100%"
          height="100%"
          style={{ overflow: 'visible' }}
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            {/* Metallic surface — off-center radial for directional light */}
            <radialGradient id="gs-metal" cx="34%" cy="26%" r="74%">
              <stop offset="0%"   stopColor="#ffffff" stopOpacity="1" />
              <stop offset="10%"  stopColor="#e2e2e2" stopOpacity="1" />
              <stop offset="28%"  stopColor="#7a7a7a" stopOpacity="1" />
              <stop offset="58%"  stopColor="#1e1e1e" stopOpacity="1" />
              <stop offset="100%" stopColor="#000000" stopOpacity="0.85" />
            </radialGradient>

            {/* Atmospheric outer glow — cool blue-white tint */}
            <filter id="gs-atmo" x="-150%" y="-150%" width="400%" height="400%">
              <feGaussianBlur in="SourceGraphic" stdDeviation="38" result="blur" />
              <feColorMatrix
                in="blur" type="matrix"
                values="0.85 0.95 1.25 0 0.03  0.85 0.95 1.25 0 0.03  0.9 1.05 1.5 0 0.06  0 0 0 0.55 0"
                result="tinted"
              />
              <feMerge>
                <feMergeNode in="tinted" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>

            {/* Soft inner glow for highlights */}
            <filter id="gs-soft" x="-40%" y="-40%" width="180%" height="180%">
              <feGaussianBlur stdDeviation="4" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>

            {/* Lens flare — multi-radius bloom */}
            <filter id="gs-flare" x="-800%" y="-800%" width="1700%" height="1700%">
              <feGaussianBlur in="SourceGraphic" stdDeviation="2"  result="s" />
              <feGaussianBlur in="SourceGraphic" stdDeviation="10" result="m" />
              <feGaussianBlur in="SourceGraphic" stdDeviation="50" result="l" />
              <feMerge>
                <feMergeNode in="l" />
                <feMergeNode in="m" />
                <feMergeNode in="s" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>

            {/* Ring gradient — bright arc sweeping around the orbit */}
            <linearGradient id="gs-ring-a" x1="0%" y1="0%" x2="100%" y2="60%">
              <stop offset="0%"   stopColor="white" stopOpacity="0" />
              <stop offset="28%"  stopColor="#88bbff" stopOpacity="0.55" />
              <stop offset="50%"  stopColor="white"   stopOpacity="0.9" />
              <stop offset="72%"  stopColor="#88bbff" stopOpacity="0.35" />
              <stop offset="100%" stopColor="white"   stopOpacity="0" />
            </linearGradient>

            <linearGradient id="gs-ring-b" x1="100%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%"   stopColor="white" stopOpacity="0" />
              <stop offset="40%"  stopColor="white" stopOpacity="0.25" />
              <stop offset="70%"  stopColor="#aaaadd" stopOpacity="0.4" />
              <stop offset="100%" stopColor="white" stopOpacity="0" />
            </linearGradient>
          </defs>

          {/* ── Glass ring orbit ───────────────────────── */}
          <g transform="rotate(-32)" opacity="0.42">
            <ellipse cx="0" cy="0" rx="218" ry="128" fill="none"
              stroke="url(#gs-ring-a)" strokeWidth="2" />
            <ellipse cx="0" cy="0" rx="223" ry="133" fill="none"
              stroke="white" strokeWidth="0.6" strokeOpacity="0.12" />
            <ellipse cx="0" cy="0" rx="212" ry="122" fill="none"
              stroke="url(#gs-ring-b)" strokeWidth="1.2" />
            <ellipse cx="0" cy="0" rx="207" ry="117" fill="none"
              stroke="white" strokeWidth="0.4" strokeOpacity="0.08" />
          </g>

          {/* Ring lens flares */}
          <g transform="rotate(-32)">
            <circle cx="-4" cy="-128" r="3.5" fill="white"
              filter="url(#gs-flare)" opacity="0.55" />
            <circle cx="4" cy="128" r="2.5" fill="#aabbff"
              filter="url(#gs-flare)" opacity="0.38" />
          </g>

          {/* ── Chrome star — inner spin ───────────────── */}
          <g className="glow-star-spin">

            {/* Massive outer bloom — bleeds far beyond SVG bounds */}
            <g opacity="0.35">
              <path d={STAR} fill="white"
                style={{ filter: 'blur(70px)' }} />
            </g>
            <g opacity="0.22">
              <path d={STAR} fill="white"
                style={{ filter: 'blur(120px)' }} />
            </g>

            {/* Atmospheric outer glow */}
            <g filter="url(#gs-atmo)" opacity="0.55">
              <path d={STAR} fill="white" />
            </g>

            {/* Drop shadow */}
            <path d={STAR} fill="black" opacity="0.55"
              transform="translate(9,14)" filter="url(#gs-soft)" />

            {/* Main metallic body */}
            <path d={STAR} fill="url(#gs-metal)" filter="url(#gs-soft)" />

            {/* ── Highlight spines along each arm ─────── */}
            {/* Top arm — brightest (facing the light) */}
            <path d="M 0,-155 L 3.5,-22 L 0,-9 L -3.5,-22 Z"
              fill="white" opacity="0.95" filter="url(#gs-soft)" />

            {/* Right arm */}
            <path d="M 122,2.5 L 24,1.5 L 9,0 L 24,-1.5 Z"
              fill="white" opacity="0.78" filter="url(#gs-soft)" />

            {/* Left arm */}
            <path d="M -122,-2.5 L -24,-1.5 L -9,0 L -24,1.5 Z"
              fill="white" opacity="0.58" filter="url(#gs-soft)" />

            {/* Bottom arm */}
            <path d="M 0,92 L 3,22 L 0,9 L -3,22 Z"
              fill="white" opacity="0.45" filter="url(#gs-soft)" />

            {/* ── Chromatic aberration edges ─────────── */}
            {/* Blue fringe — left edge of top arm */}
            <path d="M -9,-10 L -18,-95 L -2,-10 Z"
              fill="#5588ff" opacity="0.14" />
            {/* Warm fringe — right edge of top arm */}
            <path d="M 9,-10 L 18,-95 L 2,-10 Z"
              fill="#ffcc88" opacity="0.09" />
            {/* Teal fringe — bottom arm */}
            <path d="M -4,9 L -6,78 L 4,9 Z"
              fill="#55ffcc" opacity="0.07" />

            {/* ── Lens flares ─────────────────────────── */}
            {/* Center — very bright core */}
            <circle cx="0" cy="0" r="7" fill="white" filter="url(#gs-flare)" />
            <circle cx="0" cy="0" r="2.5" fill="white" />

            {/* Top tip flare */}
            <circle cx="0" cy="-155" r="4.5" fill="white"
              filter="url(#gs-flare)" />

            {/* Right tip flare */}
            <circle cx="122" cy="0" r="3.5" fill="#cce4ff"
              filter="url(#gs-flare)" opacity="0.9" />

            {/* Left tip flare */}
            <circle cx="-122" cy="0" r="2.5" fill="white"
              filter="url(#gs-flare)" opacity="0.7" />

            {/* Secondary sparkle — mid top arm */}
            <circle cx="0" cy="-80" r="2.5" fill="white"
              filter="url(#gs-flare)" opacity="0.72" />

          </g>{/* end spin group */}

          {/* ── Scattered background sparkles ─────────── */}
          <circle cx="-115" cy="-92" r="1.2" fill="white" opacity="0.32" />
          <circle cx="160"  cy="-58" r="1"   fill="white" opacity="0.22" />
          <circle cx="-172" cy="42"  r="0.8" fill="white" opacity="0.18" />
          <circle cx="82"   cy="148" r="1"   fill="#aaccff" opacity="0.28" />
          <circle cx="-42"  cy="168" r="0.7" fill="white" opacity="0.18" />
          <circle cx="210"  cy="20"  r="0.8" fill="white" opacity="0.15" />
          <circle cx="-200" cy="-30" r="1"   fill="white" opacity="0.2" />

        </svg>
      </div>
    </div>
  );
}

/* 4-pointed star: top 155px · right/left 122px · bottom 92px
   Neck width ±10px creates the sharp tapered look */
const STAR =
  'M 0,-155 ' +
  'L 10,-10 ' +
  'L 122,0 '  +
  'L 10,10 '  +
  'L 0,92 '   +
  'L -10,10 ' +
  'L -122,0 ' +
  'L -10,-10 ' +
  'Z';
