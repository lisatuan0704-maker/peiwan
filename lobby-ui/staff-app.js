/* v524 後台登入另存一格：掌櫃後台、冒險者手札、面試控制台、時裝調整室、客服台都用具名的 'tt-staff' Firebase app。
   以前後台跟大廳共用預設 app，登入存在同一格；同一個瀏覽器登入後台，就會把大廳的 Discord 客人登入蓋掉，
   大廳之後寫私訊未讀、錢包……全部被資料庫規則擋下（規則只認客人自己的登入）。
   用法：在 firebase SDK 之後載入，頁面用 ttStaffApp(firebaseConfig) 取代 firebase.initializeApp(firebaseConfig)，
   之後一律用這個 app 的 .auth()／.database()，不要再呼叫 firebase.auth()／firebase.database()。 */
(function(root){
'use strict';
const NAME='tt-staff';
function firstUser(auth){return new Promise(res=>{const stop=auth.onAuthStateChanged(u=>{stop();res(u)},()=>{stop();res(null)})})}
/* 舊版留下的後台登入（帳號密碼登入、存在預設 app）搬到 tt-staff，再把預設那格登出還給大廳。
   客人的 Discord 登入（自訂憑證，沒有 password 這種登入方式）一律不動。 */
function adopt(fb,app,config){
  let def;
  try{def=fb.apps.find(a=>a.name==='[DEFAULT]')||fb.initializeApp(config);}catch(e){return Promise.resolve();}
  return Promise.all([firstUser(def.auth()),firstUser(app.auth())]).then(async([old,cur])=>{
    if(!old||!(old.providerData||[]).some(p=>p&&p.providerId==='password'))return;
    if(!cur)await app.auth().updateCurrentUser(old);
    await def.auth().signOut();
  }).catch(e=>{try{console.warn('[後台登入搬家]',e);}catch(_){}});
}
function ttStaffApp(config){
  const fb=root.firebase;
  let app=fb.apps.find(a=>a.name===NAME);
  if(app)return app;
  app=fb.initializeApp(config,NAME);
  ttStaffApp.ready=adopt(fb,app,config);
  return app;
}
ttStaffApp.ready=Promise.resolve();
root.ttStaffApp=ttStaffApp;
})(window);
