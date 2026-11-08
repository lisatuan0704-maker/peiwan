// v504 規則第十四批：小屋串門子（邀請好友來自己的小屋一起聊天、隨機拜訪別人的小屋；一間最多 4 人同時在）。可重複執行，不會重複套用。
// 1. house/<key>/vis：主人的開放設定 public／friends／private（存在自己的小屋紀錄裡，換裝置也記得）。
// 2. houseView/<key>：給客人看的「擺設快照」{layout,vis,at,name,n}，只有主人（與店員）能寫；不開放（private）時主人整筆刪掉。
//    誰能看（＝誰能進來）：主人、店員；有闆卡的老闆在 vis＝public 時都能，vis＝friends 時要在主人的好友名單裡（friends/<主人>/<自己>）。
//    layout 的檢查跟 house/<key>/layout 同一套（只能放商城有上架的小屋家具＋入住禮四件）。錢包、背包、私訊都不在這裡。
// 3. houseDir/<key>：隨機拜訪的名單 {at,n,on?}（on＝主人最近一次在小屋裡的時間），有闆卡的老闆都能列出來；
//    只有主人寫，而且同一次寫入後 houseView 必須是 public。
// 4. houseVisit/<主人>/<客人>：來玩紀錄 {name,at,like?}。客人只能寫自己那筆、而且要進得去那間小屋；主人可以刪。一人一筆＝一人最多一個讚。
// 5. houseRoom/<主人>/<座位 0～3>：現在在小屋裡的人 {k,name,i,j,f,at}，座位只有 4 個＝最多 4 人（主人也佔一個）。
//    坐下：只能寫自己的 key；座位要是空的、本來就是自己、或那個人超過 45 秒沒回報（斷線）；客人要進得去、沒被主人請出（10 分鐘內）、沒被主人封鎖。
//    起身：自己那個座位可以刪；主人可以請任何人離開（刪座位）。
// 6. houseKick/<主人>/<客人>：主人請人離開的時間，10 分鐘內那個人不能再坐下。主人寫；主人、店員、被請出的本人可以讀。
// 7. houseChat/<主人>/<訊息>：小屋裡的聊天 {f,n,x,s,at}。要正坐在那間小屋的座位 s 上、沒被禁言才能說話；只能新增；主人可以刪。
'use strict';
const fs=require('fs'),path=require('path');
const file=path.join(__dirname,'../../../security/database.rules.json');
const R=JSON.parse(fs.readFileSync(file,'utf8'));
const P=R.rules.peiwan;
const STAFF=`(auth != null && (auth.uid == root.child('peiwan/config/adminUid').val() || root.child('peiwan/links').child(auth.uid).child('type').exists()))`;
const owner=v=>`((auth != null && root.child('secureV1/members').child(auth.uid).child('active').val() == true) && root.child('secureV1/owners').child(${v}).val() == auth.uid && root.child('secureV1/members').child(auth.uid).child('key').val() == ${v})`;
const MEMBER=`(auth != null && root.child('secureV1/members').child(auth.uid).child('active').val() == true)`;
const VK=`root.child('secureV1/members').child(auth.uid).child('key').val()`;
// 進得去 <v> 這間小屋（vis 讀的是 base：houseView 現在存的那筆）
const canView=(base,v)=>`(${MEMBER} && (${base}.child('vis').val() == 'public' || (${base}.child('vis').val() == 'friends' && root.child('peiwan/friends').child(${v}).child(${VK}).exists())))`;
const HV="root.child('peiwan/houseView').child($o)";
const NOT_KICKED=`(!root.child('peiwan/houseKick').child($o).child(${VK}).exists() || root.child('peiwan/houseKick').child($o).child(${VK}).val() < now - 600000)`;
const NOT_BLOCKED=`!root.child('peiwan/blocks').child($o).child(${VK}).exists()`;
const NOT_MUTED=`(!root.child('peiwan/mutes').child(${VK}).exists() || (root.child('peiwan/mutes').child(${VK}).child('until').val() != -1 && root.child('peiwan/mutes').child(${VK}).child('until').val() < now))`;
const TSV='newData.isNumber() && newData.val() <= now + 60000';
const KEYV="newData.isString() && newData.val().matches(/^[A-Za-z0-9_-]{1,200}$/)";
const POS='newData.isNumber() && newData.val() >= -2 && newData.val() <= 30';
if(!P.house||!P.houseInv)throw Error('phase11 not applied');
if(!P.idle)throw Error('phase12 not applied');
if(P.houseView){console.log('phase14 already applied');process.exit(0);}

// ── 1. house/<key>/vis ──
P.house.$k.vis={'.validate':"newData.val() == 'public' || newData.val() == 'friends' || newData.val() == 'private'"};

// ── 2. houseView/<key> ──
P.houseView={
 $k:{
  '.read':`${STAFF} || ${owner('$k')} || ${canView('data','$k')}`,
  '.write':`${STAFF} || ${owner('$k')}`,
  '.validate':"!newData.exists() || ($k.matches(/^[A-Za-z0-9_-]{1,200}$/) && newData.hasChildren(['layout','vis','at']))",
  layout:JSON.parse(JSON.stringify(P.house.$k.layout)),
  vis:{'.validate':"newData.val() == 'public' || newData.val() == 'friends'"},
  at:{'.validate':TSV},
  name:{'.validate':'newData.isString() && newData.val().length <= 40'},
  n:{'.validate':'newData.isNumber() && newData.val() % 1 == 0 && newData.val() >= 0 && newData.val() <= 999'},
  $other:{'.validate':false}
 }
};

// ── 3. houseDir/<key> ──
P.houseDir={
 '.read':`${MEMBER} || ${STAFF}`,
 '.indexOn':['at','on'],
 $k:{
  '.write':`${STAFF} || ${owner('$k')}`,
  '.validate':"!newData.exists() || ($k.matches(/^[A-Za-z0-9_-]{1,200}$/) && newData.hasChildren(['at','n']) && newData.parent().parent().child('houseView').child($k).child('vis').val() == 'public')",
  at:{'.validate':TSV},
  on:{'.validate':TSV},
  n:{'.validate':'newData.isNumber() && newData.val() % 1 == 0 && newData.val() >= 0 && newData.val() <= 999'},
  $other:{'.validate':false}
 }
};

// ── 4. houseVisit/<主人>/<客人> ──
P.houseVisit={
 $o:{
  '.read':`${STAFF} || ${owner('$o')} || ${canView(HV,'$o')}`,
  $v:{
   '.write':`${STAFF} || (${owner('$o')} && !newData.exists()) || (newData.exists() && $v == ${VK} && $v != $o && ${canView(HV,'$o')})`,
   '.validate':"!newData.exists() || ($v.matches(/^[A-Za-z0-9_-]{1,200}$/) && newData.hasChildren(['name','at']))",
   name:{'.validate':'newData.isString() && newData.val().length >= 1 && newData.val().length <= 40'},
   at:{'.validate':TSV},
   like:{'.validate':'newData.isBoolean()'},
   $other:{'.validate':false}
  }
 }
};

// ── 5. houseRoom/<主人>/<座位> ──
{
 const SIT=`(newData.exists() && newData.child('k').val() == ${VK} && (${owner('$o')} || (${canView(HV,'$o')} && ${NOT_KICKED} && ${NOT_BLOCKED})) && (!data.exists() || data.child('k').val() == ${VK} || data.child('at').val() < now - 45000))`;
 const LEAVE=`(!newData.exists() && ${MEMBER} && data.child('k').val() == ${VK})`;
 P.houseRoom={
  $o:{
   '.read':`${STAFF} || ${owner('$o')} || ${canView(HV,'$o')}`,
   $s:{
    '.write':`${STAFF} || (${owner('$o')} && !newData.exists()) || ${LEAVE} || ${SIT}`,
    '.validate':"!newData.exists() || ($s.matches(/^[0-3]$/) && newData.hasChildren(['k','i','j','at']))",
    k:{'.validate':KEYV},
    name:{'.validate':'newData.isString() && newData.val().length <= 40'},
    i:{'.validate':POS},
    j:{'.validate':POS},
    f:{'.validate':'newData.val() == 1 || newData.val() == -1'},
    at:{'.validate':TSV},
    $other:{'.validate':false}
   }
  }
 };
}

// ── 6. houseKick/<主人>/<客人> ──
P.houseKick={
 $o:{
  '.read':`${STAFF} || ${owner('$o')}`,
  $v:{
   '.read':`$v == ${VK}`,
   '.write':`${STAFF} || ${owner('$o')}`,
   '.validate':`!newData.exists() || (${TSV})`
  }
 }
};

// ── 7. houseChat/<主人>/<訊息> ──
P.houseChat={
 $o:{
  '.read':`${STAFF} || ${owner('$o')} || ${canView(HV,'$o')}`,
  $m:{
   '.write':`${STAFF} || (${owner('$o')} && !newData.exists()) || (!data.exists() && newData.exists() && ${MEMBER} && newData.child('f').val() == ${VK} && root.child('peiwan/houseRoom').child($o).child(newData.child('s').val()).child('k').val() == ${VK} && ${NOT_MUTED})`,
   '.validate':"!newData.exists() || newData.hasChildren(['f','x','s','at'])",
   f:{'.validate':KEYV},
   n:{'.validate':'newData.isString() && newData.val().length <= 40'},
   x:{'.validate':'newData.isString() && newData.val().length >= 1 && newData.val().length <= 120'},
   s:{'.validate':"newData.isString() && newData.val().matches(/^[0-3]$/)"},
   at:{'.validate':TSV},
   $other:{'.validate':false}
  }
 }
};

fs.writeFileSync(file,JSON.stringify(R,null,2)+'\n');
console.log('phase14 applied: house visits & rooms (houseView/houseDir/houseVisit/houseRoom/houseKick/houseChat, house vis)');
