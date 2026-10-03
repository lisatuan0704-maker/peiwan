const fs=require('fs'),path=require('path'),crypto=require('crypto'),{spawnSync}=require('child_process');const root=path.resolve(__dirname,'..');process.chdir(root);
const files=fs.readdirSync('tests').filter(x=>x.endsWith('.cjs')).sort();const tracked=['lobby.html','lobby-ui/payment-safety.js','lobby-ui/order-flow.js','lobby-ui/membership.js','security/database.rules.v273.json',...files.map(x=>'tests/'+x)];
const hash=()=>crypto.createHash('sha256').update(tracked.map(p=>p+'\n'+fs.readFileSync(p,'utf8')).join('\n')).digest('hex');const initial=hash();const report={version:273,sourceHash:initial,startedAt:new Date().toISOString(),rounds:[],scope:'Local regression suite and real Firebase Database Emulator; excludes real bank transactions, production identity migration and prolonged multi-device load testing'};
for(let round=1;round<=3;round++){
 const tests=[];console.log('ROUND '+round+' START');
 for(const file of files){const at=Date.now(),r=spawnSync(process.execPath,['tests/'+file],{encoding:'utf8',timeout:90000});const ok=r.status===0;tests.push({file,ok,ms:Date.now()-at,stdout:r.stdout,stderr:r.stderr});console.log((ok?'PASS ':'FAIL ')+file);if(!ok){console.error(r.stderr||r.stdout);break;}}
 const passed=tests.length===files.length&&tests.every(t=>t.ok)&&hash()===initial;report.rounds.push({round,passed,tests});
 fs.writeFileSync(path.resolve(root,'../../output/verification-v273.json'),JSON.stringify(report,null,2));
 if(!passed){console.error('驗證未全通過，修正後必須重新跑三輪。');process.exit(1);}
 console.log('ROUND '+round+' ALL '+tests.length+' PASSED');
}
console.log('THREE CONSECUTIVE ROUNDS PASSED · '+initial);
