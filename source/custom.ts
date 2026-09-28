import type { PropertyDef } from './rules.ts';
import {presetProperties} from './presets.ts';
import type { GameState } from './game.ts';
export function gameProperties(g: Pick<GameState, 'customCities'|'settings'> | null): Record<string, PropertyDef> {
 const defs=presetProperties(g?.settings.boardVariant);
 return Object.fromEntries(Object.entries(defs).map(([id,p])=>{const c=g?.customCities?.[id],scale=c?c.price/p.price:1;return [id,{...p,name:c?.name||p.name,price:c?.price||p.price,rent:p.rent.map(n=>Math.max(1,Math.round(n*scale))),buildCost:Math.round(p.buildCost*scale*(g?.settings.buildPercent??100)/100)}]}));
}
