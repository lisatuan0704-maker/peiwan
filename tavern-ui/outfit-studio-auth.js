/* 沿用掌櫃登入；本頁只讀取管理員識別，不寫入商店或會員資料。 */
(()=>{const $=id=>document.getElementById(id);const config={
  apiKey: "AIzaSyCXUrJCDqAuB7LmrZhp8SCYM6tVLXWDevc",
  authDomain: "my-shop-0520.firebaseapp.com",
  databaseURL: "https://my-shop-0520-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "my-shop-0520",
  storageBucket: "my-shop-0520.firebasestorage.app",
  messagingSenderId: "430482271005",
  appId: "1:430482271005:web:967059c91a9b7970bdcff4",
  measurementId: "G-NN7HQ5W8T1"
};let owner=null,loaded=false,started=false;firebase.initializeApp(config);const auth=firebase.auth();
function check(){const user=auth.currentUser;if(!owner||!user||user.uid!==owner){$('studio').hidden=true;$('gate').hidden=false;return;} $('studio').hidden=false;$('gate').hidden=true;if(!loaded){loaded=true;window.TTStudioOwner=user.uid;const s=document.createElement('script');s.src='outfit-studio.js?v=281';s.onerror=()=>{$('authStatus').textContent='調整室載入失敗，請重新整理。';$('gate').hidden=false;};document.body.append(s);}}
firebase.database().ref('peiwan/config/adminUid').once('value').then(s=>{owner=s.val();$('authStatus').textContent=owner?'請登入掌櫃帳號。':'尚未設定掌櫃帳號，請先到管理後台設定。';check();}).catch(()=>{$('authStatus').textContent='無法確認掌櫃身分，請稍後重新整理。';});
auth.onAuthStateChanged(check);$('login').onsubmit=async e=>{e.preventDefault();if(started)return;started=true;const b=e.target.querySelector('button');b.disabled=true;try{if(!owner)throw Error();let u=$('user').value.trim();const email=u.includes('@')?u:u.toLowerCase()+'@peiwan-tavern.com';const r=await auth.signInWithEmailAndPassword(email,$('password').value);$('password').value='';if(r.user.uid!==owner){await auth.signOut();$('authStatus').textContent='這不是掌櫃帳號。';}else check();}catch{$('authStatus').textContent='登入未完成，請檢查帳號、密碼與網路。';}finally{b.disabled=false;started=false;}};$('lock').onclick=()=>auth.signOut();})();