import { readFileSync } from 'node:fs';

export async function main(argv: string[]): Promise<number> {
  if (argv.includes('--version')) {
    const pkg = JSON.parse(
      readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
    ) as { version: string };
    process.stdout.write(`${pkg.version}\n`);
    return 0;
  }
  process.stdout.write('stackweight: not implemented yet\n');
  return 1;
}
