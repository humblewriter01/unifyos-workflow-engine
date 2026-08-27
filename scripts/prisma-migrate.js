const { spawnSync } = require('child_process');

function clean(value) {
  if (!value) return value;
  const trimmed = value.trim();
  return trimmed.replace(/^['"]/, '').replace(/['"]$/, '').trim();
}

if (process.env.DATABASE_URL) {
  process.env.DATABASE_URL = clean(process.env.DATABASE_URL);
}

const result = spawnSync('npx', ['prisma', 'migrate', 'deploy', '--schema', 'apps/api/prisma/schema.prisma'], {
  stdio: 'inherit',
  shell: true,
  env: process.env,
});

if (result.error) {
  console.error(`Unable to run Prisma migrations: ${result.error.message}`);
  process.exit(1);
}
process.exit(result.status ?? 1);
