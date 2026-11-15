// Renders the share card from a real scan: docs/card.png, 1200x630.
//
//   npm run card                  # scans this machine
//   npm run card -- --home DIR    # scans another home (the demo fixture)
//   npm run card -- --out file.png
//
// The PNG is drawn by a headless Chrome/Edge, so the committed card is a real
// render of the real card SVG, not a screenshot of a screenshot.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createContext } from '../src/context.js';
import { renderCardSvg } from '../src/report/card.js';
import { scan } from '../src/scan.js';

const WIDTH = 1200;
const HEIGHT = 630;

function browserCandidates(): string[] {
  const fromEnv = process.env.CHROME_BIN ?? process.env.BROWSER_BIN;
  const list = fromEnv ? [fromEnv] : [];
  if (process.platform === 'win32') {
    const bases = [
      process.env['PROGRAMFILES'],
      process.env['PROGRAMFILES(X86)'],
      process.env.LOCALAPPDATA,
    ].filter((dir): dir is string => Boolean(dir));
    for (const base of bases) {
      list.push(path.join(base, 'Google', 'Chrome', 'Application', 'chrome.exe'));
      list.push(path.join(base, 'Microsoft', 'Edge', 'Application', 'msedge.exe'));
    }
  } else if (process.platform === 'darwin') {
    list.push('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome');
    list.push('/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge');
  } else {
    list.push('/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/microsoft-edge');
  }
  return list;
}

async function findBrowser(): Promise<string | null> {
  for (const candidate of browserCandidates()) {
    try {
      await fs.access(candidate);
      return candidate;
    } catch {
      // try the next candidate
    }
  }
  return null;
}

function flagValue(args: string[], flag: string): string | undefined {
  const index = args.indexOf(flag);
  if (index === -1) return undefined;
  return args[index + 1];
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const home = flagValue(args, '--home');
  const out = path.resolve(flagValue(args, '--out') ?? 'docs/card.png');
  const ctx = createContext({ home, cwd: process.cwd(), env: { ...process.env } });
  const result = await scan(ctx, { writeHistory: false });
  const svg = renderCardSvg(result);
  const browser = await findBrowser();
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'stackweight-card-'));
  const htmlPath = path.join(dir, 'card.html');
  await fs.writeFile(
    htmlPath,
    `<!doctype html><meta charset="utf-8"><style>html,body{margin:0;padding:0;background:#0B0D10}svg{display:block}</style>${svg}`,
    'utf8',
  );
  if (!browser) {
    const svgPath = out.replace(/\.png$/, '.svg');
    await fs.writeFile(svgPath, svg, 'utf8');
    console.error(`No Chrome or Edge found. Wrote ${svgPath}; render it to a ${WIDTH}x${HEIGHT} PNG by hand.`);
    process.exitCode = 1;
    return;
  }
  await fs.mkdir(path.dirname(out), { recursive: true });
  execFileSync(
    browser,
    [
      '--headless=new',
      '--disable-gpu',
      '--hide-scrollbars',
      '--force-device-scale-factor=1',
      '--no-first-run',
      `--screenshot=${out}`,
      `--window-size=${WIDTH},${HEIGHT}`,
      pathToFileURL(htmlPath).href,
    ],
    { stdio: 'inherit' },
  );
  await fs.rm(dir, { recursive: true, force: true });
  console.log(
    `${out} · ${WIDTH}x${HEIGHT} · ${result.totals.stackWeight} tokens · ${result.totals.deadPct}% dead · ${result.generatedAt.slice(0, 10)}`,
  );
}

await main();
