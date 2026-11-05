#!/usr/bin/env node
const originalEmit = process.emitWarning;
process.emitWarning = function (warning, ...rest) {
  const text = typeof warning === 'string' ? warning : warning?.message ?? '';
  if (/SQLite/i.test(text)) return;
  return originalEmit.call(process, warning, ...rest);
};
const { main } = await import('../dist/cli.js');
process.exitCode = await main(process.argv.slice(2));
