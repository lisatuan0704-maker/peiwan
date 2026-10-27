// Minimal Realtime Database emulator client for rules tests.
'use strict';
const BASE='http://127.0.0.1:9000';
function token(uid,claims={}){
  if(!uid)return null;
  const b=o=>Buffer.from(JSON.stringify(o)).toString('base64url');
  const now=Math.floor(Date.now()/1000);
  return b({alg:'none',typ:'JWT'})+'.'+b({iss:'https://securetoken.google.com/my-shop-0520',aud:'my-shop-0520',iat:now,exp:now+3600,auth_time:now,sub:uid,user_id:uid,firebase:{sign_in_provider:'custom',identities:{}},...claims})+'.';
}
function url(ns,path,who){
  const q=new URLSearchParams({ns});
  if(who&&who!=='owner')q.set('auth',token(who.uid,who.claims));
  const [pp,extra]=path.split('?');if(extra)for(const [k,v] of new URLSearchParams(extra))q.set(k,v);
  return `${BASE}/${pp.replace(/^\//,'')}.json?${q}`;
}
async function req(ns,method,path,body,who){
  const headers={};
  if(who==='owner')headers.Authorization='Bearer owner';
  const r=await fetch(url(ns,path,who),{method,headers,body:body===undefined?undefined:JSON.stringify(body)});
  const text=await r.text();
  return {ok:r.ok,status:r.status,body:text};
}
async function setRules(ns,rules){const r=await fetch(`${BASE}/.settings/rules.json?ns=${ns}`,{method:'PUT',headers:{Authorization:'Bearer owner'},body:JSON.stringify(rules)});if(!r.ok)throw Error('rules rejected: '+await r.text());}
async function seed(ns,data){const r=await req(ns,'PUT','',data,'owner');if(!r.ok)throw Error('seed failed '+r.body);}
module.exports={req,setRules,seed,token};
