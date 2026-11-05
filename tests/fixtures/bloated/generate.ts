import fs from 'node:fs/promises';
import path from 'node:path';

interface Domain { slug: string; phrase: string; k1: string; k2: string; k3: string; }

const RAW = `
kubernetes-helm | Manage Helm charts and Kubernetes releases | helm charts, kubectl rollouts, pod logs
terraform-plan | Write and review Terraform infrastructure | terraform modules, state locking, provider pinning
aws-lambda | Build AWS Lambda functions | lambda handlers, cold starts, IAM roles
gcp-run | Deploy services to Google Cloud Run | cloud run revisions, artifact registry, service accounts
azure-functions | Build Azure Functions apps | bindings, durable functions, app settings
cloudflare-workers | Build Cloudflare Workers | wrangler config, KV namespaces, durable objects
vercel-deploy | Deploy apps to Vercel | preview deployments, edge config, build output
netlify-sites | Deploy sites to Netlify | netlify toml, redirects, edge handlers
stripe-billing | Integrate Stripe billing | checkout sessions, webhooks, subscription proration
twilio-sms | Send SMS with Twilio | messaging services, delivery receipts, opt-out keywords
sendgrid-mail | Send transactional email with SendGrid | dynamic templates, bounce handling, domain authentication
slack-bots | Build Slack bots | bolt apps, slash commands, interactive modals
discord-bots | Build Discord bots | gateway intents, slash command registration, embeds
telegram-bots | Build Telegram bots | bot api updates, inline keyboards, webhook setup
postgres-tuning | Tune PostgreSQL performance | explain analyze, index selection, vacuum settings
mysql-ops | Operate MySQL databases | replication lag, slow query log, schema migrations
redis-cache | Use Redis for caching | eviction policies, key expiry, pipelining
mongodb-schema | Design MongoDB schemas | aggregation pipelines, compound indexes, document modeling
elasticsearch-search | Build Elasticsearch search | analyzers, relevance scoring, index mappings
kafka-streams | Build Kafka streaming pipelines | consumer groups, partition keys, exactly-once delivery
airflow-dags | Write Airflow DAGs | task dependencies, sensors, backfills
dbt-models | Build dbt models | incremental models, sources freshness, macros
pandas-wrangling | Wrangle data with pandas | groupby aggregations, merges, datetime indexes
pytorch-training | Train models with PyTorch | dataloaders, mixed precision, gradient checkpointing
huggingface-hub | Publish to the Hugging Face Hub | model cards, dataset repos, inference endpoints
langchain-agents | Build LangChain agents | tool calling, retrievers, output parsers
rag-pipelines | Build retrieval-augmented generation | chunking strategies, embedding stores, reranking
prompt-evals | Evaluate prompts systematically | golden datasets, rubric grading, regression suites
ios-swiftui | Build iOS apps with SwiftUI | navigation stacks, observable models, previews
android-compose | Build Android apps with Jetpack Compose | composables, view models, gradle variants
flutter-apps | Build Flutter apps | widgets, state management, platform channels
expo-react-native | Build Expo React Native apps | expo router, eas builds, native modules
electron-desktop | Build Electron desktop apps | ipc channels, auto updates, code signing
tauri-desktop | Build Tauri desktop apps | rust commands, window management, bundling
rust-cli | Build command-line tools in Rust | clap parsing, error handling, cross compilation
go-services | Build Go microservices | goroutines, context cancellation, grpc handlers
java-spring | Build Spring Boot services | dependency injection, jpa repositories, actuator
dotnet-api | Build ASP.NET Core APIs | minimal apis, entity framework, middleware
php-laravel | Build Laravel applications | eloquent models, queues, blade templates
ruby-rails | Build Ruby on Rails applications | active record, hotwire, background jobs
svelte-kit | Build SvelteKit applications | load functions, form actions, adapters
angular-apps | Build Angular applications | standalone components, signals, rxjs
astro-sites | Build Astro content sites | content collections, islands, image optimization
tailwind-ui | Style interfaces with Tailwind CSS | utility classes, design tokens, dark mode
figma-handoff | Turn Figma designs into code | auto layout, variables, dev mode specs
a11y-audit | Audit web accessibility | aria roles, focus order, color contrast
seo-audit | Audit technical SEO | sitemaps, canonical tags, structured data
web-perf | Improve web performance | core web vitals, bundle splitting, image formats
playwright-e2e | Write Playwright end-to-end tests | locators, fixtures, trace viewer
jest-unit | Write Jest unit tests | mocks, snapshot tests, coverage thresholds
security-headers | Configure HTTP security headers | content security policy, hsts, cors
oauth-flows | Implement OAuth flows | pkce, refresh tokens, scopes
jwt-auth | Implement JWT authentication | signing keys, token rotation, claims validation
docker-compose | Run services with Docker Compose | compose profiles, healthchecks, volumes
nginx-config | Configure Nginx | reverse proxy, tls termination, rate limiting
github-actions | Write GitHub Actions workflows | matrix builds, caching, reusable workflows
sentry-errors | Track errors with Sentry | source maps, release tracking, alert rules
grafana-dashboards | Build Grafana dashboards | promql queries, panels, alerting
excel-reports | Generate Excel reports | pivot tables, formulas, conditional formatting
pptx-decks | Generate PowerPoint decks | slide layouts, speaker notes, charts
`.trim().split('\n');

const DOMAINS: Domain[] = RAW.map((line) => {
  const [slug, phrase, keys] = line.split(' | ') as [string, string, string];
  const [k1, k2, k3] = keys.split(', ') as [string, string, string];
  return { slug, phrase, k1, k2, k3 };
});

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function filler(d: Domain): string {
  return `${d.phrase}. Use when the user asks about ${d.k1}, ${d.k2} or ${d.k3}, or mentions ${d.slug} in the request. Covers setup, common pitfalls, debugging steps and best practices for ${d.k1} in production projects, including ${d.k2} edge cases and ${d.k3} configuration.`;
}

function skillDoc(name: string, description: string): string {
  return `---\nname: ${name}\ndescription: ${JSON.stringify(description)}\n---\n# ${name}\n\nInstructions.\n`;
}

function sliceDomains(start: number, end: number): Domain[] {
  return DOMAINS.slice(start - 1, end);
}

const SKILL_MTIME = new Date('2026-07-15T00:00:00Z');
const RANGE_START = Date.parse('2026-10-08T00:00:00.000Z');
const RANGE_END = Date.parse('2026-11-05T00:00:00.000Z');

function atIndex(i: number, n: number): string {
  const ms = n <= 1 ? RANGE_START : RANGE_START + ((RANGE_END - RANGE_START) * i) / (n - 1);
  return new Date(ms).toISOString();
}

async function writeFile(home: string, rel: string, text: string): Promise<void> {
  const full = path.join(home, ...rel.split('/'));
  await fs.mkdir(path.dirname(full), { recursive: true });
  await fs.writeFile(full, text);
}

export async function generateBloated(home: string): Promise<void> {
  await fs.mkdir(home, { recursive: true });
  const skillRels: string[] = [];
  const codexListing: string[] = [];

  async function addSkill(relDir: string, name: string, description: string, codex = false): Promise<void> {
    const rel = `${relDir}/SKILL.md`;
    await writeFile(home, rel, skillDoc(name, description));
    skillRels.push(rel);
    if (codex) codexListing.push(`- ${name}: ${description} (file: ${rel})`);
  }

  const plugins: Record<string, Domain[]> = {
    'cloud-kit': sliceDomains(1, 8),
    'comms-kit': sliceDomains(9, 14),
    'data-kit': sliceDomains(15, 22),
    'design-kit': sliceDomains(42, 47),
  };
  const registry: Record<string, unknown[]> = {};
  for (const [plugin, domains] of Object.entries(plugins)) {
    const installPath = `.claude/plugins/cache/vendor/${plugin}/1.0.0`;
    for (const domain of domains) {
      await addSkill(`${installPath}/skills/${domain.slug}`, domain.slug, filler(domain));
    }
    registry[`${plugin}@vendor`] = [{
      scope: 'user',
      installPath,
      version: '1.0.0',
      installedAt: '2026-07-15T00:00:00.000Z',
      lastUpdated: '2026-07-15T00:00:00.000Z',
    }];
  }
  await writeFile(home, '.claude/plugins/installed_plugins.json', `${JSON.stringify({ version: 2, plugins: registry }, null, 2)}\n`);

  for (const domain of sliceDomains(23, 32)) {
    await addSkill(`.claude/skills/${domain.slug}`, domain.slug, filler(domain));
  }
  const claudeOverlaps: [string, string][] = [
    ['commit-helper', 'Write conventional commit messages from staged git changes. Use when the user asks to commit, write a commit message, or summarize staged changes.'],
    ['git-commit-writer', 'Generate conventional commit messages for staged git changes. Use when the user wants a commit message or asks to commit staged work.'],
    ['smart-commit', 'Create conventional git commit messages from the staged diff whenever the user asks to commit changes.'],
    ['pdf-extract', 'Extract text, tables and images from PDF files. Use when the user uploads a PDF or asks to read PDF content.'],
    ['pdf-reader', 'Read PDF files and extract their text and tables when the user shares a PDF.'],
    ['pdf-toolkit', 'Work with PDF files: extract text and tables, merge pages, fill PDF forms.'],
  ];
  for (const [name, description] of claudeOverlaps) {
    await addSkill(`.claude/skills/${name}`, name, description);
  }

  for (const domain of sliceDomains(33, 41)) {
    await addSkill(`.cursor/skills/${domain.slug}`, domain.slug, filler(domain));
  }
  const cursorOverlaps: [string, string][] = [
    ['frontend-design', 'Design distinctive production-grade frontend interfaces with strong typography, layout and color. Use when building web UI components or pages.'],
    ['ui-designer', 'Build polished frontend UI components and pages with strong layout, typography and color choices.'],
    ['web-ui-polish', 'Polish frontend web interfaces: typography, spacing, color and layout for UI components and pages.'],
  ];
  for (const [name, description] of cursorOverlaps) {
    await addSkill(`.cursor/skills/${name}`, name, description);
  }
  for (const domain of sliceDomains(48, 53)) {
    await addSkill(`.cursor/plugins/cache/mkt/marketing-kit/v1/skills/${domain.slug}`, domain.slug, filler(domain));
  }

  await addSkill('.codex/skills/.system/imagegen', 'imagegen', 'Generate or edit raster images.', true);
  await addSkill('.codex/skills/.system/openai-docs', 'openai-docs', 'Look up OpenAI API documentation.', true);
  for (const domain of sliceDomains(54, 58)) {
    await addSkill(`.codex/skills/${domain.slug}`, domain.slug, filler(domain), true);
  }
  const tdd: [string, string][] = [
    ['tdd-workflow', 'Follow test-driven development: write a failing test first, then the minimal implementation, then refactor.'],
    ['test-first', 'Write the failing test first, then implement the minimal code to pass it, then refactor (test-driven development).'],
    ['red-green-refactor', 'Test-driven development loop: failing test, minimal implementation, refactor.'],
  ];
  for (const [name, description] of tdd) {
    await addSkill(`.codex/skills/${name}`, name, description, true);
  }

  for (const domain of sliceDomains(59, 60)) {
    await addSkill(`.agents/skills/${domain.slug}`, domain.slug, filler(domain), true);
  }
  const notes: [string, string][] = [
    ['meeting-notes', 'Take structured meeting notes with decisions, action items and owners.'],
    ['notes-taker', 'Capture meeting notes: decisions, action items and their owners.'],
    ['minutes-writer', 'Write meeting minutes listing decisions, action items and owners.'],
  ];
  for (const [name, description] of notes) {
    await addSkill(`.agents/skills/${name}`, name, description, true);
  }

  const rng = mulberry32(42);
  const claudeSlots = pick(rng, 900, 19);
  const claudeSkills = [
    ...Array<string>(12).fill('commit-helper'),
    ...Array<string>(3).fill('design-kit:angular-apps'),
    ...Array<string>(4).fill('pandas-wrangling'),
  ];
  const claudeUse = new Map<number, string>();
  claudeSlots.forEach((slot, i) => claudeUse.set(slot, claudeSkills[i] ?? 'commit-helper'));
  const trap = `{"type":"attachment","timestamp":"2026-10-08T00:00:00.000Z","attachment":{"type":"prompt_snapshot","systemPrompt":["Skills ${skillRels.join(' ')} \\"name\\":\\"Skill\\" tool_use"]}}\n`;
  for (let file = 0; file < 9; file++) {
    const lines = [trap.trimEnd()];
    for (let row = 0; row < 100; row++) {
      const n = file * 100 + row;
      const id = `b${n}`;
      const stamp = atIndex(n, 900);
      const skill = claudeUse.get(n);
      const content = skill
        ? `[{"type":"tool_use","id":"t${n}","name":"Skill","input":{"skill":${JSON.stringify(skill)}}}]`
        : `[{"type":"text","text":"ok"}]`;
      lines.push(`{"type":"assistant","timestamp":"${stamp}","message":{"id":"${id}","role":"assistant","content":${content}}}`);
    }
    await writeFile(home, `.claude/projects/-bloated/session-${file}.jsonl`, `${lines.join('\n')}\n`);
  }

  const cursorSlots = pick(rng, 1500, 8);
  const cursorTargets = [
    ...Array<string>(6).fill('.cursor/skills/frontend-design/SKILL.md'),
    ...Array<string>(2).fill('.cursor/skills/electron-desktop/SKILL.md'),
  ];
  const cursorUse = new Map<number, string>();
  cursorSlots.forEach((slot, i) => cursorUse.set(slot, cursorTargets[i] ?? cursorTargets[0]!));
  for (let file = 0; file < 15; file++) {
    const lines = [`{"role":"user","message":{"content":[{"type":"text","text":"<available_skills>${skillRels.join(' ')}</available_skills> tool_use"}]}}`];
    for (let row = 0; row < 100; row++) {
      const n = file * 100 + row;
      const target = cursorUse.get(n);
      const content = target
        ? `[{"type":"tool_use","name":"Read","input":{"path":${JSON.stringify(target)}}}]`
        : `[{"type":"text","text":"ok"}]`;
      lines.push(`{"role":"assistant","message":{"content":${content}}}`);
    }
    await writeFile(home, `.cursor/projects/bloated/agent-transcripts/t${file}.jsonl`, `${lines.join('\n')}\n`);
  }

  const listing = `<skills_instructions>\\n## Skills\\n### Available skills\\n${codexListing.join('\\n')}\\n### How to use skills\\nOpen the file.\\n</skills_instructions>`;
  const codexCalls = [
    [0, '.codex/skills/tdd-workflow/SKILL.md'],
    [1, '.codex/skills/tdd-workflow/SKILL.md'],
    [2, '.codex/skills/tdd-workflow/SKILL.md'],
    [3, '.codex/skills/docker-compose/SKILL.md'],
  ] as const;
  for (let day = 0; day < 10; day++) {
    const when = new Date(Date.parse('2026-10-27T00:00:00.000Z') + day * 86_400_000);
    const y = when.getUTCFullYear();
    const m = String(when.getUTCMonth() + 1).padStart(2, '0');
    const d = String(when.getUTCDate()).padStart(2, '0');
    const lines = [
      `{"timestamp":"${when.toISOString()}","type":"response_item","payload":{"type":"message","role":"developer","content":[{"type":"input_text","text":"${listing}"}]}}`,
    ];
    for (const [index, rel] of codexCalls) {
      if (index !== day) continue;
      lines.push(`{"timestamp":"${when.toISOString()}","type":"response_item","payload":{"type":"function_call","name":"shell","arguments":"{\\"command\\":[\\"cat\\",\\"${rel}\\"]}","call_id":"c${index}"}}`);
    }
    for (let row = 0; row < 30; row++) {
      const stamp = new Date(when.getTime() + row * 60_000).toISOString();
      lines.push(`{"timestamp":"${stamp}","type":"response_item","payload":{"type":"message","role":"assistant","content":[{"type":"output_text","text":"ok"}]}}`);
    }
    await writeFile(home, `.codex/sessions/${y}/${m}/${d}/rollout-${y}-${m}-${d}.jsonl`, `${lines.join('\n')}\n`);
  }

  await stampTree(home, SKILL_MTIME);
  for (let file = 0; file < 9; file++) {
    await fs.utimes(path.join(home, `.claude/projects/-bloated/session-${file}.jsonl`), new Date(atIndex(file * 100 + 99, 900)), new Date(atIndex(file * 100 + 99, 900)));
  }
  for (let file = 0; file < 15; file++) {
    const when = new Date(atIndex(file, 15));
    await fs.utimes(path.join(home, `.cursor/projects/bloated/agent-transcripts/t${file}.jsonl`), when, when);
  }
  for (let day = 0; day < 10; day++) {
    const when = new Date(Date.parse('2026-10-27T12:00:00.000Z') + day * 86_400_000);
    const y = when.getUTCFullYear();
    const m = String(when.getUTCMonth() + 1).padStart(2, '0');
    const d = String(when.getUTCDate()).padStart(2, '0');
    await fs.utimes(path.join(home, `.codex/sessions/${y}/${m}/${d}/rollout-${y}-${m}-${d}.jsonl`), when, when);
  }
}

function pick(rng: () => number, n: number, k: number): number[] {
  const idx = Array.from({ length: n }, (_, i) => i);
  for (let i = idx.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const swap = idx[i]!;
    idx[i] = idx[j]!;
    idx[j] = swap;
  }
  return idx.slice(0, k).sort((a, b) => a - b);
}

async function stampTree(root: string, when: Date): Promise<void> {
  const paths: string[] = [root];
  async function walk(dir: string): Promise<void> {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      paths.push(full);
      if (entry.isDirectory()) await walk(full);
    }
  }
  await walk(root);
  paths.sort((a, b) => b.split(path.sep).length - a.split(path.sep).length);
  for (const full of paths) await fs.utimes(full, when, when);
}
