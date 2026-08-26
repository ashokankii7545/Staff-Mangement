/**
 * BOOT VERIFIER – one-shot end-to-end smoke test.
 *   node scripts/verify-boot.mjs
 * Steps: free port → spawn dev server → poll /health → assert GraphQL flows
 * (public, authenticated, bad-token) → kill process tree → print PASS/FAIL.
 */
import { spawn, execSync } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { appendFileSync, writeFileSync } from 'node:fs';

const RESULT_FILE = new URL('../verify-result.txt', import.meta.url);
writeFileSync(RESULT_FILE, ''); // reset

/** Every log line goes to BOTH the console and the result file. */
const report = (line) => {
  console.log(line);
  appendFileSync(RESULT_FILE, `${line}\n`);
};


const CWD = fileURLToPath(new URL('..', import.meta.url));
/** Run the dev server via tsx's CLI directly – no .cmd shim / shell needed. */
const TSX_CLI = fileURLToPath(new URL('../node_modules/tsx/dist/cli.mjs', import.meta.url));
const BASE = 'http://localhost:8080';
let serverProc = null;
const failures = [];

const check = (name, ok, detail = '') => {
  report(`${ok ? '✅ PASS' : '❌ FAIL'}  ${name}${detail ? ` → ${detail}` : ''}`);
  if (!ok) failures.push(name);
};

/** Kill anything squatting on :8080 (previous zombie test servers). */
function freePort() {
  try {
    const out = execSync('netstat -ano | findstr :8080 | findstr LISTENING', {
      encoding: 'utf8',
    });
    const pids = [...new Set(out.trim().split('\n').map((l) => l.trim().split(/\s+/).pop()))];
    for (const pid of pids) {
      if (pid && /^\d+$/.test(pid)) {
        console.log(`🧹 Killing stale PID ${pid} holding :8080`);
        execSync(`taskkill /T /F /PID ${pid}`, { stdio: 'ignore' });
      }
    }
  } catch {
    /* findstr found nothing – port already free */
  }
}

async function gql(query, token, variables) {
  const res = await fetch(`${BASE}/graphql`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ query, ...(variables ? { variables } : {}) }),
  });
  return res.json();
}

async function waitForServer() {
  for (let i = 0; i < 30; i++) {
    try {
      const res = await fetch(`${BASE}/health`);
      if (res.ok) return res.json();
    } catch {
      /* not up yet */
    }
    await sleep(1000);
  }
  throw new Error('server never became healthy');
}

freePort();

serverProc = spawn(process.execPath, [TSX_CLI, 'src/server.ts'], {
  cwd: CWD,
  stdio: ['ignore', 'pipe', 'pipe'],
});
serverProc.stdout.on('data', () => {});
serverProc.stderr.on('data', () => {});

try {
  const health = await waitForServer();
  check('/health responds', health.status === 'ok' && health.dbConnected === true, JSON.stringify(health));

  // 1. Public query
  const pub = await gql('{ offices { id name } }');
  check('public offices query', Array.isArray(pub?.data?.offices), `${pub?.data?.offices?.length ?? 0} site(s)`);

  // 2. Anonymous access to protected field must be rejected with a CODE
  const anon = await gql('{ settings { organizationName } }');
  check(
    'protected field rejects anonymous',
    anon?.errors?.[0]?.extensions?.code === 'UNAUTHENTICATED',
    anon?.errors?.[0]?.extensions?.code,
  );

  // 3. Real login against seeded admin
  const login = await gql(
    'mutation($id:String!,$pw:String!){ login(employeeId:$id,password:$pw){ token user{ id role isActive approvalStatus } } }',
    null,
    { id: 'ADMIN001', pw: 'admin123' },
  );
  const payload = login?.data?.login;
  check(
    'login returns token + APPROVED admin',
    Boolean(payload?.token) &&
      payload?.user?.role === 'ADMIN' &&
      payload?.user?.approvalStatus === 'APPROVED',
  );

  // 4. Authenticated query with the minted token
  const me = await gql(
    '{ me { id email role leaveBalances { casual sick earned } } unreadNotificationsCount }',
    payload?.token,
  );
  check(
    'authenticated me + notifications',
    Boolean(me?.data?.me?.id) && typeof me?.data?.unreadNotificationsCount === 'number',
    `email=${me?.data?.me?.email}`,
  );

  // 5. Garbage token must be anonymous (never a crash)
  const bad = await gql('{ me { id } }', 'not-a-real-token');
  check('garbage token handled safely', bad?.errors?.[0]?.extensions?.code === 'UNAUTHENTICATED');

  // 6. Unknown route → JSON 404 (not HTML)
  const nf = await fetch(`${BASE}/nope`);
  const nfBody = await nf.json();
  check('JSON 404 fallback', nf.status === 404 && nfBody?.errors?.[0]?.message === 'Route not found.');
} catch (err) {
  check('suite completed', false, err.message);
} finally {
  if (serverProc?.pid) {
    try {
      execSync(`taskkill /T /F /PID ${serverProc.pid}`, { stdio: 'ignore' });
    } catch {
      /* already gone */
    }
  }
}

report(
  failures.length === 0
    ? '\n🎉 ALL CHECKS PASSED'
    : `\n💥 ${failures.length} CHECK(S) FAILED: ${failures.join(', ')}`,
);
process.exit(failures.length === 0 ? 0 : 1);
