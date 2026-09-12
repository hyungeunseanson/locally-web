import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

function readArgument(name) {
  const prefix = `--${name}=`;
  return process.argv.find((argument) => argument.startsWith(prefix))?.slice(prefix.length);
}

const profile = readArgument('profile') || process.env.CLOUDFLARE_PLACEMENT_PROFILE;
if (!['default', 'smart', 'supabase-hint'].includes(profile)) {
  throw new Error('Use --profile=default, --profile=smart, or --profile=supabase-hint.');
}

const root = process.cwd();
const output = path.resolve(
  root,
  readArgument('output') || `.wrangler/placement/wrangler.${profile}.jsonc`
);
const allowedOutputRoot = path.resolve(root, '.wrangler');
if (output !== allowedOutputRoot && !output.startsWith(`${allowedOutputRoot}${path.sep}`)) {
  throw new Error('Generated placement configs must remain under .wrangler/.');
}

const config = JSON.parse(await readFile(path.join(root, 'wrangler.jsonc'), 'utf8'));
const canary = config.env?.canary;
if (!canary) throw new Error('wrangler.jsonc is missing env.canary.');

function relativeConfigPath(absoluteTarget) {
  const relative = path.relative(path.dirname(output), absoluteTarget).split(path.sep).join('/');
  return relative.startsWith('.') ? relative : `./${relative}`;
}

// Wrangler resolves file paths from the generated config location.
config.$schema = relativeConfigPath(path.join(root, 'node_modules', 'wrangler', 'config-schema.json'));
config.main = relativeConfigPath(path.join(root, 'cloudflare-worker.ts'));
config.assets.directory = relativeConfigPath(path.join(root, '.open-next', 'assets'));

if (profile === 'default') {
  delete canary.placement;
} else if (profile === 'smart') {
  canary.placement = { mode: 'smart' };
} else {
  if (
    process.env.CLOUDFLARE_FUNCTIONAL_CANARY_SUPABASE_TIER !== 'staging' ||
    process.env.CLOUDFLARE_FUNCTIONAL_CANARY_STAGING_PROJECT_VERIFIED !== 'true'
  ) {
    throw new Error('The Supabase placement hint is allowed only for an operator-verified staging project.');
  }

  const rawSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!rawSupabaseUrl) throw new Error('NEXT_PUBLIC_SUPABASE_URL is required for the Supabase hint.');
  const supabaseUrl = new URL(rawSupabaseUrl);
  if (supabaseUrl.protocol !== 'https:' || !/^[a-z0-9]{20}\.supabase\.co$/.test(supabaseUrl.hostname)) {
    throw new Error('The placement hint must be derived from a hosted staging Supabase API hostname.');
  }

  canary.placement = { mode: 'targeted', hostname: supabaseUrl.hostname };
}

await mkdir(path.dirname(output), { recursive: true });
await writeFile(output, `${JSON.stringify(config, null, 2)}\n`);
console.log(JSON.stringify({ profile, output: path.relative(root, output), placement: canary.placement ?? null }));
