type Account={id:string;name:string;keyHash:string;secure?:boolean;avatar?:string;friends:Record<string,string>;invites:{from:string;name:string;room:string;at:number}[];stats:{games:number;wins:number;bestWealth:number}};
export const accountStub=(env:{GAME_ROOM:DurableObjectNamespace},id:string)=>env.GAME_ROOM.get(env.GAME_ROOM.idFromName(`ACCOUNT_${id}`));
export async function digestKey(key:string){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(key)))).map(x=>x.toString(16).padStart(2,'0')).join('');}
export async function accountRequest(ctx:DurableObjectState,env:{GAME_ROOM:DurableObjectNamespace},request:Request){
 const url=new URL(request.url);let a=await ctx.storage.get<Account>('account');
 const raw=await request.text();if(raw.length>8192)return Response.json({error:'Anfrage zu groß.'},{status:413});
 let data:Record<string,unknown>;try{data=raw?JSON.parse(raw):{};}catch{return Response.json({error:'Ungültige Anfrage.'},{status:400});}
 if(!data||typeof data!=='object'||Array.isArray(data))return Response.json({error:'Ungültige Anfrage.'},{status:400});
 if(url.pathname==='/account/create'){
  if(a)return Response.json({error:'Profil existiert.'},{status:409});
  if(typeof data.name!=='string'||!data.name.trim()||typeof data.key!=='string'||!/^[a-f0-9]{64}$/.test(data.key)||typeof data.id!=='string'||!/^[A-F0-9]{12}$/.test(data.id))return Response.json({error:'Ungültiges Profil.'},{status:400});
  a={id:data.id,name:data.name.trim().slice(0,20),keyHash:await digestKey(data.key),friends:{},invites:[],stats:{games:0,wins:0,bestWealth:0}};
  await ctx.storage.put('account',a);return Response.json({id:a.id,name:a.name});
 }
 if(!a)return Response.json({error:'Profil nicht gefunden.'},{status:404});
 if(url.pathname==='/account/session-required')return Response.json({secure:!!a.secure});
 if(url.pathname==='/account/secure'&&data.authenticated===true){a.secure=true;await ctx.storage.put('account',a);return Response.json({ok:true});}
 if(url.pathname==='/account/public')return Response.json({id:a.id,name:a.name});
 if(url.pathname==='/account/score'){
  // Internal route: the public router never exposes it.
  const match=String(data.match);if(!/^[a-f0-9-]{36}$/.test(match))return new Response('Invalid',{status:400});
  await ctx.storage.transaction(async tx=>{if(await tx.get(`match:${match}`))return;const latest=(await tx.get<Account>('account'))!;latest.stats.games++;latest.stats.wins+=data.win===true?1:0;latest.stats.bestWealth=Math.max(latest.stats.bestWealth,Number(data.wealth)||0);await tx.put('account',latest);await tx.put(`match:${match}`,true);});
  return Response.json({ok:true});
 }
 if(url.pathname==='/account/invite'){
  const from=String(data.from);if(!a.friends[from])return Response.json({error:'Der Empfänger muss dich ebenfalls als Freund hinzufügen.'},{status:403});
  if(!/^[A-Z0-9]{8}$/.test(String(data.room)))return new Response('Invalid',{status:400});
  a.invites=[{from,name:a.friends[from],room:String(data.room),at:Date.now()},...a.invites.filter(i=>!(i.from===from&&i.room===data.room))].slice(0,20);await ctx.storage.put('account',a);return Response.json({ok:true});
 }
 if(data.authenticated!==true){
 if(a.secure)return Response.json({error:'Bitte mit Benutzername und Passwort anmelden.'},{status:401});
 if(typeof data.key!=='string'||!/^[a-f0-9]{64}$/.test(data.key))return Response.json({error:'Anmeldecode ungültig.'},{status:401});
 const hash=await digestKey(data.key);let diff=0;for(let i=0;i<64;i++)diff|=hash.charCodeAt(i)^a.keyHash.charCodeAt(i);
 if(diff)return Response.json({error:'Anmeldecode ungültig.'},{status:401});
 }
 if(url.pathname==='/account/verify')return Response.json({id:a.id,name:a.name});
 if(data.action==='friend_add'){
  const id=String(data.friend||'');if(!/^[A-F0-9]{12}$/.test(id)||id===a.id||Object.keys(a.friends).length>=50)return Response.json({error:'Freundescode ungültig oder Liste voll.'},{status:400});
  const r=await accountStub(env,id).fetch(new Request('https://internal/account/public',{method:'POST'}));if(!r.ok)return Response.json({error:'Freund nicht gefunden.'},{status:404});const f=await r.json() as {id:string;name:string};a.friends[f.id]=f.name;
 }else if(data.action==='friend_remove'){delete a.friends[String(data.friend)];}
 else if(data.action==='invite'){
  const id=String(data.friend||'');if(!a.friends[id])return Response.json({error:'Kein Freund.'},{status:400});
  const r=await accountStub(env,id).fetch(new Request('https://internal/account/invite',{method:'POST',body:JSON.stringify({from:a.id,room:data.room})}));if(!r.ok)return r;
 }else if(data.action==='rename'){if(typeof data.name==='string'&&data.name.trim())a.name=data.name.trim().slice(0,20);}
 else if(data.action==='avatar'){if(['♜','♞','♛','♝','♚','♟'].includes(String(data.avatar)))a.avatar=String(data.avatar);}
 else if(data.action==='clear_invites'){a.invites=[];}
 a.invites=a.invites.filter(i=>Date.now()-i.at<7*86400000);
 await ctx.storage.transaction(async tx=>{const latest=(await tx.get<Account>('account'))!;a!.stats=latest.stats; if(data.action==='friend_add')latest.friends[String(data.friend)]=a!.friends[String(data.friend)];if(data.action==='friend_remove')delete latest.friends[String(data.friend)];a!.friends=latest.friends;if(data.action!=='clear_invites')a!.invites=latest.invites.filter(i=>Date.now()-i.at<7*86400000);await tx.put('account',a!);});
 const {keyHash,...view}=a;void keyHash;return Response.json(view,{headers:{'Cache-Control':'no-store'}});
}
