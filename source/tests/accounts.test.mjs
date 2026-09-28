import {test} from 'node:test';import assert from 'node:assert/strict';
const base=process.env.TEST_API||'http://127.0.0.1:8797';
async function post(path,body){const r=await fetch(base+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});return {status:r.status,data:await r.json()};}
test('profile authentication, reciprocal friends, invitations and no client score writes',async()=>{
 const keyA=crypto.randomUUID().replaceAll('-','').repeat(2),keyB=crypto.randomUUID().replaceAll('-','').repeat(2);
 const a=await post('/api/profile/new',{name:'Account A',key:keyA}),b=await post('/api/profile/new',{name:'Account B',key:keyB});assert.equal(a.status,200);assert.equal(b.status,200);
 const path='/api/profile/'+a.data.id,other='/api/profile/'+b.data.id;
 assert.equal((await post(path,{key:keyB})).status,401);
 const view=await post(path,{key:keyA});assert.equal(view.data.stats.games,0);assert.equal('keyHash' in view.data,false);
 const spoof=await post(path,{key:keyA,action:'score',wins:999,games:999});assert.equal(spoof.data.stats.wins,0);
 const added=await post(path,{key:keyA,action:'friend_add',friend:b.data.id});assert.equal(added.data.friends[b.data.id],'Account B');
 assert.equal((await post(path,{key:keyA,action:'invite',friend:b.data.id,room:'ABCD1234'})).status,403);
 await post(other,{key:keyB,action:'friend_add',friend:a.data.id});assert.equal((await post(path,{key:keyA,action:'invite',friend:b.data.id,room:'ABCD1234'})).status,200);
 const invites=await post(other,{key:keyB});assert.equal(invites.data.invites[0].room,'ABCD1234');
 assert.equal((await fetch(base+'/account/score',{method:'POST',body:'{}'})).status,405);
 const room=await post('/api/rooms',{});const code=room.data.gameId;
 const connect=(token)=>{const ws=new WebSocket(base.replace('http','ws')+'/room/'+code+'/ws');const ready=new Promise((resolve,reject)=>{const timeout=setTimeout(()=>reject(Error('join timeout')),5000);ws.onopen=()=>ws.send(JSON.stringify({type:'join',name:'Player',token,profile:{id:a.data.id,key:keyA}}));ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.type==='state'){clearTimeout(timeout);resolve(m);}if(m.type==='error'){clearTimeout(timeout);reject(Error(m.message));}}});return {ws,ready};};
 const first=connect('a'.repeat(64));const s1=await first.ready;first.ws.close();const second=connect('b'.repeat(64));const s2=await second.ready;assert.equal(s1.you,s2.you);assert.equal(s2.game.players.length,1);second.ws.close();
});

test('finished room records both profiles exactly once and profile mismatch cannot take over a slot',async()=>{
 const keyA=crypto.randomUUID().replaceAll('-','').repeat(2),keyB=crypto.randomUUID().replaceAll('-','').repeat(2);
 const a=await post('/api/profile/new',{name:'Score A',key:keyA}),b=await post('/api/profile/new',{name:'Score B',key:keyB});
 const room=await post('/api/rooms',{}),code=room.data.gameId,sockets=[];
 function wait(ws,predicate,send){return new Promise((resolve,reject)=>{const timeout=setTimeout(()=>{ws.removeEventListener('message',on);reject(Error('state timeout'));},10000);function on(e){const m=JSON.parse(e.data);if(m.type==='error'||predicate(m)){clearTimeout(timeout);ws.removeEventListener('message',on);resolve(m);}}ws.addEventListener('message',on);send?.();});}
 async function join(token,profile){const ws=new WebSocket(base.replace('http','ws')+'/room/'+code+'/ws');sockets.push(ws);await new Promise(r=>ws.addEventListener('open',r,{once:true}));const m=await wait(ws,m=>m.type==='state'&&!!m.you,()=>ws.send(JSON.stringify({type:'join',name:'Tester '+token[0],token,profile})));return {ws,m};}
 try{
 const first=await join('c'.repeat(64),{id:a.data.id,key:keyA});
 const wrong=await join('c'.repeat(64),{id:b.data.id,key:keyB});assert.equal(wrong.m.type,'error');wrong.ws.close();
 const second=await join('d'.repeat(64),{id:b.data.id,key:keyB});
 assert.equal(first.m.type,'state',first.m.message);assert.equal(second.m.type,'state',second.m.message);
 const byId={[first.m.you]:first.ws,[second.m.you]:second.ws};
 const act=async(ws,action,predicate=()=>true)=>{const m=await wait(ws,m=>m.type==='state'&&predicate(m.game),()=>ws.send(JSON.stringify(action)));assert.equal(m.type,'state',m.message);return m.game;};
 await act(first.ws,{type:'settings_patch',settings:{maxRounds:1}},g=>g.settings.maxRounds===1);
 await act(first.ws,{type:'ready',ready:true},g=>g.players.find(p=>p.id===first.m.you).ready);
 await act(second.ws,{type:'ready',ready:true},g=>g.players.every(p=>p.ready));
 let g=await act(first.ws,{type:'start'},g=>g.phase==='playing');
 for(let i=0;i<25&&g.phase!=='finished';i++){
 const ws=byId[g.players[g.currentPlayerIndex].id];
 if(g.actionNotBefore>Date.now())await new Promise(r=>setTimeout(r,g.actionNotBefore-Date.now()+40));
 const action=g.turnPhase==='roll'?{type:'roll'}:g.turnPhase==='purchase'?{type:'buy'}:{type:'end'};
 g=await act(ws,action);
 }
 assert.equal(g.phase,'finished');
 const readA=()=>post('/api/profile/'+a.data.id,{key:keyA});
 const statsA=(await readA()).data.stats,statsB=(await post('/api/profile/'+b.data.id,{key:keyB})).data.stats;
 assert.equal(statsA.games,1);assert.equal(statsB.games,1);assert.equal(statsA.wins+statsB.wins,1);
 await act(first.ws,{type:'chat',text:'Good game'});
 assert.equal((await readA()).data.stats.games,1);
 }finally{for(const ws of sockets)ws.close();}
});
