// Framework-neutral website client. It does not modify website DOM or Firebase data.
export function createCardShareClient({baseUrl,getUser,fetchImpl=fetch}){
 const base=new URL(baseUrl);if(base.protocol!=='https:'&&!['127.0.0.1','localhost'].includes(base.hostname))throw Error('HTTPS_REQUIRED');
 let generation=0;const urls=new Set();
 const error=code=>Object.assign(Error(code),{code});
 function reset(){generation++;for(const url of urls)URL.revokeObjectURL(url);urls.clear();}
 async function request(route,{method='GET',body,binary=false}={}){
  const user=getUser(),epoch=generation;if(!user)throw error('AUTH_REQUIRED');const uid=user.uid;
  const current=()=>{if(generation!==epoch||getUser()?.uid!==uid)throw error('ACCOUNT_CHANGED');};
  const token=await user.getIdToken();current();
  if(!route.startsWith('/v1/card-share/')||route.includes('?')||route.includes('..'))throw error('INVALID_PATH');
  const response=await fetchImpl(new URL(route,base),{method,headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(60000)});current();
  if(!response.ok){const e=await response.json().catch(()=>({error:'REQUEST_FAILED'}));current();throw error(e.error);}
  const result=await(binary?response.blob():response.json());current();return result;
 }
 return {reset,
  preview:fields=>request('/v1/card-share/previews',{method:'POST',body:{fields}}),
  async image(preview){const blob=await request(preview.imagePath,{binary:true});const url=URL.createObjectURL(blob);urls.add(url);return url;},
  // Caller creates and retains ONE requestId per explicit publish, including retries.
  publish:(previewId,requestId)=>request('/v1/card-share/publications',{method:'POST',body:{previewId,requestId}}),
  current:()=>request('/v1/card-share/publications/current'),
  status:id=>request('/v1/card-share/publications/'+id),
  withdraw:id=>request('/v1/card-share/publications/'+id,{method:'DELETE'})
 };
}
