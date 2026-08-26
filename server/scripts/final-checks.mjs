/** Final checks: duplicate punches in live DB + full typecheck → result file. */
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { writeFileSync } from 'node:fs';

const CWD = fileURLToPath(new URL('..', import.meta.url));
const out = [];

const dupEval = `Promise.all([import('./src/modules/attendance/attendance.model.ts'),import('./src/config/db.ts')]).then(async ([m,d])=>{await d.database.connect(); const dupes=await m.AttendanceModel.aggregate([{$group:{_id:{u:'$user',dt:'$date',t:'$type'},c:{$sum:1}}},{$match:{c:{$gt:1}}}]); console.log('DUPES:'+JSON.stringify(dupes)); await d.database.disconnect();process.exit(0)}).catch(e=>{console.error(e.message);process.exit(1)})`;

const dup = spawnSync(process.execPath, [fileURLToPath(new URL('../node_modules/tsx/dist/cli.mjs', import.meta.url)), '--eval', dupEval], { cwd: CWD, encoding: 'utf8', timeout: 60000 });
out.push(dup.stdout.split('\n').find((l) => l.startsWith('DUPES:')) ?? 'DUPES CHECK FAILED');
out.push(`dupExit=${dup.status}`);

const tsc = spawnSync(process.execPath, [fileURLToPath(new URL('../node_modules/typescript/bin/tsc', import.meta.url)), '--noEmit', '--pretty', 'false'], { cwd: CWD, encoding: 'utf8', timeout: 180000 });
out.push(tsc.status === 0 ? 'TYPECHECK: CLEAN ✓' : `TYPECHECK ERRORS:\n${tsc.stdout}`);

writeFileSync(new URL('../final-checks.txt', import.meta.url), out.join('\n'));
