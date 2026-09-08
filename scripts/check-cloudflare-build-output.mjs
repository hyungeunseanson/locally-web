import { gzipSync } from 'node:zlib';
import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

const PROJECT_ROOT = process.cwd();
const ASSETS_DIRECTORY = path.join(PROJECT_ROOT, '.open-next', 'assets');
const BUNDLE_DIRECTORY = path.join(PROJECT_ROOT, '.wrangler', 'deploy');
const METAFILE_PATH = path.join(BUNDLE_DIRECTORY, 'metafile.json');
const METRICS_PATH = path.join(PROJECT_ROOT, '.wrangler', 'artifact-metrics.json');

const MAX_WORKER_BYTES = 64 * 1024 * 1024;
const MAX_STATIC_ASSET_COUNT = 20_000;
const MAX_STATIC_ASSET_BYTES = 25 * 1024 * 1024;

async function listFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nestedFiles = await Promise.all(entries.map(async (entry) => {
    const entryPath = path.join(directory, entry.name);
    return entry.isDirectory() ? listFiles(entryPath) : [entryPath];
  }));
  return nestedFiles.flat();
}

function formatBytes(bytes) {
  return `${(bytes / 1024 / 1024).toFixed(2)} MiB`;
}

async function readBundleMetrics() {
  const metafile = JSON.parse(await readFile(METAFILE_PATH, 'utf8'));
  const outputs = Object.entries(metafile.outputs ?? {})
    .filter(([outputPath]) => !outputPath.endsWith('.map'));

  if (outputs.length === 0) {
    throw new Error(`No Worker bundle outputs were recorded in ${METAFILE_PATH}.`);
  }

  let uncompressedBytes = 0;
  let gzipBytes = 0;

  for (const [outputPath, metadata] of outputs) {
    const absolutePath = path.isAbsolute(outputPath)
      ? outputPath
      : path.resolve(PROJECT_ROOT, outputPath);
    const contents = await readFile(absolutePath);
    const recordedBytes = Number(metadata.bytes);
    uncompressedBytes += Number.isFinite(recordedBytes) ? recordedBytes : contents.byteLength;
    gzipBytes += gzipSync(contents).byteLength;
  }

  return { uncompressedBytes, gzipBytes };
}

async function readAssetMetrics() {
  const files = await listFiles(ASSETS_DIRECTORY);
  let largestAsset = { bytes: 0, path: '' };

  for (const file of files) {
    const fileStats = await stat(file);
    if (fileStats.size > largestAsset.bytes) {
      largestAsset = {
        bytes: fileStats.size,
        path: path.relative(ASSETS_DIRECTORY, file),
      };
    }
  }

  return {
    count: files.length,
    largestAsset,
  };
}

const bundle = await readBundleMetrics();
const assets = await readAssetMetrics();
const metrics = {
  limits: {
    maxWorkerBytes: MAX_WORKER_BYTES,
    maxStaticAssetCount: MAX_STATIC_ASSET_COUNT,
    maxStaticAssetBytes: MAX_STATIC_ASSET_BYTES,
  },
  bundle,
  assets,
};

await mkdir(path.dirname(METRICS_PATH), { recursive: true });
await writeFile(METRICS_PATH, `${JSON.stringify(metrics, null, 2)}\n`);

console.log(`Worker bundle: ${formatBytes(bundle.uncompressedBytes)} uncompressed`);
console.log(`Worker bundle: ${formatBytes(bundle.gzipBytes)} gzip`);
console.log(`Static assets: ${assets.count}`);
console.log(
  `Largest static asset: ${formatBytes(assets.largestAsset.bytes)} (${assets.largestAsset.path || 'none'})`
);

if (bundle.uncompressedBytes >= MAX_WORKER_BYTES) {
  throw new Error(`Worker bundle must be smaller than ${formatBytes(MAX_WORKER_BYTES)}.`);
}

if (assets.count > MAX_STATIC_ASSET_COUNT) {
  throw new Error(`Static asset count exceeds the ${MAX_STATIC_ASSET_COUNT} free-plan limit.`);
}

if (assets.largestAsset.bytes > MAX_STATIC_ASSET_BYTES) {
  throw new Error(`A static asset exceeds the ${formatBytes(MAX_STATIC_ASSET_BYTES)} per-file limit.`);
}
