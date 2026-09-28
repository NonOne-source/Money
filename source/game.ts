import {
  AVATARS,
  BOARD,
  COLORS,
  PROPERTIES,
  STOCKS,
  START_MONEY,
  START_BONUS,
  JAIL_FEE,
} from "./rules.ts";
import { gameProperties } from "./custom.ts";
export type Settings = {
  mode: "classic" | "plus";
  boardVariant?: 'world'|'dortmund';
  teams?: boolean;
  missions?: boolean;
  startBonus?: number;
  auctionSeconds?: number;
  buildPercent?: number;
  casinoLimit?: number;
  tradingSeconds?: number;
  tournamentGames?: number;
  events?: boolean;
  targetWealth?: number;
  publicRoom?: boolean;
  botLevel?: "easy" | "normal" | "hard";
  startingMoney: number;
  maxRounds: number;
  turnSeconds: number;
};
export type Player = {
  id: string;
  name: string;
  color: string;
  avatar: string;
  money: number;
  position: number;
  isHost: boolean;
  connected: boolean;
  bankrupt: boolean;
  isBot: boolean;
  ready?: boolean;
  purchases?: number;
  team?: number;
  mission?: {kind:'purchases'|'rent'|'trade';target:number;done:boolean};
  disconnectedAt?: number;
  replacementBot?: boolean;
  profileId?: string;
  casinoRounds?: number;
  achievements?: string[];
  casinoNet?: number;
  biggestPurchase?: number;
  tradesCompleted?: number;
  purchaseCounts?: Record<string,number>;
  bestDeal?: number;
  jail: number;
  rentPaid: number;
  rentCollected: number;
  stocks: Record<string, number>;
  casinoPlays: number;
  stockActions: number;
  auctionUsed: boolean;
};
export type CityState = {
  id: string;
  ownerId: string | null;
  developmentLevel: number;
  mortgaged: boolean;
};
export type Trade = {
  id: string;
  counterOf?: string;
  fromId: string;
  toId: string;
  offerCities: string[];
  requestCities: string[];
  offerMoney: number;
  requestMoney: number;
  status: "pending" | "accepted" | "declined" | "cancelled";
};
export type Auction = {
  id: string;
  cityId: string;
  cityIds?: string[];
  sellerId: string | null;
  currentBid: number;
  bidderId: string | null;
  minimum: number;
  endsAt: number;
  hardEndsAt: number;
  remainingTurn: number;
  resumePhase: TurnPhase;
  history: { name: string; amount: number }[];
};
export type Blackjack = {
  playerId: string;
  bet: number;
  hand: number[];
  dealer: number[];
  deck: number[];
  status: "playing" | "won" | "lost" | "push";
  message: string;
};
export type TurnPhase = "roll" | "purchase" | "end" | "debt";
export type GameState = {
  version: 2;
  matchId?: string;
  tradeUntil?: number;
  botVotes?: Record<string,string[]>;
  tournament?: {played:number;scoredMatch?:string;points:Record<string,number>};
  replay?: {id:string;text:string;kind:string;round:number;dice:[number,number]|null;positions:Record<string,number>}[];
  wealthHistory?: {round:number; values:Record<string,number>}[];
  manualPause?: number | null;
  pauseVotes?: string[];
  resumeVotes?: string[];
  customCities?: Record<string, {name: string; price: number; color: string}>;
  economy?: {group: string; multiplier: number; title: string} | null;
  gameId: string;
  phase: "lobby" | "playing" | "finished";
  turnPhase: TurnPhase;
  players: Player[];
  currentPlayerIndex: number;
  cities: Record<string, CityState>;
  settings: Settings;
  round: number;
  lastDice: [number, number] | null;
  rollId: number;
  lastMove: {
    playerId: string;
    from: number;
    to: number;
    steps: number;
    jail: boolean;
  } | null;
  doubles: number;
  extraRoll: boolean;
  turnDeadline: number;
  actionNotBefore: number;
  auction: Auction | null;
  trades: Trade[];
  debt: {
    playerId: string;
    creditorId: string | null;
    amount: number;
    reason: string;
    resume: TurnPhase;
    moveSteps?: number;
  } | null;
  log: { id: string; text: string; ts: number; kind: string }[];
  chat: { id: string; playerId: string; name: string; text: string }[];
  stocks: { id: string; price: number; history: number[] }[];
  news: string[];
  blackjack: Blackjack | null;
  roulette: {
    id: string;
    playerId: string;
    number: number;
    bet: number;
    choice: string;
    payout: number;
  } | null;
  winnerId: string | null;
};
export type Action = { type: string; [key: string]: unknown };
export type Random = (max: number) => number;
export const random: Random = (max) => {
  const cap = Math.floor(0x100000000 / max) * max;
  let x: number;
  do {
    x = crypto.getRandomValues(new Uint32Array(1))[0];
  } while (x >= cap);
  return x % max;
};
export const current = (g: GameState) => g.players[g.currentPlayerIndex];
export function freshGame(gameId: string): GameState {
  return {
    version: 2,
    matchId: crypto.randomUUID(),
    wealthHistory: [],
    manualPause: null, pauseVotes: [], resumeVotes: [], customCities: {}, economy: null,
    gameId,
    phase: "lobby",
    turnPhase: "roll",
    players: [],
    currentPlayerIndex: 0,
    cities: Object.fromEntries(
      Object.keys(PROPERTIES).map((id) => [
        id,
        { id, ownerId: null, developmentLevel: 0, mortgaged: false },
      ]),
    ),
    settings: {
      mode: "plus",
      startingMoney: START_MONEY,
      maxRounds: 0,
      turnSeconds: 75,
    },
    round: 1,
    lastDice: null,
    rollId: 0,
    lastMove: null,
    doubles: 0,
    extraRoll: false,
    turnDeadline: 0,
    actionNotBefore: 0,
    auction: null,
    trades: [],
    debt: null,
    log: [],
    chat: [],
    stocks: STOCKS.map((s) => ({
      id: s.id,
      price: s.price,
      history: [s.price],
    })),
    news: [
      "Willkommen an der Empire Exchange. Fiktive Kurse werden nach jeder Spielrunde aktualisiert.",
    ],
    blackjack: null,
    roulette: null,
    winnerId: null,
  };
}
function check(ok: unknown, message: string): asserts ok {
  if (!ok) throw new Error(message);
}
function integer(value: unknown, min = 0, max = 1000000): number {
  check(
    typeof value === "number" &&
      Number.isSafeInteger(value) &&
      value >= min &&
      value <= max,
    "Ungültiger Betrag.",
  );
  return value;
}
function str(value: unknown, max = 200): string {
  check(typeof value === "string", "Ungültiger Text.");
  return value.trim().slice(0, max);
}
export function log(g: GameState, text: string, kind = "info") {
  g.log.unshift({ id: crypto.randomUUID(), text, kind, ts: Date.now() });
  g.log = g.log.slice(0, 70);
  g.replay ||= [];
  g.replay.push({id:g.log[0].id,text,kind,round:g.round,dice:g.lastDice,positions:Object.fromEntries(g.players.map(p=>[p.id,p.position]))});
  g.replay=g.replay.slice(-180);
}
export function addPlayer(
  g: GameState,
  id: string,
  name: string,
  avatar = AVATARS[0],
  bot = false,
): Player {
  check(g.phase === "lobby", "Das Spiel läuft bereits.");
  check(g.players.length < 6, "Der Raum ist voll (6 Spieler).");
  const clean = str(name, 20);
  check(clean.length > 0, "Bitte einen Namen angeben.");
  check(
    !g.players.some((p) => p.name.toLowerCase() === clean.toLowerCase()),
    "Dieser Name ist bereits vergeben.",
  );
  const p: Player = {
    id,
    name: clean,
    avatar: AVATARS.includes(avatar) ? avatar : AVATARS[0],
    color:
      COLORS.find((c) => !g.players.some((p) => p.color === c)) || COLORS[0],
    money: g.settings.startingMoney,
    position: 0,
    isHost: g.players.length === 0,
    connected: true,
    bankrupt: false,
    isBot: bot,
    team: g.players.length % 2,
    ready: bot, purchases: 0, bestDeal: 0,
    jail: -1,
    rentPaid: 0,
    rentCollected: 0,
    stocks: {},
    casinoPlays: 0,
    stockActions: 0,
    auctionUsed: false,
  };
  g.players.push(p);
  log(g, `${clean} ist beigetreten.`);
  return p;
}
export function hostTransfer(g: GameState) {
  const host = g.players.find((p) => p.isHost);
  if (host?.connected && !host.isBot) return;
  const replacement = g.players.find((p) => p.connected && !p.isBot);
  if (replacement) {
    g.players.forEach((p) => (p.isHost = p.id === replacement.id));
    log(g, `${replacement.name} ist jetzt Host.`);
  }
}
export const groupCities = (id: string) =>
  Object.values(PROPERTIES)
    .filter((p) => p.group === PROPERTIES[id]?.group)
    .map((p) => p.id);
export const ownsGroup = (g: GameState, id: string, pid: string) =>
  groupCities(id).every((cid) => g.cities[cid].ownerId === pid);
export function rent(g: GameState, id: string) {
  const PROPERTIES = gameProperties(g);
  const c = g.cities[id],
    d = PROPERTIES[id];
  if (!c?.ownerId || c.mortgaged) return 0;
  if (d.kind === "station") {
    const count = groupCities(id).filter(
      (cid) => g.cities[cid].ownerId === c.ownerId,
    ).length;
    return d.rent[count - 1];
  }
  return Math.round(
    (g.economy?.group === d.group ? g.economy.multiplier : 1) * d.rent[c.developmentLevel] *
    (c.developmentLevel === 0 && ownsGroup(g, id, c.ownerId) ? 2 : 1)
  );
}
export function netWorth(g: GameState, p: Player) {
  const PROPERTIES = gameProperties(g);
  return (
    p.money +
    Object.values(g.cities)
      .filter((c) => c.ownerId === p.id)
      .reduce(
        (n, c) =>
          n +
          Math.round(PROPERTIES[c.id].price * (c.mortgaged ? 0.5 : 1)) +
          c.developmentLevel * PROPERTIES[c.id].buildCost,
        0,
      ) +
    g.stocks.reduce((n, s) => n + s.price * (p.stocks[s.id] || 0), 0) -
    (g.debt?.playerId === p.id ? g.debt.amount : 0)
  );
}
export const available = (g: GameState, p: Player) =>
  p.money - (g.auction?.bidderId === p.id ? g.auction.currentBid : 0);
export function recordWealth(g: GameState) {
  const point = {round:g.round, values:Object.fromEntries(g.players.map(p=>[p.id,netWorth(g,p)]))};
  g.wealthHistory ||= [];
  if (g.wealthHistory.at(-1)?.round === g.round) g.wealthHistory[g.wealthHistory.length-1] = point;
  else g.wealthHistory.push(point);
  g.wealthHistory = g.wealthHistory.slice(-101);
}
function competingWealth(g:GameState,p:Player){return g.settings.teams?g.players.filter(x=>x.team===p.team&&!x.bankrupt).reduce((n,x)=>n+netWorth(g,x),0):netWorth(g,p);}
export function finishCheck(g: GameState) {
  const active = g.players.filter((p) => !p.bankrupt);
  if(g.phase==='playing'&&g.settings.teams&&active.length>0&&new Set(active.map(p=>p.team)).size===1){g.phase='finished';g.winnerId=active[0].id;g.turnDeadline=0;g.auction=null;log(g,`Team ${(active[0].team||0)+1} gewinnt!`,'win');scoreTournament(g);return;}
  if (g.phase === "playing" && g.settings.targetWealth && !g.debt && !g.auction && g.blackjack?.status !== "playing") {
    const winner = [...active].filter(p=>competingWealth(g,p)>=g.settings.targetWealth!).sort((a,b)=>competingWealth(g,b)-competingWealth(g,a))[0];
    if (winner) {g.phase="finished";g.winnerId=winner.id;g.turnDeadline=0;recordWealth(g);log(g,`${winner.name} erreicht das Vermögensziel und gewinnt!`,"win");return;}
  }
  if (g.phase === "playing" && active.length <= 1) {
    g.phase = "finished";
    g.winnerId = active[0]?.id || null;
    g.turnDeadline = 0;
    g.auction = null;
    log(g, `${active[0]?.name || "Niemand"} gewinnt World Empire!`, "win");
  }
}
function resetTurn(g: GameState, now: number) {
  g.turnPhase = "roll";
  g.turnDeadline = now + g.settings.turnSeconds * 1000;
  g.actionNotBefore = 0;
  g.doubles = 0;
  g.extraRoll = false;
  const p = current(g);
  p.casinoPlays = 0;
  p.stockActions = 0;
  p.auctionUsed = false;
  g.blackjack = null;
}
function advance(g: GameState, now: number, rng: Random) {
  recordWealth(g);
  finishCheck(g);
  if (g.phase === "finished") return;
  const previous = g.currentPlayerIndex;
  do {
    g.currentPlayerIndex = (g.currentPlayerIndex + 1) % g.players.length;
  } while (current(g).bankrupt);
  if (g.currentPlayerIndex <= previous) {
    g.round++;
    g.economy = null;
    if (g.settings.mode === "plus" && g.settings.events) {
      const groups = ["germany", "france", "italy", "usa", "japan", "georgia"];
      const group = groups[rng(groups.length)], boom = rng(2) === 0;
      g.economy = {group, multiplier: boom ? 1.25 : .75, title: boom ? "Tourismusboom: +25 % Miete" : "Nebensaison: −25 % Miete"};
      g.news.unshift(`${g.economy.title} · ${group} · nur Runde ${g.round}`);
      g.news = g.news.slice(0, 20);
      log(g, g.news[0], "event");
    }
    if (g.settings.mode === "plus")
      for (const s of g.stocks) {
        const change = rng(25) - 12;
        s.price = Math.max(
          10,
          Math.min(1000, Math.round(s.price * (1 + change / 100))),
        );
        const actual = Math.round((s.price / s.history.at(-1)! - 1) * 100);
        const headline = actual>0 ? "Hohe Nachfrage" : actual<0 ? "Verkaufsdruck" : "Stabiler Handel";
        g.news.unshift(`${STOCKS.find(x=>x.id===s.id)!.name}: ${headline}, ${actual>0?"+":""}${actual} % auf €${s.price} · Runde ${g.round}.`);
        s.history.push(s.price);
        s.history = s.history.slice(-24);
      }
    if (g.settings.mode === "plus") {
      const s = g.stocks[rng(g.stocks.length)];
      g.news.unshift(
        `${STOCKS.find((x) => x.id === s.id)!.name}: neuer Kurs €${s.price} · Runde ${g.round}.`,
      );
      g.news = g.news.slice(0, 20);
    }
    if (g.settings.maxRounds && g.round > g.settings.maxRounds) {
      g.phase = "finished";
      g.winnerId = [...g.players]
        .filter((p) => !p.bankrupt)
        .sort((a, b) => competingWealth(g,b)-competingWealth(g,a))[0].id;
      g.turnDeadline = 0;
      log(g, "Rundenlimit erreicht. Das gesamte Vermögen entscheidet.", "win");
      return;
    }
  }
  resetTurn(g, now);
  if(g.currentPlayerIndex<=previous && g.settings.tradingSeconds){g.tradeUntil=now+g.settings.tradingSeconds*1000;g.turnDeadline+=g.settings.tradingSeconds*1000;log(g,'Gemeinsame Handelsphase beginnt.','trade');}
}
function sendJail(g: GameState, p: Player) {
  const from = p.position;
  p.position = 8;
  p.jail = 0;
  g.extraRoll = false;
  g.doubles = 0;
  g.turnPhase = "end";
  g.lastMove = { playerId: p.id, from, to: 8, steps: 0, jail: true };
  log(g, `${p.name} muss ins Gefängnis.`, "jail");
}
function pay(
  g: GameState,
  p: Player,
  amount: number,
  creditorId: string | null,
  reason: string,
  resume: TurnPhase = "end",
) {
  if (p.money < amount) {
    g.debt = { playerId: p.id, creditorId, amount, reason, resume };
    g.turnPhase = "debt";
    log(g, `${p.name} fehlen €${amount - p.money} für ${reason}.`, "debt");
    return;
  }
  p.money -= amount;
  const owner = g.players.find((x) => x.id === creditorId);
  if (owner) {
    owner.money += amount;
    p.rentPaid += amount;
    owner.rentCollected += amount;
  }
  g.turnPhase = resume;
  log(g, `${p.name} zahlt €${amount} ${reason}.`, "money");
}
function bankrupt(g: GameState, p: Player, now: number, rng: Random) {
  const debt = g.debt?.playerId === p.id ? g.debt : null;
  const creditor = g.players.find(
    (x) => x.id === debt?.creditorId && !x.bankrupt,
  );
  const proceeds =
    p.money + g.stocks.reduce((n, s) => n + s.price * (p.stocks[s.id] || 0), 0);
  if (creditor) creditor.money += proceeds;
  p.money = 0;
  p.stocks = {};
  p.bankrupt = true;
  for (const c of Object.values(g.cities))
    if (c.ownerId === p.id) {
      if (creditor) c.ownerId = creditor.id;
      else {
        c.ownerId = null;
        c.developmentLevel = 0;
        c.mortgaged = false;
      }
    }
  g.trades.forEach((t) => {
    if (t.status === "pending" && (t.fromId === p.id || t.toId === p.id))
      t.status = "cancelled";
  });
  g.debt = null;
  log(g, `${p.name} ist ausgeschieden.`, "debt");
  finishCheck(g);
  if (g.phase === "playing" && current(g).id === p.id) advance(g, now, rng);
}
function event(g: GameState, p: Player, rng: Random) {
  const n = rng(8);
  if (n === 0) {
    p.money += 200;
    log(g, "Dividende: €200 ausbezahlt.", "event");
  } else if (n === 1) {
    pay(g, p, 100, null, "Reparaturen");
  } else if (n === 2) {
    sendJail(g, p);
  } else if (n === 3) {
    p.money += 100;
    log(g, "Tourismusboom: €100 Prämie.", "event");
  } else if (n === 4) {
    const cost = Object.values(g.cities)
      .filter((c) => c.ownerId === p.id)
      .reduce(
        (s, c) =>
          s + (c.developmentLevel === 5 ? 100 : c.developmentLevel * 25),
        0,
      );
    pay(g, p, cost, null, "Gebäudewartung");
  } else if (n === 5) {
    p.money += 50;
    log(g, "Steuerrückzahlung: €50.", "event");
  } else if (n === 6) {
    const from = p.position;
    p.position = 0;
    p.money += g.settings.startBonus ?? START_BONUS;
    g.lastMove = {
      playerId: p.id,
      from,
      to: 0,
      steps: BOARD.length - from,
      jail: false,
    };
    log(g, `Reise zum Start: €${g.settings.startBonus??START_BONUS} Startbonus.`, "event");
  } else {
    pay(g, p, 50, null, "Stadtabgabe");
  }
}
function landing(g: GameState, p: Player, rng: Random) {
  const tile = BOARD[p.position];
  g.turnPhase = "end";
  if (tile.kind === "property") {
    const c = g.cities[tile.id];
    if (!c.ownerId) g.turnPhase = "purchase";
    else if (c.ownerId !== p.id && !(g.settings.teams && g.players.find(x=>x.id===c.ownerId)?.team===p.team))
      pay(g, p, rent(g, tile.id), c.ownerId, `Miete für ${gameProperties(g)[tile.id]?.name || tile.name}`);
  } else if (tile.kind === "tax") pay(g, p, tile.amount!, null, tile.name);
  else if (tile.kind === "gojail") sendJail(g, p);
  else if (tile.kind === "event") event(g, p, rng);
}
function move(g: GameState, p: Player, steps: number, rng: Random) {
  const from = p.position;
  p.position = (from + steps) % BOARD.length;
  if (from + steps >= BOARD.length) {
    p.money += g.settings.startBonus ?? START_BONUS;
    log(g, `${p.name} passiert Start: +€${g.settings.startBonus ?? START_BONUS}.`, "money");
  }
  g.lastMove = { playerId: p.id, from, to: p.position, steps, jail: false };
  log(g, `${p.name} landet auf ${gameProperties(g)[BOARD[p.position].id]?.name || BOARD[p.position].name}.`, "move");
  landing(g, p, rng);
}
function startAuction(
  g: GameState,
  cityId: string,
  sellerId: string | null,
  minimum: number,
  now: number,
) {
  const PROPERTIES = gameProperties(g);
  g.auction = {
    id: crypto.randomUUID(),
    cityId,
    sellerId,
    currentBid: 0,
    bidderId: null,
    minimum,
    endsAt: now + (g.settings.auctionSeconds??20)*1000,
    hardEndsAt: now + ((g.settings.auctionSeconds??20)+40)*1000,
    remainingTurn: Math.max(10000, g.turnDeadline - now),
    resumePhase: sellerId ? g.turnPhase : "end",
    history: [],
  };
  g.turnDeadline = 0;
  log(g, `${PROPERTIES[cityId].name} wird versteigert.`, "auction");
}
function resolveAuction(g: GameState, now: number) {
  const PROPERTIES = gameProperties(g);
  const a = g.auction!;
  const winner = g.players.find((p) => p.id === a.bidderId && !p.bankrupt);
  if (winner && winner.money >= a.currentBid && (a.cityIds||[a.cityId]).every(id=>g.cities[id].ownerId === a.sellerId)) {
    winner.money -= a.currentBid;
    const seller = g.players.find((p) => p.id === a.sellerId);
    if (seller) seller.money += a.currentBid;
    for(const id of a.cityIds||[a.cityId]) g.cities[id].ownerId=winner.id;
    winner.biggestPurchase = Math.max(winner.biggestPurchase || 0, a.currentBid);
    winner.purchases = (winner.purchases || 0) + (a.cityIds||[a.cityId]).length;
    winner.purchaseCounts ||= {}; for(const id of a.cityIds||[a.cityId])winner.purchaseCounts[id] = (winner.purchaseCounts[id] || 0) + 1;
    winner.bestDeal = Math.max(winner.bestDeal || 0, (a.cityIds||[a.cityId]).reduce((n,id)=>n+PROPERTIES[id].price,0) - a.currentBid);
    log(
      g,
      `${winner.name} ersteigert ${(a.cityIds||[a.cityId]).map(id=>PROPERTIES[id].name).join(" + ")} für €${a.currentBid}.`,
      "auction",
    );
  } else
    log(
      g,
      `Auktion beendet: ${(a.cityIds||[a.cityId]).map(id=>PROPERTIES[id].name).join(" + ")} bleibt unverkauft.`,
      "auction",
    );
  g.turnPhase = a.resumePhase;
  g.turnDeadline = now + a.remainingTurn;
  g.auction = null;
}
export function handValue(cards: number[]) {
  let total = 0,
    aces = 0;
  for (const c of cards) {
    const v = c % 13;
    if (v === 0) {
      total += 11;
      aces++;
    } else total += Math.min(v + 1, 10);
  }
  while (total > 21 && aces-- > 0) total -= 10;
  return total;
}
function settleBlackjack(g: GameState, stand: boolean) {
  const b = g.blackjack!;
  const p = g.players.find((p) => p.id === b.playerId)!;
  if (b.status !== "playing") return;
  const player = handValue(b.hand);
  if (stand && player <= 21)
    while (handValue(b.dealer) < 17) b.dealer.push(b.deck.pop()!);
  const dealer = handValue(b.dealer);
  const playerNatural = player === 21 && b.hand.length === 2,
    dealerNatural = dealer === 21 && b.dealer.length === 2;
  let payout = 0;
  if (
    player > 21 ||
    (dealerNatural && !playerNatural) ||
    (dealer <= 21 && dealer > player)
  ) {
    b.status = "lost";
    b.message = "Dealer gewinnt.";
  } else if (player === dealer && playerNatural === dealerNatural) {
    b.status = "push";
    payout = b.bet;
    b.message = "Unentschieden. Einsatz zurück.";
  } else {
    b.status = "won";
    const natural = player === 21 && b.hand.length === 2;
    b.message = natural ? "Blackjack!" : "Du gewinnst.";
    payout = natural ? Math.floor(b.bet * 2.5) : b.bet * 2;
  }
  p.money += payout;
  p.casinoNet = (p.casinoNet || 0) + payout - b.bet;
  b.deck = [];
  log(
    g,
    `${p.name}: Blackjack ${b.status === "won" ? "gewonnen" : b.status === "push" ? "unentschieden" : "verloren"} (${payout - b.bet >= 0 ? "+" : ""}€${payout - b.bet}).`,
    "casino",
  );
}
const RED = new Set([
  1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36,
]);
export const rouletteColor = (n: number) =>
  n === 0 ? "green" : RED.has(n) ? "red" : "black";
function clearInvalidTrades(g: GameState) {
  for (const t of g.trades)
    if (
      t.status === "pending" &&
      (!t.offerCities.every((id) => g.cities[id]?.ownerId === t.fromId) ||
        !t.requestCities.every((id) => g.cities[id]?.ownerId === t.toId))
    )
      t.status = "cancelled";
}
export function scoreTournament(g:GameState){
 if(g.phase!=='finished'||!g.settings.tournamentGames)return;
 g.tournament||={played:0,points:{}};if(g.tournament.scoredMatch===g.matchId)return;
 g.tournament.scoredMatch=g.matchId;g.tournament.played++;
 const winner=g.players.find(p=>p.id===g.winnerId);
 const rank=[...g.players].sort((a,b)=>Number(a.bankrupt)-Number(b.bankrupt)||netWorth(g,b)-netWorth(g,a));
 rank.forEach((p,i)=>{const pts=g.settings.teams?(p.team===winner?.team?3:0):(p.id===g.winnerId?3:i===1?2:i===2?1:0);g.tournament!.points[p.id]=(g.tournament!.points[p.id]||0)+pts;});
}
export function act(g:GameState,pid:string,a:Action,now=Date.now(),rng:Random=random) {
  applyAction(g,pid,a,now,rng);
  progress(g);
}
function progress(g:GameState){
  for(const player of g.players) {
    const m=player.mission;
    if(m&&!m.done&&(m.kind==='purchases'?(player.purchases||0):m.kind==='rent'?player.rentCollected:(player.tradesCompleted||0))>=m.target){m.done=true;player.money+=100;log(g,`${player.name} erfüllt eine Mission: +€100.`,'mission');}
    const earned=new Set(player.achievements || []);
    if(player.purchases)earned.add('Stadtgründer');
    if(Object.values(PROPERTIES).some(c=>c.kind==='city'&&ownsGroup(g,c.id,player.id)))earned.add('Farbmeister');
    if(player.tradesCompleted)earned.add('Verhandlungstalent');
    if(player.rentCollected>=1000)earned.add('Mietmagnat');
    if(hasWon(g,player.id)&&!player.casinoRounds)earned.add('Ohne Casino');
    player.achievements=[...earned];
  }
  scoreTournament(g);
}
function applyAction(
  g: GameState,
  pid: string,
  a: Action,
  now = Date.now(),
  rng: Random = random,
) {
  const PROPERTIES = gameProperties(g);
  const p = g.players.find((p) => p.id === pid);
  check(p, "Spieler nicht gefunden.");
  if (a.type === "chat") {
    const text = str(a.text);
    check(text, "Nachricht ist leer.");
    g.chat.push({ id: crypto.randomUUID(), playerId: pid, name: p.name, text });
    g.chat = g.chat.slice(-60);
    return;
  }
  if (a.type === "ready") {
    check(g.phase === "lobby", "Nur in der Lobby möglich."); p.ready = a.ready === true; return;
  }
  if (a.type === "city_set") {
    check(p.isHost && g.phase === "lobby", "Nur der Host in der Lobby.");
    const input = a.cities;
    check(input && typeof input === "object" && !Array.isArray(input), "Ungültiges Stadtset.");
    const result: NonNullable<GameState["customCities"]> = {};
    for (const [id, raw] of Object.entries(input)) {
      check(PROPERTIES[id]?.kind === "city", "Unbekannte Stadt.");
      const d = raw as {name:string; price:number; color:string};
      check(d && typeof d === "object", "Ungültige Stadt.");
      const name = str(d.name, 24); check(name, "Stadtname fehlt.");
      check(typeof d.color === "string" && /^#[0-9a-f]{6}$/i.test(d.color), "Ungültige Farbe.");
      result[id] = {name, price:integer(d.price, 10, 10000), color:d.color};
    }
    g.customCities = result; g.players.forEach(x => x.ready = x.isBot); return;
  }
  if(a.type==='team_set'){check(p.isHost&&g.phase==='lobby',"Nur der Host in der Lobby.");const who=g.players.find(x=>x.id===a.playerId);check(who,"Spieler fehlt.");who.team=integer(a.team,0,1);g.players.forEach(x=>x.ready=x.isBot);return;}
  if(a.type==='replace_bot'){
   check(g.phase==='playing'&&!p.bankrupt&&!p.isBot,'Abstimmung nicht möglich.');
   const target=g.players.find(x=>x.id===a.playerId);
   check(target&&!target.connected&&!target.isBot&&!target.bankrupt&&target.disconnectedAt&&now-target.disconnectedAt>=60000,'Spieler muss mindestens 60 Sekunden getrennt sein.');
   g.botVotes||={};const voters=new Set(g.botVotes[target.id]||[]);voters.add(pid);g.botVotes[target.id]=[...voters];
   if(g.players.filter(x=>x.connected&&!x.isBot&&!x.bankrupt).every(x=>voters.has(x.id))){target.isBot=true;target.replacementBot=true;target.connected=true;delete g.botVotes[target.id];log(g,`${target.name} wird von einem Bot vertreten.`);}
   return;
  }
  if (a.type === "pause" || a.type === "resume") {
    check(g.phase === "playing" && !p.bankrupt && !p.isBot, "Pause gerade nicht möglich.");
    const resume = a.type === "resume";
    check(resume ? !!g.manualPause : !g.manualPause, resume ? "Spiel läuft bereits." : "Spiel ist pausiert.");
    const key = resume ? "resumeVotes" : "pauseVotes";
    const votes = new Set(g[key] || []); votes.has(pid) ? votes.delete(pid) : votes.add(pid); g[key] = [...votes];
    const voters = g.players.filter(x => !x.isBot && !x.bankrupt && (resume || x.connected));
    if (voters.every(x => votes.has(x.id))) {
      if (resume) {
        const offset = now - g.manualPause!;
        if (g.tradeUntil) g.tradeUntil += offset;
        if (g.turnDeadline) g.turnDeadline += offset;
        if (g.actionNotBefore) g.actionNotBefore += offset;
        if (g.auction) { g.auction.endsAt += offset; g.auction.hardEndsAt += offset; }
        g.manualPause = null; log(g, "Die Partie wird fortgesetzt.");
      } else { g.manualPause = now; log(g, "Partie gemeinsam pausiert. Raumcode für später aufbewahren."); }
      g.pauseVotes = []; g.resumeVotes = [];
    }
    return;
  }
  check(!g.manualPause, "Die Partie ist pausiert.");
  if (a.type === "settings" || a.type === "settings_patch") {
    check(
      p.isHost && g.phase === "lobby",
      "Nur der Host kann die Lobby konfigurieren.",
    );
    const s = (a.type === "settings_patch" ? {...g.settings,...(a.settings as Partial<Settings>)} : a.settings) as Settings;
    if(s?.boardVariant !== g.settings.boardVariant) g.customCities={};
    check(s && ["classic", "plus"].includes(s.mode), "Ungültiger Modus.");
    g.settings = {
      mode: s.mode,
      boardVariant:s.boardVariant==='dortmund'?'dortmund':'world',
      teams:s.teams===true, missions:s.missions===true,
      startBonus:integer(s.startBonus??200,0,1000),auctionSeconds:integer(s.auctionSeconds??20,10,120),buildPercent:integer(s.buildPercent??100,50,200),casinoLimit:integer(s.casinoLimit??4,0,20),tradingSeconds:integer(s.tradingSeconds??0,0,120),tournamentGames:integer(s.tournamentGames??0,0,10),
      events: s.mode === "plus" && s.events === true,
      publicRoom: s.publicRoom === true,
      botLevel: ["easy", "normal", "hard"].includes(s.botLevel || "") ? s.botLevel : "normal",
      startingMoney: integer(s.startingMoney, 1000, 5000),
      targetWealth: s.targetWealth ? integer(s.targetWealth, Math.max(3000,s.startingMoney+1000),100000) : 0,
      maxRounds: integer(s.maxRounds, 0, 100),
      turnSeconds: integer(s.turnSeconds, 30, 180),
    };
    g.players.forEach((x) => { x.money = g.settings.startingMoney; x.ready = x.isBot; });
    return;
  }
  if (a.type === "add_bot") {
    check(
      p.isHost && g.phase === "lobby",
      "Nur der Host kann Bots hinzufügen.",
    );
    const names = ["Aurora", "Atlas", "Nova", "Orion", "Luna"];
    const name = names.find((n) => !g.players.some((x) => x.name === n));
    check(name, "Keine weiteren Bots möglich.");
    addPlayer(g, crypto.randomUUID(), name, AVATARS[g.players.length], true);
    return;
  }
  if (a.type === "remove_bot") {
    check(p.isHost && g.phase === "lobby", "Nicht erlaubt.");
    g.players = g.players.filter((x) => !(x.id === a.id && x.isBot));
    return;
  }
  if (a.type === "rematch") {
    check(p.isHost && g.phase === "finished", "Noch keine Revanche möglich.");
    const fresh = freshGame(g.gameId);
    fresh.settings = { ...g.settings };
    fresh.customCities = structuredClone(g.customCities || {});
    scoreTournament(g);
    fresh.tournament=g.tournament?.played!<(g.settings.tournamentGames||0)?structuredClone(g.tournament):{played:0,points:{}};
    for (const old of g.players.filter((x) => x.connected || x.isBot)) {
      const n = addPlayer(fresh, old.id, old.name, old.avatar, old.isBot);
      n.isHost = old.id === pid; n.team=old.team; n.profileId=old.profileId;
    }
    Object.assign(g, fresh);
    return;
  }
  if (a.type === "start") {
    check(p.isHost && g.phase === "lobby", "Nur der Host kann starten.");
    check(
      g.players.length >= 2,
      "Mindestens 2 Spieler oder einen Bot hinzufügen.",
    );
    check(
      g.players.every((x) => x.connected || x.isBot),
      "Ein Spieler ist getrennt. Entferne ihn vor dem Start.",
    );
    check(g.players.every(x => x.isBot || x.isHost || x.ready), "Alle Mitspieler müssen bereit sein.");
    if(g.settings.teams)check(g.players.length===4&&[0,1].every(t=>g.players.filter(x=>x.team===t).length===2),"Teammodus braucht genau vier Spieler, zwei pro Team.");
    if(g.settings.missions)g.players.forEach(x=>{const kinds=['purchases','rent','trade'] as const;const kind=kinds[rng(3)];x.mission={kind,target:kind==='rent'?300:kind==='purchases'?3:1,done:false};});
    g.phase = "playing";
    resetTurn(g, now);
    recordWealth(g);
    log(g, "Das Spiel beginnt. Baue dein Imperium.", "start");
    return;
  }
  if (a.type === "kick_disconnected") {
    check(p.isHost && g.phase === "lobby", "Nicht erlaubt.");
    g.players = g.players.filter((x) => x.id === pid || x.connected);
    return;
  }
  check(
    g.phase === "playing" && !p.bankrupt,
    "Du kannst gerade nicht spielen.",
  );
  if (a.type === "bid") {
    const auction = g.auction;
    check(auction && now < auction.endsAt, "Keine laufende Auktion.");
    check(
      auction.sellerId !== pid,
      "Du kannst nicht auf deine eigene Stadt bieten.",
    );
    check(!g.debt, "Während Geldnot nicht möglich.");
    const amount = integer(
      a.amount,
      auction.bidderId ? auction.currentBid + 10 : auction.minimum,
    );
    check(amount <= p.money, "Nicht genügend Geld.");
    auction.currentBid = amount;
    auction.bidderId = pid;
    auction.endsAt = Math.min(
      auction.hardEndsAt,
      Math.max(auction.endsAt, now + 5000),
    );
    auction.history.unshift({ name: p.name, amount });
    auction.history = auction.history.slice(0, 8);
    return;
  }
  if (a.type === "trade_cancel") {
    const t = g.trades.find(
      (t) => t.id === a.id && t.fromId === pid && t.status === "pending",
    );
    check(t, "Angebot nicht gefunden.");
    t.status = "cancelled";
    return;
  }
  if (a.type === "trade" || a.type === "trade_respond") {
    check(
      !g.auction && !g.debt && g.blackjack?.status !== "playing",
      "Handel ist während Auktionen, Geldnot oder Blackjack gesperrt.",
    );
    if (a.type === "trade") {
      const counter = a.counterOf ? g.trades.find(t=>t.id===a.counterOf && t.toId===pid && t.status==="pending") : undefined;
      check(!a.counterOf || (counter && counter.fromId===a.toId), "Das ursprüngliche Angebot ist nicht mehr offen.");
      const to = g.players.find(
        (x) => x.id === a.toId && !x.bankrupt && x.id !== pid,
      );
      check(to, "Ungültiger Handelspartner.");
      const list = (x: unknown, owner: string) => {
        check(
          Array.isArray(x) &&
            x.length <= 22 &&
            x.every(
              (id) => typeof id === "string" && g.cities[id]?.ownerId === owner,
            ),
          "Ungültige Grundstücke.",
        );
        const ids = [...new Set(x as string[])];
        check(
          ids.every(
            (id) =>
              !groupCities(id).some(
                (cid) => g.cities[cid].developmentLevel > 0,
              ),
          ),
          "Vor dem Handel alle Gebäude der Gruppe verkaufen.",
        );
        return ids;
      };
      const offerCities = list(a.offerCities, pid),
        requestCities = list(a.requestCities, to.id),
        offerMoney = integer(a.offerMoney),
        requestMoney = integer(a.requestMoney);
      check(
        offerMoney <= available(g, p) && requestMoney <= available(g, to),
        "Nicht genügend Geld.",
      );
      check(
        offerCities.length + requestCities.length + offerMoney + requestMoney >
          0,
        "Das Angebot ist leer.",
      );
      check(
        g.trades.filter((t) => t.fromId === pid && t.status === "pending")
          .length < 3,
        "Maximal drei offene Angebote.",
      );
      if (counter) counter.status = "declined";
      g.trades.push({
        counterOf: counter?.id,
        id: crypto.randomUUID(),
        fromId: pid,
        toId: to.id,
        offerCities,
        requestCities,
        offerMoney,
        requestMoney,
        status: "pending",
      });
      g.trades = g.trades.slice(-30);
      log(g, `${p.name} bietet ${to.name} einen Handel an.`, "trade");
    } else {
      const t = g.trades.find(
        (t) => t.id === a.id && t.toId === pid && t.status === "pending",
      );
      check(t, "Angebot nicht gefunden.");
      if (a.accept !== true) {
        t.status = "declined";
        return;
      }
      const from = g.players.find((x) => x.id === t.fromId && !x.bankrupt);
      check(from, "Handelspartner ausgeschieden.");
      check(
        t.offerCities.every((id) => g.cities[id].ownerId === from.id) &&
          t.requestCities.every((id) => g.cities[id].ownerId === pid),
        "Eigentum hat sich geändert.",
      );
      check(
        [...t.offerCities, ...t.requestCities].every(
          (id) =>
            !groupCities(id).some((cid) => g.cities[cid].developmentLevel > 0),
        ),
        "Gebäude müssen zuerst verkauft werden.",
      );
      check(
        from.money >= t.offerMoney && p.money >= t.requestMoney,
        "Kontostand hat sich geändert.",
      );
      from.money += t.requestMoney - t.offerMoney;
      p.money += t.offerMoney - t.requestMoney;
      t.offerCities.forEach((id) => (g.cities[id].ownerId = pid));
      t.requestCities.forEach((id) => (g.cities[id].ownerId = from.id));
      t.status = "accepted";
      from.tradesCompleted = (from.tradesCompleted || 0) + 1;
      p.tradesCompleted = (p.tradesCompleted || 0) + 1;
      log(g, `${from.name} und ${p.name} schließen einen Handel ab.`, "trade");
      clearInvalidTrades(g);
    }
    return;
  }
  if(a.type==='team_transfer'){
   check(g.settings.teams&&!g.auction&&!g.debt&&g.blackjack?.status!=='playing','Teamtransfer gerade gesperrt.');
   const to=g.players.find(x=>x.id===a.toId&&!x.bankrupt&&x.id!==pid&&x.team===p.team);check(to,'Kein aktiver Teamkollege.');const amount=integer(a.amount,1,available(g,p));p.money-=amount;to.money+=amount;log(g,`${p.name} überträgt €${amount} an ${to.name}.`,'trade');return;
  }
  check(!g.tradeUntil || now>=g.tradeUntil,"Handelsphase läuft noch.");
  check(current(g).id === pid, "Warte auf deinen Zug.");
  check(!g.auction, "Die Auktion läuft noch.");
  check(now >= g.actionNotBefore, "Der Würfelwurf läuft noch.");
  if (a.type === "surrender") {
    check(
      g.turnPhase === "debt",
      "Aufgeben ist bei Zahlungsunfähigkeit möglich.",
    );
    bankrupt(g, p, now, rng);
    return;
  }
  if (a.type === "settle_debt") {
    const d = g.debt;
    check(d && d.playerId === pid, "Keine offene Zahlung.");
    check(p.money >= d.amount, "Es fehlt noch Geld.");
    g.debt = null;
    pay(g, p, d.amount, d.creditorId, d.reason, d.resume);
    if (d.moveSteps) move(g, p, d.moveSteps, rng);
    return;
  }
  if (
    a.type === "build" ||
    a.type === "sell_building" ||
    a.type === "mortgage" ||
    a.type === "unmortgage"
  ) {
    const id = str(a.cityId, 30),
      c = g.cities[id],
      d = PROPERTIES[id];
    check(c && c.ownerId === pid, "Diese Stadt gehört dir nicht.");
    check(g.turnPhase !== "purchase", "Zuerst Kaufentscheidung treffen.");
    check(g.blackjack?.status !== "playing", "Beende zuerst Blackjack.");
    const group = groupCities(id).map((cid) => g.cities[cid]);
    if (a.type === "build") {
      check(
        !g.debt && d.kind === "city" && ownsGroup(g, id, pid),
        "Du brauchst die vollständige Gruppe.",
      );
      check(
        group.every((c) => !c.mortgaged),
        "Zuerst alle Hypotheken dieser Gruppe auslösen.",
      );
      check(
        c.developmentLevel < 5 &&
          c.developmentLevel ===
            Math.min(...group.map((c) => c.developmentLevel)),
        "Gleichmäßig bauen, maximal ein Hotel.",
      );
      check(p.money >= d.buildCost, "Nicht genügend Geld.");
      p.money -= d.buildCost;
      c.developmentLevel++;
      log(
        g,
        `${p.name} baut in ${d.name}: ${c.developmentLevel === 5 ? "Hotel" : `Stufe ${c.developmentLevel}`}.`,
        "build",
      );
    } else if (a.type === "sell_building") {
      check(
        c.developmentLevel > 0 &&
          c.developmentLevel ===
            Math.max(...group.map((c) => c.developmentLevel)),
        "Gebäude gleichmäßig verkaufen.",
      );
      c.developmentLevel--;
      p.money += Math.floor(d.buildCost / 2);
      log(g, `${p.name} verkauft ein Gebäude in ${d.name}.`, "money");
    } else if (a.type === "mortgage") {
      check(
        !c.mortgaged && group.every((c) => c.developmentLevel === 0),
        "Vorher alle Gebäude der Gruppe verkaufen.",
      );
      c.mortgaged = true;
      p.money += Math.floor(d.price / 2);
      log(g, `${p.name} verpfändet ${d.name}.`, "money");
    } else {
      check(!g.debt && c.mortgaged, "Keine auslösbare Hypothek.");
      const cost = Math.ceil(d.price * 0.55);
      check(p.money >= cost, "Nicht genügend Geld.");
      p.money -= cost;
      c.mortgaged = false;
    }
    return;
  }
  if (a.type === "stock_sell" || a.type === "stock_buy") {
    check(g.settings.mode === "plus", "Nur im Plus-Modus verfügbar.");
    check(g.blackjack?.status !== "playing", "Beende zuerst Blackjack.");
    const s = g.stocks.find((s) => s.id === a.stockId);
    check(s, "Aktie nicht gefunden.");
    const qty = integer(a.quantity, 1, 100);
    check(
      p.stockActions < 3 || (a.type === "stock_sell" && g.debt),
      "Maximal drei Börsengeschäfte pro Zug.",
    );
    if (a.type === "stock_buy") {
      check(
        !g.debt && g.turnPhase !== "purchase",
        "Zuerst offene Entscheidung klären.",
      );
      check(p.money >= s.price * qty, "Nicht genügend Geld.");
      p.money -= s.price * qty;
      p.stocks[s.id] = (p.stocks[s.id] || 0) + qty;
    } else {
      check((p.stocks[s.id] || 0) >= qty, "Nicht genügend Aktien.");
      p.money += s.price * qty;
      p.stocks[s.id] -= qty;
    }
    p.stockActions++;
    log(
      g,
      `${p.name} ${a.type === "stock_buy" ? "kauft" : "verkauft"} ${qty} ${s.id.toUpperCase()} zu €${s.price}.`,
      "stock",
    );
    return;
  }
  check(!g.debt, "Zuerst die offene Zahlung begleichen oder aufgeben.");
  if (a.type === "blackjack_hit" || a.type === "blackjack_stand") {
    const b = g.blackjack;
    check(
      b && b.playerId === pid && b.status === "playing",
      "Kein offenes Blackjack-Spiel.",
    );
    if (a.type === "blackjack_hit") {
      b.hand.push(b.deck.pop()!);
      if (handValue(b.hand) >= 21) settleBlackjack(g, true);
    } else settleBlackjack(g, true);
    return;
  }
  check(
    g.blackjack?.status !== "playing",
    "Beende zuerst deine Blackjack-Runde.",
  );
  if (a.type === "auction_create") {
    check(
      g.settings.mode === "plus",
      "Private Auktionen sind im Plus-Modus verfügbar.",
    );
    check(
      g.turnPhase === "end" && !p.auctionUsed,
      "Eine private Auktion pro Zug, nach dem Würfeln.",
    );
    const ids = a.cityIds===undefined?[str(a.cityId,30)]:a.cityIds;
    check(Array.isArray(ids)&&ids.length>0&&ids.length<=22&&ids.every(id=>typeof id==='string'),"Ungültiges Paket.");
    check(new Set(ids).size===ids.length,"Doppelte Grundstücke.");
    for(const id of ids)check(g.cities[id]?.ownerId===pid&&!g.cities[id].mortgaged&&groupCities(id).every(cid=>g.cities[cid].developmentLevel===0),"Paket enthält fremde, bebaute oder belastete Grundstücke.");
    const id = ids[0] as string;
    check(g.cities[id]?.ownerId === pid, "Nicht dein Grundstück.");
    check(
      !g.cities[id].mortgaged &&
        groupCities(id).every((cid) => g.cities[cid].developmentLevel === 0),
      "Nur unbelastete Grundstücke; vorher Gruppen-Gebäude verkaufen.",
    );
    const minimum = integer(a.minimum, 10, 10000);
    p.auctionUsed = true;
    startAuction(g, id, pid, minimum, now);
    g.auction!.cityIds=ids as string[];
    return;
  }
  if (a.type === "roulette" || a.type === "blackjack_start") {
    check(
      g.settings.mode === "plus" && g.turnPhase === "end",
      "Casino im Plus-Modus nach dem Würfeln verfügbar.",
    );
    check(p.casinoPlays < (g.settings.casinoLimit??4), `Maximal ${g.settings.casinoLimit??4} Casino-Spiele pro Zug (Standard: vier).`);
    const bet = integer(a.bet, 1, p.money);
    check(Number.isSafeInteger(p.money + Math.ceil(bet * 1.5)), "Betrag überschreitet die sichere Rechengenauigkeit.");
    check(p.money >= bet, "Nicht genügend Geld.");
    if (a.type === "roulette") {
      const choice = str(a.choice, 10);
      check(
        ["red", "black", "even", "odd"].includes(choice),
        "Wähle Rot, Schwarz, Gerade oder Ungerade.",
      );
      p.money -= bet;
      p.casinoPlays++;
      p.casinoRounds = (p.casinoRounds || 0) + 1;
      const number = rng(37),
        win =
          number !== 0 &&
          (choice === rouletteColor(number) ||
            (choice === "even" && number % 2 === 0) ||
            (choice === "odd" && number % 2 === 1));
      const payout = win ? bet * 2 : 0;
      p.money += payout;
      p.casinoNet = (p.casinoNet || 0) + payout - bet;
      g.roulette = {
        id: crypto.randomUUID(),
        playerId: pid,
        number,
        bet,
        choice,
        payout,
      };
      log(
        g,
        `${p.name}: Roulette ${number}, ${win ? "+" : "−"}€${bet}.`,
        "casino",
      );
    } else {
      p.money -= bet;
      p.casinoPlays++;
      p.casinoRounds = (p.casinoRounds || 0) + 1;
      const deck = Array.from({ length: 52 }, (_, i) => i);
      for (let i = deck.length - 1; i > 0; i--) {
        const j = rng(i + 1);
        [deck[i], deck[j]] = [deck[j], deck[i]];
      }
      g.blackjack = {
        playerId: pid,
        bet,
        hand: [deck.pop()!, deck.pop()!],
        dealer: [deck.pop()!, deck.pop()!],
        deck,
        status: "playing",
        message: "Karte ziehen oder stehen bleiben?",
      };
      if (
        handValue(g.blackjack.hand) === 21 ||
        handValue(g.blackjack.dealer) === 21
      )
        settleBlackjack(g, true);
    }
    return;
  }
  if (a.type === "bail") {
    check(p.jail >= 0 && g.turnPhase === "roll", "Du bist nicht im Gefängnis.");
    check(p.money >= JAIL_FEE, "€50 für die Freilassung nötig.");
    p.money -= JAIL_FEE;
    p.jail = -1;
    log(g, `${p.name} zahlt €50 Kaution.`);
    return;
  }
  if (a.type === "roll") {
    check(g.turnPhase === "roll", "Du hast schon gewürfelt.");
    const dice: [number, number] = [rng(6) + 1, rng(6) + 1];
    g.lastDice = dice;
    g.rollId++;
    g.actionNotBefore = now + 2700;
    g.turnDeadline = Math.max(g.turnDeadline, now + 12000);
    const double = dice[0] === dice[1];
    g.extraRoll = double;
    g.doubles = double ? g.doubles + 1 : 0;
    if (p.jail >= 0) {
      g.extraRoll = false;
      if (double) {
        p.jail = -1;
        move(g, p, dice[0] + dice[1], rng);
      } else {
        p.jail++;
        if (p.jail >= 3) {
          p.jail = -1;
          pay(g, p, JAIL_FEE, null, "Kaution", "end");
          const jailDebt = g.debt as GameState["debt"];
          if (jailDebt) jailDebt.moveSteps = dice[0] + dice[1];
          else move(g, p, dice[0] + dice[1], rng);
        } else {
          g.turnPhase = "end";
          log(g, `${p.name} bleibt im Gefängnis (${p.jail}/3).`);
        }
      }
      return;
    }
    if (g.doubles >= 3) {
      sendJail(g, p);
      return;
    }
    move(g, p, dice[0] + dice[1], rng);
    return;
  }
  if (a.type === "buy") {
    check(g.turnPhase === "purchase", "Keine Stadt zum Kaufen.");
    const id = BOARD[p.position].id,
      c = g.cities[id],
      d = PROPERTIES[id];
    check(c && !c.ownerId, "Nicht verfügbar.");
    check(p.money >= d.price, "Nicht genügend Geld. Du kannst versteigern.");
    p.money -= d.price;
    c.ownerId = pid;
    p.biggestPurchase = Math.max(p.biggestPurchase || 0, d.price);
    p.purchases = (p.purchases || 0) + 1;
    p.purchaseCounts ||= {}; p.purchaseCounts[id] = (p.purchaseCounts[id] || 0) + 1;
    g.turnPhase = "end";
    log(g, `${p.name} kauft ${d.name} für €${d.price}.`, "purchase");
    if (ownsGroup(g, id, pid))
      log(
        g,
        `${p.name} vervollständigt ${d.group === "transport" ? "das Verkehrsnetz" : "eine Gruppe"}!`,
        "group",
      );
    return;
  }
  if (a.type === "skip") {
    check(g.turnPhase === "purchase", "Keine offene Kaufentscheidung.");
    startAuction(g, BOARD[p.position].id, null, 10, now);
    return;
  }
  if (a.type === "end") {
    check(g.turnPhase === "end", "Beende zuerst deine Aktion.");
    if (g.extraRoll) {
      g.extraRoll = false;
      g.turnPhase = "roll";
      g.turnDeadline = now + g.settings.turnSeconds * 1000;
    } else advance(g, now, rng);
    return;
  }
  throw new Error("Unbekannte Aktion.");
}
export function botAct(
  g: GameState,
  p: Player,
  now: number,
  rng: Random = random,
) {
  const PROPERTIES = gameProperties(g);
  const reserve = g.settings.botLevel === "easy" ? 350 : g.settings.botLevel === "hard" ? 60 : 150;
  const attempt = (a: Action) => {
    try {
      act(g, p.id, a, now, rng);
      return true;
    } catch {
      return false;
    }
  };
  if (g.auction) {
    const a = g.auction,
      d = PROPERTIES[a.cityId];
    const bid = a.bidderId ? a.currentBid + 10 : a.minimum;
    if (
      a.sellerId !== p.id &&
      a.bidderId !== p.id &&
      p.money - bid >= reserve &&
      bid <= (a.cityIds||[a.cityId]).reduce((n,id)=>n+PROPERTIES[id].price,0) * (ownsGroupAfter(g, d.id, p.id) ? 1.2 : (g.settings.botLevel === "hard" ? 1 : .85))
    )
      attempt({ type: "bid", amount: bid });
    return;
  }
  const incoming = g.trades.find(
    (t) => t.toId === p.id && t.status === "pending",
  );
  if (incoming && !g.debt) {
    const received =
      incoming.offerMoney +
      incoming.offerCities.reduce(
        (n, id) =>
          n + PROPERTIES[id].price * (g.cities[id].mortgaged ? 0.5 : 1),
        0,
      );
    const given =
      incoming.requestMoney +
      incoming.requestCities.reduce(
        (n, id) =>
          n + PROPERTIES[id].price * (g.cities[id].mortgaged ? 0.5 : 1),
        0,
      );
    if (
      !attempt({
        type: "trade_respond",
        id: incoming.id,
        accept: received >= given * (g.settings.botLevel === "easy" ? .9 : g.settings.botLevel === "hard" ? 1.2 : 1.1),
      })
    )
      attempt({ type: "trade_respond", id: incoming.id, accept: false });
  }
  if (current(g).id !== p.id || now < g.actionNotBefore) return;
  if (g.turnPhase === "debt") {
    if (attempt({ type: "settle_debt" })) return;
    for (const s of g.stocks)
      if ((p.stocks[s.id] || 0) > 0) {
        attempt({
          type: "stock_sell",
          stockId: s.id,
          quantity: Math.min(100, p.stocks[s.id]),
        });
        return;
      }
    for (const c of Object.values(g.cities)
      .filter((c) => c.ownerId === p.id)
      .sort((a, b) => b.developmentLevel - a.developmentLevel))
      if (
        c.developmentLevel > 0 &&
        attempt({ type: "sell_building", cityId: c.id })
      )
        return;
    for (const c of Object.values(g.cities))
      if (
        c.ownerId === p.id &&
        !c.mortgaged &&
        attempt({ type: "mortgage", cityId: c.id })
      )
        return;
    attempt({ type: "surrender" });
    return;
  }
  if (g.turnPhase === "roll") {
    attempt({ type: "roll" });
    return;
  }
  if (g.turnPhase === "purchase") {
    const d = PROPERTIES[BOARD[p.position].id];
    attempt({ type: p.money - d.price >= reserve ? "buy" : "skip" });
    return;
  }
  if (g.turnPhase === "end") {
    for (const c of Object.values(g.cities))
      if (
        c.ownerId === p.id &&
        ownsGroup(g, c.id, p.id) &&
        PROPERTIES[c.id].kind === "city" &&
        p.money - PROPERTIES[c.id].buildCost >= reserve * 2
      ) {
        if (attempt({ type: "build", cityId: c.id })) return;
      }
    attempt({ type: "end" });
  }
}
function ownsGroupAfter(g: GameState, id: string, pid: string) {
  return groupCities(id)
    .filter((cid) => cid !== id)
    .every((cid) => g.cities[cid].ownerId === pid);
}
export function tick(g:GameState,now=Date.now(),rng:Random=random){runTick(g,now,rng);progress(g);}
function runTick(g: GameState, now = Date.now(), rng: Random = random) {
  if (g.phase !== "playing" || g.manualPause) return;
  if(g.tradeUntil){if(now<g.tradeUntil)return;g.tradeUntil=undefined;log(g,'Handelsphase beendet.');}
  if (g.auction) {
    if (now >= g.auction.endsAt) {
      resolveAuction(g, now);
      return;
    }
    const candidates = g.players.filter((p) => p.isBot && !p.bankrupt);
    for (const p of candidates) botAct(g, p, now, rng);
    return;
  }
  for (const p of g.players.filter(
    (p) => p.isBot && !p.bankrupt && p.id !== current(g).id,
  ))
    if (g.trades.some((t) => t.status === "pending" && t.toId === p.id))
      botAct(g, p, now, rng);
  const p = current(g);
  if (p.bankrupt) {
    advance(g, now, rng);
    return;
  }
  if (p.isBot) {
    botAct(g, p, now, rng);
    return;
  }
  if (now < g.turnDeadline || now < g.actionNotBefore) return;
  if (g.blackjack?.status === "playing") settleBlackjack(g, true);
  if (g.turnPhase === "debt") {
    let guard = 0;
    while (g.debt && guard++ < 160) botAct(g, p, now, rng);
    if (g.debt) bankrupt(g, p, now, rng);
    return;
  }
  if (g.turnPhase === "purchase") {
    startAuction(g, BOARD[p.position].id, null, 10, now);
    return;
  }
  log(g, `${p.name}: Zeit abgelaufen.`);
  g.extraRoll = false;
  advance(g, now, rng);
}
export function publicGame(g: GameState, viewer?:string): GameState {
  const copy = structuredClone(g);
  if(copy.phase!=="finished")copy.players.forEach(p=>{if(p.id!==viewer)delete p.mission;});
  if (copy.blackjack) {
    copy.blackjack.deck = [];
    if (copy.blackjack.status === "playing")
      copy.blackjack.dealer = [copy.blackjack.dealer[0], -1];
  }
  return copy;
}
export function nextWake(g: GameState, now = Date.now()) {
  if (g.phase !== "playing" || g.manualPause) return null;
  if(g.tradeUntil)return g.tradeUntil;
  if (g.auction) return Math.min(g.auction.endsAt, now + 1800);
  if (current(g).isBot) return Math.max(now + 1100, g.actionNotBefore + 100);
  if (
    g.trades.some(
      (t) =>
        t.status === "pending" &&
        g.players.some((p) => p.id === t.toId && p.isBot),
    )
  )
    return now + 1200;
  return Math.max(g.turnDeadline, g.actionNotBefore, now + 100);
}

export function hasWon(g:GameState,id:string):boolean {
 const winner=g.players.find(p=>p.id===g.winnerId),player=g.players.find(p=>p.id===id);
 return !!winner&&!!player&&(g.settings.teams?player.team===winner.team:id===winner.id);
}
