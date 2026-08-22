import { execSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const webRoot = resolve(here, '..');

function resolveCommitSha() {
  const envSha = process.env.CF_PAGES_COMMIT_SHA
    || process.env.COMMIT_SHA
    || process.env.GITHUB_SHA
    || process.env.RAILWAY_GIT_COMMIT_SHA;
  if (envSha?.trim()) return envSha.trim();
  try {
    return execSync('git rev-parse HEAD', { cwd: webRoot, encoding: 'utf8' }).trim();
  } catch {
    return `local-${Date.now()}`;
  }
}

const sha = resolveCommitSha();
const generatedAt = new Date().toISOString();
const payload = { version: sha, generatedAt };

mkdirSync(resolve(webRoot, 'src/generated'), { recursive: true });
writeFileSync(resolve(webRoot, 'public/build-version.json'), `${JSON.stringify(payload)}\n`);
writeFileSync(
  resolve(webRoot, 'src/generated/buildVersion.ts'),
  `// Generated automatically before every production build.\nexport const BUILD_VERSION = ${JSON.stringify(sha)};\n`,
);

console.log(`[lifonk] build version ${sha}`);
