import {test} from 'node:test';import assert from 'node:assert/strict';
const base=process.env.TEST_API||'http://127.0.0.1:8798';
async function post(route,body={},cookie='',origin=base){const r=await fetch(base+route,{method:'POST',headers:{'Content-Type':'application/json',Origin:origin,Cookie:cookie},body:JSON.stringify(body)});const raw=await r.text();let data;try{data=JSON.parse(raw);}catch{data={error:raw};}return {status:r.status,data,cookie:r.headers.get('set-cookie')?.split(';')[0]||'',headers:r.headers};}
const unique=()=>('u_'+crypto.randomUUID().slice(0,8)).replaceAll('-','');
test('new account uses cookie, rejects wrong password and cross-origin, rotates and revokes sessions',async()=>{
 const username=unique(),password='a correct long passphrase';
 const reg=await post('/api/auth/register',{username,password});assert.equal(reg.status,200,reg.data.error);assert.ok(reg.cookie);assert.match(reg.headers.get('set-cookie'),/HttpOnly/);assert.equal(reg.data.user.username,username);assert.equal('token' in reg.data,false);
 const login=await post('/api/auth/login',{username:username.toUpperCase(),password});assert.equal(login.status,200);assert.notEqual(login.cookie,reg.cookie);
 assert.equal((await post('/api/auth/login',{username,password:'incorrect password'})).status,401);
 assert.equal((await post('/api/auth/password',{password:'new long passphrase',currentPassword:password},reg.cookie,'https://evil.invalid')).status,403);
 const changed=await post('/api/auth/password',{password:'new long passphrase',currentPassword:password},reg.cookie);assert.equal(changed.status,200,changed.data.error);
 const session=async cookie=>(await fetch(base+'/api/auth/session',{headers:{Cookie:cookie}})).json();
 assert.equal((await session(login.cookie)).user,null);assert.equal((await session(reg.cookie)).user,null);assert.equal((await session(changed.cookie)).user.id,reg.data.user.id);
 assert.equal((await post('/api/auth/logout',{},changed.cookie)).status,200);assert.equal((await session(changed.cookie)).user,null);
});
test('legacy profile migrates once, retains identity, and no client can forge internal authentication',async()=>{
 const key=crypto.randomUUID().replaceAll('-','').repeat(2),old=await post('/api/profile/new',{name:'Legacy',key});
 const reg=await post('/api/auth/register',{username:unique(),password:'long migration password',legacy:{id:old.data.id,key}});assert.equal(reg.status,200,reg.data.error);assert.equal(reg.data.user.id,old.data.id);
 const path='/api/profile/'+old.data.id;
 assert.equal((await post(path,{key,action:'read'})).status,401);
 assert.equal((await post(path,{authenticated:true,action:'read'})).status,401);
 const read=await post(path,{action:'read'},reg.cookie);assert.equal(read.status,200);assert.equal(read.data.name,'Legacy');assert.equal('keyHash' in read.data,false);
 assert.equal((await post('/api/auth/register',{username:unique(),password:'long migration password',legacy:{id:old.data.id,key}})).status,400);
});
test('login is throttled and Google/mail correctly report missing configuration',async()=>{
 const username=unique();for(let i=0;i<5;i++)assert.equal((await post('/api/auth/login',{username,password:'wrong'})).status,401);
 assert.equal((await post('/api/auth/login',{username,password:'wrong'})).status,429);
 const cfg=await (await fetch(base+'/api/auth/config')).json();assert.equal(cfg.google,false);assert.equal(cfg.email,false);
 assert.equal((await fetch(base+'/api/auth/google/start')).status,503);
 assert.equal((await fetch(base+'/api/auth/google/callback?state=invalid&code=bad')).status,400);
 assert.equal((await post('/api/auth/reset',{secret:'bad',password:'new long password'})).status,400);
});
