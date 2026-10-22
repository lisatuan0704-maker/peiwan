(function(root){
'use strict';
const NEW_CARD='tt_created_card_v334';
function cleanUrl(){const url=new URL(root.location.href);if(url.searchParams.has('me')){url.searchParams.delete('me');root.history.replaceState(null,'',url.pathname+url.search+url.hash)}}
function localKey(){cleanUrl();try{return root.localStorage.getItem('tt_me')||null}catch{return null}}
function createdHere(key){try{const p=JSON.parse(root.sessionStorage.getItem(NEW_CARD));return !!(p&&p.key===key&&Number.isFinite(p.at)&&Date.now()>=p.at&&Date.now()-p.at<600000)}catch{return false}}
function rememberCreated(key){if(typeof key!=='string'||!key)return;root.sessionStorage.setItem(NEW_CARD,JSON.stringify({key,at:Date.now()}));root.localStorage.setItem('tt_me',key)}
function consumeCreated(){try{root.sessionStorage.removeItem(NEW_CARD)}catch{}}
cleanUrl();root.TTLegacyIdentity={localKey,createdHere,rememberCreated,consumeCreated};
})(window);
