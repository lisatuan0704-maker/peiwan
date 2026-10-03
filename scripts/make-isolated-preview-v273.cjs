const fs=require('fs'),path=require('path');const root=path.resolve(__dirname,'..');let s=fs.readFileSync(path.join(root,'lobby.html'),'utf8');
s=s.replace('<head>','<head><base href="/work/release-v214/"><meta http-equiv="Content-Security-Policy" content="connect-src http://127.0.0.1:9273 ws://127.0.0.1:9273;"><script>localStorage.setItem("tt_me","guest");localStorage.setItem("tt_dc",JSON.stringify({id:"qa-guest",username:"隔離驗證",global_name:"隔離驗證"}));</script>');
s=s.replace(/const firebaseConfig\s*=\s*\{[\s\S]*?\};/,'const firebaseConfig={apiKey:"demo-key",projectId:"demo-tiny-tavern-v273",databaseURL:"http://127.0.0.1:9273?ns=demo-tiny-tavern-v273"};');
s=s.replace('db=firebase.database();','db=firebase.database();db.useEmulator("127.0.0.1",9273);');s=s.replace(/const ORDER_WEBHOOK='[^']*';/,"const ORDER_WEBHOOK='';");
fs.writeFileSync(path.resolve(root,'../../output/lobby-isolated-v273.html'),s);console.log('隔離預覽已建立；資料連線限本機 9273，外部通知已停用。');
