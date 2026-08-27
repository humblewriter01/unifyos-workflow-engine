const warnedAliases = new Set<string>();

function clean(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim().replace(/[\r\n]/g, '');
  if (!trimmed) return undefined;

  return trimmed.replace(/^['"]/, '').replace(/['"]$/, '').trim();
}

export function getEnv(name: string, aliases: string[] = []): string | undefined {
  const primary = clean(process.env[name]);
  if (primary) return primary;

  for (const alias of aliases) {
    const value = clean(process.env[alias]);
    if (value) {
      const warningKey = `${name}:${alias}`;
      if (!warnedAliases.has(warningKey)) {
        warnedAliases.add(warningKey);
        console.warn(`Environment variable ${alias} is supported for compatibility; rename it to ${name}.`);
      }
      return value;
    }
  }

  return undefined;
}

export function isEmailConfigured(): boolean {
  return Boolean(getEnv('RESEND_API_KEY', ['RESENDER_API_KEY']));
}
