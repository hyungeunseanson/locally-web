import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { spawnSync } from 'child_process';

import * as ts from 'typescript';

const argv = process.argv.slice(2);
const ALLOWED_MANUAL_STATUSES = new Set(['pending', 'pass', 'fail', 'n/a', 'unknown']);
const ALLOWED_CHECK_STATUSES = new Set(['pending', 'pass', 'fail', 'n/a', 'unknown']);

function hasFlag(flag) {
  return argv.includes(flag);
}

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

function timestampSlug(date = new Date()) {
  return date.toISOString().replace(/[:]/g, '-').replace(/\..+$/, 'Z');
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function writeTextFile(path, content) {
  ensureDir(dirname(path));
  writeFileSync(path, content, 'utf8');
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

function listAllSpecFiles() {
  return readdirSync(resolve('tests/e2e'))
    .filter((name) => name.endsWith('.spec.ts'))
    .map((name) => `tests/e2e/${name}`)
    .sort();
}

function validateMatrix(matrix) {
  const allSpecs = listAllSpecFiles();
  const seen = new Map();
  const duplicateAssignments = [];
  const unknownSpecs = [];

  for (const domain of matrix) {
    for (const spec of domain.specs) {
      if (!allSpecs.includes(spec)) {
        unknownSpecs.push({ domainId: domain.id, spec });
        continue;
      }

      if (seen.has(spec)) {
        duplicateAssignments.push({
          spec,
          firstDomainId: seen.get(spec),
          duplicateDomainId: domain.id,
        });
      } else {
        seen.set(spec, domain.id);
      }
    }
  }

  const unassignedSpecs = allSpecs.filter((spec) => !seen.has(spec));
  const assignedSpecCount = seen.size;

  return {
    allSpecCount: allSpecs.length,
    assignedSpecCount,
    duplicateAssignments,
    unknownSpecs,
    unassignedSpecs,
    pass:
      duplicateAssignments.length === 0 &&
      unknownSpecs.length === 0 &&
      unassignedSpecs.length === 0,
  };
}

function formatDomainList(domains) {
  const lines = [];
  lines.push('ID  Priority  Specs  Slug');
  lines.push('--  --------  ----  ----');

  for (const domain of domains) {
    lines.push(
      `${String(domain.id).padEnd(2)}  ${String(domain.priority).padEnd(8)}  ${String(domain.specs.length).padEnd(4)}  ${domain.slug}`
    );
  }

  return lines.join('\n');
}

function resolveBundleSelection({ rawBundle, matrixModule }) {
  if (!rawBundle) return { selectedDomains: null, selectedExternalBundle: null };

  const domainBundle = matrixModule.DOMAIN_QA_BUNDLES.find((bundle) => bundle.id === rawBundle) || null;
  if (domainBundle) {
    return {
      selectedDomains: domainBundle.domains,
      selectedExternalBundle: null,
    };
  }

  const externalBundle =
    matrixModule.EXTERNAL_QA_BUNDLES.find((bundle) => bundle.id === rawBundle) || null;
  if (externalBundle) {
    return {
      selectedDomains: null,
      selectedExternalBundle: externalBundle,
    };
  }

  throw new Error(`Unknown bundle: ${rawBundle}`);
}

function resolveProjectArgs(projectSet) {
  switch (projectSet) {
    case 'desktop':
      return ['--project=chromium'];
    case 'mobile':
      return ['--project=chromium-mobile'];
    case 'tablet':
      return ['--project=chromium-tablet'];
    case 'responsive':
    default:
      return [];
  }
}

function spawnCommand(command, args = [], options = {}) {
  return spawnSync(command, args, {
    stdio: 'inherit',
    env: {
      ...process.env,
      PLAYWRIGHT_HTML_OPEN: process.env.PLAYWRIGHT_HTML_OPEN || 'never',
    },
    ...options,
  });
}

function normalizeStatus(status, allowed, fallback = 'unknown') {
  if (typeof status !== 'string') return fallback;
  return allowed.has(status) ? status : fallback;
}

function deriveSignoffStatus({ autoStatus, manualStatus }) {
  if (autoStatus === 'fail' || manualStatus === 'fail') return 'red';
  if (autoStatus === 'pass' && manualStatus === 'pass') return 'green';
  if (autoStatus === 'pass' && ['pending', 'n/a', 'unknown'].includes(manualStatus)) return 'yellow';
  return 'pending';
}

function buildGateAssessment(domainReports) {
  const criticalHoldDomains = [12, 1, 2, 4, 11];
  const requiredGateDomains = [12, 1, 2, 4, 11, 13, 16, 17, 18];
  const publicGreenGateDomains = [3, 6, 14, 15, 16];
  const byId = new Map(domainReports.map((domain) => [domain.id, domain]));

  const selectedIds = domainReports.map((domain) => domain.id);
  const missingRequiredDomains = requiredGateDomains.filter((id) => !selectedIds.includes(id));
  const criticalRedDomains = criticalHoldDomains.filter((id) => byId.get(id)?.finalStatus === 'red');
  const requiredBelowYellow = requiredGateDomains.filter((id) => {
    const status = byId.get(id)?.finalStatus;
    return status != null && !['green', 'yellow'].includes(status);
  });
  const publicManualMissingForGreen = publicGreenGateDomains.filter((id) => {
    const domain = byId.get(id);
    return domain?.finalStatus === 'green' && domain.manual.status !== 'pass';
  });

  let status = 'incomplete';
  if (criticalRedDomains.length > 0) {
    status = 'hold';
  } else if (missingRequiredDomains.length === 0 && requiredBelowYellow.length === 0) {
    status = 'conditional-pass';
  }

  return {
    status,
    criticalRedDomains,
    requiredBelowYellow,
    missingRequiredDomains,
    publicManualMissingForGreen,
  };
}

function loadManualResults(path) {
  if (!path) return null;
  if (!existsSync(path)) {
    throw new Error(`Manual results file not found: ${path}`);
  }

  return readJson(path);
}

function summarizeManualChecks(checks) {
  const summary = {
    total: checks.length,
    byStatus: {},
    byArea: {},
    pendingCount: 0,
    passCount: 0,
    failCount: 0,
  };

  for (const check of checks) {
    const status = normalizeStatus(check?.status, ALLOWED_CHECK_STATUSES, 'unknown');
    const area = typeof check?.area === 'string' && check.area ? check.area : 'unknown';

    summary.byStatus[status] = (summary.byStatus[status] || 0) + 1;
    summary.byArea[area] = (summary.byArea[area] || 0) + 1;

    if (status === 'pending') summary.pendingCount += 1;
    if (status === 'pass') summary.passCount += 1;
    if (status === 'fail') summary.failCount += 1;
  }

  return summary;
}

function getManualDomainResult(manualResults, domainId) {
  if (!manualResults || !manualResults.domains) {
    return {
      status: 'pending',
      notes: [],
      artifacts: [],
      checks: [],
      summary: summarizeManualChecks([]),
    };
  }

  const result = manualResults.domains[String(domainId)] || manualResults.domains[domainId] || null;
  if (!result) {
    return {
      status: 'pending',
      notes: [],
      artifacts: [],
      checks: [],
      summary: summarizeManualChecks([]),
    };
  }

  const checks = Array.isArray(result.checks)
    ? result.checks.map((check) => ({
        ...check,
        status: normalizeStatus(check?.status, ALLOWED_CHECK_STATUSES, 'unknown'),
      }))
    : [];

  return {
    status: normalizeStatus(result.status, ALLOWED_MANUAL_STATUSES, 'unknown'),
    notes: Array.isArray(result.notes) ? result.notes : [],
    artifacts: Array.isArray(result.artifacts) ? result.artifacts : [],
    checks,
    summary: summarizeManualChecks(checks),
  };
}

function buildMarkdownReport(report) {
  const lines = [];
  lines.push(`# Domain QA Sign-off`);
  lines.push('');
  lines.push(`- Generated at: \`${report.generatedAt}\``);
  lines.push(`- Mode: \`${report.mode}\``);
  lines.push(`- Project set: \`${report.projectSet}\``);
  lines.push(`- Validation pass: \`${report.validation.pass}\``);
  lines.push(`- Selected domains: \`${report.selectedDomainIds.join(', ') || 'none'}\``);
  lines.push(`- Gate assessment: \`${report.gateAssessment.status}\``);
  if (report.externalBundle) {
    lines.push(`- External bundle: \`${report.externalBundle.id}\``);
  }
  lines.push('');

  lines.push(`## Gate assessment`);
  lines.push('');
  lines.push(`- Status: \`${report.gateAssessment.status}\``);
  lines.push(`- Critical red domains: \`${report.gateAssessment.criticalRedDomains.join(', ') || 'none'}\``);
  lines.push(`- Required domains below yellow: \`${report.gateAssessment.requiredBelowYellow.join(', ') || 'none'}\``);
  lines.push(`- Missing required domains in this run: \`${report.gateAssessment.missingRequiredDomains.join(', ') || 'none'}\``);
  lines.push(`- Public domains marked green without manual pass: \`${report.gateAssessment.publicManualMissingForGreen.join(', ') || 'none'}\``);
  lines.push('');

  if (report.validation.unassignedSpecs.length) {
    lines.push(`## Validation gaps`);
    lines.push('');
    for (const spec of report.validation.unassignedSpecs) {
      lines.push(`- Unassigned spec: \`${spec}\``);
    }
    lines.push('');
  }

  lines.push(`## Domain status`);
  lines.push('');
  for (const domain of report.domains) {
    lines.push(`### ${domain.id}. ${domain.name}`);
    lines.push(`- Auto: \`${domain.auto.status}\``);
    lines.push(`- Manual: \`${domain.manual.status}\``);
    lines.push(`- Final: \`${domain.finalStatus}\``);
    lines.push(`- Specs: \`${domain.specs.length}\``);
    lines.push(`- Canonical routes: ${domain.canonicalRoutes.map((route) => `\`${route}\``).join(', ')}`);
    lines.push(`- Actors: ${domain.actors.map((actor) => `\`${actor}\``).join(', ')}`);
    lines.push(`- Locales: ${domain.locales.map((locale) => `\`${locale}\``).join(', ')}`);
    lines.push(`- Viewports: ${domain.viewports.map((viewport) => `\`${viewport}\``).join(', ')}`);
    if (domain.auto.command) {
      lines.push(`- Auto command: \`${domain.auto.command}\``);
    }
    if (domain.manual.summary.total > 0) {
      lines.push(
        `- Manual checks: total \`${domain.manual.summary.total}\`, pending \`${domain.manual.summary.pendingCount}\`, pass \`${domain.manual.summary.passCount}\`, fail \`${domain.manual.summary.failCount}\``
      );
      lines.push(
        `- Manual areas: ${Object.entries(domain.manual.summary.byArea)
          .map(([area, count]) => `\`${area}:${count}\``)
          .join(', ')}`
      );
    }
    if (domain.manual.artifacts.length) {
      lines.push(`- Manual artifacts: ${domain.manual.artifacts.map((artifact) => `\`${artifact}\``).join(', ')}`);
    }
    if (domain.manual.notes.length) {
      lines.push(`- Manual notes: ${domain.manual.notes.join(' | ')}`);
    }
    lines.push('');
  }

  if (report.externalBundle) {
    lines.push(`## External bundle`);
    lines.push('');
    lines.push(`- Bundle: \`${report.externalBundle.id}\``);
    lines.push(`- Command: \`${report.externalBundle.command}\``);
    lines.push(`- Status: \`${report.externalBundle.status}\``);
    lines.push('');
  }

  return `${lines.join('\n')}\n`;
}

async function main() {
  const rawBundle = getArgValue('--bundle');
  const rawDomains = getArgValue('--domain');
  const run = hasFlag('--run');
  const listDomains = hasFlag('--list-domains');
  const validateOnly = hasFlag('--validate');
  const writeDocReport = hasFlag('--write-doc-report');
  const projectSet = getArgValue('--project-set') || 'responsive';
  const manualResultsPath = getArgValue('--manual-results');

  const matrixModule = await loadDomainMatrixModule();
  const validation = validateMatrix(matrixModule.DOMAIN_MATRIX);

  if (listDomains) {
    console.log(formatDomainList(matrixModule.DOMAIN_MATRIX));
    return;
  }

  if (validateOnly) {
    console.log(
      JSON.stringify(
        {
          validation,
          domainCount: matrixModule.DOMAIN_MATRIX.length,
          externalBundleCount: matrixModule.EXTERNAL_QA_BUNDLES.length,
        },
        null,
        2
      )
    );

    if (!validation.pass) {
      process.exit(1);
    }
    return;
  }

  if (!validation.pass) {
    console.error('Domain matrix validation failed. Run with --validate for details.');
    process.exit(1);
  }

  const { selectedDomains: bundleDomains, selectedExternalBundle } = resolveBundleSelection({
    rawBundle,
    matrixModule,
  });

  const directDomainSelection = parseDomainSelection(rawDomains);
  const selectedDomainIds = selectedExternalBundle
    ? []
    : directDomainSelection.length
      ? directDomainSelection
      : bundleDomains || [...matrixModule.DOMAIN_PRIORITY_ORDER];

  const selectedDomains = matrixModule.DOMAIN_MATRIX.filter((domain) =>
    selectedDomainIds.includes(domain.id)
  ).sort((a, b) => selectedDomainIds.indexOf(a.id) - selectedDomainIds.indexOf(b.id));

  const manualResults = loadManualResults(manualResultsPath);
  const generatedAt = new Date().toISOString();
  const reportStamp = timestampSlug(new Date());
  const reportDir = resolve(`test-results/domain-qa/${reportStamp}`);
  const archiveDir = resolve(`docs/qa/runs/archive/${reportStamp}`);
  ensureDir(reportDir);
  ensureDir(archiveDir);

  let externalBundleReport = null;
  if (selectedExternalBundle) {
    const bundleResult = {
      id: selectedExternalBundle.id,
      command: selectedExternalBundle.command,
      status: run ? 'running' : 'planned',
      exitCode: null,
    };

    if (run) {
      const execution = spawnCommand(selectedExternalBundle.command, [], { shell: true });
      bundleResult.status = execution.status === 0 ? 'pass' : 'fail';
      bundleResult.exitCode = execution.status;
    }

    externalBundleReport = bundleResult;
  }

  const domainReports = [];
  for (const domain of selectedDomains) {
    const manual = getManualDomainResult(manualResults, domain.id);
    const projectArgs = resolveProjectArgs(projectSet);
    const commandArgs = [
      'playwright',
      'test',
      ...domain.specs,
      '--config=playwright.domain-qa.config.ts',
      ...projectArgs,
    ];
    const commandString = `npx ${commandArgs.join(' ')}`;

    const auto = {
      status: run ? 'running' : 'planned',
      command: commandString,
      exitCode: null,
      startedAt: null,
      finishedAt: null,
    };

    if (run) {
      auto.startedAt = new Date().toISOString();
      const execution = spawnCommand('npx', commandArgs);
      auto.finishedAt = new Date().toISOString();
      auto.exitCode = execution.status;
      auto.status = execution.status === 0 ? 'pass' : 'fail';
    }

    if (!run) {
      auto.status = 'planned';
    }

    domainReports.push({
      ...domain,
      auto,
      manual,
      finalStatus: deriveSignoffStatus({
        autoStatus: auto.status,
        manualStatus: manual.status,
      }),
      residualGaps: [
        ...(auto.status === 'planned' ? ['Automated run has not been executed yet.'] : []),
        ...(manual.status === 'pending' ? ['Manual checklist has not been signed off yet.'] : []),
        ...(manual.status === 'pass' && manual.summary.pendingCount > 0
          ? ['Manual checklist is marked pass but still contains pending checks.']
          : []),
        ...(manual.summary.failCount > 0 && manual.status !== 'fail'
          ? ['Manual checklist contains failed checks but the domain is not marked fail.']
          : []),
      ],
    });
  }

  const report = {
    schemaVersion: 1,
    generatedAt,
    mode: run ? 'run' : 'plan-only',
    projectSet,
    selectedDomainIds,
    validation,
    externalBundle: externalBundleReport,
    domains: domainReports,
    gateAssessment: buildGateAssessment(domainReports),
  };

  writeTextFile(resolve(reportDir, 'summary.json'), `${JSON.stringify(report, null, 2)}\n`);

  const markdown = buildMarkdownReport(report);
  writeTextFile(resolve(reportDir, 'summary.md'), markdown);
  writeTextFile(resolve(archiveDir, 'summary.json'), `${JSON.stringify(report, null, 2)}\n`);
  writeTextFile(resolve(archiveDir, 'summary.md'), markdown);

  if (writeDocReport) {
    const dailyDocReportName = `${generatedAt.slice(0, 10)}-domain-signoff.md`;
    const stampedDocReportName = `${reportStamp}-domain-signoff.md`;
    writeTextFile(resolve(`docs/qa/runs/${dailyDocReportName}`), markdown);
    writeTextFile(resolve(`docs/qa/runs/${stampedDocReportName}`), markdown);
  }

  console.log(`[domain-qa] reportDir=${reportDir}`);
  console.log(`[domain-qa] archiveDir=${archiveDir}`);
  console.log(`[domain-qa] domains=${selectedDomainIds.join(', ') || 'none'}`);
  if (selectedExternalBundle) {
    console.log(`[domain-qa] externalBundle=${selectedExternalBundle.id}`);
  }

  const hasFailure =
    (externalBundleReport && externalBundleReport.status === 'fail') ||
    domainReports.some((domain) => domain.auto.status === 'fail');

  process.exit(hasFailure ? 1 : 0);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : error);
  process.exit(1);
});
