import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { generateBloated } from '../tests/fixtures/bloated/generate.js';

const dest = path.join(os.tmpdir(), 'stackweight-demo');
const marker = path.join(dest, '.stackweight-demo');
let exists = false;
try {
  await fs.access(dest);
  exists = true;
} catch {
  exists = false;
}
if (exists) {
  try {
    await fs.access(marker);
  } catch {
    console.error(`Refusing to remove ${dest} because it has no .stackweight-demo marker.`);
    process.exit(1);
  }
  await fs.rm(dest, { recursive: true, force: true });
}
await generateBloated(dest);
await fs.writeFile(marker, 'stackweight demo\n');
console.log(dest);
