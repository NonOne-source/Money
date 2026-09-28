import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import {
  ArrowUpRight,
  CircleHelp,
  Coffee,
  Landmark,
  LockKeyhole,
  Plane,
  TrainFront,
  Ship,
  Siren,
  Hotel,
} from "lucide-react";
import { BOARD, GROUPS, boardPoint, money } from "./rules.ts";
import {gameProperties} from "./custom.ts";
import { current, type GameState } from "./game.ts";
const specialIcons = {
  start: ArrowUpRight,
  event: CircleHelp,
  tax: Landmark,
  jail: LockKeyhole,
  parking: Coffee,
  gojail: Siren,
};
export function CityArt({ variant = 0 }: { variant?: number }) {
  return (
    <svg
      viewBox="0 0 260 115"
      fill="none"
      className="city-art"
      aria-hidden="true"
    >
      <path d="M4 107H256" stroke="currentColor" opacity=".2" />
      {[24, 51, 78, 104, 133, 163, 193, 222].map((x, i) => {
        const h = [42, 65, 38, 94, 59, 72, 49, 34][(i + variant) % 8];
        return (
          <g key={x}>
            <rect
              x={x}
              y={107 - h}
              width={i === 3 ? 25 : 21}
              height={h}
              rx="1"
              fill="currentColor"
              opacity={0.12 + (i % 3) * 0.1}
            />
            <path
              d={`M${x + 10} ${107 - h}v-8`}
              stroke="currentColor"
              opacity=".4"
            />
            {Array.from({ length: Math.floor(h / 12) - 1 }, (_, j) => (
              <path
                key={j}
                d={`M${x + 5} ${117 - h + j * 11}h3m4 0h3`}
                stroke="currentColor"
                strokeWidth="2"
                opacity=".65"
              />
            ))}
          </g>
        );
      })}
      <circle cx="218" cy="20" r="13" fill="currentColor" opacity=".07" />
    </svg>
  );
}
export function Board({
  game,
  selected,
  onSelect,
  children,
  reduced,
}: {
  game: GameState;
  selected: string | null;
  onSelect: (id: string) => void;
  children: ReactNode;
  reduced: boolean;
}) {
  const PROPERTIES = gameProperties(game);
  const [zoom,setZoom]=useState(1);
  const [positions, setPositions] = useState<Record<string, number>>({});
  useEffect(() => {
    let ids: ReturnType<typeof setTimeout>[] = [];
    const move = game.lastMove;
    const next = Object.fromEntries(
      game.players.map((p) => [p.id, p.position]),
    );
    if (move && !reduced) {
      setPositions((prev) => ({
        ...next,
        ...prev,
        [move.playerId]: move.from,
      }));
      const delay = 1700;
      if (move.jail || move.steps > 12) {
        ids.push(setTimeout(() => setPositions(next), delay));
      } else
        for (let i = 1; i <= move.steps; i++)
          ids.push(
            setTimeout(
              () =>
                setPositions((prev) => ({
                  ...prev,
                  [move.playerId]: (move.from + i) % BOARD.length,
                })),
              delay + i * 75,
            ),
          );
    } else setPositions(next);
    return () => ids.forEach(clearTimeout);
    // Positions animate only when a new roll/move occurs; chat and bids must not restart them.
  }, [game.rollId, reduced]);
  const active = current(game);
  return (
    <section className={`board-viewport ${zoom===1?"board-fit":"board-zoomed"}`}><div className="zoom-toolbar"><span>Brettansicht</span>{[1,1.5,2].map(n=><button key={n} className="button" aria-pressed={zoom===n} onClick={()=>setZoom(n)}>{n===1?'Gesamt':`${n*100} %`}</button>)}</div><div className="board-scroll"><div className="board-surround" style={{width:`${zoom*100}%`,'--board-zoom':zoom} as CSSProperties}>
      <div className="board-coordinate top">
        WORLD EMPIRE · {game.settings.boardVariant === "dortmund" ? "DORTMUND EDITION" : "WORLD EDITION"}
      </div>
      <div
        className="board"
        role="group"
        aria-label="Spielbrett mit 32 Feldern"
      >
        {BOARD.map((tile, i) => {
          const { row, col } = boardPoint(i),
            d = PROPERTIES[tile.id],
            c = game.cities[tile.id],
            owner = game.players.find((p) => p.id === c?.ownerId);
          const Icon = d
            ? d.kind === "station"
              ? tile.id === "air"
                ? Plane
                : tile.id === "port"
                  ? Ship
                  : TrainFront
              : null
            : specialIcons[tile.kind as keyof typeof specialIcons];
          const accent = d ? (game.customCities?.[d.id]?.color || GROUPS[d.group].color) : "#b8a17a";
          return (
            <button
              key={`${tile.id}-${c?.developmentLevel}-${c?.ownerId}`}
              className={`tile ${owner ? "owned" : ""} ${tile.kind} ${selected === tile.id ? "selected" : ""} ${active?.position === i ? "active-tile" : ""} ${c?.mortgaged ? "mortgaged" : ""}`}
              style={
                {
                  gridRow: row + 1,
                  gridColumn: col + 1,
                  "--group": accent,
                  "--owner": owner?.color || "transparent",
                } as CSSProperties
              }
              onClick={() => onSelect(tile.id)}
              aria-label={`${d?.name || tile.name}${d ? `, ${money(d.price)}` : ""}${owner ? `, Besitzer ${owner.name}` : ""}`}
            >
              {d && <span className="group-band" />}
              <span className="tile-name" title={d?.name || tile.name}>{({"World Airways":"Airways","Ocean Lines":"Ocean","Empire Transit":"Transit","Euro Express":"Express","Freier Parkplatz":"Parkplatz","Ins Gefängnis":"Ins Gef.","Luxussteuer":"Luxussteuer"} as Record<string,string>)[d?.name || tile.name] || d?.name || tile.name}</span>
              {Icon ? (
                <Icon className="tile-icon" size={21} strokeWidth={1.4} />
              ) : (
                <CityArt variant={i % 8} />
              )}
              <span className="tile-price">
                {d
                  ? money(d.price)
                  : tile.kind === "start"
                    ? `+${game.settings.startBonus??200} €`
                    : tile.kind === "tax"
                      ? `−${tile.amount} €`
                      : tile.kind === "event"
                        ? "?"
                        : tile.kind === "jail"
                          ? "ZU BESUCH"
                          : ""}
              </span>
              {c?.developmentLevel > 0 && (
                <span className="tile-buildings">
                  {c.developmentLevel === 5 ? (
                    <Hotel size={17} />
                  ) : (
                    Array.from({ length: c.developmentLevel }, (_, j) => (
                      <i key={j} />
                    ))
                  )}
                </span>
              )}
              {owner && <span className="owner-badge" title={`Besitzer: ${owner.name}`} aria-label={`Besitzer: ${owner.name}`}>{owner.avatar}</span>}
            </button>
          );
        })}
        <div className="board-center">{children}</div>
        <div className="tokens-layer" aria-hidden="true">
          {game.players
            .filter((p) => !p.bankrupt)
            .map((p) => {
              const index = positions[p.id] ?? p.position,
                { row, col } = boardPoint(index);
              const colocated = game.players.filter(
                  (x) =>
                    !x.bankrupt && (positions[x.id] ?? x.position) === index,
                ),
                offset = colocated.indexOf(p);
              return (
                <div
                  key={p.id}
                  className={`pawn ${active?.id === p.id ? "active-pawn" : ""}`}
                  style={
                    {
                      left: `${((col + 0.5) / 9) * 100}%`,
                      top: `${((row + 0.7) / 9) * 100}%`,
                      "--pawn": p.color,
                      "--offset": `${(offset - (colocated.length - 1) / 2) * 15}px`,
                    } as CSSProperties
                  }
                >
                  <span>{p.avatar}</span>
                </div>
              );
            })}
        </div>
      </div>
      <div className="board-coordinate bottom">
        <span>18 ORTE · 6 FARBGRUPPEN</span>
        <span>DEINE STÄDTE. DEIN IMPERIUM.</span>
      </div>
    </div></div></section>
  );
}
