// Lightweight structured logger.
// In production (NODE_ENV=production) emits JSON lines for log aggregators.
// In development emits human-readable prefixed output.

const isProd = process.env.NODE_ENV === 'production';

type Level = 'info' | 'warn' | 'error';
type Meta = Record<string, unknown> | string | undefined;

function log(level: Level, message: string, meta?: Meta): void {
  const ts = new Date().toISOString();
  const metaObj = typeof meta === 'string' ? { detail: meta } : meta;
  if (isProd) {
    process.stdout.write(JSON.stringify({ ts, level, message, ...metaObj }) + '\n');
  } else {
    const prefix = level === 'error' ? '✖' : level === 'warn' ? '⚠' : '•';
    const metaStr = meta ? ' ' + (typeof meta === 'string' ? meta : JSON.stringify(meta)) : '';
    console.log(`${ts} ${prefix} ${message}${metaStr}`);
  }
}

export const logger = {
  info:  (message: string, meta?: Meta) => log('info',  message, meta),
  warn:  (message: string, meta?: Meta) => log('warn',  message, meta),
  error: (message: string, meta?: Meta) => log('error', message, meta),
};
