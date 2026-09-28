import {authPublic,authRequest,authCleanup,sessionProfile,type AuthEnv} from './auth.ts';
import {accountRequest, accountStub} from './accounts.ts';
import {
  act,
  addPlayer,
  freshGame,
  hostTransfer,
  nextWake,
  publicGame,
  tick,
  scoreTournament, netWorth,
  type GameState,
  type Action,
} from "./game.ts";
interface Env extends AuthEnv {
  GAME_ROOM: DurableObjectNamespace;
  ALLOWED_ORIGINS?: string;
}
type Session = {
  playerId: string | null;
  spectator?: boolean;
  rateStart: number;
  count: number;
  createdAt?: number;
  authToken?:string;
};
function allowed(request: Request, env: Env) {
  const origin = request.headers.get("Origin");
  if (!origin) return true;
  return (env.ALLOWED_ORIGINS || "http://localhost:5173,http://127.0.0.1:5173")
    .split(",")
    .map((x) => x.trim())
    .includes(origin);
}
export class EmpireRoom {
  ctx: DurableObjectState;
  game: GameState | null = null;
  identities: Record<string, string> = {};
  pausedAt: number | null = null;
  env: Env;
  directoryKey = "";
  constructor(ctx: DurableObjectState, _env: Env) {
    this.ctx = ctx;
    this.env = _env;
    ctx.blockConcurrencyWhile(async () => {
      const record = await ctx.storage.get<{
        game: GameState;
        identities: Record<string, string>;
        pausedAt?: number | null;
      }>("room");
      if (record) {
        this.game = record.game;
        this.game.replay=(await ctx.storage.get<GameState["replay"]>("replay"))||this.game.replay||[];
        this.identities = record.identities;
        this.pausedAt = record.pausedAt || null;
        const ids = ctx
          .getWebSockets()
          .map((ws) => (ws.deserializeAttachment() as Session)?.playerId);
        this.game.players.forEach(
          (p) => (p.connected = p.isBot || ids.includes(p.id)),
        );
        hostTransfer(this.game);
      }
    });
  }
  async save() {
    if (!this.game) return;
    scoreTournament(this.game);
    const {replay,...storedGame}=this.game;
    await this.ctx.storage.put({room:{game:storedGame, identities:this.identities, pausedAt:this.pausedAt},replay:replay||[]});
    const g = this.game;
    scoreTournament(g);
    if(g.phase==='finished'&&g.matchId){
      for(const p of g.players.filter(p=>p.profileId&&!p.isBot)){
       const marker=`scored:${g.matchId}:${p.id}`;
       if(!await this.ctx.storage.get(marker)){const winner=g.players.find(x=>x.id===g.winnerId);const r=await accountStub(this.env,p.profileId!).fetch(new Request('https://internal/account/score',{method:'POST',body:JSON.stringify({match:g.matchId,win:g.settings.teams?p.team===winner?.team:g.winnerId===p.id,wealth:netWorth(g,p)})}));if(r.ok)await this.ctx.storage.put(marker,true);}
      }
    }
    const listing = {code:g.gameId, host:g.players.find(p=>p.isHost)?.name || "Neuer Raum", players:g.players.length, phase:g.phase, mode:g.settings.mode, publicRoom:g.settings.publicRoom === true};
    const key = JSON.stringify(listing);
    if (key !== this.directoryKey) {
      try {
        const dir = this.env.GAME_ROOM.get(this.env.GAME_ROOM.idFromName("PUBLIC_DIRECTORY_V1"));
        await dir.fetch(new Request("https://internal/directory", {method:"POST", body:JSON.stringify(listing)}));
        this.directoryKey = key;
      } catch { /* Gameplay continues if discovery is temporarily unavailable. */ }
    }
  }
  async schedule() {
    if (!this.game) return;
    const now = Date.now();
    const joins = this.ctx
      .getWebSockets()
      .map((ws) => ws.deserializeAttachment() as Session)
      .filter((s) => !s.playerId && !s.spectator)
      .map((s) => (s.createdAt || now) + 15000);
    const next = this.game.manualPause ? now + 86400000 : this.pausedAt
      ? this.pausedAt + 24 * 60 * 60 * 1000
      : nextWake(this.game);
    await this.ctx.storage.setAlarm(
      Math.max(
        now + 100,
        Math.min(next || now + 24 * 60 * 60 * 1000, ...joins),
      ),
    );
  }
  send(ws: WebSocket, data: unknown) {
    try {
      ws.send(JSON.stringify(data));
    } catch {
      /* disconnected */
    }
  }
  broadcast() {
    if (!this.game) return;

    for (const ws of this.ctx.getWebSockets()) {
      const session = ws.deserializeAttachment() as Session;
      if (session?.playerId || session?.spectator)
        this.send(ws, { type: "state", game:publicGame(this.game,session.playerId||undefined), you: session.playerId || "spectator", spectator:!!session.spectator });
    }
  }
  async fetch(request: Request) {
    const url = new URL(request.url);
    if(url.hostname==='auth')return this.ctx.blockConcurrencyWhile(()=>authRequest(this.ctx,this.env,request));
    if(url.pathname.startsWith('/account/'))return accountRequest(this.ctx,this.env,request);
    if (url.pathname === "/directory") {
      if (request.method === "POST") {
        const entry = await request.json() as {code:string; publicRoom:boolean};
        if (entry.publicRoom) await this.ctx.storage.put(entry.code, {...entry, updated:Date.now()});
        else await this.ctx.storage.delete(entry.code);
        return new Response("OK");
      }
      const entries = await this.ctx.storage.list<{updated:number}>({limit:100});
      return Response.json([...entries.values()].filter(e=>Date.now()-e.updated < 86400000));
    }
    if (url.pathname === "/summary") {
      const g=this.game;
      if (!g?.settings.publicRoom) return new Response("Not found", {status:404});
      return Response.json({code:g.gameId, host:g.players.find(p=>p.isHost)?.name || "Raum", players:g.players.length, phase:g.phase, mode:g.settings.mode});
    }
    if (url.pathname === "/init" && request.method === "POST") {
      if (this.game) return new Response("Exists", { status: 409 });
      const { code } = (await request.json()) as { code: string };
      this.game = freshGame(code);
      await this.save();
      await this.schedule();
      return Response.json({ gameId: code });
    }
    if (!this.game)
      return new Response("Raum nicht gefunden.", { status: 404 });
    if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket")
      return new Response("WebSocket erforderlich", { status: 426 });
    if (this.ctx.getWebSockets().length >= 24)
      return new Response("Zu viele Verbindungen", { status: 429 });
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    this.ctx.acceptWebSocket(server);
    server.serializeAttachment({
      playerId: null,
      rateStart: Date.now(),
      count: 0,
      createdAt: Date.now(),
      authToken: request.headers.get("X-Empire-Session")||undefined,
    } satisfies Session);
    await this.schedule();
    return new Response(null, { status: 101, webSocket: client });
  }
  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer) {
    await this.ctx.blockConcurrencyWhile(async () => {
      try {
        if (typeof message !== "string" || message.length > 8192)
          throw new Error("Nachricht zu groß.");
        const session = ws.deserializeAttachment() as Session;
        const now = Date.now();
        if (now - session.rateStart > 10000) {
          session.rateStart = now;
          session.count = 0;
        }
        session.count++;
        ws.serializeAttachment(session);
        if (session.count > 45)
          throw new Error("Zu viele Aktionen. Bitte kurz warten.");
        const msg = JSON.parse(message);
        if (!msg || typeof msg !== "object" || typeof msg.type !== "string")
          throw new Error("Ungültige Nachricht.");
        if (!this.game) throw new Error("Raum nicht gefunden.");
        if (msg.type === "watch") {
          if (session.playerId || session.spectator) throw new Error("Bereits angemeldet.");
          session.spectator = true; ws.serializeAttachment(session);
          await this.schedule(); this.broadcast(); return;
        }
        if (msg.type === "join_play" && session.spectator) {
          if (this.game.phase !== "lobby") throw new Error("Bitte auf die nächste Lobby warten.");
          session.spectator = false; msg.type = "join";
        }
        if (msg.type === "join") {
          if (session.playerId) throw new Error("Bereits angemeldet.");
          if (
            typeof msg.token !== "string" ||
            !/^[a-f0-9]{64}$/.test(msg.token)
          )
            throw new Error("Ungültiger Sitzungsschlüssel.");
          const hash = Array.from(
            new Uint8Array(
              await crypto.subtle.digest(
                "SHA-256",
                new TextEncoder().encode(msg.token),
              ),
            ),
          )
            .map((b) => b.toString(16).padStart(2, "0"))
            .join("");
          let profileId=session.authToken?await sessionProfile(new Request('https://local/',{headers:{Cookie:'we_session='+session.authToken}}),this.env):undefined;
          if(session.authToken&&!profileId)throw Error('Anmeldung abgelaufen. Bitte erneut anmelden.');
          if(msg.profile&&!profileId){
           if(typeof msg.profile.id!=='string'||!/^[A-F0-9]{12}$/.test(msg.profile.id))throw Error('Profil ungültig.');
           const r=await accountStub(this.env,msg.profile.id).fetch(new Request('https://internal/account/verify',{method:'POST',body:JSON.stringify({key:msg.profile.key})}));
           if(!r.ok)throw Error('Profil-Anmeldung ungültig. Bitte im Startbildschirm erneut anmelden.');
           profileId=msg.profile.id;
          }
          const profilePlayer=profileId?this.game.players.find(p=>p.profileId===profileId):undefined;
          let id = profilePlayer?.id || this.identities[hash];
          const existing=this.game.players.find(p=>p.id===id);
          if(existing?.profileId&&!profileId){const r=await accountStub(this.env,existing.profileId).fetch(new Request('https://internal/account/session-required',{method:'POST',body:'{}'}));const data=await r.json() as {secure:boolean};if(data.secure)throw Error('Bitte mit dem Konto dieses Spielers anmelden.');}
          if(profileId&&existing?.profileId&&existing.profileId!==profileId)throw Error("Dieser Platz ist bereits einem anderen Profil zugeordnet.");
          if (id && !this.game.players.some((p) => p.id === id)) {
            delete this.identities[hash];
            id = "";
          }
          if (!id) {
            id = crypto.randomUUID();
            addPlayer(this.game, id, msg.name, msg.avatar);
            this.identities[hash] = id;
          } else {const p=this.game.players.find(p=>p.id===id)!;p.connected=true;p.disconnectedAt=undefined;if(p.replacementBot){p.isBot=false;p.replacementBot=false;}if(this.game.botVotes)delete this.game.botVotes[id];}
          for (const other of this.ctx.getWebSockets())
            if (
              other !== ws &&
              (other.deserializeAttachment() as Session)?.playerId === id
            ) {
              other.serializeAttachment({
                playerId: null,
                rateStart: now,
                count: 0,
              });
              other.close(4001, "Sitzung auf anderem Tab fortgesetzt.");
            }
          this.identities[hash]=id;
          if(profileId){const player=this.game.players.find(p=>p.id===id)!;if(player.profileId&&player.profileId!==profileId)throw Error("Dieser Platz ist bereits einem anderen Profil zugeordnet.");player.profileId=profileId;}
          session.playerId = id;
          ws.serializeAttachment(session);
          if (this.pausedAt) {
            const offset = this.game.manualPause ? 0 : now - this.pausedAt;
            if (this.game.tradeUntil) this.game.tradeUntil += offset;
            if (this.game.turnDeadline) this.game.turnDeadline += offset;
            if (this.game.actionNotBefore) this.game.actionNotBefore += offset;
            if (this.game.auction) {
              this.game.auction.endsAt += offset;
              this.game.auction.hardEndsAt += offset;
            }
            this.pausedAt = null;
          }
          hostTransfer(this.game);
        } else {
          if (!session.playerId) throw new Error("Bitte zuerst beitreten.");
          if(session.authToken&&!await sessionProfile(new Request('https://local/',{headers:{Cookie:'we_session='+session.authToken}}),this.env))throw Error('Anmeldung abgelaufen. Bitte neu verbinden.');
          const activePlayer=this.game.players.find(p=>p.id===session.playerId);
          if(activePlayer?.profileId&&!session.authToken){const r=await accountStub(this.env,activePlayer.profileId).fetch(new Request('https://internal/account/session-required',{method:'POST',body:'{}'}));const data=await r.json() as {secure:boolean};if(data.secure)throw Error('Profil wurde auf ein Konto umgestellt. Bitte neu anmelden.');}
          const next = structuredClone(this.game);
          act(next, session.playerId, msg as Action, now);
          this.game = next;
          this.identities = Object.fromEntries(
            Object.entries(this.identities).filter(([, id]) =>
              next.players.some((p) => p.id === id),
            ),
          );
        }
        await this.save();
        await this.schedule();
        this.broadcast();
      } catch (error) {
        this.send(ws, {
          type: "error",
          message:
            error instanceof Error ? error.message : "Aktion fehlgeschlagen.",
        });
      }
    });
  }
  async disconnected(ws: WebSocket) {
    await this.ctx.blockConcurrencyWhile(async () => {
      const s = ws.deserializeAttachment() as Session;
      if (!s?.playerId || !this.game) return;
      const remaining = this.ctx
        .getWebSockets()
        .some(
          (x) =>
            x !== ws &&
            (x.deserializeAttachment() as Session)?.playerId === s.playerId,
        );
      const p = this.game.players.find((p) => p.id === s.playerId);
      if (p && !remaining) {p.connected = false;p.disconnectedAt=Date.now();}
      hostTransfer(this.game);
      if (
        !this.ctx
          .getWebSockets()
          .some(
            (x) => x !== ws && (x.deserializeAttachment() as Session)?.playerId,
          )
      )
        this.pausedAt = Date.now();
      await this.save();
      await this.schedule();
      this.broadcast();
    });
  }
  async webSocketClose(ws: WebSocket, code: number, reason: string) {
    try {
      ws.close(code, reason);
    } catch {}
    await this.disconnected(ws);
  }
  async webSocketError(ws: WebSocket) {
    await this.disconnected(ws);
  }
  async alarm() {
    if(await this.ctx.storage.get("authKind")){await authCleanup(this.ctx);return;}
    await this.ctx.blockConcurrencyWhile(async () => {
      if (!this.game) return;
      for (const ws of this.ctx.getWebSockets()) {
        const s = ws.deserializeAttachment() as Session;
        if (!s.playerId && !s.spectator && Date.now() - (s.createdAt || 0) >= 15000)
          ws.close(4002, "Zeitüberschreitung beim Beitritt.");
      }
      if (this.pausedAt && !this.game.manualPause) {
        if (Date.now() - this.pausedAt >= 24 * 60 * 60 * 1000) {
          await this.ctx.storage.deleteAll();
          this.game = null;
          this.identities = {};
        } else await this.schedule();
        return;
      }
      if (this.game.manualPause) { await this.schedule(); return; }
      if (this.game.phase !== "playing") {
        if (!this.ctx.getWebSockets().length) {
          await this.ctx.storage.deleteAll();
          this.game = null;
          this.identities = {};
        } else await this.schedule();
        return;
      }
      tick(this.game);
      await this.save();
      await this.schedule();
      this.broadcast();
    });
  }
}
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (!allowed(request, env))
      return new Response("Origin nicht freigegeben", { status: 403 });
    const origin = request.headers.get("Origin") || "";
    const headers = {
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      Vary: "Origin",
    };
    if (request.method === "OPTIONS") return new Response(null, { headers });
    if(url.pathname.startsWith('/api/auth/'))return authPublic(request,env);
    if(url.pathname.startsWith('/api/profile/')){
      if(request.method!=='POST')return Response.json({error:'POST erforderlich.'},{status:405});
      const raw=await request.text();if(raw.length>8192)return Response.json({error:'Anfrage zu groß.'},{status:413});
      let data;try{data=JSON.parse(raw);}catch{return Response.json({error:'Ungültige Anfrage.'},{status:400});}
      const id=url.pathname==='/api/profile/new'?crypto.randomUUID().replaceAll('-','').slice(0,12).toUpperCase():url.pathname.slice('/api/profile/'.length);
      if(!/^[A-F0-9]{12}$/.test(id))return Response.json({error:'Profilcode ungültig.'},{status:400});
      const route=url.pathname==='/api/profile/new'?'create':'action';
      const authenticatedId=await sessionProfile(request,env);
      if(authenticatedId&&request.headers.get('Origin')!==url.origin)return Response.json({error:'Anfrage nicht erlaubt.'},{status:403});
      const r=await accountStub(env,id).fetch(new Request(`https://internal/account/${route}`,{method:'POST',body:JSON.stringify({...data,id,authenticated:authenticatedId===id})}));
      return new Response(r.body,{status:r.status,headers:{...headers,'Content-Type':'application/json','Cache-Control':'no-store'}});
    }
    if (url.pathname === "/health")
      return Response.json({ ok: true, version: 2 }, { headers });
    if (url.pathname === "/api/rooms" && request.method === "GET") {
      const dir=env.GAME_ROOM.get(env.GAME_ROOM.idFromName("PUBLIC_DIRECTORY_V1"));
      const candidates = await (await dir.fetch("https://internal/directory")).json() as {code:string}[];
      const rooms = await Promise.all(candidates.slice(0,30).map(async entry=>{
        try { const r=await env.GAME_ROOM.get(env.GAME_ROOM.idFromName(entry.code)).fetch("https://internal/summary"); return r.ok ? await r.json() : null; } catch { return null; }
      }));
      return Response.json(rooms.filter(Boolean), {headers:{...headers,"Cache-Control":"no-store"}});
    }
    if (url.pathname === "/api/rooms" && request.method === "POST") {
      const code = crypto
        .randomUUID()
        .replaceAll("-", "")
        .slice(0, 8)
        .toUpperCase();
      const stub = env.GAME_ROOM.get(env.GAME_ROOM.idFromName(code));
      const response = await stub.fetch(
        new Request("https://room/init", {
          method: "POST",
          body: JSON.stringify({ code }),
        }),
      );
      return new Response(response.body, {
        status: response.status,
        headers: { ...headers, "Content-Type": "application/json" },
      });
    }
    const match = url.pathname.match(/^\/room\/([A-Z0-9]{8})\/ws$/);
    if (match){
      const h=new Headers(request.headers);h.delete('X-Empire-Session');
      const cookie=request.headers.get('Cookie')?.split(';').map(s=>s.trim()).find(s=>s.startsWith('we_session='))?.slice(11);
      if(cookie)h.set('X-Empire-Session',cookie);
      return env.GAME_ROOM.get(env.GAME_ROOM.idFromName(match[1])).fetch(new Request(request,{headers:h}));
    }
    return new Response("World Empire API", { status: 404, headers });
  },
};
