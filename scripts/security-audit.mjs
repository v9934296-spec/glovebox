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
const advisoryId = (via) => {
  const text = `${via.url ?? ''} ${via.title ?? ''}`;
  return [...allowedAdvisories].find((id) => text.includes(id)) ?? null;
};

function isAllowedOnly(name, seen = new Set()) {
  if (seen.has(name)) return false;
  const vuln = vulnerabilities[name];
  if (!vuln) return false;
  const nextSeen = new Set(seen);
  nextSeen.add(name);
  if (!Array.isArray(vuln.via) || vuln.via.length === 0) return false;
  return vuln.via.every((via) => {
    if (typeof via === 'string') return isAllowedOnly(via, nextSeen);
    return advisoryId(via) !== null;
  });
}

const blockers = Object.entries(vulnerabilities).filter(([, vuln]) =>
  (severityRank[vuln.severity] ?? 0) >= severityRank.high && !isAllowedOnly(vuln.name),
);

const allowedHigh = Object.entries(vulnerabilities)
  .filter(([, vuln]) => (severityRank[vuln.severity] ?? 0) >= severityRank.high && isAllowedOnly(vuln.name))
  .map(([name]) => name);

if (allowedHigh.length) {
  console.warn(`SECURITY EXCEPTION: ${allowedHigh.length} high-severity audit entries trace only to the two image-size no-fix advisories: ${allowedHigh.join(', ')}`);
  console.warn('Track upstream Expo/Metro/image-size and remove this exception as soon as a compatible patched release exists.');
}

if (blockers.length) {
  console.error('FAIL: unapproved high/critical production dependency vulnerabilities:');
  for (const [name, vuln] of blockers) console.error(`- ${name}: ${vuln.severity}`);
  process.exit(1);
}

console.log('OK: no unapproved high/critical production dependency vulnerabilities');
