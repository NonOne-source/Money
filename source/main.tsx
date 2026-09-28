import {OwnershipDialog} from './PropertyTools.tsx';
import {AdvancedLobby,RoundExtras,Tournament,Replay,AudioSettings,InstallApp} from './NewFeatures.tsx';
import {ProfilePanel} from './Profile.tsx';
import {groupName} from './presets.ts';
import {
  lazy,
  Suspense,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import ReactDOM from "react-dom/client";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Check,
  ChevronRight,
  Clock3,
  Copy,
  Crown,
  Dice5,
  Globe2,
  Gavel,
  Grid2X2,
  Handshake,
  Landmark,
  LogOut,
  MessageCircle,
  Plus,
  QrCode,
  Radio,
  Send,
  Settings2,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Trophy,
  Users,
  Volume2,
  VolumeX,
  Wifi,
  X,
  Zap,
} from "lucide-react";
import { BOARD, GROUPS, AVATARS, money } from "./rules.ts";
import { hasWon, current, netWorth, rent } from "./game.ts";
import { recentConnections, makeToken, useGame, type Connection } from "./client.ts";
import {Career, Cosmetics, LobbyExtras, PublicRooms, ResultsDetails, Achievements, Podium, Tutorial, readStats, useCareer} from "./Enhancements.tsx";
import {gameProperties} from "./custom.ts";
import { Board, CityArt } from "./Board.tsx";
import { Dice } from "./Dice.tsx";
import { EmpirePaymentCard, Phone, type AppId } from "./Phone.tsx";
import { sounds } from "./sound.ts";
import "@fontsource/manrope/latin-400.css";
import "@fontsource/manrope/latin-600.css";
import "@fontsource/manrope/latin-800.css";
import "@fontsource/dm-sans/latin-400.css";
import "@fontsource/dm-sans/latin-500.css";
import "@fontsource/dm-sans/latin-700.css";
import "./styles.css";
export type { GameState } from "./game.ts";
const Globe = lazy(() =>
  import("./globe.tsx").then((m) => ({ default: m.Globe })),
);
function Logo({ small = false }: { small?: boolean }) {
  return (
    <div className={`brand ${small ? "small" : ""}`}>
      <span className="brand-mark">
        <Crown size={small ? 19 : 24} strokeWidth={1.5} />
      </span>
      <div>
        <strong>
          WORLD<span>EMPIRE</span>
        </strong>
        <small>BUILD YOUR LEGACY</small>
      </div>
    </div>
  );
}
function safeConnection(): Connection | null {
  try {
    return JSON.parse(localStorage.getItem("we-connection") || "null");
  } catch {
    return null;
  }
}
function App() {
  const [ownership,setOwnership]=useState<string|null>(null);
  const [connection, setConnection] = useState<Connection | null>(
      () => new URLSearchParams(location.search).has("room") ? null : safeConnection(),
    ),
    [phone, setPhone] = useState<AppId | null>(null),
    [modal, setModal] = useState<"rules" | "invite" | "settings" | null>(null),
    [selected, setSelected] = useState<string | null>(null),
    [view, setView] = useState<"board" | "globe">("board"),
    [payment, setPayment] = useState<null | {
      city: string;
      amount: number;
      stage: "ready" | "face" | "approved";
    }>(null);
  useEffect(()=>{const logout=()=>{setConnection(null);setModal(null);setPhone(null);};window.addEventListener('we-logout',logout);return()=>window.removeEventListener('we-logout',logout);},[]);
  const [now, setNow] = useState(Date.now()),
    [sound, setSound] = useState(
      () => localStorage.getItem("we-sound") === "true",
    ),
    [reduced, setReduced] = useState(
      () =>
        localStorage.getItem("we-reduced") === "true" ||
        matchMedia("(prefers-reduced-motion: reduce)").matches,
    ),
    [chat, setChat] = useState(""),
    [qr, setQr] = useState(""),
    [copied, setCopied] = useState(false),
    [toast, setToast] = useState("");
  const { game, you, connected, error, send, clearError } = useGame(connection);
  const PROPERTIES = gameProperties(game);
  const [look, setLook] = useState(()=>localStorage.getItem("we-look")||"classic");
  useCareer(game,you);
  const notice = useRef("");
  useEffect(()=>{ if(!game)return; const incoming=game.trades.filter(t=>t.toId===you&&t.status==="pending").map(t=>t.id).join(',');
    if(incoming && incoming!==notice.current) {setToast("Neues Handelsangebot im Handy");if(sound)sounds.notify();} notice.current=incoming;
  },[game,you,sound]);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    if (connection)
      localStorage.setItem("we-connection", JSON.stringify(connection));
    else localStorage.removeItem("we-connection");
  }, [connection]);
  const previous = useRef({
    roll: 0,
    money: 0,
    initialized: false,
    auction: "",
  });
  useEffect(() => {
    if (!game) return;
    const p = game.players.find((p) => p.id === you);
    if (previous.current.initialized && p) {
      const delta = p.money - previous.current.money;
      if (delta) {
        setToast(`${delta > 0 ? "+" : ""}${money(delta)} · ${game.log.find(l=>l.text.includes(p.name))?.text || "Kontostand aktualisiert"}`);
        if(sound){const kind=game.log[0]?.kind;if(kind==="purchase")sounds.purchase();else if(kind==="money"&&delta<0)sounds.rent();else if(delta>0)sounds.cash();}
      }
      if (game.rollId !== previous.current.roll && sound) sounds.diceRoll();
    }
    if (game.auction?.id && game.auction.id !== previous.current.auction) {
      setPhone("auction");
      if (sound) sounds.notify();
    }
    previous.current = {
      roll: game.rollId,
      money: p?.money || 0,
      initialized: !!p,
      auction: game.auction?.id || "",
    };
  }, [game, you, sound]);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 2600);
    return () => clearTimeout(t);
  }, [toast]);
  useEffect(() => {
    if (modal === "invite" && game) {
      import("qrcode")
        .then((m) =>
          m.default.toDataURL(
            `${location.origin}${location.pathname}?room=${game.gameId}`,
            {
              width: 220,
              margin: 2,
              color: { dark: "#102332", light: "#f4f0e7" },
            },
          ),
        )
        .then(setQr)
        .catch(() => setQr(""));
    }
  }, [modal, game?.gameId]);
  function leave() {
    if (
      game?.phase === "playing" &&
      !window.confirm(
        "Raum verlassen? Du kannst über diesen Browser später wieder beitreten.",
      )
    )
      return;
    setConnection(null);
    setPhone(null);
    previous.current.initialized = false;
  }
  function openPhone(app: AppId) {
    setPhone(app);
  }
  function copy(text: string) {
    navigator.clipboard
      .writeText(text)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      })
      .catch(() => setToast("Bitte den sichtbaren Raumcode kopieren."));
  }
  if (!connection)
    return (
      <Landing
        onJoin={setConnection}
        onRules={() => setModal("rules")}
        rules={
          modal === "rules" ? <Rules onClose={() => setModal(null)} /> : null
        }
      />
    );
  if (!game)
    return (
      <div className="connecting">
        <Logo />
        <div className="loading-ring" />
        <h2>Dein Imperium wartet.</h2>
        <p>{error || "Verbindung zum Raum wird aufgebaut …"}</p>
        <button className="button" onClick={() => setConnection(null)}>
          <ArrowLeft size={16} /> Zurück
        </button>
      </div>
    );
  const spectator = you === "spectator";
  const p = game.players.find((p) => p.id === you) || (spectator ? {...game.players[0],id:you,name:"Zuschauer",money:0,isHost:false,bankrupt:true} : undefined);
  if (!p)
    return (
      <div className="connecting">
        <p>Spieler wird geladen …</p>
        <button className="button" onClick={leave}>
          Zurück
        </button>
      </div>
    );
  const cp = current(game),
    myTurn = cp?.id === you && !p.bankrupt,
    animating = now < game.actionNotBefore,
    remaining = Math.max(0, Math.ceil((game.turnDeadline - (game.tradeUntil&&game.tradeUntil>now?game.tradeUntil:now)) / 1000)),
    locked = !connected || !myTurn || animating || !!game.auction || !!game.manualPause || !!(game.tradeUntil&&game.tradeUntil>now);
  const definition = selected ? PROPERTIES[selected] : null,
    state = selected ? game.cities[selected] : null,
    owner = game.players.find((p) => p.id === state?.ownerId),
    tile = BOARD.find((t) => t.id === selected),
    landed = PROPERTIES[BOARD[cp?.position || 0].id];
  const actionBar = (
            <div className="turn-bar dice-actions">
              <div className="turn-person">
                <span
                  className="avatar"
                  style={{ "--player": cp.color } as CSSProperties}
                >
                  {cp.avatar}
                </span>
                <div>
                  <small>
                    {myTurn ? "DEIN ZUG" : `${cp.name.toUpperCase()} SPIELT`}
                  </small>
                  <b>
                    {game.auction
                      ? "Auktion läuft"
                      : game.turnPhase === "debt"
                        ? "Eine Zahlung ist offen"
                        : cp.jail >= 0
                          ? "Im Gefängnis"
                          : game.turnPhase === "purchase"
                            ? "Kaufen oder versteigern?"
                            : game.turnPhase === "roll"
                              ? "Würfle für deinen nächsten Zug."
                              : game.extraRoll
                                ? "Pasch! Du darfst erneut würfeln."
                                : "Zeit für deinen nächsten Schritt."}
                  </b>
                </div>
              </div>
              <span
                className={`turn-time ${remaining < 15 && !game.auction ? "urgent" : ""}`}
              >
                <Clock3 size={15} />
                {game.manualPause ? "Pausiert" : game.auction ? "Auktion" : `${remaining}s`}
              </span>
              <div className="turn-actions">
                {game.auction ? (
                  <button
                    className="button gold"
                    onClick={() => openPhone("auction")}
                  >
                    <Gavel size={17} /> Zur Auktion
                  </button>
                ) : game.turnPhase === "purchase" && myTurn ? (
                  <>
                    <button
                      className="button"
                      disabled={locked}
                      onClick={() => send({ type: "skip" })}
                    >
                      Versteigern
                    </button>
                    <button
                      className="button gold"
                      disabled={locked || p.money < (landed?.price || 0)}
                      onClick={() =>
                        landed &&
                        setPayment({
                          city: BOARD[cp?.position || 0].id,
                          amount: landed.price,
                          stage: "ready",
                        })
                      }
                    >
                      Kaufen · {money(landed?.price || 0)}
                    </button>
                  </>
                ) : game.turnPhase === "debt" && myTurn ? (
                  <button
                    className="button gold"
                    onClick={() => openPhone("bank")}
                  >
                    Zahlung klären
                  </button>
                ) : (
                  <>
                    {cp.jail >= 0 && myTurn && game.turnPhase === "roll" && (
                      <button
                        className="button"
                        disabled={locked || p.money < 50}
                        onClick={() => send({ type: "bail" })}
                      >
                        Kaution · 50 €
                      </button>
                    )}
                    <button
                      className="button gold"
                      disabled={locked}
                      onClick={() =>
                        send({
                          type: game.turnPhase === "roll" ? "roll" : "end",
                        })
                      }
                    >
                      {game.turnPhase === "roll" ? (
                        <Dice5 size={19} />
                      ) : (
                        <ArrowRight size={19} />
                      )}{" "}
                      {game.turnPhase === "roll"
                        ? "Würfeln"
                        : game.extraRoll
                          ? "Noch einmal"
                          : "Zug beenden"}
                    </button>
                  </>
                )}
              </div>
            </div>
  );
  const controls = (
    <>
      <button
        className="icon-button"
        title="Spielregeln"
        aria-label="Spielregeln"
        onClick={() => setModal("rules")}
      >
        <BookOpen size={18} />
      </button>
      <button
        className="icon-button"
        aria-label={sound ? "Ton ausschalten" : "Ton einschalten"}
        onClick={() => {
          setSound(!sound);
          localStorage.setItem("we-sound", String(!sound));
          if (!sound) sounds.notify();
        }}
      >
        {sound ? <Volume2 size={18} /> : <VolumeX size={18} />}
      </button>
      <button
        className="icon-button"
        aria-label="Einstellungen"
        onClick={() => setModal("settings")}
      >
        <Settings2 size={18} />
      </button>
      <button
        className="icon-button"
        aria-label="Raum verlassen"
        onClick={leave}
      >
        <LogOut size={18} />
      </button>
    </>
  );
  return (
    <div className={`app-shell look-${look} ${reduced ? "reduce-motion" : ""}`}>
      <header className="topbar">
        <Logo small />
        <nav>
          <span className="nav-active">
            {game.phase === "lobby" ? "Warteraum" : "Spielbrett"}
          </span>
          <button onClick={() => openPhone("properties")}>Mein Imperium</button>
          <button onClick={() => openPhone("news")}>Nachrichten</button>
        </nav>
        <div className="topbar-right">
          <span className={`connection-indicator ${connected ? "online" : ""}`}>
            <i />
            {connection.local
              ? "SOLO MIT BOTS"
              : connected
                ? "LIVE"
                : "VERBINDE …"}
          </span>
          {controls}
        </div>
      </header>
      {spectator && <div className="status-banner">Du schaust zu · {game.gameId}{game.phase === "lobby" && <button className="button gold" disabled={game.players.length>=6} onClick={()=>send({type:"join_play"})}>Jetzt mitspielen</button>}</div>}
      {spectator && game.auction && <div className="status-banner">Auktion: {PROPERTIES[game.auction.cityId].name} · Höchstgebot {money(game.auction.currentBid)} · {Math.max(0,Math.ceil((game.auction.endsAt-(game.manualPause||now))/1000))}s</div>}
      {!connected && <div className="status-banner" role="status">Verbindung wird wiederhergestellt. Dein Platz bleibt erhalten.</div>}
      {game.phase === "lobby" ? (
        <main className="lobby-layout">
          <section className="lobby-hero">
            <span className="eyebrow">
              <Radio size={14} /> DEIN TISCH IST BEREIT
            </span>
            <h1>
              Eine Welt.
              <br />
              <em>Dein Imperium.</em>
            </h1>
            <p>
              Lade deine Freunde ein, wähle deinen Spielmodus und mache den
              ersten Schritt.
            </p>
            <div className="room-code-card">
              <div>
                <small>DEIN RAUMCODE</small>
                <strong>{game.gameId}</strong>
              </div>
              <button
                className="icon-button"
                aria-label="Raumcode kopieren"
                onClick={() => copy(game.gameId)}
              >
                {copied ? <Check /> : <Copy />}
              </button>
              <button
                className="icon-button"
                aria-label="QR Einladung öffnen"
                onClick={() => setModal("invite")}
              >
                <QrCode />
              </button>
            </div>
            <div className="lobby-art">
              <CityArt variant={3} />
              <span>18 STÄDTE. UNENDLICHE MÖGLICHKEITEN.</span>
            </div>
          </section>
          <section className="lobby-panel">
            <div className="section-title">
              <h2>Am Spieltisch</h2>
              <span>{game.players.length} / 6</span>
            </div>
            <div className="lobby-players">
              {game.players.map((player) => (
                <div key={player.id} className="lobby-player">
                  <span
                    className="avatar"
                    style={{ "--player": player.color } as CSSProperties}
                  >
                    {player.avatar}
                  </span>
                  <div>
                    <b>
                      {player.name}
                      {player.id === you ? " (du)" : ""}
                    </b>
                    <small>
                      {player.isHost
                        ? "Gastgeber"
                        : player.isBot
                          ? "Computergegner"
                          : player.connected
                            ? (player.ready ? "Bereit ✓" : "Noch nicht bereit")
                            : "Verbindung getrennt"}
                    </small>
                  </div>
                  {player.isHost ? (
                    <Crown size={17} />
                  ) : player.isBot && p.isHost ? (
                    <button
                      className="icon-button"
                      aria-label={`${player.name} entfernen`}
                      onClick={() =>
                        send({ type: "remove_bot", id: player.id })
                      }
                    >
                      <X size={16} />
                    </button>
                  ) : (
                    <i className="ready-dot" />
                  )}
                </div>
              ))}
            </div>
            {p.isHost && (
              <div className="lobby-actions">
                <button
                  className="button"
                  disabled={game.players.length >= 6}
                  onClick={() => send({ type: "add_bot" })}
                >
                  <Plus size={16} /> Bot hinzufügen
                </button>
                {game.players.some((p) => !p.connected) && (
                  <button
                    className="button"
                    onClick={() => send({ type: "kick_disconnected" })}
                  >
                    Getrennte entfernen
                  </button>
                )}
              </div>
            )}
            <div className="room-settings">
              <h3>Wie willst du spielen?</h3>
              <div className="mode-cards">
                {(["classic", "plus"] as const).map((mode) => (
                  <button
                    key={mode}
                    disabled={!p.isHost}
                    className={game.settings.mode === mode ? "selected" : ""}
                    onClick={() =>
                      send({
                        type: "settings",
                        settings: { ...game.settings, mode },
                      })
                    }
                  >
                    {mode === "plus" ? (
                      <Sparkles size={20} />
                    ) : (
                      <Landmark size={20} />
                    )}
                    <b>{mode === "plus" ? "Empire Plus" : "Klassisch"}</b>
                    <span>
                      {mode === "plus"
                        ? "Börse, Casino & private Auktionen"
                        : "Grundstücke, Handel & Hotels"}
                    </span>
                  </button>
                ))}
              </div>
              <div className="settings-row">
                <label>
                  Startgeld
                  <select
                    disabled={!p.isHost}
                    value={game.settings.startingMoney}
                    onChange={(e) =>
                      send({
                        type: "settings",
                        settings: {
                          ...game.settings,
                          startingMoney: Number(e.target.value),
                        },
                      })
                    }
                  >
                    {[1000, 1500, 2000, 3000, 5000].map((n) => (
                      <option key={n} value={n}>
                        {money(n)}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Zugzeit
                  <select
                    disabled={!p.isHost}
                    value={game.settings.turnSeconds}
                    onChange={(e) =>
                      send({
                        type: "settings",
                        settings: {
                          ...game.settings,
                          turnSeconds: Number(e.target.value),
                        },
                      })
                    }
                  >
                    {[45, 60, 75, 90, 120, 180].map((n) => (
                      <option key={n} value={n}>
                        {n} Sekunden
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Runden
                  <select
                    disabled={!p.isHost}
                    value={game.settings.maxRounds}
                    onChange={(e) =>
                      send({
                        type: "settings",
                        settings: {
                          ...game.settings,
                          maxRounds: Number(e.target.value),
                        },
                      })
                    }
                  >
                    {[0, 10, 20, 30, 50].map((n) => (
                      <option key={n} value={n}>
                        {n || "Ohne Limit"}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </div>
            <AdvancedLobby game={game} you={you} send={send}/><LobbyExtras game={game} you={you} send={send}/><Tournament game={game}/><ProfilePanel room={connection.local?undefined:game.gameId}/>
            {!p.isHost && !spectator && <button className="button gold full" onClick={()=>send({type:"ready",ready:!p.ready})}>{p.ready?"✓ Bereit – zurücknehmen":"Ich bin bereit"}</button>}
            {p.isHost ? (
              <button
                className="button gold start-button"
                disabled={game.players.length < 2 || !connected || game.players.some(x=>!x.isBot&&!x.isHost&&!x.ready)}
                onClick={() => send({ type: "start" })}
              >
                Imperium gründen <ArrowRight size={19} />
              </button>
            ) : (
              <p className="waiting-note">Der Gastgeber startet die Partie.</p>
            )}
            <p className="fineprint centered">
              <ShieldCheck size={13} /> Gleiche Regeln für alle. Viel Raum für
              deinen nächsten Zug.
            </p>
          </section>
        </main>
      ) : game.phase === "finished" ? (
        <main className="results">
          <span className="win-icon">
            <Trophy size={42} />
          </span>
          <span className="eyebrow">DAS IMPERIUM HAT EINEN NAMEN</span>
          <h1>
            {(game.settings.teams?`Team ${((game.players.find(p=>p.id===game.winnerId)?.team)||0)+1}`:game.players.find((p) => p.id === game.winnerId)?.name) ||
              "Unentschieden"}
          </h1>
          <p>
            Die Partie ist beendet. Grundstücke, Gebäude und Aktien zählen zum
            Vermögen.
          </p>
          <div className="ranking">
            {[...game.players]
              .sort(
                (a, b) =>
                  Number(a.bankrupt) - Number(b.bankrupt) ||
                  netWorth(game, b) - netWorth(game, a),
              )
              .map((p, i) => (
                <div key={p.id}>
                  <span>{i + 1}</span>
                  <span
                    className="avatar"
                    style={{ "--player": p.color } as CSSProperties}
                  >
                    {p.avatar}
                  </span>
                  <b>
                    {p.name}
                    <small>
                      {p.bankrupt
                        ? "Ausgeschieden"
                        : `${Object.values(game.cities).filter((c) => c.ownerId === p.id).length} Grundstücke`}
                    </small>
                  </b>
                  <strong>{money(netWorth(game, p))}</strong>
                  {hasWon(game,p.id) && <Crown size={19} />}
                </div>
              ))}
          </div>
          <Tournament game={game}/><Replay game={game}/><Podium game={game}/><ResultsDetails game={game}/><Achievements game={game} you={you}/><Career/>
          {p.isHost ? (
            <button
              className="button gold"
              onClick={() => send({ type: "rematch" })}
            >
              Revanche vorbereiten <ArrowRight size={18} />
            </button>
          ) : (
            <p>Warte auf die Revanche des Hosts.</p>
          )}
        </main>
      ) : (
        <main className="game-layout">
          <section className="game-area">
            <div className="live-tools"><span>{spectator?"Zuschauer":`${p.name} · ${money(p.money)}`}</span>{!spectator && <button className="button" onClick={()=>send({type:game.manualPause?"resume":"pause"})}>{game.manualPause?"Gemeinsam fortsetzen":"Pause & speichern"} {(game.manualPause?game.resumeVotes:game.pauseVotes)?.length || 0}/{game.players.filter(x=>!x.isBot&&!x.bankrupt&&(game.manualPause||x.connected)).length}</button>}</div>
            <RoundExtras game={game} you={you} send={send} now={game.manualPause||now}/>
            {game.settings.targetWealth ? <p className="target-progress">Vermögensziel: {money(netWorth(game,p))} / {money(game.settings.targetWealth)} · Wertung am Zugende</p> : null}
            {game.manualPause && <div className="status-banner">Partie gespeichert und pausiert. Alle verbleibenden Mitspieler müssen zum Fortsetzen zustimmen. Jeder kehrt über seinen eigenen Browser zurück.</div>}
            {game.economy && <div className="status-banner">{game.economy.title} · {groupName(game,game.economy.group)} · Runde {game.round}</div>}
            {!spectator && <Tutorial game={game} you={you} phone={phone} onPhone={openPhone}/>}
            <div className="game-heading">
              <div>
                <span className="eyebrow">
                  {game.settings.mode === "plus"
                    ? "WORLD EMPIRE PLUS"
                    : "DIE KLASSISCHE PARTIE"}
                </span>
                <h1>Dein nächster großer Zug.</h1>
              </div>
              <div className="board-switch">
                <button
                  className={view === "board" ? "selected" : ""}
                  onClick={() => setView("board")}
                  aria-label="Spielbrett anzeigen"
                >
                  <Grid2X2 size={16} />
                </button>
                <button
                  className={view === "globe" ? "selected" : ""}
                  onClick={() => setView("globe")}
                  aria-label="Globus anzeigen"
                >
                  <Globe2 size={16} />
                </button>
              </div>
            </div>
            {view === "board" ? (
              <Board
                game={game}
                selected={selected}
                onSelect={setSelected}
                reduced={reduced}
              >
                <div className="center-orbit" />
                <span className="center-edition">THE WORLD IS YOURS</span>
                <div className="center-brand">
                  WORLD
                  <br />
                  <span>EMPIRE</span>
                </div>
                <div className="center-divider">
                  <span />
                  <Crown size={17} />
                  <span />
                </div>
                <Dice
                  values={game.lastDice}
                  rollId={game.rollId}
                  color={look==="ocean"?"#74d7c6":look==="violet"?"#bfa3ff":cp.color}
                  skin={look}
                  lowMotion={reduced}
                />
                <div className="dice-caption">
                  {animating
                    ? "Die Würfel fallen …"
                    : game.lastDice
                      ? `${game.lastDice[0]} + ${game.lastDice[1]} = ${game.lastDice[0] + game.lastDice[1]}${game.lastDice[0] === game.lastDice[1] ? " · PASCH" : ""}`
                      : "Zwei Würfel. Tausend Möglichkeiten."}
                </div>
                {actionBar}
                <div className="center-turn">
                  <i style={{ background: cp.color }} />
                  <span>
                    {myTurn ? "Du bist am Zug" : `${cp.name} ist am Zug`}{game.settings.teams?` · Team ${(cp.team||0)+1}`:""}
                  </span>
                </div>
                <div className="center-round">
                  RUNDE {game.round}
                  {game.settings.maxRounds
                    ? ` / ${game.settings.maxRounds}`
                    : ""}{" "}
                  <span>•</span>{" "}
                  {game.players.filter((p) => !p.bankrupt).length} SPIELER
                </div>
              </Board>
            ) : (
              <div className="globe-wrapper">
                <Suspense
                  fallback={
                    <div className="connecting">Weltansicht wird geladen …</div>
                  }
                >
                  <Globe
                    game={game}
                    activeCityId={
                      PROPERTIES[BOARD[cp.position].id]?.kind === "city"
                        ? BOARD[cp.position].id
                        : "london"
                    }
                  />
                </Suspense>
                <button
                  className="button globe-back"
                  onClick={() => setView("board")}
                >
                  <Grid2X2 size={16} /> Zum Spielbrett
                </button>
              </div>
            )}
            {view === "globe" && actionBar}
            <div className="board-footnote">
              <span>
                <ShieldCheck size={13} />{" "}
                {connection.local
                  ? "Lokale Partie · automatisch gespeichert"
                  : "Synchronisiert · servergeprüfte Spielzüge"}
              </span>
              <button onClick={() => setModal("invite")}>
                RAUM {game.gameId} <Copy size={12} />
              </button>
            </div>
          </section>
          <aside className="game-sidebar">
            <div className="section-title">
              <h2>Am Spieltisch</h2>
              <span>{game.players.length} Spieler</span>
            </div>
            <div className="player-list">
              {game.players.map((player) => {
                const owns = Object.values(game.cities).filter(
                  (c) => c.ownerId === player.id,
                );
                return (
                  <div
                    key={player.id}
                    role="button" tabIndex={0} aria-label={`Besitz von ${player.name} ansehen`} onClick={()=>setOwnership(player.id)} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();setOwnership(player.id);}}}
                    className={`player-card ${player.id === cp.id ? "current" : ""} ${player.bankrupt ? "out" : ""}`}
                    style={{ "--player": player.color } as CSSProperties}
                  >
                    <span className="avatar">{player.avatar}</span>
                    <div className="player-details">
                      <div>
                        <b>
                          {player.name}
                          {player.id === you && <small> DU</small>}
                        </b>
                        {player.isHost && <Crown size={12} />}
                      </div>
                      <span>
                        {player.bankrupt
                          ? "Ausgeschieden"
                          : player.jail >= 0
                            ? "Im Gefängnis"
                            : player.isBot
                              ? "Computergegner"
                              : player.connected
                                ? "Online"
                                : "Getrennt"}
                      </span>
                      <div className="mini-deeds">
                        {owns.map((c) => (
                          <i
                            key={c.id}
                            style={{
                              background: GROUPS[PROPERTIES[c.id].group].color,
                            }}
                            title={PROPERTIES[c.id].name}
                          />
                        ))}
                        {!owns.length && <small>Noch keine Grundstücke</small>}
                      </div>
                    </div>
                    <div className="player-money">
                      <b>{money(player.money)}</b>
                      <small>{owns.length} Städte & Verkehr</small>
                    </div>
                  </div>
                );
              })}
            </div>
            {definition && state ? (
              <div
                className="inspector"
                style={
                  { "--group": GROUPS[definition.group].color } as CSSProperties
                }
              >
                <button
                  className="inspector-close"
                  onClick={() => setSelected(null)}
                  aria-label="Grundstückskarte schließen"
                >
                  <X size={14} />
                </button>
                <span className="eyebrow">{groupName(game,definition.group)}</span>
                <h2>{definition.name}</h2>
                <CityArt
                  variant={BOARD.findIndex((t) => t.id === selected) % 8}
                />
                <div className="inspect-row">
                  <span>Kaufpreis</span>
                  <b>{money(definition.price)}</b>
                </div>
                <div className="inspect-row">
                  <span>{owner ? "Besitzer" : "Verfügbarkeit"}</span>
                  <b style={{ color: owner?.color }}>
                    {owner?.name || "Bei der Bank"}
                  </b>
                </div>
                <div className="rent-table">
                  {definition.kind === "city"
                    ? definition.rent.map((value, i) => (
                        <div
                          className={
                            state.developmentLevel === i ? "selected" : ""
                          }
                          key={i}
                        >
                          <span>
                            {i === 0
                              ? "Grundmiete"
                              : i === 5
                                ? "Hotel"
                                : `${i} ${i === 1 ? "Haus" : "Häuser"}`}
                          </span>
                          <b>{money(value)}</b>
                        </div>
                      ))
                    : definition.rent.map((value, i) => (
                        <div key={i}>
                          <span>{i + 1} Verkehrsunternehmen</span>
                          <b>{money(value)}</b>
                        </div>
                      ))}
                </div>
                <small className="muted">
                  {state.mortgaged
                    ? "Verpfändet: keine Miete."
                    : `Aktuelle Miete: ${money(rent(game, definition.id))}`}
                </small>
                {definition.kind === "city" && state.developmentLevel < 5 && <p className="rent-preview">Nächste Stufe: {money(definition.rent[state.developmentLevel+1])} Grundmiete · Baukosten {money(definition.buildCost)}. Vollständige Gruppe und gleichmäßiger Ausbau erforderlich.</p>}
                {owner?.id === you && (
                  <button
                    className="button full"
                    onClick={() => openPhone("properties")}
                  >
                    Verwalten <ArrowUpRight size={15} />
                  </button>
                )}
              </div>
            ) : tile ? (
              <div className="inspector">
                <button
                  className="inspector-close"
                  onClick={() => setSelected(null)}
                  aria-label="Feld schließen"
                >
                  <X size={14} />
                </button>
                <span className="eyebrow">SONDERFELD</span>
                <h2>{tile.name}</h2>
                <p className="muted">
                  {tile.kind === "start"
                    ? "Beim Überqueren erhältst du 200 € Startbonus."
                    : tile.kind === "event"
                      ? "Eine Ereigniskarte verändert deinen Zug."
                      : tile.kind === "tax"
                        ? `Zahle ${money(tile.amount || 0)} an die Bank.`
                        : tile.kind === "parking"
                          ? "Hier kannst du durchatmen. Keine Zahlung."
                          : tile.kind === "jail"
                            ? "Nur zu Besuch, außer du wurdest eingewiesen."
                            : "Direkt ins Gefängnis. Kein Startbonus."}
                </p>
              </div>
            ) : (
              <button className="phone-promo" onClick={() => openPhone("home")}>
                <div>
                  <Smartphone size={22} />
                  <span>DEIN EMPIRE PHONE</span>
                </div>
                <h3>Alles in deiner Hand.</h3>
                <p>
                  Deine Städte, deine Deals,
                  <br />
                  dein nächster Schritt.
                </p>
                <span className="phone-promo-link">
                  Handy öffnen <ArrowUpRight size={16} />
                </span>
                <div className="mini-phone">
                  <div />
                  <Landmark size={16} />
                  <Gavel size={16} />
                  <Handshake size={16} />
                  <Globe2 size={16} />
                </div>
              </button>
            )}
            <div className="activity-panel">
              <div className="section-title">
                <h2>
                  <Radio size={14} /> Spielgeschehen
                </h2>
                <span>LIVE</span>
              </div>
              <div className="activity-scroll">
                {game.log.slice(0, 14).map((l) => (
                  <div className={`activity-item ${l.kind}`} key={l.id}>
                    <i />
                    <p>{l.text}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="chat-panel">
              <h3>
                <MessageCircle size={15} /> Tischgespräch
              </h3>
              {!spectator && <div className="quick-reactions">{["👏","😅","Guter Deal!","Zu teuer","Viel Glück!"].map(text=><button key={text} className="button" disabled={!connected} onClick={()=>send({type:"chat",text})}>{text}</button>)}</div>}
              <div className="chat-scroll">
                {game.chat.length ? (
                  game.chat.slice(-12).map((m) => (
                    <p key={m.id}>
                      <b
                        style={{
                          color: game.players.find((p) => p.id === m.playerId)
                            ?.color,
                        }}
                      >
                        {m.name}
                      </b>{" "}
                      {m.text}
                    </p>
                  ))
                ) : (
                  <p className="muted">
                    Ein guter Deal beginnt mit einem Gespräch.
                  </p>
                )}
              </div>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (chat.trim()) {
                    send({ type: "chat", text: chat });
                    setChat("");
                  }
                }}
              >
                <input
                  aria-label="Chatnachricht"
                  maxLength={200}
                  value={chat}
                  onChange={(e) => setChat(e.target.value)}
                  placeholder={spectator?"Zuschauer lesen mit":"Nachricht schreiben …"}
                  disabled={spectator}
                />
                <button aria-label="Nachricht senden" disabled={!chat.trim() || spectator}>
                  <Send size={16} />
                </button>
              </form>
            </div>
          </aside>
        </main>
      )}
      {game.phase === "playing" && !spectator && <button
        className="phone-trigger"
        disabled={spectator}
        onClick={() => openPhone("home")}
        aria-label="Handy öffnen"
      >
        <Smartphone size={24} />
        <span>PHONE</span>
        {(!!game.auction ||
          game.trades.some(
            (t) => t.toId === you && t.status === "pending",
          )) && <i />}
      </button>}
      {phone && !spectator && (
        <Phone
          game={game}
          you={you}
          app={phone}
          setApp={setPhone}
          onClose={() => setPhone(null)}
          send={send}
          now={game.manualPause||now}
        />
      )}
      {payment && !spectator && (
        <Dialog
          title="Kauf autorisieren"
          onClose={() => {
            if (payment.stage !== "face") setPayment(null);
          }}
        >
          <div className="payment-flow">
            <div className="payment-flow-head">
              <span className="eyebrow">WORLD EMPIRE PAY</span>
              <h2>{PROPERTIES[payment.city]?.name || "Grundstück"}</h2>
              <strong>{money(payment.amount)}</strong>
            </div>

            <EmpirePaymentCard
              name={p.name}
              wealth={netWorth(game, p)}
              seed={you}
              now={now}
              compact
            />

            {payment.stage === "ready" && (
              <>
                <div className="payment-terminal">
                  <span className="terminal-screen">KARTE BEREIT</span>
                  <div className="terminal-slot" />
                  <small>Virtuelle Spielkarte · keine echte Zahlung</small>
                </div>
                <button
                  className="button gold full face-id-button"
                  onClick={() => {
                    setPayment({ ...payment, stage: "face" });
                    window.setTimeout(
                      () =>
                        setPayment((x) =>
                          x ? { ...x, stage: "approved" } : x,
                        ),
                      reduced ? 120 : 850,
                    );
                  }}
                >
                  <ShieldCheck size={17} /> Mit Face ID bestätigen
                </button>
              </>
            )}

            {payment.stage === "face" && (
              <div className="face-id-stage" role="status" aria-live="polite">
                <div className="face-id-frame">
                  <span />
                  <span />
                  <span />
                  <span />
                  <ShieldCheck size={40} />
                </div>
                <b>Face ID</b>
                <small>Spielzahlung wird bestätigt …</small>
              </div>
            )}

            {payment.stage === "approved" && (
              <div className="payment-approved">
                <span className="payment-check"><Check size={31} /></span>
                <h3>Bestätigt</h3>
                <p>
                  {money(payment.amount)} für {PROPERTIES[payment.city]?.name || "das Grundstück"}.
                </p>
                <button
                  className="button gold full"
                  disabled={
                    locked ||
                    game.turnPhase !== "purchase" ||
                    BOARD[cp?.position || 0].id !== payment.city ||
                    p.money < payment.amount
                  }
                  onClick={() => {
                    send({ type: "buy" });
                    setPayment(null);
                  }}
                >
                  Kauf abschließen
                </button>
              </div>
            )}
          </div>
        </Dialog>
      )}
      {modal === "rules" && <Rules onClose={() => setModal(null)} />}
      {modal === "invite" && (
        <Dialog
          title="Gute Gesellschaft. Große Pläne."
          onClose={() => setModal(null)}
        >
          <p className="muted">
            {connection.local
              ? "Diese Partie läuft lokal mit Bots. Für Freunde erstelle im Startbildschirm einen Online-Raum."
              : "Teile den Link oder den Raumcode mit deinen Freunden."}
          </p>
          {qr && (
            <img className="invite-qr" src={qr} alt="QR-Code zur Einladung" />
          )}
          <div className="invite-code">{game.gameId}</div>
          <button
            className="button gold full"
            onClick={() =>
              copy(`${location.origin}${location.pathname}?room=${game.gameId}`)
            }
          >
            {copied ? <Check size={17} /> : <Copy size={17} />} Einladungslink
            kopieren
          </button>
        </Dialog>
      )}
      {ownership&&game&&<OwnershipDialog game={game} id={ownership} onClose={()=>setOwnership(null)}/>}
      {modal === "settings" && (
        <Dialog title="Dein Spielerlebnis." onClose={() => setModal(null)}>
          <AudioSettings/><InstallApp/><ProfilePanel room={connection.local?undefined:game.gameId}/><Cosmetics onChange={()=>setLook(localStorage.getItem("we-look")||"classic")}/><Career/>
          <label className="toggle-setting">
            <span>
              <b>Soundeffekte</b>
              <small>Würfel, Nachrichten und Geldbewegungen</small>
            </span>
            <input
              type="checkbox"
              checked={sound}
              onChange={(e) => {
                setSound(e.target.checked);
                localStorage.setItem("we-sound", String(e.target.checked));
              }}
            />
          </label>
          <label className="toggle-setting">
            <span>
              <b>Weniger Animationen</b>
              <small>Ruhigeres Bild und geringere Grafiklast</small>
            </span>
            <input
              type="checkbox"
              checked={reduced}
              onChange={(e) => {
                setReduced(e.target.checked);
                localStorage.setItem("we-reduced", String(e.target.checked));
              }}
            />
          </label>
          <p className="fineprint">
            Spielregeln und Modus legt der Host in der Lobby fest.
          </p>
        </Dialog>
      )}
      {toast && (
        <div
          className={`money-toast ${toast.startsWith("-") ? "negative" : ""}`}
          role="status"
        >
          {toast}
        </div>
      )}
      {error && (
        <div className="error-toast" role="alert">
          <span>{error}</span>
          <button onClick={clearError} aria-label="Fehlermeldung schließen">
            <X size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
function Landing({
  onJoin,
  onRules,
  rules,
}: {
  onJoin: (c: Connection) => void;
  onRules: () => void;
  rules: ReactNode;
}) {
  const [name, setName] = useState(() => localStorage.getItem("we-name") || ""),
    [avatar, setAvatar] = useState(AVATARS[0]),
    [code, setCode] = useState(
      () =>
        new URLSearchParams(location.search).get("room")?.toUpperCase() || "",
    ),
    [api, setApi] = useState(() => location.origin),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [serverOpen, setServerOpen] = useState(false);
  useEffect(() => {
    Promise.resolve({json:()=>Promise.resolve({apiBase:location.origin})})
      .then((r) => r.json())
      .then((raw) => {
        const c = raw as { apiBase?: string };
        if (c.apiBase) setApi(c.apiBase);
      })
      .catch(() => {});
  }, []);
  function enter(room: string, local: boolean, spectator = false) {
    const clean = name.trim();
    if (!clean) {
      setError("Gib zuerst deinen Spielernamen ein.");
      return;
    }
    localStorage.setItem("we-name", clean);
    if (api) localStorage.setItem("we-api", api);
    const key = `we-token-${room}`;
    let token = localStorage.getItem(key);
    if (!token) {
      token = makeToken();
      localStorage.setItem(key, token);
    }
    onJoin({ code: room, name: clean, avatar, local, api, token, spectator });
  }
  async function online(create: boolean) {
    setError("");
    if (!name.trim()) {
      setError("Gib zuerst deinen Spielernamen ein.");
      return;
    }
    let base: URL;
    try {
      base = new URL(api);
      if (!["http:", "https:"].includes(base.protocol)) throw new Error();
    } catch {
      setServerOpen(true);
      setError(
        "Online-Server noch nicht verbunden. Trage die Worker-Adresse ein oder spiele sofort mit Bots.",
      );
      return;
    }
    if (!create && !/^[A-Z0-9]{8}$/.test(code)) {
      setError("Der Raumcode hat 8 Zeichen.");
      return;
    }
    setBusy(true);
    try {
      let room = code;
      if (create) {
        const response = await fetch(new URL("/api/rooms", base), {
          method: "POST",
        });
        if (!response.ok)
          throw new Error(
            "Server nicht erreichbar. Prüfe die freigegebene Pages-Adresse.",
          );
        room = ((await response.json()) as { gameId: string }).gameId;
      }
      enter(room, false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="landing">
      <header className="landing-header">
        <Logo />
        <div>
          <span className="version-badge">THE INTERNATIONAL EDITION</span>
          <button className="button" onClick={onRules}>
            <BookOpen size={16} /> So wird gespielt
          </button>
        </div>
      </header>
      <main className="landing-main">
        {recentConnections().length>0 && <section className="saved-rooms upgrade-panel"><h3>Deine letzten Spieltische</h3><p>Pausierte Partien bleiben gespeichert. Kehre mit diesem Browser zu deinem Platz zurück.</p>{recentConnections().map(c=><button className="button" key={c.api+c.code} onClick={()=>onJoin(c)}>Fortsetzen · {c.code} · {c.name}{c.local?' · Lokal':''}</button>)}</section>}
        <section className="landing-copy">
          <span className="eyebrow">
            <span className="gold-line" /> STRATEGIE TRIFFT MÖGLICHKEITEN
          </span>
          <h1>
            Die Welt liegt
            <br />
            dir zu <em>Füßen.</em>
          </h1>
          <p>
            Kaufe ikonische Städte. Schließe große Deals.
            <br />
            Und baue das Imperium, das deinen Namen trägt.
          </p>
          <div className="landing-features">
            <span>
              <Users size={17} /> 2–6 Spieler
            </span>
            <span>
              <Dice5 size={17} /> Echte 3D-Würfel
            </span>
            <span>
              <Smartphone size={17} /> Dein Empire Phone
            </span>
          </div>
          <div className="hero-illustration">
            <div className="hero-orbit one" />
            <div className="hero-orbit two" />
            <div className="hero-city">
              <CityArt variant={2} />
            </div>
            <div className="floating-deed deed-paris">
              <span />
              <small>EUROPA</small>
              <h3>Paris</h3>
              <CityArt variant={4} />
              <b>180 €</b>
              <i>DEIN NÄCHSTER GROSSER DEAL</i>
            </div>
            <div className="floating-deed deed-tokyo">
              <span />
              <small>PAZIFIK</small>
              <h3>Tokyo</h3>
              <CityArt variant={3} />
              <b>400 €</b>
            </div>
            <div className="hero-dice">
              <Dice values={null} rollId={0} color="#f1bc62" />
            </div>
            <div className="hero-label">
              <i /> DIE NÄCHSTE RUNDE GEHÖRT DIR.
            </div>
          </div>
        </section>
        <section className="entry-card">
          <div className="entry-card-head">
            <span className="entry-symbol">
              <Crown size={25} />
            </span>
            <span className="eyebrow">DEIN PLATZ AM TISCH</span>
            <h2>Bereit für mehr?</h2>
            <p>Dein Imperium beginnt mit einem Namen.</p>
          </div>
          <label>
            Spielername
            <input
              autoComplete="nickname"
              maxLength={20}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Wie heißt du?"
            />
          </label>
          <label>Deine Spielfigur</label>
          <div className="avatar-picker">
            {AVATARS.filter(a=>a!=="★"&&a!=="◆"||readStats().games>=(a==="★"?1:3)).map((a) => (
              <button
                key={a}
                className={a === avatar ? "selected" : ""}
                onClick={() => setAvatar(a)}
                aria-label={`Spielfigur ${a}`}
                aria-pressed={a === avatar}
              >
                {a}
              </button>
            ))}
          </div>
          <button
            className="button gold full"
            disabled={busy}
            onClick={() => online(true)}
          >
            Privaten Raum erstellen <ArrowUpRight size={18} />
          </button>
          <button
            className="button full solo-button"
            onClick={() =>
              enter(
                `LOCAL${crypto.randomUUID().slice(0, 3).toUpperCase()}`,
                true,
              )
            }
          >
            <Zap size={17} /> Sofort mit Bots spielen
          </button>
          <ProfilePanel/><InstallApp/><PublicRooms api={api} onChoose={(room,watch)=>enter(room,false,watch)}/>
          <div className="divider-text">
            <span /> ODER EINEM SPIEL BEITRETEN <span />
          </div>
          <div className="join-row">
            <input
              aria-label="Raumcode"
              value={code}
              maxLength={8}
              onChange={(e) =>
                setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))
              }
              placeholder="RAUMCODE"
            />
            <button
              className="button"
              disabled={busy}
              onClick={() => online(false)}
              aria-label="Raum beitreten"
            >
              <ArrowRight size={20} />
            </button>
          </div>
          <button className="button full" disabled={!/^[A-Z0-9]{8}$/.test(code)} onClick={()=>enter(code,false,true)}>Mit Raumcode zuschauen</button>
          {error && (
            <p className="entry-error" role="alert">
              {error}
            </p>
          )}
          <button
            className="server-toggle"
            onClick={() => setServerOpen(!serverOpen)}
          >
            <Wifi size={13} />
            {api ? "Online-Verbindung" : "Online-Server verbinden"}
            <ChevronRight size={13} />
          </button>
          {serverOpen && (
            <div className="server-settings">
              <label>
                Server-Adresse
                <input
                  type="url"
                  value={api}
                  onChange={(e) => setApi(e.target.value.replace(/\/$/, ""))}
                  placeholder="https://world-empire-api.…workers.dev"
                />
              </label>
              <p>
                Einmalig die Worker-Adresse aus deiner Hosting-Einrichtung
                eintragen. Sie wird in diesem Browser gespeichert.
              </p>
              <button
                className="button full"
                onClick={() => {
                  localStorage.setItem("we-api", api);
                  setServerOpen(false);
                }}
              >
                Verbindung speichern
              </button>
            </div>
          )}
          <div className="entry-bottom">
            <ShieldCheck size={14} /> Kostenlos spielen · Nur virtuelles
            Spielgeld
          </div>
        </section>
      </main>
      <footer className="landing-footer">
        <span>WORLD EMPIRE © 2026</span>
        <span>DEINE STÄDTE. DEINE ENTSCHEIDUNGEN. DEIN IMPERIUM.</span>
        <span>MADE FOR YOUR NEXT MOVE.</span>
      </footer>
      {rules}
    </div>
  );
}
function Dialog({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement;
    ref.current?.querySelector<HTMLElement>("button")?.focus();
    function key(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (e.key === "Tab") {
        const all = ref.current?.querySelectorAll<HTMLElement>(
          "button,input,select,a[href]",
        );
        if (!all?.length) return;
        const first = all[0],
          last = all[all.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("keydown", key);
      previous?.focus();
    };
  }, []);
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={ref}
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <button
          className="modal-close icon-button"
          aria-label="Schließen"
          onClick={onClose}
        >
          <X size={20} />
        </button>
        <span className="eyebrow">WORLD EMPIRE</span>
        <h2>{title}</h2>
        {children}
      </div>
    </div>
  );
}
function Rules({ onClose }: { onClose: () => void }) {
  return (
    <Dialog title="So wächst dein Imperium." onClose={onClose}>
      <div className="rules-list">
        {[
          [
            "01",
            "Würfeln & reisen",
            "Zwei Würfel bewegen dich über 32 Felder. Beim Überqueren von Start erhältst du 200 €. Pasch bedeutet einen zusätzlichen Wurf. Drei Pasche hintereinander führen ins Gefängnis.",
          ],
          [
            "02",
            "Kaufen & sammeln",
            "Freie Grundstücke kaufen oder versteigern. Auf fremden Grundstücken zahlst du Miete. Vollständige Stadtgruppen verdoppeln die unbebaute Grundmiete.",
          ],
          [
            "03",
            "Häuser & Hotels",
            "Besitze die ganze Gruppe und löse ihre Hypotheken aus. Baue gleichmäßig: maximal vier Häuser, danach ein Hotel. Verkaufe Gebäude ebenfalls gleichmäßig für die Hälfte der Baukosten.",
          ],
          [
            "04",
            "Verhandeln & versteigern",
            "Handle Geld und Grundstücke über das Handy. Vor Grundstückstransfers müssen alle Gebäude ihrer Gruppe verkauft sein. Hypotheken bleiben beim Handel bestehen. Auktionen reservieren Gebote und pausieren den Zugtimer.",
          ],
          [
            "05",
            "Gefängnis & Geldnot",
            "Zahle 50 € Kaution vor dem Wurf oder versuche bis zu dreimal einen Pasch. Nach dem dritten Fehlversuch werden 50 € fällig; danach ziehst du mit dem dritten Wurf weiter. Bei Geldnot kannst du Gebäude, Hypotheken und Aktien nutzen. Bei Bankrott gehen verbleibende Werte an den Gläubiger, sonst an die Bank.",
          ],
          [
            "06",
            "Empire Plus",
            "Zusätzlich: private Auktionen, fiktive Aktien und Spielgeld-Casino. Drei Börsengeschäfte und vier Casino-Runden pro Zug. Einsatz ab 1 € bis zum verfügbaren Spielgeld. Aktienkurse ändern sich einmal pro voller Runde; Würfel und Casino werden online vom Server bestimmt.",
          ],
          [
            "07",
            "Gewinnen",
            "Der letzte aktive Spieler gewinnt. Bei einem Rundenlimit zählt Bargeld plus Grundstückswerte, Gebäudeinvestitionen und Aktien; verpfändete Grundstücke zählen zur Hälfte. Bei Gleichstand entscheidet die ursprüngliche Spielerreihenfolge.",
          ],
        ].map(([n, title, text]) => (
          <div key={n}>
            <span>{n}</span>
            <article>
              <h3>{title}</h3>
              <p>{text}</p>
            </article>
          </div>
        ))}
      </div>
      <p className="fineprint">
        Eigenständige Umsetzung im Stil klassischer Immobilien-Brettspiele.
        Deine 18 Städte bilden ein eigenes 32-Felder-Brett. Keine bestätigte
        1:1-Kopie sämtlicher Richup-Sonderregeln. Unbegrenzter Gebäudevorrat;
        Verkehrsmiete 25/50/100/200 €. Freier Parkplatz ohne Auszahlung.
      </p>
    </Dialog>
  );
}
ReactDOM.createRoot(document.getElementById("root")!).render(<App />);

if('serviceWorker' in navigator)window.addEventListener('load',()=>{navigator.serviceWorker.register('/sw.js').catch(()=>{});});
