/* v432 冒險者店內名稱（蕪／縭／桃）。訂單與帳號資料仍保留舊名稱快照（大卡／小mo／Caboo…），
   所有給客人、冒險者、店長看的地方都透過這裡換成店內名稱；不改資料，配對與查詢照舊。 */
(function(root){'use strict';
const BY_CID={'-OxY46ezlpnRt64hUIw9':'蕪','-OxY7C4vDkgsr1zcyWbk':'縭','-OzbfbQcF6J6fIR6YYGh':'桃'};
const LEGACY={'caboo':'蕪','卡布':'蕪','大卡':'縭','小mo':'桃','陪玩':'冒險者','接單陪玩':'冒險者','陪陪':'冒險者'};
function display(name,cid,fallback){
 if(typeof cid==='string'&&BY_CID[cid])return BY_CID[cid];
 const raw=String(name??'').trim();
 return LEGACY[raw.toLowerCase()]||raw||fallback||'';
}
// 文字裡出現的舊名稱（例如店長手寫的備註、舊信件標題）也一併換掉。
function text(s){return String(s??'').replace(/Caboo|卡布|大卡|小mo/gi,m=>LEGACY[m.toLowerCase()]||m);}   // 只換名字，不動一般文字裡的「陪玩」
root.TTStaffNames={display,text,BY_CID,LEGACY};
})(window);
