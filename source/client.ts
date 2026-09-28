import {credentials} from './Profile.tsx';
import { useEffect, useRef, useState } from "react";
import {
  act,
  addPlayer,
  freshGame,
  publicGame,
  tick,
  type Action,
  type GameState,
} from "./game.ts";
export type Connection = {
  code: string;
  name: string;
  avatar: string;
  local: boolean;
  api: string;
  token: string;
  spectator?: boolean;
};
export function recentConnections(): Connection[] {
  try { const value=JSON.parse(localStorage.getItem("we-recent-rooms")||"[]");return Array.isArray(value)?value.filter(c=>c && typeof c.code==="string" && typeof c.token==="string" && typeof c.api==="string").slice(0,8):[]; } catch {return [];}
}
export function rememberConnection(c:Connection) {
  if(c.spectator)return;
  localStorage.setItem("we-recent-rooms",JSON.stringify([c,...recentConnections().filter(x=>x.code!==c.code || x.api!==c.api)].slice(0,8)));
}
export function makeToken() {
  return (
    crypto.randomUUID().replaceAll("-", "") +
    crypto.randomUUID().replaceAll("-", "")
  );
}
export function useGame(connection: Connection | null) {
  const [game, setGame] = useState<GameState | null>(null),
    [you, setYou] = useState(""),
    [connected, setConnected] = useState(false),
    [error, setError] = useState("");
  const socket = useRef<WebSocket | null>(null),
    local = useRef<GameState | null>(null);
  useEffect(() => {
    if (!connection) {
      setGame(null);
      return;
    }
    setError("");
    setConnected(false);
    const c = connection;
    let stopped = false,
      timer: ReturnType<typeof setTimeout> | undefined;
    let tries = 0;
    if (c.local) {
      let saved: GameState | null = null;
      try {
        const s = localStorage.getItem(`we-local-${c.code}`) || localStorage.getItem("we-local-v2");
        if (s) saved = JSON.parse(s);
        if (saved?.version !== 2 || saved.gameId !== c.code) saved = null;
      } catch {}
      const g = saved || freshGame(c.code);
      if (!saved) {
        addPlayer(g, "local-player", c.name, c.avatar);
        addPlayer(g, "bot-atlas", "Atlas", "♞", true);
        addPlayer(g, "bot-nova", "Nova", "♝", true);
      }
      local.current = g;
      localStorage.setItem(`we-local-${c.code}`,JSON.stringify(g));
      setYou("local-player");
      setGame(publicGame(g,"local-player"));
      setConnected(true);
      rememberConnection(c);
      const t = setInterval(() => {
        if (!local.current) return;
        const before = JSON.stringify(local.current);
        tick(local.current);
        if (JSON.stringify(local.current) !== before) {
          setGame(publicGame(local.current,"local-player"));
          localStorage.setItem(`we-local-${c.code}`, JSON.stringify(local.current));
        }
      }, 1000);
      return () => {
        clearInterval(t);
        local.current = null;
      };
    }
    function connect() {
      if (stopped) return;
      const url = new URL(`/room/${c.code}/ws`, c.api);
      url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
      const ws = new WebSocket(url);
      socket.current = ws;
      ws.onopen = () => {
        ws.send(
          JSON.stringify({
            type: c.spectator ? "watch" : "join",
            name: c.name,
            avatar: c.avatar,
            token: c.token,
            profile: credentials(),
          }),
        );
      };
      ws.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data);
          if (msg.type === "state") {
            setGame(msg.game);
            setYou(msg.you);
            if (!msg.spectator && c.spectator) { c.spectator = false; localStorage.setItem("we-connection", JSON.stringify(c)); }
            tries=0;
            rememberConnection(c);
            setConnected(true);
            setError("");
          } else if (msg.type === "error") setError(msg.message);
        } catch {
          setError("Ungültige Serverantwort.");
        }
      };
      ws.onclose = (e) => {
        setConnected(false);
        if (e.code === 4001) {
          setError("Dieser Raum ist jetzt in einem anderen Tab geöffnet.");
          return;
        }
        if (!stopped) {
          setError("Verbindung getrennt. Wiederverbindung läuft …");
          timer = setTimeout(connect, Math.min(15000, 1200 * 2 ** tries++));
        }
      };
      ws.onerror = () => ws.close();
    }
    connect();
    const authChanged=()=>{socket.current?.close();};
    window.addEventListener('we-auth-changed',authChanged);
    const wake = () => {if (!stopped && (!socket.current || socket.current.readyState===WebSocket.CLOSED)) {clearTimeout(timer);connect();}};
    const visible = () => {if(document.visibilityState==="visible")wake();};
    window.addEventListener("online",wake);document.addEventListener("visibilitychange",visible);
    return () => {
      window.removeEventListener('we-auth-changed',authChanged);
      window.removeEventListener("online",wake);document.removeEventListener("visibilitychange",visible);
      stopped = true;
      clearTimeout(timer);
      socket.current?.close();
    };
  }, [connection]);
  function send(a: Action) {
    setError("");
    if (local.current) {
      try {
        const next = structuredClone(local.current);
        act(next, "local-player", a);
        local.current = next;
        setGame(publicGame(next,"local-player"));
        localStorage.setItem(`we-local-${next.gameId}`, JSON.stringify(next));
      } catch (e) {
        setError((e as Error).message);
      }
      return;
    }
    if (socket.current?.readyState !== WebSocket.OPEN) {
      setError("Keine Verbindung. Warte auf die Wiederverbindung.");
      return;
    }
    socket.current.send(JSON.stringify(a.type === "join_play" ? {...a, profile:credentials(), name:connection?.name, avatar:connection?.avatar, token:connection?.token} : a));
  }
  return { game, you, connected, error, send, clearError: () => setError("") };
}
