import { test } from "node:test";
import assert from "node:assert/strict";
import {
  act,
  addPlayer,
  freshGame,
  current,
  tick,
  publicGame,
  random,
  rent,
  netWorth,
  hostTransfer,
  handValue,
  nextWake,
  type GameState,
  type Action,
} from "../game.ts";
import { BOARD, PROPERTIES } from "../rules.ts";
const now = 100000;
function setup() {
  const g = freshGame("TEST1234");
  addPlayer(g, "a", "Alice");
  addPlayer(g, "b", "Bob");
  act(g, "b", {type:"ready",ready:true},now);
  act(g, "a", { type: "start" }, now);
  g.actionNotBefore = 0;
  return g;
}
const a = (g: GameState, action: Action, p = "a", time = now) =>
  act(g, p, action, time, () => 0);
function seq(...v: number[]) {
  return (n: number) => (v.shift() ?? 0) % n;
}
test("32 tiles, 18 original cities, 4 transport properties", () => {
  assert.equal(BOARD.length, 32);
  assert.equal(
    Object.values(PROPERTIES).filter((p) => p.kind === "city").length,
    18,
  );
  assert.equal(Object.keys(PROPERTIES).length, 22);
  assert.equal(new Set(BOARD.map((t) => t.id)).size, 32);
});
test("finite integer money only, no strings or null on trade", () => {
  for (const value of ["100", NaN, Infinity, null, -1, 1.5]) {
    const g = setup();
    assert.throws(() =>
      a(g, {
        type: "trade",
        toId: "b",
        offerCities: [],
        requestCities: [],
        offerMoney: value,
        requestMoney: 0,
      }),
    );
    assert.equal(g.players[0].money, 1500);
    assert.equal(g.players[1].money, 1500);
  }
});
test("host and turn ownership enforced", () => {
  const g = setup();
  assert.throws(() => a(g, { type: "roll" }, "b"));
  assert.throws(() => a(g, { type: "settings", settings: g.settings }, "b"));
  assert.equal(g.rollId, 0);
});
test("roll moves by both dice, passes start, and cannot roll twice", () => {
  const g = setup();
  g.players[0].position = 31;
  act(g, "a", { type: "roll" }, now, seq(0, 0));
  assert.equal(g.lastDice?.join(","), "1,1");
  assert.equal(g.players[0].position, 1);
  assert.equal(g.players[0].money, 1700);
  assert.equal(g.turnPhase, "purchase");
  assert.throws(() => a(g, { type: "roll" }, "a", now + 3000));
});
test("purchase and extra turn after doubles", () => {
  const g = setup();
  act(g, "a", { type: "roll" }, now, seq(0, 0));
  a(g, { type: "buy" }, "a", now + 3000);
  assert.equal(g.cities.koeln.ownerId, "a");
  a(g, { type: "end" }, "a", now + 3000);
  assert.equal(current(g).id, "a");
  assert.equal(g.turnPhase, "roll");
});
test("three consecutive doubles send player to jail", () => {
  const g = setup();
  g.doubles = 2;
  act(g, "a", { type: "roll" }, now, seq(1, 1));
  assert.equal(g.players[0].jail, 0);
  assert.equal(g.players[0].position, 8);
  assert.equal(g.extraRoll, false);
});
test("mortgaged city has no rent and full group doubles base rent", () => {
  const g = setup();
  for (const id of ["dortmund", "koeln", "duesseldorf"])
    g.cities[id].ownerId = "a";
  assert.equal(rent(g, "dortmund"), 4);
  g.cities.dortmund.mortgaged = true;
  assert.equal(rent(g, "dortmund"), 0);
});
test("build requires full group and even development; hotel reaches level 5", () => {
  const g = setup();
  g.turnPhase = "end";
  g.players[0].money = 10000;
  g.cities.dortmund.ownerId = "a";
  assert.throws(() => a(g, { type: "build", cityId: "dortmund" }));
  for (const id of ["koeln", "duesseldorf"]) g.cities[id].ownerId = "a";
  a(g, { type: "build", cityId: "dortmund" });
  assert.throws(() => a(g, { type: "build", cityId: "dortmund" }));
  for (let level = 0; level < 5; level++)
    for (const id of ["dortmund", "koeln", "duesseldorf"])
      if (g.cities[id].developmentLevel === level)
        a(g, { type: "build", cityId: id });
  assert.equal(g.cities.dortmund.developmentLevel, 5);
  assert.equal(rent(g, "dortmund"), 100);
  assert.throws(() => a(g, { type: "build", cityId: "dortmund" }));
});
test("building sales and mortgages respect whole-group restrictions", () => {
  const g = setup();
  g.turnPhase = "end";
  for (const id of ["dortmund", "koeln", "duesseldorf"])
    g.cities[id].ownerId = "a";
  a(g, { type: "build", cityId: "dortmund" });
  assert.throws(() => a(g, { type: "mortgage", cityId: "koeln" }));
  a(g, { type: "sell_building", cityId: "dortmund" });
  a(g, { type: "mortgage", cityId: "koeln" });
  assert.equal(g.cities.koeln.mortgaged, true);
  assert.throws(() => a(g, { type: "build", cityId: "dortmund" }));
});
test("debt allows rescue before bankruptcy; zero cash alone is not bankruptcy", () => {
  const g = setup();
  g.players[0].money = 0;
  g.cities.koeln.ownerId = "b";
  g.cities.tokyo.ownerId = "a";
  act(g, "a", { type: "roll" }, now, seq(0, 0));
  assert.equal(g.turnPhase, "debt");
  assert.equal(g.players[0].bankrupt, false);
  a(g, { type: "mortgage", cityId: "tokyo" }, "a", now + 3000);
  a(g, { type: "settle_debt" }, "a", now + 3000);
  assert.equal(g.debt, null);
  assert.equal(g.players[0].money, 196);
  assert.equal(g.players[1].money, 1504);
});
test("bankruptcy ends a two-player game instead of blocking the scheduler", () => {
  const g = setup();
  g.players[0].money = 0;
  g.cities.koeln.ownerId = "b";
  act(g, "a", { type: "roll" }, now, seq(0, 0));
  a(g, { type: "surrender" }, "a", now + 3000);
  assert.equal(g.phase, "finished");
  assert.equal(g.winnerId, "b");
  assert.equal(nextWake(g), null);
});
test("timeout automatically liquidates assets to settle debt", () => {
  const g = setup();
  g.players[0].money = 0;
  g.cities.koeln.ownerId = "b";
  g.cities.tokyo.ownerId = "a";
  act(g, "a", { type: "roll" }, now, seq(0, 0));
  tick(g, now + 90000, () => 0);
  assert.equal(g.debt, null);
  assert.equal(g.cities.tokyo.mortgaged, true);
  assert.equal(g.players[0].bankrupt, false);
});
test("auction reserves funds, blocks spending/trades, pays full winning bid", () => {
  const g = setup();
  g.turnPhase = "purchase";
  g.players[0].position = 1;
  a(g, { type: "skip" });
  a(g, { type: "bid", amount: 100 }, "b");
  assert.throws(() =>
    a(
      g,
      {
        type: "trade",
        toId: "a",
        offerCities: [],
        requestCities: [],
        offerMoney: 1499,
        requestMoney: 0,
      },
      "b",
    ),
  );
  tick(g, now + 20001, () => 0);
  assert.equal(g.cities.dortmund.ownerId, "b");
  assert.equal(g.players[1].money, 1400);
  assert.equal(g.turnPhase, "end");
  assert.ok(g.turnDeadline > now + 20001);
});
test("late bids extend 5 seconds, reject after deadline and seller self bids", () => {
  const g = setup();
  g.turnPhase = "end";
  g.cities.dortmund.ownerId = "a";
  a(g, { type: "auction_create", cityId: "dortmund", minimum: 50 });
  assert.throws(() => a(g, { type: "bid", amount: 50 }));
  a(g, { type: "bid", amount: 50 }, "b", now + 19000);
  assert.equal(g.auction!.endsAt, now + 24000);
  assert.throws(() => a(g, { type: "bid", amount: 60 }, "b", now + 24001));
});
test("private auction transfers proceeds; no bid retains property", () => {
  const g = setup();
  g.turnPhase = "end";
  g.cities.dortmund.ownerId = "a";
  a(g, { type: "auction_create", cityId: "dortmund", minimum: 50 });
  a(g, { type: "bid", amount: 50 }, "b");
  tick(g, now + 20001);
  assert.equal(g.cities.dortmund.ownerId, "b");
  assert.equal(g.players[0].money, 1550);
  assert.equal(g.players[1].money, 1450);
  assert.equal(g.players[0].auctionUsed, true);
});
test("trade rejects stale assets and sends money atomically", () => {
  const g = setup();
  g.cities.dortmund.ownerId = "a";
  a(g, {
    type: "trade",
    toId: "b",
    offerCities: ["dortmund"],
    requestCities: [],
    offerMoney: 10,
    requestMoney: 100,
  });
  const id = g.trades[0].id;
  a(g, { type: "trade_respond", id, accept: true }, "b");
  assert.equal(g.cities.dortmund.ownerId, "b");
  assert.equal(g.players[0].money, 1590);
  assert.equal(g.players[1].money, 1410);
  assert.throws(() => a(g, { type: "trade_respond", id, accept: true }, "b"));
});
test("casino and stocks unavailable in classic, only own turn in plus", () => {
  const g = setup();
  g.turnPhase = "end";
  g.settings.mode = "classic";
  assert.throws(() => a(g, { type: "roulette", bet: 10, choice: "red" }));
  assert.throws(() =>
    a(g, { type: "stock_buy", stockId: "nova", quantity: 1 }),
  );
  g.settings.mode = "plus";
  assert.throws(() => a(g, { type: "roulette", bet: 10, choice: "red" }, "b"));
});
test("roulette zero loses even-money bets and max four rounds enforced", () => {
  const g = setup();
  g.turnPhase = "end";
  a(g, { type: "roulette", bet: 10, choice: "even" });
  assert.equal(g.roulette!.number, 0);
  assert.equal(g.players[0].money, 1490);
  a(g, { type: "roulette", bet: 10, choice: "red" });
  a(g, { type: "roulette", bet: 10, choice: "black" });
  a(g, { type: "roulette", bet: 10, choice: "black" });
  assert.throws(() => a(g, { type: "roulette", bet: 10, choice: "black" }));
});
test("blackjack private deck and dealer hole card never leave server", () => {
  const g = setup();
  g.turnPhase = "end";
  g.blackjack = {
    playerId: "a",
    bet: 10,
    hand: [3, 4],
    dealer: [9, 1],
    deck: [0, 1, 2, 3],
    status: "playing",
    message: "",
  };
  const state = publicGame(g);
  assert.deepEqual(state.blackjack!.deck, []);
  assert.deepEqual(state.blackjack!.dealer, [9, -1]);
  assert.equal(g.blackjack.deck.length, 4);
  assert.throws(() => a(g, { type: "end" }));
});
test("blackjack timeout automatically stands and finishes turn", () => {
  const g = setup();
  g.turnPhase = "end";
  g.blackjack = {
    playerId: "a",
    bet: 10,
    hand: [9, 8],
    dealer: [9, 6],
    deck: [1],
    status: "playing",
    message: "",
  };
  tick(g, now + 90000, () => 0);
  assert.equal(current(g).id, "b");
  assert.equal(g.players[0].money, 1520);
});
test("stock limits, round update and net worth value shares consistently", () => {
  const g = setup();
  a(g, { type: "stock_buy", stockId: "nova", quantity: 2 });
  assert.equal(g.players[0].money, 1300);
  assert.equal(netWorth(g, g.players[0]), 1500);
  a(g, { type: "stock_buy", stockId: "nova", quantity: 1 });
  a(g, { type: "stock_buy", stockId: "nova", quantity: 1 });
  assert.throws(() =>
    a(g, { type: "stock_buy", stockId: "nova", quantity: 1 }),
  );
  g.turnPhase = "end";
  a(g, { type: "end" });
  g.turnPhase = "end";
  a(g, { type: "end" }, "b");
  assert.equal(g.round, 2);
  assert.equal(g.stocks[0].price, 88);
  assert.equal(g.stocks[0].history.length, 2);
});
test("host transfers and player cap / duplicate names enforced", () => {
  const g = freshGame("TEST1234");
  addPlayer(g, "a", "Alice");
  addPlayer(g, "b", "Bob");
  g.players[0].connected = false;
  hostTransfer(g);
  assert.equal(g.players[1].isHost, true);
  assert.throws(() => addPlayer(g, "c", "alice"));
  for (let i = 2; i < 6; i++) addPlayer(g, String(i), `Player${i}`);
  assert.throws(() => addPlayer(g, "z", "Excess"));
});
test("round limit ranks real net worth, not only cash", () => {
  const g = setup();
  g.settings.maxRounds = 1;
  g.players[0].money = 500;
  g.players[1].money = 800;
  g.cities.tokyo.ownerId = "a";
  g.turnPhase = "end";
  a(g, { type: "end" });
  g.turnPhase = "end";
  a(g, { type: "end" }, "b");
  assert.equal(g.phase, "finished");
  assert.equal(g.winnerId, "a");
});
test("soft aces and crypto die range", () => {
  assert.equal(handValue([0, 13, 9]), 12);
  assert.equal(handValue([0, 9]), 21);
  for (let i = 0; i < 500; i++) {
    const n = random(6);
    assert.ok(n >= 0 && n < 6);
  }
});
test("20 complete seeded bot games end with finite balances and valid ownership", () => {
  for (let seed = 1; seed <= 20; seed++) {
    let state = seed;
    const rng = (n: number) => {
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
      return state % n;
    };
    const g = freshGame(`BOT${seed}`);
    for (let i = 0; i < 4; i++)
      addPlayer(g, String(i), `Bot${i}`, undefined, true);
    g.settings.maxRounds = 15;
    act(g, "0", { type: "start" }, now, rng);
    let time = now;
    for (let i = 0; i < 10000 && g.phase === "playing"; i++) {
      time += 2300;
      tick(g, time, rng);
      for (const p of g.players)
        assert.ok(Number.isSafeInteger(p.money) && p.money >= 0);
      for (const c of Object.values(g.cities)) {
        assert.ok(c.developmentLevel >= 0 && c.developmentLevel <= 5);
        assert.ok(
          !c.ownerId ||
            g.players.some((p) => p.id === c.ownerId && !p.bankrupt),
        );
      }
    }
    assert.equal(g.phase, "finished", `seed ${seed}`);
    assert.ok(g.winnerId);
  }
});
test("third failed jail roll moves after bail, including deferred debt rescue", () => {
  for (const cash of [100, 0]) {
    const g = setup();
    g.players[0].position = 8;
    g.players[0].jail = 2;
    g.players[0].money = cash;
    g.cities.tokyo.ownerId = "a";
    act(g, "a", { type: "roll" }, now, seq(0, 1));
    if (cash === 0) {
      assert.equal(g.turnPhase, "debt");
      a(g, { type: "mortgage", cityId: "tokyo" }, "a", now + 3000);
      a(g, { type: "settle_debt" }, "a", now + 3000);
    }
    assert.equal(g.players[0].position, 11);
    assert.equal(g.players[0].jail, -1);
    assert.equal(g.turnPhase, "purchase");
  }
});
test("natural blackjack beats a non-natural 21", () => {
  const g = setup();
  g.turnPhase = "end";
  g.blackjack = {
    playerId: "a",
    bet: 20,
    hand: [0, 9],
    dealer: [6, 5, 7],
    deck: [],
    status: "playing",
    message: "",
  };
  a(g, { type: "blackjack_stand" });
  assert.equal(g.blackjack.status, "won");
  assert.equal(g.players[0].money, 1550);
});
