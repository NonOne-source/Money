import {GROUPS,PROPERTIES} from './rules.ts';
import type {GameState} from './game.ts';
export const DORTMUND_NAMES=['Mengede','Nette','Westerfilde','Huckarde','Kirchlinde','Deusen','Eving','Lindenhorst','Brechten','Lütgendortmund','Marten','Bövinghausen','Brackel','Wambel','Asseln','Brückstraße','Nordstadt','Hannibal'];
export function groupName(g:GameState|null,id:string){return g?.settings.boardVariant==='dortmund'&&id!=='transport'?`Dortmund · Gruppe ${Object.keys(GROUPS).indexOf(id)+1}`:GROUPS[id]?.name||id;}
export function presetProperties(variant?:string){return Object.fromEntries(Object.values(PROPERTIES).map((p,i)=>[p.id,variant==='dortmund'?{...p,name:p.kind==='city'?DORTMUND_NAMES[i]:({rail:'Dortmund Hbf',air:'Flughafen Dortmund',port:'Dortmunder Hafen',metro:'Stadtbahn'} as Record<string,string>)[p.id],country:'Dortmund',lat:51.51,lon:7.46}:p]));}
