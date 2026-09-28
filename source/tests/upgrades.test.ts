import {test} from 'node:test';
import assert from 'node:assert/strict';
import {act,addPlayer,freshGame,tick,rent,nextWake,botAct} from '../game.ts';
import {gameProperties} from '../custom.ts';
function lobby(){const g=freshGame('UPGRADE1');addPlayer(g,'a','Alice');addPlayer(g,'b','Bob');return g;}
function playing(){const g=lobby();act(g,'b',{type:'ready',ready:true},1000);act(g,'a',{type:'start'},1000);return g;}
test('readiness is required and settings invalidate consent',()=>{const g=lobby();assert.throws(()=>act(g,'a',{type:'start'}),/bereit/);act(g,'b',{type:'ready',ready:true});act(g,'a',{type:'settings',settings:g.settings});assert.equal(g.players[1].ready,false);});
test('four casino plays, arbitrary integer bets above old cap, no overdraft',()=>{const g=playing();g.turnPhase='end';g.players[0].money=10000;for(let i=0;i<4;i++)act(g,'a',{type:'roulette',bet:1234,choice:'red'},1001,()=>0);assert.equal(g.players[0].money,5064);assert.throws(()=>act(g,'a',{type:'roulette',bet:1,choice:'red'},1001),/vier/);const h=playing();h.turnPhase='end';assert.throws(()=>act(h,'a',{type:'blackjack_start',bet:1501},1001));act(h,'a',{type:'roulette',bet:1500,choice:'red'},1001,()=>0);assert.equal(h.players[0].money,0)});
test('pause requires agreement, blocks actions and freezes auction clocks',()=>{const g=playing();g.turnPhase='purchase';g.players[0].position=1;act(g,'a',{type:'skip'},2000);const end=g.auction!.endsAt;act(g,'a',{type:'pause'},3000);assert.equal(g.manualPause,null);act(g,'b',{type:'pause'},3000);assert.equal(g.manualPause,3000);tick(g,90000);assert.equal(g.auction!.endsAt,end);assert.equal(nextWake(g),null);assert.throws(()=>act(g,'b',{type:'bid',amount:10},90000),/pausiert/);act(g,'a',{type:'resume'},100000);assert.equal(g.manualPause,3000);act(g,'b',{type:'resume'},100000);assert.equal(g.manualPause,null);assert.equal(g.auction!.endsAt,end+97000)});
test('custom city prices are room scoped and affect purchases and rent',()=>{const g=lobby();act(g,'a',{type:'city_set',cities:{dortmund:{name:'Meine Stadt',price:120,color:'#abcdef'}}});assert.equal(gameProperties(g).dortmund.price,120);assert.equal(gameProperties(lobby()).dortmund.price,60);act(g,'b',{type:'ready',ready:true});act(g,'a',{type:'start'});g.players[0].position=1;g.turnPhase='purchase';act(g,'a',{type:'buy'});assert.equal(g.players[0].money,1380);assert.equal(rent(g,'dortmund'),4);assert.equal(g.players[0].purchases,1)});
test('custom sets reject arbitrary ids, invalid price and non-host edits',()=>{const g=lobby();for(const cities of [{bad:{name:'x',price:20,color:'#abcdef'}},{dortmund:{name:'x',price:NaN,color:'#abcdef'}}])assert.throws(()=>act(g,'a',{type:'city_set',cities}));assert.throws(()=>act(g,'b',{type:'city_set',cities:{}}));});
test('economic event applies for one round and is disabled in classic',()=>{const g=playing();g.settings.events=true;g.currentPlayerIndex=1;g.turnPhase='end';act(g,'b',{type:'end'},2000,()=>0);assert.equal(g.economy?.multiplier,1.25);g.cities.dortmund.ownerId='a';assert.equal(rent(g,'dortmund'),3);g.settings.mode='classic';g.currentPlayerIndex=1;g.turnPhase='end';act(g,'b',{type:'end'},3000,()=>0);assert.equal(g.economy,null)});
test('difficulty changes bot purchase strategy',()=>{for(const [level,buys] of [['easy',false],['hard',true]] as const){const g=playing();g.settings.botLevel=level;g.players[0].money=200;g.players[0].position=1;g.turnPhase='purchase';botAct(g,g.players[0],2000,()=>0);assert.equal(g.cities.dortmund.ownerId==='a',buys)}});
test('rematch generates a fresh career identity and retains custom rules',()=>{const g=playing();const id=g.matchId;g.phase='finished';g.customCities={dortmund:{name:'Neu',price:100,color:'#aabbcc'}};act(g,'a',{type:'rematch'});assert.notEqual(g.matchId,id);assert.equal(g.customCities.dortmund.name,'Neu');assert.equal(g.phase,'lobby');assert.equal(g.players[1].ready,false)});
test('counter offer is atomic, validates recipient, rejects stale originals',()=>{
 const g=playing();act(g,'a',{type:'trade',toId:'b',offerCities:[],requestCities:[],offerMoney:50,requestMoney:0},2000);
 const id=g.trades[0].id;
 assert.throws(()=>act(g,'b',{type:'trade',counterOf:id,toId:'a',offerCities:[],requestCities:[],offerMoney:999999,requestMoney:0},2000));
 assert.equal(g.trades[0].status,'pending');
 act(g,'b',{type:'trade',counterOf:id,toId:'a',offerCities:[],requestCities:[],offerMoney:0,requestMoney:60},2000);
 assert.equal(g.trades[0].status,'declined');assert.equal(g.trades[1].counterOf,id);
 assert.throws(()=>act(g,'a',{type:'trade_respond',id,accept:true},2000));
 act(g,'a',{type:'trade_respond',id:g.trades[1].id,accept:true},2000);
 assert.equal(g.players[0].money,1440);assert.equal(g.players[1].money,1560);assert.equal(g.players[0].tradesCompleted,1);
});
test('wealth target ends match at turn end and captures history',()=>{
 const g=playing();g.settings.targetWealth=5000;g.players[0].money=5100;g.turnPhase='end';act(g,'a',{type:'end'},2000);
 assert.equal(g.phase,'finished');assert.equal(g.winnerId,'a');assert.equal(g.wealthHistory?.at(-1)?.values.a,5100);
 const h=lobby();assert.throws(()=>act(h,'a',{type:'settings',settings:{...h.settings,targetWealth:1000}}));
});
test('paused match cannot resume without disconnected participants consent',()=>{
 const g=playing();act(g,'a',{type:'pause'},2000);act(g,'b',{type:'pause'},2000);
 const deadline=g.turnDeadline;g.players[1].connected=false;act(g,'a',{type:'resume'},9000);assert.equal(g.manualPause,2000);
 g.players[1].connected=true;act(g,'b',{type:'resume'},10000);assert.equal(g.manualPause,null);assert.equal(g.turnDeadline,deadline+8000);
});
test('casino lifetime statistics survive new turns and reset with a rematch',()=>{
 const g=playing();g.turnPhase='end';act(g,'a',{type:'roulette',bet:100,choice:'red'},2000,()=>0);
 assert.equal(g.players[0].casinoNet,-100);assert.equal(g.players[0].casinoRounds,1);
 act(g,'a',{type:'end'},2000);g.turnPhase='end';act(g,'b',{type:'end'},3000,()=>0);
 assert.equal(g.players[0].casinoPlays,0);assert.equal(g.players[0].casinoRounds,1);
 assert.ok(g.news.some(n=>n.includes('Verkaufsdruck')));assert.ok(g.wealthHistory?.length);
 g.phase='finished';act(g,'a',{type:'rematch'});assert.equal(g.players[0].casinoRounds,undefined);
});
