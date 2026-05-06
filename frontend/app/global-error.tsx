'use client';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html>
      <body style={{ background: 'hsl(222,22%,5%)', color: 'hsl(215,28%,92%)', fontFamily: 'monospace', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: '2rem', textAlign: 'center' }}>
        <div style={{ maxWidth: '420px', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <p style={{ fontSize: '0.7rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'hsl(355,78%,60%)' }}>
            Critical error
          </p>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 700 }}>
            Strix Protocol failed to load
          </h1>
          <p style={{ fontSize: '0.8rem', color: 'hsl(215,14%,52%)', lineHeight: 1.6 }}>
            {error.message || 'A critical error occurred. Please reload the page.'}
          </p>
          <button
            onClick={reset}
            style={{ padding: '0.5rem 1.25rem', fontSize: '0.7rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', border: '1px solid hsl(45,96%,54%,0.4)', color: 'hsl(45,96%,54%)', background: 'transparent', borderRadius: '3px', cursor: 'pointer' }}
          >
            Reload
          </button>
        </div>
      </body>
    </html>
  );
}
