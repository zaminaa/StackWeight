import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createInterface } from 'node:readline/promises';
import { parseArgs } from 'node:util';
import { executePrune, planPrune } from './apply/prune.js';
import { listManifests } from './apply/manifest.js';
import { restoreRun } from './apply/restore.js';
import { createContext } from './context.js';
import { renderPruneOutcome, renderPrunePlan, renderRestoreOutcome, renderSources, renderSummary } from './render/terminal.js';
import { scan } from './scan.js';
import { fmtDate, fmtTokens } from './util/format.js';

const USAGE = `stackweight [scan] [--json] [--open] [--out file] [--budget tokens] [--window days] [--home dir] [--no-history]
stackweight prune [--yes] [--keep a,b] [--home dir]
stackweight restore [runId] [--item name] [--list] [--home dir]
stackweight sources [--home dir]
stackweight --version | --help
`;

export async function main(argv: string[]): Promise<number> {
  let values: ReturnType<typeof parseArgs>['values'];
  let positionals: string[];
  try {
    const parsed = parseArgs({
      args: argv,
      allowPositionals: true,
      strict: true,
      options: {
        version: { type: 'boolean' },
        help: { type: 'boolean' },
        json: { type: 'boolean' },
        open: { type: 'boolean' },
        out: { type: 'string' },
        budget: { type: 'string' },
        window: { type: 'string' },
        home: { type: 'string' },
        'no-history': { type: 'boolean' },
        yes: { type: 'boolean' },
        keep: { type: 'string' },
        item: { type: 'string' },
        list: { type: 'boolean' },
      },
    });
    values = parsed.values;
    positionals = parsed.positionals;
  } catch (err) {
    process.stderr.write(`${USAGE}stackweight: ${err instanceof Error ? err.message : String(err)}\n`);
    return 1;
  }
  if (values.version) {
    const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as { version: string };
    process.stdout.write(`${pkg.version}\n`);
    return 0;
  }
  if (values.help) {
    process.stdout.write(USAGE);
    return 0;
  }
  try {
    return await dispatch(positionals[0] ?? 'scan', positionals.slice(1), values);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    process.stderr.write(`stackweight: ${message}\n`);
    if (process.env.STACKWEIGHT_DEBUG === '1' && err instanceof Error && err.stack) process.stderr.write(`${err.stack}\n`);
    return 1;
  }
}

async function dispatch(
  command: string,
  rest: string[],
  values: { [key: string]: string | boolean | (string | boolean)[] | undefined },
): Promise<number> {
  const ctx = createContext({
    home: typeof values.home === 'string' ? values.home : undefined,
    windowDays: typeof values.window === 'string' ? Number(values.window) : undefined,
  });
  const color = Boolean(process.stdout.isTTY) && !ctx.env.NO_COLOR;
  const opts = { color, reportPath: null as string | null, home: ctx.home };
  if (command === 'sources') {
    process.stdout.write(renderSources(await scan(ctx, { writeHistory: false }), opts));
    return 0;
  }
  if (command === 'restore') {
    if (values.list) {
      for (const manifest of await listManifests(ctx)) {
        const actions = manifest.actions.length;
        process.stdout.write(`${manifest.runId} · ${manifest.status} · ${fmtDate(manifest.createdAt)} · ${fmtTokens(manifest.stackWeightBefore)} → ${fmtTokens(manifest.stackWeightAfter)} · ${actions} actions\n`);
      }
      return 0;
    }
    const outcome = await restoreRun(ctx, { runId: rest[0], item: typeof values.item === 'string' ? values.item : undefined });
    process.stdout.write(renderRestoreOutcome(outcome, opts));
    return 0;
  }
  if (command === 'prune') {
    const result = await scan(ctx, { writeHistory: false });
    const keep = typeof values.keep === 'string' ? values.keep.split(',').map((name) => name.trim()).filter(Boolean) : [];
    const plan = planPrune(result, ctx, keep);
    process.stdout.write(renderPrunePlan(plan, opts));
    const actionable = plan.moves.length + plan.pluginDisables.length + plan.manual.length;
    if (actionable === 0) {
      process.stdout.write('Nothing to prune.\n');
      return 0;
    }
    const confirmed = values.yes === true || (Boolean(process.stdin.isTTY) && await confirm());
    if (!confirmed) {
      process.stdout.write('Dry run. Re-run with --yes to apply.\n');
      return 0;
    }
    const manifest = await executePrune(plan, ctx);
    process.stdout.write(renderPruneOutcome(manifest, opts));
    const fresh = await scan(ctx, { writeHistory: true });
    const summary = renderSummary(fresh, opts).split('\n').filter((line) => line.includes('Stack weight') || line.includes('Dead weight'));
    process.stdout.write(`${summary.join('\n')}\n`);
    return manifest.status === 'partial' ? 3 : 0;
  }
  if (command !== 'scan') {
    process.stderr.write(`${USAGE}stackweight: unknown command ${command}\n`);
    return 1;
  }
  const writeHistory = values['no-history'] !== true && values.json !== true;
  const result = await scan(ctx, { writeHistory });
  if (values.json) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } else {
    process.stdout.write(renderSummary(result, opts));
  }
  if (typeof values.budget === 'string') {
    const budget = Number(values.budget);
    if (!Number.isFinite(budget)) throw new Error('--budget needs a token count');
    if (result.harnesses.some((harness) => harness.weight > budget)) return 2;
  }
  return 0;
}

async function confirm(): Promise<boolean> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = (await rl.question('Apply this plan? [y/N] ')).trim().toLowerCase();
  rl.close();
  return answer === 'y' || answer === 'yes';
}

export function openReport(file: string): void {
  const child = process.platform === 'win32'
    ? spawn('cmd', ['/c', 'start', '', file], { detached: true, stdio: 'ignore' })
    : spawn(process.platform === 'darwin' ? 'open' : 'xdg-open', [file], { detached: true, stdio: 'ignore' });
  child.unref();
}
