/**
 * Build script that confines USERPROFILE/HOME to the project directory.
 * Prevents Next.js/build tools from scanning C:\Users\... (e.g. "Ambiente de Impressão") on Windows.
 */
const path = require('path');
const { spawnSync } = require('child_process');

const projectRoot = path.resolve(__dirname, '..');

// Confine home to project so glob/fs doesn't scan real user profile (e.g. "Ambiente de Impressão")
process.env.USERPROFILE = projectRoot;
process.env.HOME = projectRoot;

// Versão = branch atual (automático em qualquer ambiente)
if (!process.env.VERCEL_GIT_COMMIT_REF && !process.env.NEXT_PUBLIC_APP_VERSION) {
  try {
    const { execSync } = require('child_process');
    process.env.NEXT_PUBLIC_APP_VERSION = execSync('git branch --show-current', {
      encoding: 'utf8',
      cwd: projectRoot,
    }).trim();
  } catch {
    /* ignora */
  }
}

const run = (cmd, args, opts = {}) => {
  const r = spawnSync(cmd, args, {
    stdio: 'inherit',
    cwd: projectRoot,
    shell: true,
    ...opts,
  });
  if (r.status !== 0) process.exit(r.status ?? 1);
};

run('npx', ['prisma', 'generate']);
run('npx', ['next', 'build']);
