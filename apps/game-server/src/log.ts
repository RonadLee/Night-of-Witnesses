type Level = 'info' | 'warn' | 'error';

export function log(level: Level, event: string, fields: Record<string, unknown> = {}) {
  const line = {
    level,
    event,
    t: new Date().toISOString(),
    service: 'night-of-witnesses',
    ...fields,
  };
  const write = level === 'error' ? console.error : console.log;
  write(JSON.stringify(line));
}
