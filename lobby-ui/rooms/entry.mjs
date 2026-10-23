import {createRoomClient,createTransport} from './room-client.mjs';
import {createFirebaseAdapter} from './firebase-client.mjs';
import {createPresencePublisher,createServerClock} from './presence-publisher.mjs';
import {watchPublicRooms} from './room-directory.mjs';
import {mountRoomSelector} from './room-selector.mjs';
import {createChatComposer} from './chat-composer.mjs';
import {beginVoiceLogin} from '../voice-rehearsal.mjs?v=353';
const API='https://api.tinytavern.tw';
const entry=document.createElement('button');entry.id='roomEntry';entry.type='button';entry.textContent='大廳選單 ▾';entry.setAttribute('aria-haspopup','dialog');
const dialog=document.createElement('dialog');dialog.id='roomDialog';dialog.setAttribute('aria-label','大廳選單');
dialog.innerHTML='<div class="room-top"><div><small>TAVERN SPACES</small><h2>切換大廳</h2></div><button class="room-close" aria-label="關閉大廳選單">×</button></div><div class="room-body"><div class="room-original"><div><strong>酒館大廳</strong><p>大家平常相遇的地方</p></div><button type="button" id="roomOriginal">目前所在</button></div><p class="room-access-note" role="status">登入 Discord 後，可切換分流或建立私人大廳。</p><button type="button" class="room-login">登入 Discord</button><div id="roomPicker"></div><p class="room-rules">私人大廳最多 12 人，有效 12 小時。每人同時可建立一間；只有持有邀請碼的人能加入。離開前記得複製邀請碼，之後可用同一組邀請碼回來。</p></div>';
document.body.append(entry,dialog);
const note=dialog.querySelector('.room-access-note'),login=dialog.querySelector('.room-login'),original=dialog.querySelector('#roomOriginal');
let client=null,roomAuth=null,clock=null,publisher=null,bootstrapPending=null,identity=null,room=null,stopDirectory=()=>{},epoch=0;
let availableRooms=['02','03'].map(n=>({id:'public-'+n,title:'公共大廳 '+n,count:0,capacity:30,available:false}));
const errors={SERVICE_NOT_ACTIVATED:'房間服務尚未開放，目前可先使用酒館大廳。',ACCOUNT_REQUIRED:'這個帳號的角色綁定尚未確認，請聯絡掌櫃。',CHARACTER_UNAVAILABLE:'請先建立角色，再進入大廳。',CHARACTER_MISMATCH:'目前角色與登入帳號不一致，請重新整理後再試。',SESSION_IN_USE:'這個帳號正在另一個分頁或裝置的房間中，請先離開該房間。',PLAYER_MUTED:'你目前被禁言，暫時無法傳送訊息。',AUTH_REQUIRED:'請先登入 Discord，再選擇大廳。',AUTH_CHANGED:'帳號已切換，請重新整理後再試。',OFFLINE:'房間連線暫時中斷，請稍後再試。'};
const fail=e=>{if(TTRoomWorld.active){original.disabled=false;original.textContent='返回酒館大廳'}note.textContent=errors[e.code||e.message]||'房間連線暫時中斷，請稍後重試。';window.toast?.(note.textContent)};
const picker=mountRoomSelector(dialog.querySelector('#roomPicker'),{
 joinPublic:async id=>{await bootstrap();return client.joinPublic(id)},
 createPrivate:async title=>{await bootstrap();return client.createPrivate(title)},
 joinPrivate:async code=>{await bootstrap();return client.joinPrivate(code)},onEntered:()=>{dialog.close();window.gClose?.('setM');}
});
picker.update(availableRooms,null);
function place(){const settings=document.querySelector('#setM .tuning-controls');if(settings&&entry.parentElement!==settings)settings.append(entry);}
place();addEventListener('resize',place);
new MutationObserver(place).observe(document.body,{attributes:true,attributeFilter:['class']});
function authReady(auth){return new Promise((resolve,reject)=>{let stop=()=>{};stop=auth.onAuthStateChanged(u=>{queueMicrotask(stop);resolve(u)},reject)})}
async function bootstrap(){
 if(bootstrapPending)return bootstrapPending;if(client)return client;
 bootstrapPending=(async()=>{
  const user=firebase.auth().currentUser,version=epoch;
  if(!user?.uid?.startsWith('discord_'))throw Error('AUTH_REQUIRED');
  note.textContent='正在確認帳號與房間連線…';
  const app=firebase.apps.find(a=>a.name==='tavern-rooms')||firebase.initializeApp(firebase.app().options,'tavern-rooms');
  roomAuth=app.auth();await roomAuth.setPersistence(firebase.auth.Auth.Persistence.SESSION);
  const previous=await authReady(roomAuth);
  const token=await (previous?.uid===user.uid?previous:user).getIdToken();
  const response=await fetch(API+'/v1/rooms/session',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:'{}',credentials:'omit',redirect:'error',signal:AbortSignal.timeout(15000)});
  const result=await response.json();if(!response.ok)throw Error(result.error);
  if(epoch!==version||firebase.auth().currentUser?.uid!==user.uid)throw Error('AUTH_CHANGED');
  if(result.uid!==user.uid||result.key!==TTRoomWorld.ownKey())throw Error('CHARACTER_MISMATCH');
  await roomAuth.signInWithCustomToken(result.token);
  if(epoch!==version||firebase.auth().currentUser?.uid!==user.uid)throw Error('AUTH_CHANGED');
  identity={uid:result.uid,key:result.key,character:result.character};
  try{const saved=JSON.parse(sessionStorage.getItem('tt_room_invite_'+identity.uid));if(saved?.until>Date.now())dialog.querySelector('#private-code').value=saved.code}catch{}

  const database=app.database();
  const adapter=createFirebaseAdapter({database,getUid:()=>roomAuth.currentUser?.uid,serverTimestamp:firebase.database.ServerValue.TIMESTAMP});
  const transport=createTransport({baseUrl:API,getToken:async()=>{if(firebase.auth().currentUser?.uid!==identity?.uid)throw Error('AUTH_CHANGED');return roomAuth.currentUser?.getIdToken()}});
  client=createRoomClient({
   request:async(path,body)=>{
    const r=await transport(path,body);
    if(r.code){try{sessionStorage.setItem('tt_room_invite_'+identity.uid,JSON.stringify({code:r.code,until:Date.now()+12*60*60*1000}));dialog.querySelector('#private-code').value=r.code}catch{}}
    if(path==='/v1/rooms'&&r.roomId){let timer;try{await Promise.race([TTRoomWorld.enter(identity),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('OFFLINE')),12000)})])}finally{clearTimeout(timer)}}return r;
   },
   watch:adapter.watch,onSnapshot:s=>{if(TTRoomWorld.active)TTRoomWorld.apply(s)},onError:fail,
   onState:s=>{
    if(room!==(s.room?.roomId||null)){
     room=s.room?.roomId||null;publisher?.dispose();publisher=null;TTRoomWorld.switchRoom(room);
     if(room){const id=room;publisher=createPresencePublisher({publish:p=>adapter.publish(id,p),onError:fail,minInterval:150});publisher.setConnected(clock?.isConnected()??true)}
     picker.update(availableRooms,room);original.disabled=!TTRoomWorld.active;original.textContent=TTRoomWorld.active?'返回酒館大廳':'目前所在';
     entry.textContent=room?.startsWith('private-')?'私人大廳 ▾':room?'公共大廳 '+room.slice(-2)+' ▾':'大廳選單 ▾';
     note.textContent=room?'目前在「'+(s.room.title||'房間')+'」。':TTRoomWorld.active?'房間已離開或連線失效，可重新加入，或返回酒館大廳。':'請選擇大廳或建立私人房間。';
    }
   }
  });
  await new Promise((resolve,reject)=>{
   const timer=setTimeout(()=>reject(Error('OFFLINE')),12000);
   clock=createServerClock(database,{onConnection:v=>{client?.setConnected(v);publisher?.setConnected(v);if(v){clearTimeout(timer);resolve()}}});
  });
  stopDirectory=watchPublicRooms(database,list=>{availableRooms=list.filter(r=>r.id!=='public-01');picker.update(availableRooms,room)},{now:clock.now,onError:fail});
  const composer=createChatComposer({send:(text,id)=>client.sendMessage(text,id),getRoom:()=>room,notify:text=>window.toast?.(text)});
  window.TTRoomSession={get active(){return TTRoomWorld.active},offer:p=>publisher?.offer(p),send:(text,input,sticker)=>{void composer.submit(text,input,{sticker:!!sticker});return true}};
  login.hidden=true;note.textContent='已連線，可以選擇公共或私人大廳。';return client;
 })().catch(e=>{publisher?.dispose();client?.dispose();clock?.dispose();stopDirectory();client=null;fail(e);throw e}).finally(()=>{bootstrapPending=null});
 return bootstrapPending;
}
original.disabled=true;
original.onclick=async()=>{original.disabled=true;try{if(client?.state().connected)await client.leave();location.assign('lobby.html')}catch(e){original.disabled=false;fail(e)}};
entry.onclick=()=>{dialog.showModal();if(firebase.auth().currentUser?.uid?.startsWith('discord_'))void bootstrap().catch(()=>{})};
login.onclick=beginVoiceLogin;dialog.querySelector('.room-close').onclick=()=>dialog.close();
dialog.addEventListener('click',e=>{if(e.target===dialog){const b=dialog.getBoundingClientRect();if(e.clientX<b.left||e.clientX>b.right||e.clientY<b.top||e.clientY>b.bottom)dialog.close()}});
dialog.addEventListener('keydown',e=>e.stopPropagation());dialog.addEventListener('keyup',e=>e.stopPropagation());
firebase.auth().onAuthStateChanged(user=>{
 login.hidden=!!user?.uid?.startsWith('discord_');
 if(identity&&user?.uid!==identity.uid){epoch++;publisher?.dispose();client?.dispose();clock?.dispose();stopDirectory();client=null;identity=null;void roomAuth?.signOut();
  if(TTRoomWorld.active){note.textContent='帳號已切換，請返回酒館大廳。';if(!dialog.open)dialog.showModal();original.disabled=false;original.onclick=()=>location.assign('lobby.html')}
 }
});
addEventListener('pagehide',()=>{publisher?.dispose();client?.dispose();clock?.dispose();stopDirectory()},{once:true});
