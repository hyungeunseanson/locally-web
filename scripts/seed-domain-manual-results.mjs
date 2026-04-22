import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { dirname, resolve } from 'path';

import * as ts from 'typescript';

const argv = process.argv.slice(2);

function getArgValue(flag) {
  const index = argv.indexOf(flag);
  if (index === -1) return null;
  return argv[index + 1] || null;
}

function parseDomainSelection(raw) {
  if (!raw) return [];

  return raw
    .split(',')
    .map((value) => Number(value.trim()))
    .filter((value) => Number.isInteger(value) && value > 0);
}

function ensureDir(path) {
  mkdirSync(path, { recursive: true });
}

async function loadDomainMatrixModule() {
  const manifestPath = resolve('tests/e2e/domainMatrix.ts');
  const source = readFileSync(manifestPath, 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ES2022,
      target: ts.ScriptTarget.ES2022,
    },
    fileName: manifestPath,
  });

  const dataUrl = `data:text/javascript;base64,${Buffer.from(compiled.outputText).toString('base64')}`;
  return import(dataUrl);
}

function pickRouteActors(domain, route) {
  if (route.includes('/admin') && domain.actors.includes('admin')) return ['admin'];
  if (route.includes('/host') && domain.actors.includes('host')) return ['host'];
  if (route.includes('/guest') && domain.actors.includes('guest')) return ['guest'];
  if (route.includes('/services') && domain.actors.includes('guest')) return ['guest'];
  if (route.includes('/proxy') && domain.actors.includes('guest')) return ['guest'];
  if (domain.actors.includes('public')) return ['public'];
  return [domain.actors[0]];
}

function buildChecksForDomain(domain) {
  const areas = ['copy', 'translation', 'ux', 'ui', 'a11y', 'tap-target', 'overflow', 'state'];
  const checks = [];

  for (const route of domain.canonicalRoutes) {
    const actors = pickRouteActors(domain, route);
    for (const actor of actors) {
      for (const locale of domain.locales) {
        for (const viewport of domain.viewports) {
          for (const area of areas) {
            checks.push({
              route,
              actor,
              locale,
              viewport,
              area,
              status: 'pending',
              note: '',
            });
          }
        }
      }
    }
  }

  return checks;
}

async function main() {
  const bundleId = getArgValue('--bundle');
  const directDomains = parseDomainSelection(getArgValue('--domain'));
  const output = getArgValue('--output');

  if (!bundleId && directDomains.length === 0) {
    console.error('Usage: node scripts/seed-domain-manual-results.mjs (--bundle <bundle-id> | --domain 12,1,2) --output <path>');
    process.exit(1);
  }

  if (!output) {
    console.error('Missing --output <path>');
    process.exit(1);
  }

  const matrixModule = await loadDomainMatrixModule();
  let selectedIds = directDomains;

  if (bundleId) {
    const bundle = matrixModule.DOMAIN_QA_BUNDLES.find((entry) => entry.id === bundleId);
    if (!bundle) {
      console.error(`Unknown domain bundle: ${bundleId}`);
      process.exit(1);
    }
    selectedIds = bundle.domains;
  }

  const selectedDomains = matrixModule.DOMAIN_MATRIX.filter((domain) =>
    selectedIds.includes(domain.id)
  ).sort((a, b) => selectedIds.indexOf(a.id) - selectedIds.indexOf(b.id));

  const result = {
    generatedAt: new Date().toISOString(),
    source: bundleId ? `bundle:${bundleId}` : `domains:${selectedIds.join(',')}`,
    domains: Object.fromEntries(
      selectedDomains.map((domain) => [
        String(domain.id),
        {
          status: 'pending',
          notes: [
            `Canonical routes: ${domain.canonicalRoutes.join(', ')}`,
            `Actors: ${domain.actors.join(', ')}`,
            `Locales: ${domain.locales.join(', ')}`,
            `Viewports: ${domain.viewports.join(', ')}`,
          ],
          artifacts: [],
          checks: buildChecksForDomain(domain),
        },
      ])
    ),
  };

  const outputPath = resolve(output);
  ensureDir(dirname(outputPath));
  writeFileSync(outputPath, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
  console.log(`[seed-manual-results] output=${outputPath}`);
  console.log(`[seed-manual-results] domains=${selectedIds.join(', ')}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : error);
  process.exit(1);
});
