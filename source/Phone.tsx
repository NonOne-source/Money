import {DebtHelper,PropertyTags,TradeComparison} from './PropertyTools.tsx';
import {propertyColor,sortedProperties,quickBid} from './advisors.ts';
import {groupName} from './presets.ts';
import {WealthChart, Achievements} from "./Enhancements.tsx";
import {gameProperties} from "./custom.ts";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import {
  ArrowDownLeft,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Bell,
  Building2,
  ChevronRight,
  Gavel,
  Handshake,
  Landmark,
  Newspaper,
  Signal,
  Spade,
  TrendingUp,
  Wallet,
  Wifi,
  X,
  BatteryFull,
  LockKeyhole,
} from "lucide-react";
import {
  current,
  available,
  groupCities,
  handValue,
  netWorth,
  ownsGroup,
  rent,
  rouletteColor,
  type Action,
  type GameState,
} from "./game.ts";
import { GROUPS, money, STOCKS } from "./rules.ts";
export type AppId =
  | "home"
  | "bank"
  | "properties"
  | "trade"
  | "auction"
  | "stocks"
  | "casino"
  | "news";
export const APPS = [
  {
    id: "bank",
    name: "Empire Bank",
    short: "Bank",
    icon: Landmark,
    color: "#a8d9ca",
  },
  {
    id: "properties",
    name: "Immobilien",
    short: "Immobilien",
    icon: Building2,
    color: "#d8c6a9",
  },
  {
    id: "trade",
    name: "Handelsplatz",
    short: "Handel",
    icon: Handshake,
    color: "#bfb0e5",
  },
  {
    id: "auction",
    name: "Auktionen",
    short: "Auktionen",
    icon: Gavel,
    color: "#e8bb7d",
  },
  {
    id: "stocks",
    name: "Empire Exchange",
    short: "Börse",
    icon: TrendingUp,
    color: "#8fc6dc",
  },
  {
    id: "casino",
    name: "Empire Club",
    short: "Casino",
    icon: Spade,
    color: "#de91a6",
  },
  {
    id: "news",
    name: "Empire Daily",
    short: "News",
    icon: Newspaper,
    color: "#a9b7c8",
  },
] as const;
const wheelOrder = [
  0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24,
  16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26,
];
export function Phone({
  game,
  you,
  app,
  setApp,
  onClose,
  send,
  now,
}: {
  game: GameState;
  you: string;
  app: AppId;
  setApp: (a: AppId) => void;
  onClose: () => void;
  send: (a: Action) => void;
  now: number;
}) {
  const PROPERTIES = gameProperties(game);
  const p = game.players.find((p) => p.id === you)!;
  const mine =
    current(game)?.id === you && !p.bankrupt && game.phase === "playing";
  const active = !game.manualPause && !game.auction && !game.tradeUntil && mine && now >= game.actionNotBefore;
  const plus = game.settings.mode === "plus";
  const owned = Object.values(game.cities).filter((c) => c.ownerId === you);
  const pending = game.trades.filter(
    (t) => t.status === "pending" && (t.toId === you || t.fromId === you),
  );
  const [city, setCity] = useState(owned[0]?.id || ""),
    [minimum, setMinimum] = useState(50),
    [quantity, setQuantity] = useState(1),
    [bet, setBet] = useState(20),
    [choice, setChoice] = useState("red"),
    [casinoTab, setCasinoTab] = useState<"roulette" | "blackjack">("roulette");
  const [partner, setPartner] = useState(
      game.players.find((x) => x.id !== you && !x.bankrupt)?.id || "",
    ),
    [offer, setOffer] = useState<string[]>([]),
    [request, setRequest] = useState<string[]>([]),
    [offerCash, setOfferCash] = useState(0),
    [requestCash, setRequestCash] = useState(0),
    [counterOf,setCounterOf] = useState<string|undefined>();
  useEffect(()=>{if(counterOf && !game.trades.some(t=>t.id===counterOf && t.status==='pending'))setCounterOf(undefined);},[game.trades,counterOf]);
  const [packet,setPacket]=useState<string[]>([]);
  const [bid, setBid] = useState(10);
  const root = useRef<HTMLDivElement>(null),
    closeButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const before = document.activeElement as HTMLElement;
    closeButton.current?.focus();
    function key(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (e.key === "Tab") {
        const nodes = root.current?.querySelectorAll<HTMLElement>(
          'button:not([disabled]),input:not([disabled]),select:not([disabled]),[tabindex="0"]',
        );
        if (!nodes?.length) return;
        const first = nodes[0],
          last = nodes[nodes.length - 1];
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
      before?.focus();
    };
  }, []);
  useEffect(() => {
    if (game.auction)
      setBid(
        game.auction.bidderId
          ? game.auction.currentBid + 10
          : game.auction.minimum,
      );
  }, [game.auction?.id, game.auction?.currentBid]);
  const spin = useRef(0),
    [rotation, setRotation] = useState(0);
  useEffect(() => {
    const r = game.roulette;
    if (!r || r.playerId !== you) return;
    const target = (360 - (wheelOrder.indexOf(r.number) * 360) / 37) % 360;
    spin.current += 1440 + ((target - (spin.current % 360) + 360) % 360);
    setRotation(spin.current);
  }, [game.roulette?.id]);
  const appDef = APPS.find((a) => a.id === app);
  const canCasino =
    active &&
    plus &&
    game.turnPhase === "end" &&
    p.casinoPlays < (game.settings.casinoLimit??4) &&
    game.blackjack?.status !== "playing";
  const badgeCount =
    pending.filter((t) => t.toId === you).length + (game.auction ? 1 : 0);
  const toggle = (id: string, value: string[], set: (v: string[]) => void) =>
    set(value.includes(id) ? value.filter((x) => x !== id) : [...value, id]);
  return (
    <div
      className="phone-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="phone"
        role="dialog"
        aria-modal="true"
        aria-label="Empire Phone"
        ref={root}
      >
        <div className="phone-hardware">
          <span className="phone-speaker" />
          <div className="phone-status">
            <b>
              {new Date(now).toLocaleTimeString("de-DE", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </b>
            <span>
              <Signal size={12} />
              <Wifi size={12} />
              <BatteryFull size={16} />
            </span>
          </div>
        </div>
        <div className="phone-nav">
          <button
            aria-label={
              app === "home" ? "Handy schließen" : "Zum Startbildschirm"
            }
            onClick={() => (app === "home" ? onClose() : setApp("home"))}
          >
            <ArrowLeft size={18} />
          </button>
          <span>{app === "home" ? "EMPIRE OS" : appDef?.name}</span>
          <button
            ref={closeButton}
            onClick={onClose}
            aria-label="Handy schließen"
          >
            <X size={18} />
          </button>
        </div>
        <div className={`phone-content app-${app} ${app === "casino" ? "casino-content" : ""}`}>
          {app === "home" && (
            <>
              <div className="phone-greeting">
                <span>DEIN IMPERIUM, IN DEINER HAND.</span>
                <h2>Hallo, {p.name}.</h2>
                <p>
                  {mine
                    ? "Du bist am Zug. Mach deinen nächsten Schritt."
                    : "Das Geschehen im Blick. Jederzeit."}
                </p>
              </div>
              <button className="wallet-widget" onClick={() => setApp("bank")}>
                <div>
                  <Wallet size={19} />
                  <span>Verfügbares Spielgeld</span>
                  <ArrowUpRight size={16} />
                </div>
                <strong>{money(available(game, p))}</strong>
                <small>
                  {owned.length} Grundstücke <span>•</span>{" "}
                  {money(netWorth(game, p))} Vermögen
                </small>
              </button>
              <div className="app-grid">
                {APPS.map(({ id, short, icon: Icon, color }) => (
                  <button
                    key={id}
                    className="app-icon"
                    onClick={() => setApp(id)}
                  >
                    <span style={{ "--app-color": color } as CSSProperties}>
                      <Icon size={25} strokeWidth={1.65} />
                      {id === "auction" && game.auction && <i />}
                      {id === "trade" &&
                        pending.some((t) => t.toId === you) && <i />}
                      {!plus && (id === "stocks" || id === "casino") && (
                        <LockKeyhole className="locked-icon" size={12} />
                      )}
                    </span>
                    <b>{short}</b><small>{id === "casino" ? (canCasino ? `${(game.settings.casinoLimit??4)-p.casinoPlays} Spiele frei` : "Nach deinem Wurf") : id === "auction" ? (game.auction ? "Jetzt bieten" : "Keine Auktion") : id === "trade" ? `${pending.filter(t=>t.toId===you).length} Angebote` : id === "stocks" ? (active&&plus?"Handel möglich":"Kurse ansehen") : "Öffnen"}</small>
                  </button>
                ))}
              </div>
              <div className="phone-notice">
                <Bell size={16} />
                <div>
                  <b>
                    {game.auction
                      ? "Auktion läuft"
                      : badgeCount
                        ? `${badgeCount} neue Meldungen`
                        : "Alles auf dem neuesten Stand"}
                  </b>
                  <p>
                    {game.auction
                      ? `${(game.auction.cityIds||[game.auction.cityId]).map(id=>PROPERTIES[id].name).join(" + ")} wartet auf dein Gebot.`
                      : game.news[0]}
                  </p>
                </div>
              </div>
              <div className="phone-footer-note">
                WORLD EMPIRE · {plus ? "PLUS" : "KLASSISCH"}
              </div>
            </>
          )}
          {app === "bank" && (
            <>
              <div className="app-eyebrow">EMPIRE PRIVATE BANKING</div>
              <h2>Dein Überblick.</h2>
              <div className="bank-card">
                <Landmark size={23} />
                <span>KONTOSTAND</span>
                <strong>{money(p.money)}</strong>
                <footer>
                  <b>{p.name.toUpperCase()}</b>
                  <span>•••• {you.slice(-4).toUpperCase()}</span>
                </footer>
              </div>
              <div className="stat-grid">
                <div>
                  <small>Gesamtvermögen</small>
                  <b>{money(netWorth(game, p))}</b>
                </div>
                <div>
                  <small>Reserviert</small>
                  <b>{money(p.money - available(game, p))}</b>
                </div>
                <div>
                  <small>Aktienwert</small><b>{money(game.stocks.reduce((v,s)=>v+s.price*(p.stocks[s.id]||0),0))}</b>
                </div><div>
                  <small>Immobilienwert (abzgl. Hypotheken)</small><b>{money(netWorth(game,p)-p.money-game.stocks.reduce((v,s)=>v+s.price*(p.stocks[s.id]||0),0)+(game.debt?.playerId===you?game.debt.amount:0))}</b>
                </div><div>
                  <small>Miete erhalten</small>
                  <b className="positive">+{money(p.rentCollected)}</b>
                </div>
                <div>
                  <small>Miete bezahlt</small>
                  <b>{money(p.rentPaid)}</b>
                </div>
              </div>
              <DebtHelper game={game} you={you} send={send} active={active}/>
              {game.debt?.playerId === you && (
                <div className="warning-box">
                  <b>Offene Zahlung: {money(game.debt.amount)}</b>
                  <p>
                    {game.debt.reason}. Verwalte Immobilien oder verkaufe
                    Aktien.
                  </p>
                  <button
                    className="button gold"
                    disabled={!active || p.money < game.debt.amount}
                    onClick={() => send({ type: "settle_debt" })}
                  >
                    Zahlung begleichen
                  </button>
                  <button
                    className="button danger"
                    disabled={!active}
                    onClick={() => {
                      if (
                        window.confirm(
                          "Wirklich aufgeben? Dein Besitz wird abgewickelt.",
                        )
                      )
                        send({ type: "surrender" });
                    }}
                  >
                    Bankrott erklären
                  </button>
                </div>
              )}
              <button
                className="list-link"
                onClick={() => setApp("properties")}
              >
                <Building2 size={18} /> Hypotheken verwalten{" "}
                <ChevronRight size={16} />
              </button>
              <WealthChart game={game} playerId={you}/>
              <Achievements game={game} you={you}/>
              <h3>Letzte Bewegungen</h3>
              {game.log
                .filter((l) =>
                  [
                    "money",
                    "purchase",
                    "auction",
                    "trade",
                    "stock",
                    "casino",
                  ].includes(l.kind),
                )
                .slice(0, 10)
                .map((l) => (
                  <div className="transaction" key={l.id}>
                    <span>
                      <ArrowDownLeft size={16} />
                    </span>
                    <p>{l.text}</p>
                  </div>
                ))}
            </>
          )}
          {app === "properties" && (
            <>
              <div className="app-eyebrow">DEIN PORTFOLIO</div>
              <h2>
                Große Pläne.
                <br />
                Eigene Städte.
              </h2>
              <p className="muted">
                Vollständige Gruppen erlauben gleichmäßigen Ausbau. 4 Häuser →
                Hotel.
              </p>
              {!owned.length && (
                <div className="empty-state">
                  <Building2 size={36} />
                  <h3>Deine erste Stadt wartet.</h3>
                  <p>
                    Kaufe ein Grundstück, auf dem du landest, oder gewinne eine
                    Auktion.
                  </p>
                </div>
              )}
              {owned.map((c) => {
                const d = PROPERTIES[c.id],
                  full = ownsGroup(game, c.id, you);
                return (
                  <div
                    className="property-item"
                    key={c.id}
                    style={
                      { "--group": GROUPS[d.group].color } as CSSProperties
                    }
                  >
                    <div className="property-item-title">
                      <span />
                      <div>
                        <b>{d.name}</b>
                        <small>
                          {groupName(game,d.group)} {full ? "· Vollständig" : ""}
                        </small>
                      </div>
                      <b>
                        {c.mortgaged
                          ? "Hypothek"
                          : c.developmentLevel === 5
                            ? "Hotel"
                            : `${c.developmentLevel} Häuser`}
                      </b>
                    </div>
                    <div className="property-metrics">
                      <span>
                        Wert <b>{money(d.price)}</b>
                      </span>
                      <span>
                        Miete <b>{money(rent(game, c.id))}</b>
                      </span>
                    </div>
                    <div className="property-actions">
                      {d.kind === "city" && (
                        <>
                          <button
                            disabled={
                              !active ||
                              !full ||
                              c.mortgaged ||
                              c.developmentLevel >= 5 ||
                              !!game.debt ||
                              game.turnPhase === "purchase"
                            }
                            onClick={() =>
                              send({ type: "build", cityId: c.id })
                            }
                          >
                            Bauen · {money(d.buildCost)}
                          </button>
                          <button
                            disabled={
                              !active ||
                              !c.developmentLevel ||
                              game.turnPhase === "purchase"
                            }
                            onClick={() =>
                              send({ type: "sell_building", cityId: c.id })
                            }
                          >
                            Gebäude verkaufen
                          </button>
                        </>
                      )}
                      {c.mortgaged ? (
                        <button
                          disabled={
                            !active ||
                            !!game.debt ||
                            game.turnPhase === "purchase"
                          }
                          onClick={() =>
                            send({ type: "unmortgage", cityId: c.id })
                          }
                        >
                          Auslösen · {money(Math.ceil(d.price * 0.55))}
                        </button>
                      ) : (
                        <button
                          disabled={
                            !active ||
                            groupCities(c.id).some(
                              (id) => game.cities[id].developmentLevel > 0,
                            ) ||
                            game.turnPhase === "purchase"
                          }
                          onClick={() =>
                            send({ type: "mortgage", cityId: c.id })
                          }
                        >
                          Verpfänden · +{money(Math.floor(d.price / 2))}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </>
          )}
          {app === "auction" && (
            <>
              <div className="app-eyebrow">DER MARKTPLATZ</div>
              <h2>
                Ein Gebot.
                <br />
                Neue Möglichkeiten.
              </h2>
              {game.auction ? (
                <>
                  <div className="auction-live">
                    <span className="live-label">
                      <i /> LIVE-AUKTION
                    </span>
                    <strong>{(game.auction.cityIds||[game.auction.cityId]).map(id=>PROPERTIES[id].name).join(" + ")}</strong>
                    <p>
                      {game.auction.sellerId
                        ? `Verkäufer: ${game.players.find((p) => p.id === game.auction!.sellerId)?.name}`
                        : "Versteigerung der Bank"}{" "}
                      · {money((game.auction.cityIds||[game.auction.cityId]).reduce((v,id)=>v+PROPERTIES[id].price,0))} Grundwert
                    </p>
                    <div className="auction-numbers">
                      <div>
                        <small>
                          {game.auction.bidderId ? "Höchstgebot" : "Startgebot"}
                        </small>
                        <b>
                          {money(
                            game.auction.currentBid || game.auction.minimum,
                          )}
                        </b>
                      </div>
                      <div>
                        <small>Verbleibend</small>
                        <b
                          className={
                            game.auction.endsAt - now < 6000 ? "urgent" : ""
                          }
                        >
                          {Math.max(
                            0,
                            Math.ceil((game.auction.endsAt - now) / 1000),
                          )}
                          s
                        </b>
                      </div>
                    </div>
                    <progress className="auction-progress" max={60} value={Math.max(0,(game.auction.endsAt-now)/1000)}/><p aria-live="polite">
                      {game.auction.bidderId
                        ? `${game.players.find((p) => p.id === game.auction!.bidderId)?.name} führt`
                        : "Wer macht den Anfang?"}
                    </p>
                  </div>
                  <div className="quick-bids" aria-label="Schnellgebote">{[10,50,100].map(inc=>{const amount=quickBid(game,inc);return <button key={inc} className="button" disabled={p.bankrupt||game.manualPause!==null&&!!game.manualPause||game.auction!.sellerId===you||amount>p.money||now>=game.auction!.endsAt} onClick={()=>setBid(amount)}>+{inc}<small>{money(amount)}</small></button>;})}</div><small>Schnellwahl setzt den Betrag. Erst „Verbindlich bieten“ sendet dein Gebot.</small>
                  <label>
                    Dein Gebot (€)
                    <input
                      type="number"
                      min={
                        game.auction.bidderId
                          ? game.auction.currentBid + 10
                          : game.auction.minimum
                      }
                      step={10}
                      value={bid}
                      onChange={(e) => setBid(Number(e.target.value))}
                    />
                  </label>
                  <button
                    className="button gold full"
                    disabled={
                      p.bankrupt ||
                      game.auction.sellerId === you ||
                      !Number.isSafeInteger(bid) || bid < (game.auction.bidderId?game.auction.currentBid+10:game.auction.minimum) || !!game.manualPause ||
                      bid > p.money ||
                      now >= game.auction.endsAt
                    }
                    onClick={() => send({ type: "bid", amount: bid })}
                  >
                    <Gavel size={16} /> Verbindlich bieten
                  </button>
                  <p className="fineprint">
                    Dein Höchstgebot wird reserviert. Späte Gebote verlängern
                    auf 5 Sekunden, höchstens 60 Sekunden insgesamt.
                  </p>
                  <h3>Gebote</h3>
                  {game.auction.history.map((b, i) => (
                    <div className="bid-row" key={i}>
                      <span>{b.name}</span>
                      <b>{money(b.amount)}</b>
                    </div>
                  ))}
                </>
              ) : (
                <div className="empty-state">
                  <Gavel size={32} />
                  <h3>Gerade keine Auktion.</h3>
                  <p>
                    Wenn jemand eine freie Stadt nicht kauft, können alle
                    bieten.
                  </p>
                </div>
              )}
              {plus && (
                <div className="app-section">
                  <h3>Grundstück oder Paket versteigern</h3><details><summary>Mehrere Grundstücke auswählen ({packet.length})</summary>{owned.filter(c=>!c.mortgaged&&groupCities(c.id).every(id=>game.cities[id].developmentLevel===0)).map(c=><label className="check-row" key={c.id}><input type="checkbox" checked={packet.includes(c.id)} onChange={()=>setPacket(ids=>ids.includes(c.id)?ids.filter(id=>id!==c.id):[...ids,c.id])}/>{PROPERTIES[c.id].name}</label>)}</details>
                  <p className="muted">
                    Einmal pro Zug nach dem Würfeln. Ohne Hypothek oder Gebäude
                    in der Gruppe.
                  </p>
                  <label>
                    Grundstück
                    <select
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                    >
                      <option value="">Stadt auswählen</option>
                      {owned
                        .filter(
                          (c) =>
                            !c.mortgaged &&
                            groupCities(c.id).every(
                              (id) => game.cities[id].developmentLevel === 0,
                            ),
                        )
                        .map((c) => (
                          <option key={c.id} value={c.id}>
                            {PROPERTIES[c.id].name}
                          </option>
                        ))}
                    </select>
                  </label>
                  <label>
                    Startgebot (€)
                    <input
                      type="number"
                      min={10}
                      max={10000}
                      step={10}
                      value={minimum}
                      onChange={(e) => setMinimum(Number(e.target.value))}
                    />
                  </label>
                  <button
                    className="button full"
                    disabled={
                      !active ||
                      (!city&&!packet.length) ||
                      p.auctionUsed ||
                      game.turnPhase !== "end"
                    }
                    onClick={() =>
                      send({ type: "auction_create", cityId: city, cityIds:packet.length?packet:undefined, minimum })
                    }
                  >
                    Auktion starten
                  </button>
                </div>
              )}
            </>
          )}
          {app === "trade" && (
            <>
              <div className="app-eyebrow">GUTE DEALS VERBINDEN</div>
              <h2>Dein nächster Deal.</h2>
              {pending.map((t) => (
                <div className="offer-card" key={t.id}>
                  <span>
                    {game.players.find((p) => p.id === t.fromId)?.name} →{" "}
                    {game.players.find((p) => p.id === t.toId)?.name}
                  </span>
                  <p><small>{t.fromId===you?"Du gibst":"Du erhältst"}</small>
                    <b>
                      {t.offerCities.length?<PropertyTags game={game} ids={t.offerCities}/>:"Kein Grundstück"}
                    </b>{" "}
                    + {money(t.offerMoney)}
                  </p>
                  <ArrowRight size={16} />
                  <p><small>{t.toId===you?"Du gibst":"Du erhältst"}</small>
                    <b>
                      {t.requestCities.length?<PropertyTags game={game} ids={t.requestCities}/>:"Kein Grundstück"}
                    </b>{" "}
                    + {money(t.requestMoney)}
                  </p>
                  <TradeComparison game={game} a={you} b={t.fromId===you?t.toId:t.fromId} give={t.fromId===you?t.offerCities:t.requestCities} receive={t.fromId===you?t.requestCities:t.offerCities} giveMoney={t.fromId===you?t.offerMoney:t.requestMoney} receiveMoney={t.fromId===you?t.requestMoney:t.offerMoney}/>
                  {t.toId === you ? (
                    <div className="property-actions">
                      <button
                        onClick={() =>
                          send({
                            type: "trade_respond",
                            id: t.id,
                            accept: true,
                          })
                        }
                      >
                        Annehmen
                      </button>
                      <button
                        onClick={() => {
                          setPartner(t.fromId);
                          setOffer(t.requestCities);
                          setRequest(t.offerCities);
                          setOfferCash(t.requestMoney);
                          setRequestCash(t.offerMoney);
                          setCounterOf(t.id);
                        }}
                      >
                        Gegenangebot
                      </button>
                      <button
                        onClick={() =>
                          send({
                            type: "trade_respond",
                            id: t.id,
                            accept: false,
                          })
                        }
                      >
                        Ablehnen
                      </button>
                    </div>
                  ) : (
                    <button
                      className="text-button"
                      onClick={() => send({ type: "trade_cancel", id: t.id })}
                    >
                      Zurückziehen
                    </button>
                  )}
                </div>
              ))}
              <h3>{counterOf?"Gegenangebot bearbeiten":"Neues Angebot"}</h3>{counterOf&&<button className="text-button" onClick={()=>setCounterOf(undefined)}>Gegenangebot verwerfen</button>}<p className="trade-summary">Du gibst: {offer.length?<PropertyTags game={game} ids={offer}/>:"keine Grundstücke"} + {money(offerCash)}<br/>Du erhältst: {request.length?<PropertyTags game={game} ids={request}/>:"keine Grundstücke"} + {money(requestCash)}</p>
              <label>
                Handelspartner
                <select
                  value={partner}
                  onChange={(e) => {
                    setCounterOf(undefined);
                    setPartner(e.target.value);
                    setRequest([]);
                    setRequestCash(0);
                  }}
                >
                  {game.players
                    .filter((p) => p.id !== you && !p.bankrupt)
                    .map((p) => (
                      <option value={p.id} key={p.id}>
                        {p.name}
                        {p.isBot ? " · Bot" : ""}
                      </option>
                    ))}
                </select>
              </label>
              <div className="trade-halves">
                {[
                  {
                    title: "Du bietest",
                    pid: you,
                    ids: offer,
                    set: setOffer,
                    cash: offerCash,
                    setCash: setOfferCash,
                  },
                  {
                    title: "Du erhältst",
                    pid: partner,
                    ids: request,
                    set: setRequest,
                    cash: requestCash,
                    setCash: setRequestCash,
                  },
                ].map((side) => (
                  <div key={side.title}>
                    <h4>{side.title}</h4><small style={{color:game.players.find(p=>p.id===side.pid)?.color}}>{game.players.find(p=>p.id===side.pid)?.name}</small>
                    {Object.values(game.cities)
                      .filter((c) => c.ownerId === side.pid)
                      .sort((a,b)=>sortedProperties(game,[a.id,b.id])[0]===a.id?-1:1)
                      .map((c) => (
                        <label className="check-row trade-property" key={c.id} style={{borderLeftColor:propertyColor(game,c.id)}}>
                          <input
                            disabled={groupCities(c.id).some(id=>game.cities[id].developmentLevel>0)}
                            type="checkbox"
                            checked={side.ids.includes(c.id)}
                            onChange={() => toggle(c.id, side.ids, side.set)}
                          />
                          <span>
                            {PROPERTIES[c.id].name}
                            {c.mortgaged ? " (H)" : ""}<small>{groupName(game,PROPERTIES[c.id].group)}{groupCities(c.id).some(id=>game.cities[id].developmentLevel>0)?' · Erst Gebäude verkaufen':''}</small>
                          </span>
                        </label>
                      ))}
                    <label>
                      Geld (€)
                      <input
                        type="number"
                        min={0}
                        value={side.cash}
                        onChange={(e) => side.setCash(Number(e.target.value))}
                      />
                    </label>
                  </div>
                ))}
              </div>
              <TradeComparison game={game} a={you} b={partner} give={offer} receive={request} giveMoney={offerCash} receiveMoney={requestCash}/>
              <button
                className="button gold full"
                disabled={p.bankrupt || !!game.auction || !!game.debt}
                onClick={() =>
                  send({
                    type: "trade",
                    counterOf,
                    toId: partner,
                    offerCities: offer,
                    requestCities: request,
                    offerMoney: offerCash,
                    requestMoney: requestCash,
                  })
                }
              >
                <Handshake size={16} /> Angebot senden
              </button>
              <p className="fineprint">
                Handel auch außerhalb deines Zuges. Gebäude der betroffenen
                Gruppen müssen zuerst verkauft werden. Hypotheken bleiben
                bestehen.
              </p>
            </>
          )}
          {app === "stocks" && (
            <>
              {!plus ? (
                <Locked />
              ) : (
                <>
                  <div className="app-eyebrow">EMPIRE EXCHANGE</div>
                  <h2>
                    Heute investieren.
                    <br />
                    Morgen gestalten.
                  </h2>
                  <div className="market-status">
                    <i /> FIKTIVER MARKT <span>Runde {game.round}</span>
                  </div>
                  <label>
                    Stückzahl
                    <input
                      type="number"
                      min={1}
                      max={100}
                      value={quantity}
                      onChange={(e) => setQuantity(Number(e.target.value))}
                    />
                  </label>
                  {game.stocks.map((s) => {
                    const d = STOCKS.find((x) => x.id === s.id)!;
                    const change =
                      s.history.length > 1
                        ? (s.price / s.history[s.history.length - 2] - 1) * 100
                        : 0;
                    const min = Math.min(...s.history) * 0.95,
                      max = Math.max(...s.history) * 1.05;
                    const path = s.history
                      .map(
                        (v, i) =>
                          `${i === 0 ? "M" : "L"}${(i / Math.max(1, s.history.length - 1)) * 280},${65 - ((v - min) / (max - min)) * 55}`,
                      )
                      .join(" ");
                    return (
                      <div className="stock-card" key={s.id}>
                        <header>
                          <div
                            className="stock-logo"
                            style={{ color: d.color }}
                          >
                            {d.symbol.slice(0, 1)}
                          </div>
                          <div>
                            <b>{d.symbol}</b>
                            <small>{d.name}</small>
                          </div>
                          <div>
                            <b>{money(s.price)}</b>
                            <small
                              className={change >= 0 ? "positive" : "negative"}
                            >
                              {change >= 0 ? "+" : ""}
                              {change.toFixed(1)} %
                            </small>
                          </div>
                        </header>
                        <svg
                          viewBox="0 0 280 75"
                          className="sparkline"
                          aria-label={`Kursverlauf ${d.name}`}
                        >
                          <path
                            d={path || "M0 35 L280 35"}
                            fill="none"
                            stroke={d.color}
                            strokeWidth="2.5"
                          />
                          {s.history.length === 1 && (
                            <path
                              d="M0 37L280 37"
                              stroke={d.color}
                              strokeWidth="2"
                            />
                          )}
                        </svg>
                        <div className="property-metrics">
                          <span>
                            Im Depot <b>{p.stocks[s.id] || 0} Stück</b>
                          </span>
                          <span>
                            Wert <b>{money(s.price * (p.stocks[s.id] || 0))}</b>
                          </span>
                        </div>
                        <div className="property-actions">
                          <button
                            disabled={
                              !active ||
                              !!game.debt ||
                              p.stockActions >= 3 ||
                              game.turnPhase === "purchase"
                            }
                            onClick={() =>
                              send({
                                type: "stock_buy",
                                stockId: s.id,
                                quantity,
                              })
                            }
                          >
                            Kaufen
                          </button>
                          <button
                            disabled={
                              !active ||
                              !(p.stocks[s.id] >= quantity) ||
                              (p.stockActions >= 3 && !game.debt)
                            }
                            onClick={() =>
                              send({
                                type: "stock_sell",
                                stockId: s.id,
                                quantity,
                              })
                            }
                          >
                            Verkaufen
                          </button>
                        </div>
                      </div>
                    );
                  })}
                  <p className="fineprint">
                    {p.stockActions}/3 Geschäfte in diesem Zug. Kurse ändern
                    sich nach jeder vollen Runde. Bei Geldnot sind weitere
                    Verkäufe möglich. Keine echten Wertpapiere.
                  </p>
                </>
              )}
            </>
          )}
          {app === "casino" && (
            <>
              {!plus ? (
                <Locked />
              ) : (
                <>
                  <div className="casino-status"><b>{money(p.money)}</b><span>Noch {Math.max(0,(game.settings.casinoLimit??4)-p.casinoPlays)} / {game.settings.casinoLimit??4} Spiele</span></div>
                  <div className="casino-header">
                    <Spade size={28} />
                    <span>MEMBERS LOUNGE</span>
                    <h2>Empire Club</h2>
                    <p>Nur Spielgeld · Kein Echtgeld · Keine Auszahlung</p>
                  </div>
                  <div className="segmented">
                    <button
                      className={casinoTab === "roulette" ? "selected" : ""}
                      onClick={() => setCasinoTab("roulette")}
                    >
                      Roulette
                    </button>
                    <button
                      className={casinoTab === "blackjack" ? "selected" : ""}
                      onClick={() => setCasinoTab("blackjack")}
                    >
                      Blackjack
                    </button>
                  </div>
                  {casinoTab === "roulette" ? (
                    <>
                      <div className="roulette-stage">
                        <div className="wheel-pointer" />
                        <svg
                          className="roulette-wheel"
                          viewBox="0 0 240 240"
                          style={{ transform: `rotate(${rotation}deg)` }}
                          aria-hidden="true"
                        >
                          {wheelOrder.map((n, i) => {
                            const a =
                                (((i * 360) / 37 - 90 - 360 / 74) * Math.PI) /
                                180,
                              b =
                                ((((i + 1) * 360) / 37 - 90 - 360 / 74) *
                                  Math.PI) /
                                180;
                            const x1 = 120 + 108 * Math.cos(a),
                              y1 = 120 + 108 * Math.sin(a),
                              x2 = 120 + 108 * Math.cos(b),
                              y2 = 120 + 108 * Math.sin(b);
                            return (
                              <g key={n}>
                                <path
                                  d={`M120 120L${x1} ${y1}A108 108 0 0 1 ${x2} ${y2}Z`}
                                  fill={
                                    n === 0
                                      ? "#418d74"
                                      : rouletteColor(n) === "red"
                                        ? "#a54f61"
                                        : "#253240"
                                  }
                                  stroke="#bd9d62"
                                  strokeWidth=".7"
                                />
                                <text
                                  x="120"
                                  y="29"
                                  textAnchor="middle"
                                  fill="#f8eee0"
                                  fontSize="9"
                                  transform={`rotate(${(i * 360) / 37} 120 120)`}
                                >
                                  {n}
                                </text>
                              </g>
                            );
                          })}
                          <circle
                            cx="120"
                            cy="120"
                            r="62"
                            fill="#1a2e30"
                            stroke="#b99a63"
                            strokeWidth="4"
                          />
                          <circle
                            cx="120"
                            cy="120"
                            r="39"
                            fill="#132629"
                            stroke="#b99a63"
                            strokeWidth="1"
                          />
                          <path
                            d="M120 93V147M93 120H147"
                            stroke="#b99a63"
                            strokeWidth="6"
                          />
                          <circle cx="120" cy="120" r="9" fill="#d9b47d" />
                        </svg>
                      </div>
                      <div className="roulette-result" aria-live="polite">
                        {game.roulette?.playerId === you ? (
                          <>
                            <b>{game.roulette.number}</b>
                            <span>
                              {game.roulette.payout
                                ? `Gewonnen: +${money(game.roulette.payout - game.roulette.bet)}`
                                : `Einsatz verloren: ${money(game.roulette.bet)}`}
                            </span>
                          </>
                        ) : (
                          <span>Europäisches Roulette · Eine grüne Null</span>
                        )}
                      </div>
                      <div className="bet-choices">
                        {[
                          ["red", "Rot"],
                          ["black", "Schwarz"],
                          ["even", "Gerade"],
                          ["odd", "Ungerade"],
                        ].map(([id, name]) => (
                          <button
                            key={id}
                            className={`${choice === id ? "selected" : ""} bet-${id}`}
                            onClick={() => setChoice(id)}
                          >
                            {name}
                          </button>
                        ))}
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="blackjack-table">
                        <small>
                          DEALER ·{" "}
                          {game.blackjack?.status === "playing"
                            ? "?"
                            : game.blackjack
                              ? handValue(game.blackjack.dealer)
                              : "—"}
                        </small>
                        <div className="cards">
                          {(game.blackjack?.dealer || [-1, -1]).map((c, i) => (
                            <PlayingCard card={c} key={i} />
                          ))}
                        </div>
                        <span className="table-rule">
                          BLACKJACK ZAHLT 3:2 · DEALER STEHT AB 17
                        </span>
                        <div className="cards">
                          {(game.blackjack?.hand || [-1, -1]).map((c, i) => (
                            <PlayingCard card={c} key={i} />
                          ))}
                        </div>
                        <small>
                          HAND ·{" "}
                          {game.blackjack
                            ? handValue(game.blackjack.hand)
                            : "—"}
                        </small>
                      </div>
                      {game.blackjack && (
                        <p className="casino-message">
                          {game.blackjack.message}
                        </p>
                      )}
                      {game.blackjack?.status === "playing" && (
                        <div className="property-actions">
                          <button
                            disabled={
                              !active || game.blackjack.playerId !== you
                            }
                            onClick={() => send({ type: "blackjack_hit" })}
                          >
                            Karte ziehen
                          </button>
                          <button
                            disabled={
                              !active || game.blackjack.playerId !== you
                            }
                            onClick={() => send({ type: "blackjack_stand" })}
                          >
                            Stehen bleiben
                          </button>
                        </div>
                      )}
                    </>
                  )}
                  <div className="casino-controls"><label>
                    Einsatz · frei bis {money(p.money)}
                    <input
                      type="number"
                      inputMode="numeric"
                      min={1}
                      max={p.money}
                      step={1}
                      value={bet}
                      onChange={(e) => setBet(Number(e.target.value))}
                    />
                  </label>
                  <button
                    className="button gold full"
                    disabled={!canCasino || p.money < bet || !Number.isSafeInteger(bet) || bet < 1}
                    onClick={() =>
                      send(
                        casinoTab === "roulette"
                          ? { type: "roulette", bet, choice }
                          : { type: "blackjack_start", bet },
                      )
                    }
                  >
                    {casinoTab === "roulette"
                      ? "Roulette spielen"
                      : "Karten geben"}{" "}
                    · {money(bet)}
                  </button>
                  </div><p className="fineprint">
                    {p.casinoPlays}/{game.settings.casinoLimit??4} Spiele in diesem Zug. Nur nach dem
                    Würfeln. Der Zugtimer läuft weiter; bei Ablauf bleibt die
                    Blackjack-Hand automatisch stehen. Keine Versicherung, kein
                    Split, kein Verdoppeln.
                  </p>
                </>
              )}
            </>
          )}
          {app === "news" && (
            <>
              <div className="app-eyebrow">DEINE WELT IN BEWEGUNG</div>
              <h2 className="newspaper-title">The Empire Daily</h2>
              <div className="newspaper-date">
                AUSGABE {game.round} · WORLD EMPIRE
              </div>
              {game.news.map((n, i) => (
                <article className="news-story" key={i}>
                  <span>{i === 0 ? "AKTUELL" : "MARKTARCHIV"}</span>
                  <h3>{n}</h3>
                </article>
              ))}
              <h3>Aus dem Spiel</h3>
              {game.log.slice(0, 12).map((l) => (
                <div className="news-log" key={l.id}>
                  {l.text}
                </div>
              ))}
            </>
          )}
        </div>
        <button
          className="phone-home"
          aria-label="Handy-Startbildschirm"
          onClick={() => setApp("home")}
        >
          <span />
        </button>
      </div>
    </div>
  );
}
function Locked() {
  return (
    <div className="empty-state">
      <LockKeyhole size={36} />
      <h2>World Empire Plus</h2>
      <p>
        Diese App ist im Plus-Modus verfügbar. Der Host kann den Modus vor
        Spielbeginn auswählen.
      </p>
    </div>
  );
}
function PlayingCard({ card }: { card: number }) {
  if (card < 0)
    return (
      <div className="playing-card card-back">
        <Spade size={22} />
      </div>
    );
  const suit = ["♠", "♥", "♣", "♦"][Math.floor(card / 13)],
    rank = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"][
      card % 13
    ];
  return (
    <div
      className={`playing-card ${suit === "♥" || suit === "♦" ? "red-card" : ""}`}
    >
      <b>{rank}</b>
      <span>{suit}</span>
      <small>{rank}</small>
    </div>
  );
}
