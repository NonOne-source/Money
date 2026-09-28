import assert from "node:assert/strict";
import { test } from "node:test";
const API = process.env.TEST_API || "http://127.0.0.1:8787";
function connect(code, name, token) {
  const ws = new WebSocket(`${API.replace(/^http/, "ws")}/room/${code}/ws`);
  const messages = [];
  const waits = [];
  ws.addEventListener("open", () =>
    ws.send(JSON.stringify({ type: "join", name, token, avatar: "♜" })),
  );
  ws.addEventListener("message", (e) => {
    const m = JSON.parse(e.data);
    messages.push(m);
    for (const w of [...waits])
      if (w.p(m)) {
        waits.splice(waits.indexOf(w), 1);
        clearTimeout(w.timer);
        w.resolve(m);
      }
  });
  const next = (p) =>
    new Promise((resolve, reject) => {
      const found = messages.find(p);
      if (found) {
        resolve(found);
        return;
      }
      const w = {
        p,
        resolve,
        timer: setTimeout(
          () =>
            reject(
              new Error(
                "Timed out waiting for room state: " +
                  JSON.stringify(messages.at(-1)),
              ),
            ),
          10000,
        ),
      };
      waits.push(w);
    });
  return { ws, next, send: (a) => ws.send(JSON.stringify(a)), messages };
}
test("real Durable Object WebSockets: create, join, turn, takeover denial, reconnect, host transfer", async () => {
  const blocked = await fetch(API + "/api/rooms", {
    method: "POST",
    headers: { Origin: "https://untrusted.example" },
  });
  assert.equal(blocked.status, 403);
  const r = await fetch(API + "/api/rooms", {
    method: "POST",
    headers: { Origin: API },
  });
  assert.equal(r.status, 200);
  const { gameId } = await r.json();
  assert.match(gameId, /^[A-F0-9]{8}$/);
  const tokenA = "a".repeat(64),
    tokenB = "b".repeat(64);
  const a = connect(gameId, "Alice", tokenA);
  let b, attacker, reconnect;
  try {
    const first = await a.next((m) => m.type === "state");
    const aid = first.you;
    assert.equal(first.game.players[0].isHost, true);
    b = connect(gameId, "Bob", tokenB);
    await b.next((m) => m.type === "state" && m.game.players.length === 2);
    b.send({type:"ready",ready:true});
    await a.next(m=>m.type==="state" && m.game.players.some(p=>p.name==="Bob"&&p.ready));
    a.send({ type: "start" });
    const running = await b.next(
      (m) => m.type === "state" && m.game.phase === "playing",
    );
    assert.equal(running.game.players[0].id, aid);
    b.send({ type: "roll" });
    await b.next((m) => m.type === "error" && m.message.includes("Warte"));
    a.send({ type: "roll" });
    const roll = await b.next((m) => m.type === "state" && m.game.rollId === 1);
    assert.equal(roll.game.lastDice.length, 2);
    assert.equal(roll.game.version, 2);
    assert.equal("identities" in roll.game, false);
    a.ws.close();
    await b.next(
      (m) =>
        m.type === "state" &&
        m.game.players.some((p) => p.name === "Bob" && p.isHost),
    );
    attacker = connect(gameId, "Alice", "c".repeat(64));
    await attacker.next(
      (m) => m.type === "error" && m.message.includes("bereits"),
    );
    attacker.ws.close();
    reconnect = connect(gameId, "Alice", tokenA);
    const restored = await reconnect.next((m) => m.type === "state");
    assert.equal(restored.you, aid);
    assert.equal(restored.game.players.length, 2);
    assert.equal(
      restored.game.players.find((p) => p.id === aid).connected,
      true,
    );
    assert.equal(restored.game.rollId, 1);
  } finally {
    a.ws.close();
    b?.ws.close();
    attacker?.ws.close();
    reconnect?.ws.close();
  }
});

test("public discovery, privacy and spectator permissions",async()=>{
 const r=await fetch(API+'/api/rooms',{method:'POST'}); const {gameId}=await r.json();
 const a=connect(gameId,'Host','d'.repeat(64));let watcher;
 try {
  const first=await a.next(m=>m.type==='state');
  assert.ok(!(await (await fetch(API+'/api/rooms')).json()).some(r=>r.code===gameId));
  a.send({type:'settings',settings:{...first.game.settings,publicRoom:true}});
  await a.next(m=>m.type==='state'&&m.game.settings.publicRoom);
  assert.ok((await (await fetch(API+'/api/rooms')).json()).some(r=>r.code===gameId));
  watcher=new WebSocket(API.replace(/^http/,'ws')+'/room/'+gameId+'/ws');
  const messages=[];watcher.addEventListener('message',e=>messages.push(JSON.parse(e.data)));
  await new Promise(resolve=>watcher.addEventListener('open',resolve));watcher.send(JSON.stringify({type:'watch'}));
  async function wait(p){for(let i=0;i<100;i++){const m=messages.find(p);if(m)return m;await new Promise(r=>setTimeout(r,20));}throw Error('Missing spectator state '+JSON.stringify(messages));}
  const watched=await wait(m=>m.type==='state');assert.equal(watched.you,'spectator');assert.equal(watched.game.players.length,1);
  watcher.send(JSON.stringify({type:'add_bot'}));await wait(m=>m.type==='error');
  watcher.send(JSON.stringify({type:'join_play',name:'Viewer',avatar:'♜',token:'e'.repeat(64)}));
  const joined=await wait(m=>m.type==='state'&&m.you!=='spectator');assert.equal(joined.game.players.length,2);
  a.send({type:'settings',settings:{...first.game.settings,publicRoom:false}});
  await a.next(m=>m.type==='state'&&m.game.players.length===2&&!m.game.settings.publicRoom);
  assert.ok(!(await (await fetch(API+'/api/rooms')).json()).some(r=>r.code===gameId));
 }finally{a.ws.close();watcher?.close();}
});
