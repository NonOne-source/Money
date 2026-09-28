import { CITIES as ORIGINAL_CITIES } from "./cities.ts";
export const COLORS = [
  "#f1bc62",
  "#74d7c6",
  "#bfa3ff",
  "#ef8397",
  "#75b6f4",
  "#bed879",
];
export const AVATARS = ["♜", "♞", "♛", "♝", "♟", "♚", "★", "◆"];
export const GROUPS: Record<string,{name:string;color:string}> = {
 germany:{name:'Deutschland',color:'#a77fec'},france:{name:'Frankreich',color:'#67bccf'},italy:{name:'Italien',color:'#e795bc'},usa:{name:'USA',color:'#f5ab65'},japan:{name:'Japan',color:'#c5ca6a'},georgia:{name:'Georgien',color:'#65c4a1'},transport:{name:'Verkehr',color:'#8396b2'}
};
export interface PropertyDef {
  id: string;
  name: string;
  group: string;
  price: number;
  rent: number[];
  buildCost: number;
  kind: "city" | "station";
  country: string;
  lat: number;
  lon: number;
}
const VALUES: [string, string, number, number][] = [
  ["dortmund", "ruhr", 60, 2],
  ["koeln", "ruhr", 80, 4],
  ["duesseldorf", "ruhr", 100, 6],
  ["hamburg", "germany", 120, 8],
  ["berlin", "germany", 140, 10],
  ["muenchen", "germany", 160, 12],
  ["paris", "europe", 180, 14],
  ["london", "europe", 200, 16],
  ["chicago", "east", 220, 18],
  ["newyork", "east", 240, 20],
  ["miami", "west", 260, 22],
  ["losangeles", "west", 280, 24],
  ["saopaulo", "south", 300, 26],
  ["buenosaires", "south", 320, 28],
  ["sydney", "pacific", 320, 28],
  ["osaka", "pacific", 340, 30],
  ["kyoto", "pacific", 360, 32],
  ["tokyo", "pacific", 400, 40],
];
export const PROPERTIES: Record<string, PropertyDef> = Object.fromEntries(
  VALUES.map(([id, group, price, base]) => [
    id,
    {
      ...ORIGINAL_CITIES[id],
      id,
      group,
      price,
      kind: "city",
      buildCost:
        price <= 100 ? 50 : price <= 200 ? 100 : price <= 300 ? 150 : 200,
      rent: [base, base * 5, base * 15, base * 30, base * 40, base * 50],
    },
  ]),
);
for (const [id, name] of [
  ["rail", "Euro Express"],
  ["air", "World Airways"],
  ["port", "Ocean Lines"],
  ["metro", "Empire Transit"],
])
  PROPERTIES[id] = {
    id,
    name,
    group: "transport",
    price: 200,
    rent: [25, 50, 100, 200],
    buildCost: 0,
    kind: "station",
    country: "International",
    lat: 0,
    lon: 0,
  };
const worldNames = ['Dortmund', 'Hamburg', 'Berlin', 'Lyon', 'Marseille', 'Paris', 'Neapel', 'Mailand', 'Rom', 'Chicago', 'Los Angeles', 'New York', 'Osaka', 'Kyoto', 'Tokyo', 'Kutaisi', 'Batumi', 'Tiflis'];
const worldPoints = [[51.51, 7.46], [53.55, 10], [52.52, 13.4], [45.76, 4.84], [43.3, 5.37], [48.86, 2.35], [40.85, 14.27], [45.46, 9.19], [41.9, 12.5], [41.88, -87.63], [34.05, -118.24], [40.71, -74.01], [34.69, 135.5], [35.01, 135.77], [35.68, 139.69], [42.27, 42.7], [41.65, 41.64], [41.72, 44.79]];
Object.values(PROPERTIES).filter(p=>p.kind==='city').forEach((p,i)=>{p.group=['germany','france','italy','usa','japan','georgia'][Math.floor(i/3)];p.name=worldNames[i];p.country=GROUPS[p.group].name;[p.lat,p.lon]=worldPoints[i];});
export type Tile = {
  id: string;
  kind: "property" | "start" | "event" | "tax" | "jail" | "parking" | "gojail";
  name: string;
  amount?: number;
};
const property = (id: string): Tile => ({
  id,
  kind: "property",
  name: PROPERTIES[id].name,
});
export const BOARD: Tile[] = [
  { id: "start", kind: "start", name: "START" },
  property("dortmund"),
  property("koeln"),
  { id: "chance1", kind: "event", name: "Ereignis" },
  property("duesseldorf"),
  property("hamburg"),
  { id: "tax1", kind: "tax", name: "Steuer", amount: 200 },
  property("berlin"),
  { id: "jail", kind: "jail", name: "Gefängnis" },
  property("muenchen"),
  property("rail"),
  property("paris"),
  property("london"),
  { id: "chance2", kind: "event", name: "Ereignis" },
  property("chicago"),
  property("newyork"),
  { id: "parking", kind: "parking", name: "Freier Parkplatz" },
  property("miami"),
  property("losangeles"),
  property("air"),
  property("saopaulo"),
  property("buenosaires"),
  { id: "chance3", kind: "event", name: "Ereignis" },
  { id: "tax2", kind: "tax", name: "Luxussteuer", amount: 100 },
  { id: "gojail", kind: "gojail", name: "Ins Gefängnis" },
  property("sydney"),
  property("port"),
  property("osaka"),
  property("kyoto"),
  property("tokyo"),
  { id: "chance4", kind: "event", name: "Ereignis" },
  property("metro"),
];
export const STOCKS = [
  {
    id: "nova",
    name: "Nova Technologies",
    symbol: "NOVA",
    color: "#bfa3ff",
    price: 100,
  },
  {
    id: "atlas",
    name: "Atlas Energy",
    symbol: "ATLS",
    color: "#f1bc62",
    price: 75,
  },
  {
    id: "ocean",
    name: "Ocean Mobility",
    symbol: "OCN",
    color: "#74d7c6",
    price: 50,
  },
];
export const START_MONEY = 1500,
  START_BONUS = 200,
  JAIL_FEE = 50,
  MAX_LEVEL = 5;
export function boardPoint(index: number): { row: number; col: number } {
  if (index <= 8) return { row: 8, col: 8 - index };
  if (index <= 16) return { row: 16 - index, col: 0 };
  if (index <= 24) return { row: 0, col: index - 16 };
  return { row: index - 24, col: 8 };
}
export const money = (n: number) =>
  new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(n);
