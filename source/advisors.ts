import {act,groupCities,type GameState,type Action} from './game.ts';
import {gameProperties} from './custom.ts';
import {GROUPS} from './rules.ts';
export function propertyColor(g:GameState,id:string){const d=gameProperties(g)[id];return g.customCities?.[id]?.color||GROUPS[d.group].color;}
export function sortedProperties(g:GameState,ids:string[]){const props=gameProperties(g),groups=Object.keys(GROUPS);return [...ids].sort((a,b)=>groups.indexOf(props[a].group)-groups.indexOf(props[b].group)||props[a].price-props[b].price);}
export function tradeValue(g:GameState,ids:string[],cash:number){const props=gameProperties(g);return Math.max(0,cash||0)+ids.reduce((sum,id)=>sum+props[id].price-(g.cities[id].mortgaged?Math.floor(props[id].price/2):0)+g.cities[id].developmentLevel*props[id].buildCost,0);}
export function groupChanges(g:GameState,pid:string,give:string[],receive:string[]){const props=gameProperties(g),has=(id:string)=>g.cities[id].ownerId===pid;const after=(id:string)=>receive.includes(id)||has(id)&&!give.includes(id);const groups=[...new Set(Object.values(props).filter(x=>x.kind==='city').map(x=>x.group))];return groups.flatMap(group=>{const ids=Object.keys(props).filter(id=>props[id].group===group);const before=ids.filter(has).length,n=ids.filter(after).length;return before===n?[]:[{group,before,after:n,total:ids.length,complete:n===ids.length,lost:before===ids.length&&n<ids.length}];});}
export function quickBid(g:GameState,increment:number){const a=g.auction;if(!a)return 0;return a.bidderId?a.currentBid+increment:a.minimum+increment;}
export function debtPlan(g:GameState,pid:string){
 const debt=g.debt;if(!debt||debt.playerId!==pid)return {shortfall:0,steps:[],remaining:0};const copy=structuredClone(g),p=copy.players.find(x=>x.id===pid)!,props=gameProperties(copy);copy.manualPause=null;copy.tradeUntil=undefined;const shortfall=Math.max(0,debt.amount-p.money),steps:{action:Action;label:string;gain:number}[]=[];
 // Preview actual legal engine actions. Never execute the preview on live state.
 for(let n=0;n<150&&p.money<debt.amount;n++){
  const options:{action:Action;label:string}[]=[];
  for(const stock of copy.stocks)if((p.stocks[stock.id]||0)>0)options.push({action:{type:'stock_sell',stockId:stock.id,quantity:Math.min(100,p.stocks[stock.id],Math.max(1,Math.ceil((debt.amount-p.money)/stock.price)))},label:stock.id.toUpperCase()+' verkaufen'});
  const owned=Object.values(copy.cities).filter(c=>c.ownerId===pid);
  for(const c of owned.filter(c=>!c.mortgaged&&groupCities(c.id).every(id=>copy.cities[id].developmentLevel===0)).sort((a,b)=>props[a.id].price-props[b.id].price))options.push({action:{type:'mortgage',cityId:c.id},label:props[c.id].name+' verpfänden'});
  for(const c of owned.filter(c=>c.developmentLevel>0).sort((a,b)=>b.developmentLevel-a.developmentLevel))options.push({action:{type:'sell_building',cityId:c.id},label:'Eine Baustufe in '+props[c.id].name+' verkaufen'});
  let chosen=false;
  for(const item of options){const before=p.money;try{act(copy,pid,item.action,Math.max(Date.now(),copy.actionNotBefore+1));}catch{continue;}const gain=p.money-before;if(gain>0){steps.push({...item,gain});chosen=true;break;}}
  if(!chosen)break;
 }
 return {shortfall,steps,remaining:Math.max(0,debt.amount-p.money)};
}
