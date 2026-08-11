import { spawnSync } from 'node:child_process';

const allowedAdvisories = new Set([
  'GHSA-w3rx-r6r6-pgpr', // image-size ICNS infinite-loop DoS; no patched release as of 2026-08-11
  'GHSA-5p2g-fcmc-qvqq', // image-size JXL/HEIF infinite-loop DoS; no patched release as of 2026-08-11
]);
const severityRank = { low: 1, moderate: 2, high: 3, critical: 4 };

const audit = spawnSync('npm', ['audit', '--omit=dev', '--json'], { encoding: 'utf8' });
let report;
try {
  report = JSON.parse(audit.stdout || '{}');
} catch {
  console.error('FAIL: npm audit did not return parseable JSON');
  if (audit.stderr) console.error(audit.stderr.trim());
  process.exit(1);
}

if (report.error) {
  console.error(`FAIL: npm audit error: ${report.error.summary ?? report.error.message ?? 'unknown error'}`);
  process.exit(1);
}

const vulnerabilities = report.vulnerabilities ?? {};
const directAdvisories = [];
for (const [packageName, vuln] of Object.entries(vulnerabilities)) {
  for (const via of Array.isArray(vuln.via) ? vuln.via : []) {
    if (typeof via === 'string') continue; // propagated dependency edge, not a distinct advisory
    const rank = severityRank[via.severity ?? vuln.severity] ?? 0;
    if (rank >= severityRank.high) directAdvisories.push({ packageName, ...via });
  }
}

const advisoryId = (advisory) => {
  const text = `${advisory.url ?? ''} ${advisory.title ?? ''}`;
  return [...allowedAdvisories].find((id) => text.includes(id)) ?? null;
};
const blockers = directAdvisories.filter((advisory) => advisoryId(advisory) === null);
const allowed = directAdvisories.filter((advisory) => advisoryId(advisory) !== null);

if (allowed.length) {
  const ids = [...new Set(allowed.map((a) => advisoryId(a)).filter(Boolean))];
  console.warn(`SECURITY EXCEPTION: ${ids.join(', ')} are currently allowlisted because GitHub reports no patched image-size release.`);
  console.warn('Track upstream Expo/Metro/image-size and remove this exception as soon as a compatible patched release exists.');
}

if (blockers.length) {
  console.error('FAIL: unapproved high/critical production dependency advisories:');
  for (const advisory of blockers) console.error(`- ${advisory.packageName}: ${advisory.severity ?? 'high'} · ${advisory.title ?? advisory.url ?? 'unknown advisory'}`);
  process.exit(1);
}

console.log('OK: no unapproved high/critical production dependency vulnerabilities');
