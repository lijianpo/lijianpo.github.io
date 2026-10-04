import { execFileSync } from 'node:child_process';

export interface BuildInfo {
  readonly revision: string;
  readonly builtAt: string;
}

export function createBuildInfo(root: string): BuildInfo {
  const builtAt = new Date().toISOString();
  let revision = process.env.GITHUB_SHA?.trim() || 'local';
  if (revision === 'local') {
    const git = (args: string[]) => execFileSync('git', args, {
      cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    try {
      revision = git(['rev-parse', 'HEAD']);
      if (git(['status', '--porcelain'])) revision += '-dirty';
    } catch { /* Exported source trees can be built without Git. */ }
  }
  return { revision, builtAt };
}
