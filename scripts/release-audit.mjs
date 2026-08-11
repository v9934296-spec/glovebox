import fs from 'node:fs';
import path from 'node:path';
const root=process.cwd();
const walk=d=>fs.readdirSync(d,{withFileTypes:true}).flatMap(e=>{const p=path.join(d,e.name);return e.isDirectory()&&!['node_modules','.git'].includes(e.name)?walk(p):e.isFile()&&/\.(ts|tsx|sql|json)$/.test(e.name)?[p]:[]});
const files=walk(root).filter(f=>!f.endsWith(path.join('scripts','release-audit.mjs')));let failed=false;function requireCheck(ok,msg){if(!ok){console.error(`FAIL: ${msg}`);failed=true;}else console.log(`OK: ${msg}`);}
const all=files.map(f=>fs.readFileSync(f,'utf8')).join('\n');
requireCheck(!all.includes('INSERT OR REPLACE'),'sync does not use SQLite REPLACE');
requireCheck(fs.existsSync('supabase/config.toml'),'Supabase function auth config is source-controlled');
requireCheck(fs.existsSync('supabase/migrations/0003_hardening.sql'),'cloud hardening migration exists');
requireCheck(fs.existsSync('lib/db/fuelRepo.ts'),'fuel logging repository exists');
requireCheck(fs.existsSync('lib/notifications/reminders.ts'),'notifications implementation exists');
requireCheck(fs.existsSync('supabase/functions/delete-account/index.ts'),'account deletion endpoint exists');
requireCheck(fs.existsSync('app/(auth)/reset-password.tsx'),'password recovery completion screen exists');
const pkg=JSON.parse(fs.readFileSync('package.json','utf8'));
requireCheck(pkg.dependencies['expo-network']?.startsWith('~55.'),'expo-network aligned to SDK 55');
requireCheck(pkg.dependencies['expo-sqlite']?.startsWith('~55.'),'expo-sqlite aligned to SDK 55');
requireCheck(pkg.dependencies['expo-notifications']?.startsWith('~55.'),'notifications aligned to SDK 55');
if(failed)process.exit(1);
