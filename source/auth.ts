import {scryptSync,timingSafeEqual,randomBytes,createHash} from 'node:crypto';
import {accountStub} from './accounts.ts';
export interface AuthEnv {GAME_ROOM:DurableObjectNamespace;GOOGLE_CLIENT_ID?:string;GOOGLE_CLIENT_SECRET?:string;RESEND_API_KEY?:string;MAIL_FROM?:string;}
type User={username:string;id:string;salt?:string;hash?:string;email?:string;emailVerified?:boolean;googleSub?:string;version:number};
type Login={username:string;version:number;expires:number};
const hex=()=>Buffer.from(randomBytes(32)).toString('hex');
const digest=(s:string)=>createHash('sha256').update(s).digest('hex');
export function passwordHash(password:string,salt:string){return Buffer.from(scryptSync(password,salt,32,{N:16384,r:8,p:5,maxmem:32*1024*1024})).toString('hex');}
function passwordValid(p:unknown):p is string{return typeof p==='string'&&p.length>=12&&p.length<=128;}
function usernameOf(x:unknown){const s=String(x||'').trim().toLowerCase();if(!/^[a-z0-9_]{3,20}$/.test(s))throw Error('Benutzername: 3–20 Zeichen, Buchstaben, Zahlen oder Unterstrich.');return s;}
const ok=(data:unknown,status=200,headers:HeadersInit={})=>{const h=new Headers(headers);h.set('Cache-Control','no-store');return Response.json(data,{status,headers:h});};
const stub=(env:AuthEnv)=>env.GAME_ROOM.get(env.GAME_ROOM.idFromName('AUTH_V6'));
export function cookieValue(request:Request,name:string){return request.headers.get('Cookie')?.split(';').map(s=>s.trim()).find(s=>s.startsWith(name+'='))?.slice(name.length+1)||'';}
const cookie=(name:string,value:string,url:URL,seconds:number)=>`${name}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${seconds}${url.protocol==='https:'?'; Secure':''}`;
async function internal(env:AuthEnv,route:string,data:unknown){return stub(env).fetch(new Request('https://auth/'+route,{method:'POST',body:JSON.stringify(data)}));}
export async function sessionProfile(request:Request,env:AuthEnv):Promise<string|undefined>{const token=cookieValue(request,'we_session');if(!/^[a-f0-9]{64}$/.test(token))return;const r=await internal(env,'session',{token});const d=await r.json() as {user?:User};return d.user?.id;}
export async function authPublic(request:Request,env:AuthEnv):Promise<Response>{
 const url=new URL(request.url),route=url.pathname.slice('/api/auth/'.length),token=cookieValue(request,'we_session');
 if(route==='config')return ok({google:!!(env.GOOGLE_CLIENT_ID&&env.GOOGLE_CLIENT_SECRET),email:!!(env.RESEND_API_KEY&&env.MAIL_FROM)});
 if(route==='google/start'){
  if(!env.GOOGLE_CLIENT_ID||!env.GOOGLE_CLIENT_SECRET)return ok({error:'Google-Anmeldung ist noch nicht eingerichtet.'},503);
  const r=await internal(env,'google-start',{token,ip:request.headers.get('CF-Connecting-IP')||'local'});const d=await r.json() as {state:string;challenge:string;error?:string};if(!r.ok)return r;
  const redirect=new URL('https://accounts.google.com/o/oauth2/v2/auth');redirect.search=new URLSearchParams({client_id:env.GOOGLE_CLIENT_ID,redirect_uri:url.origin+'/api/auth/google/callback',response_type:'code',scope:'openid email profile',state:d.state,code_challenge:d.challenge,code_challenge_method:'S256',prompt:'select_account'}).toString();return new Response(null,{status:302,headers:{Location:redirect.href,'Set-Cookie':cookie('we_oauth',d.state,url,600),'Cache-Control':'no-store'}});
 }
 if(route==='google/callback'){
  const state=url.searchParams.get('state')||'';
  if(!state||state!==cookieValue(request,'we_oauth'))return ok({error:'Google-Anmeldung abgelaufen. Bitte neu starten.'},400);
  const r=await internal(env,'google-finish',{state,code:url.searchParams.get('code'),origin:url.origin});const d=await r.json() as {token?:string;error?:string};
  if(!r.ok)return ok({error:d.error||'Google-Anmeldung fehlgeschlagen.'},400);
  const h=new Headers({Location:'/#account=welcome','Cache-Control':'no-store'});h.append('Set-Cookie',cookie('we_session',d.token!,url,2592000));h.append('Set-Cookie',cookie('we_oauth','',url,0));return new Response(null,{status:302,headers:h});
 }
 if(route==='session'&&request.method==='GET')return internal(env,'session',{token});
 if(request.method!=='POST')return ok({error:'POST erforderlich.'},405);
 // Cookie-authenticated mutations only from this application, never cross-site forms.
 if(request.headers.get('Origin')!==url.origin||!request.headers.get('Content-Type')?.startsWith('application/json'))return ok({error:'Anfrage nicht erlaubt.'},403);
 if(!['register','login','logout','password','email','verify','forgot','reset'].includes(route))return ok({error:'Nicht gefunden.'},404);
 const raw=await request.text();if(raw.length>4096)return ok({error:'Anfrage zu groß.'},413);
 let data;try{data=JSON.parse(raw);if(!data||typeof data!=='object'||Array.isArray(data))throw Error();}catch{return ok({error:'Ungültige Anfrage.'},400);}
 const r=await internal(env,route,{...data,token,origin:url.origin,ip:request.headers.get('CF-Connecting-IP')||'local'});
 const d=await r.json() as {token?:string;error?:string};const h=new Headers({'Cache-Control':'no-store'});
 if(d.token){h.set('Set-Cookie',cookie('we_session',d.token,url,2592000));delete d.token;}
 if(route==='logout'&&r.ok)h.set('Set-Cookie',cookie('we_session','',url,0));return ok(d,r.status,h);
}
export async function authRequest(ctx:DurableObjectState,env:AuthEnv,request:Request){
 const s=ctx.storage,route=new URL(request.url).pathname.slice(1),d=await request.json() as Record<string,any>,now=Date.now();
 async function limited(key:string,max:number,period=60000){const k='rate:'+digest(key);const v=await s.get<{count:number;expires:number}>(k);const n=v&&v.expires>now?v:{count:0,expires:now+period};if(n.count>=max)return true;n.count++;await s.put(k,n);return false;}
 async function userSession(){if(typeof d.token!=='string'||!/^[a-f0-9]{64}$/.test(d.token))return null;const key='session:'+digest(d.token);const v=await s.get<Login>(key);if(!v)return null;const u=await s.get<User>('user:'+v.username);if(v.expires<now||!u||u.version!==v.version){await s.delete(key);return null;}return u;}
 async function issue(u:User){const token=hex();await s.put('session:'+digest(token),{username:u.username,version:u.version,expires:now+2592000000});return {token,user:view(u)};}
 function view(u:User){return {id:u.id,username:u.username,email:u.email||'',emailVerified:!!u.emailVerified,google:!!u.googleSub,hasPassword:!!u.hash};}
 async function save(u:User){await s.put('user:'+u.username,u);}
 async function profile(u:User,route:string,extra:Record<string,unknown>={}){const r=await accountStub(env,u.id).fetch(new Request('https://internal/account/'+route,{method:'POST',body:JSON.stringify({authenticated:true,...extra})}));if(!r.ok)throw Error('Profil konnte nicht übernommen werden.');return r;}
 async function mail(u:User,kind:'verify'|'reset',email:string){
  if(!env.RESEND_API_KEY||!env.MAIL_FROM)throw Error('E-Mail-Versand ist noch nicht eingerichtet.');
  const secret=hex(),key='mail:'+digest(secret);await s.put(key,{username:u.username,kind,email,version:u.version,expires:now+900000});
  const link=d.origin+'/#account='+kind+'&token='+secret;
  const r=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+env.RESEND_API_KEY,'Content-Type':'application/json'},body:JSON.stringify({from:env.MAIL_FROM,to:[email],subject:kind==='verify'?'World Empire: E-Mail bestätigen':'World Empire: Passwort zurücksetzen',text:`${kind==='verify'?'Bestätige deine E-Mail-Adresse':'Setze dein Passwort zurück'} für ${u.username}:\n${link}\nDer Link gilt 15 Minuten. Falls du dies nicht angefordert hast, ignoriere diese Nachricht.`})});if(!r.ok){await s.delete(key);throw Error('Die E-Mail konnte nicht versendet werden. Bitte später erneut versuchen.');}
 }
 try{
  await s.put('authKind',true);if(!(await s.getAlarm()))await s.setAlarm(now+86400000);
  if(route==='session'){const u=await userSession();return ok({user:u?view(u):null});}
  if(await limited('ip:'+String(d.ip||'internal'),30))return ok({error:'Zu viele Versuche. Bitte eine Minute warten.'},429);
  if(route==='logout'){if(d.token)await s.delete('session:'+digest(d.token));return ok({ok:true});}
  if(route==='register'){
   const username=usernameOf(d.username);if(!passwordValid(d.password))throw Error('Das Passwort muss 12 bis 128 Zeichen lang sein.');
   if(await s.get('user:'+username))throw Error('Dieser Benutzername ist bereits vergeben.');
   let id=hex().slice(0,12).toUpperCase();
   if(d.legacy?.id){if(!/^[A-F0-9]{12}$/.test(d.legacy.id))throw Error('Altes Profil ungültig.');const r=await accountStub(env,d.legacy.id).fetch(new Request('https://internal/account/verify',{method:'POST',body:JSON.stringify({key:d.legacy.key})}));if(!r.ok)throw Error('Altes Profil konnte nicht bestätigt werden.');id=d.legacy.id;if(await s.get('profile:'+id))throw Error('Dieses Profil besitzt bereits ein Konto. Bitte anmelden.');}
   const salt=hex(),u:User={username,id,salt,hash:passwordHash(d.password,salt),version:1};
   if(d.email){const email=String(d.email).trim().toLowerCase();if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254)throw Error('E-Mail-Adresse ungültig.');u.email=email;}
   if(!d.legacy?.id){const r=await accountStub(env,id).fetch(new Request('https://internal/account/create',{method:'POST',body:JSON.stringify({id,name:username,key:hex()})}));if(!r.ok)throw Error('Profil konnte nicht erstellt werden.');}
   await save(u);await s.put('profile:'+id,username);await profile(u,'secure');
   let notice='Konto erstellt.';if(u.email){try{await mail(u,'verify',u.email);notice+=' Bitte E-Mail bestätigen.';}catch(e){notice+=' '+(e as Error).message;}}
   return ok({...await issue(u),notice});
  }
  if(route==='login'){
   const username=usernameOf(d.username);if(await limited('login:'+username,5,300000))return ok({error:'Zu viele Anmeldeversuche. Bitte fünf Minuten warten.'},429);
   const u=await s.get<User>('user:'+username);const candidate=passwordHash(typeof d.password==='string'&&d.password.length<=128?d.password:'',u?.salt||'invalid-user-salt');
   if(!u?.hash||!timingSafeEqual(Buffer.from(candidate,'hex'),Buffer.from(u.hash,'hex')))return ok({error:'Benutzername oder Passwort stimmt nicht.'},401);
   return ok(await issue(u));
  }
  if(route==='forgot'){
   const username=usernameOf(d.username);if(await limited('mail:'+username,2,900000))return ok({error:'Bitte warte vor der nächsten Mail-Anfrage.'},429);
   const u=await s.get<User>('user:'+username);if(!env.RESEND_API_KEY||!env.MAIL_FROM)throw Error('E-Mail-Versand ist noch nicht eingerichtet.');if(u?.email&&u.emailVerified)await mail(u,'reset',u.email);
   return ok({notice:'Falls ein Konto mit bestätigter E-Mail existiert, wurde ein Link gesendet.'});
  }
  if(route==='verify'||route==='reset'){
   if(typeof d.secret!=='string'||!/^[a-f0-9]{64}$/.test(d.secret))throw Error('Link ungültig oder abgelaufen.');const key='mail:'+digest(d.secret),m=await s.get<{username:string;kind:string;email:string;version:number;expires:number}>(key);
   if(!m||m.kind!==route||m.expires<now)throw Error('Link ungültig oder abgelaufen.');const u=await s.get<User>('user:'+m.username);if(!u||u.version!==m.version||u.email!==m.email)throw Error('Link ungültig oder abgelaufen.');
   if(route==='verify'){if(u.email!==m.email)throw Error('E-Mail wurde inzwischen geändert.');u.emailVerified=true;await save(u);await s.delete(key);return ok({notice:'E-Mail bestätigt. Du kannst dich anmelden.'});}
   if(!passwordValid(d.password))throw Error('Das Passwort muss 12 bis 128 Zeichen lang sein.');u.salt=hex();u.hash=passwordHash(d.password,u.salt!);u.version++;await save(u);await s.delete(key);return ok({...await issue(u),notice:'Passwort geändert. Andere Anmeldungen wurden beendet.'});
  }
  if(route==='google-start'){
   const state=hex(),verifier=hex();await s.put('oauth:'+digest(state),{verifier,expires:now+600000});return ok({state,challenge:createHash('sha256').update(verifier).digest('base64url')});
  }
  if(route==='google-finish'){
   if(!env.GOOGLE_CLIENT_ID||!env.GOOGLE_CLIENT_SECRET)throw Error('Google nicht eingerichtet.');const key='oauth:'+digest(String(d.state)),o=await s.get<{verifier:string;expires:number}>(key);await s.delete(key);if(!o||o.expires<now||typeof d.code!=='string')throw Error('Google-Anmeldung abgelaufen.');
   const r=await fetch('https://oauth2.googleapis.com/token',{method:'POST',body:new URLSearchParams({code:d.code,client_id:env.GOOGLE_CLIENT_ID,client_secret:env.GOOGLE_CLIENT_SECRET,redirect_uri:d.origin+'/api/auth/google/callback',grant_type:'authorization_code',code_verifier:o.verifier})});const tokens=await r.json() as {access_token?:string};if(!r.ok||!tokens.access_token)throw Error('Google-Anmeldung fehlgeschlagen.');
   const info=await fetch('https://openidconnect.googleapis.com/v1/userinfo',{headers:{Authorization:'Bearer '+tokens.access_token}});const g=await info.json() as {sub?:string;email?:string;email_verified?:boolean;name?:string};if(!info.ok||!g.sub||!g.email_verified||!g.email)throw Error('Google-Konto konnte nicht bestätigt werden.');
   const mapping='google:'+digest(g.sub);let username=await s.get<string>(mapping),u=username?await s.get<User>('user:'+username):undefined;
   if(!u){username='g_'+hex().slice(0,16);u={username,id:hex().slice(0,12).toUpperCase(),googleSub:g.sub,email:g.email,emailVerified:true,version:1};const r=await accountStub(env,u.id).fetch(new Request('https://internal/account/create',{method:'POST',body:JSON.stringify({id:u.id,name:(g.name||username).slice(0,20),key:hex()})}));if(!r.ok)throw Error('Profil konnte nicht erstellt werden.');await save(u);await s.put(mapping,username);await s.put('profile:'+u.id,username);await profile(u,'secure');}
   return ok(await issue(u));
  }
  const u=await userSession();if(!u)return ok({error:'Bitte erneut anmelden.'},401);
  if(route==='password'){
   if(!passwordValid(d.password))throw Error('Das Passwort muss 12 bis 128 Zeichen lang sein.');
   if(!u.hash)throw Error('Bei Google-Konten Passwort über die bestätigte E-Mail einrichten.');
   const candidate=passwordHash(String(d.currentPassword||'').slice(0,128),u.salt!);if(!timingSafeEqual(Buffer.from(candidate,'hex'),Buffer.from(u.hash,'hex')))return ok({error:'Aktuelles Passwort stimmt nicht.'},401);
   u.salt=hex();u.hash=passwordHash(d.password,u.salt!);u.version++;await save(u);return ok({...await issue(u),notice:'Passwort geändert. Andere Anmeldungen wurden beendet.'});
  }
  if(route==='email'){
   if(await limited('mail:'+u.username,2,900000))return ok({error:'Bitte warte vor der nächsten Mail-Anfrage.'},429);
   if(!u.hash)throw Error('Dieses Google-Konto verwendet seine Google-E-Mail.');
   const candidate=passwordHash(String(d.currentPassword||'').slice(0,128),u.salt!);if(!timingSafeEqual(Buffer.from(candidate,'hex'),Buffer.from(u.hash,'hex')))return ok({error:'Aktuelles Passwort stimmt nicht.'},401);
   const email=String(d.email||'').trim().toLowerCase();if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254)throw Error('E-Mail-Adresse ungültig.');
   await mail(u,'verify',email);u.email=email;u.emailVerified=false;await save(u);return ok({user:view(u),notice:'Bestätigungslink gesendet. Erst nach Bestätigung ist die Wiederherstellung möglich.'});
  }
  return ok({error:'Nicht gefunden.'},404);
 }catch(e){return ok({error:(e as Error).message},400);}
}
export async function authCleanup(ctx:DurableObjectState){for(const prefix of ['session:','mail:','oauth:','rate:']){const all=await ctx.storage.list<{expires:number}>({prefix});const keys=[...all].filter(([,v])=>v.expires<Date.now()).map(([k])=>k);for(let i=0;i<keys.length;i+=128)await ctx.storage.delete(keys.slice(i,i+128));}await ctx.storage.setAlarm(Date.now()+86400000);}
