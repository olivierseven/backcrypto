/**
 * Dev server with USERPROFILE/HOME confined to project (same as build.js).
 * Prevents Next.js from scanning C:\Users\... and failing with EPERM or leaving .next incomplete.
 */
const path = require('path');
const { spawn } = require('child_process');

const projectRoot = path.resolve(__dirname, '..');

process.env.USERPROFILE = projectRoot;
process.env.HOME = projectRoot;

const child = spawn('npx', ['next', 'dev', '-p', '3004'], {
  stdio: 'inherit',
  cwd: projectRoot,
  shell: true,
});

child.on('exit', (code) => process.exit(code ?? 0));
