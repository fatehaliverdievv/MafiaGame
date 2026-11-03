// api/domino.js — Domino 101 otaqları. KV varsa Vercel KV, yoxdursa RAM (yalnız lokal test üçün).
//   POST {action:"create", name}
//   POST {action:"join", code, name}
//   POST {action:"start", code, token}                 (otağı yaradan; 2 nəfər 1×1, 3 nəfər hər kəs özü üçün, 4 nəfər 2×2)
//   GET  ?action=state&code=..&token=..                (polling)
//   POST {action:"play", code, token, tileId, side}
//   POST {action:"draw" | "pass", code, token}
//   POST {action:"next", code, token, round}           (növbəti raund / yeni oyun)

const crypto = require("crypto");
const engine = require("./_domino-engine");

// ---- 101 qaydaları (dəyişə bilən sabitlər) ----
const TARGET = 101;       // oyunu bitirən xal
const ENTRY = 13;         // "saya düşmək" üçün minimal xal
const ENTRY_ATTEMPTS = 3; // 13 xalı toplamaq üçün cəhd sayı (ardıcıl qələbə), sonra xallar sıfırlanır
const DRY_WIN_VALUE = 2;  // "quru" qələbə neçə qələbə sayılır
const TIE_DOUBLE = false; // bərabərlikdə bonus: false = bir tərəfin xalı, true = hər iki tərəfin xalı (2-yə vurulur)

const HAND_SIZE = 7;
const MAX_PLAYERS = 4;
const TTL = 60 * 60 * 6;
const roomKey = (code) => `domino:${code}`;

const USE_KV = !!(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
const kv = USE_KV ? require("@vercel/kv").kv : null;
const mem = (globalThis.__dominoRooms = globalThis.__dominoRooms || new Map());

async function loadRoom(code) {
  if (USE_KV) return kv.get(roomKey(code));
  return mem.get(roomKey(code)) || null;
}
async function save(room) {
  if (USE_KV) await kv.set(roomKey(room.code), room, { ex: TTL });
  else mem.set(roomKey(room.code), room);
}

const newCode = () => crypto.randomBytes(3).toString("hex").toUpperCase();
const newToken = () => crypto.randomBytes(16).toString("hex");
const zeros = (n) => Array.from({ length: n }, () => 0);

// Yeni oyun (match): xallar sıfırlanır, qələbə sayı (wins) saxlanılır
function resetMatch(room) {
  const n = room.sides.length;
  room.scores = zeros(n);          // sayılan xal
  room.pending = zeros(n);         // saya düşməmiş toplanan xal
  room.attempts = zeros(n);        // saya düşmək üçün istifadə olunan cəhdlər
  room.entered = room.sides.map(() => false);
  room.pot = 0;                    // bərabərlikdən qalan xal (növbəti raundun qalibinə əlavə olunur)
  room.round = 0;
  room.matchWinner = null;
  room.dry = false;
  room.lastRound = null;
  room.lastStarter = null;
}

function startRound(room, opts) {
  room.game = engine.newGame(room.players.length, HAND_SIZE, opts);
  room.lastStarter = room.game.turn;
  room.round += 1;
  room.lastRound = null;
}

// Raund indicə bitibsə: xalı tətbiq et
function finalizeIfFinished(room, wasPlaying) {
  const g = room.game;
  if (!wasPlaying || g.status !== "finished") return;
  const res = engine.roundResult(g);

  const ev = {
    round: room.round, reason: g.reason, tie: res.tie, winnerSide: res.winnerSide,
    winnerSeat: typeof res.winnerSeat === "number" ? res.winnerSeat : null,
    base: res.points, pot: 0, gained: 0, potNow: 0,
    entered: false, reset: false, pending: 0, attempts: 0, dropped: [],
    sideTotals: res.sideTotals, hands: g.hands,
  };

  // Sayaya düşməmiş tərəf raundu qazanmasa (məğlubiyyət və ya bərabərlik), toplanan xalı silinir
  room.sides.forEach((_, i) => {
    const wonThis = !res.tie && res.winnerSide === i;
    if (!room.entered[i] && room.pending[i] > 0 && !wonThis) {
      room.pending[i] = 0;
      room.attempts[i] = 0;
      ev.dropped.push(i);
    }
  });

  if (res.tie) {
    // Qayda 5: bərabərlikdə "mövcud xal" növbəti raundun qalibinin xalının üstünə gəlinir
    room.pot += TIE_DOUBLE ? res.sideTotals.reduce((a, b) => a + b, 0) : Math.min(...res.sideTotals);
    ev.potNow = room.pot;
  } else {
    const s = res.winnerSide;
    const gained = res.points + room.pot;
    ev.pot = room.pot; ev.gained = gained;
    room.pot = 0;

    if (room.entered[s]) {
      room.scores[s] += gained;
    } else {
      // Qayda 1-2-6: saya düşmək üçün cəmi ən azı 13 xal, ardıcıl ən çox 3 qələbədə
      room.pending[s] += gained;
      room.attempts[s] += 1;
      if (room.pending[s] >= ENTRY) {
        room.entered[s] = true;
        room.scores[s] = room.pending[s];
        room.pending[s] = 0; room.attempts[s] = 0;
        ev.entered = true;
      } else if (room.attempts[s] >= ENTRY_ATTEMPTS) {
        room.pending[s] = 0; room.attempts[s] = 0;
        ev.reset = true;
      }
      ev.pending = room.pending[s]; ev.attempts = room.attempts[s];
    }

    if (room.entered[s] && room.scores[s] >= TARGET) {
      room.matchWinner = s;
      // Qayda 3: rəqib heç xal toplamayıbsa → "quru" qələbə (2 qələbə sayılır)
      room.dry = room.scores.every((sc, i) => i === s || sc === 0);
      room.wins[s] += room.dry ? DRY_WIN_VALUE : 1;
    }
  }
  room.lastRound = ev;
}

// Oyun bağlıdır: bazardan çəkmək mümkün deyil və heç kimin gedişi yoxdur → raund avtomatik bitir
// (əksər hallarda engine.pass özü bitirir; bu, bağlı qalmış vəziyyətlər üçün ehtiyat yoxlamadır)
function isBlocked(g) {
  if (!g || g.status !== "playing") return false;
  if (g.boneyard.length > engine.bazarKeep(g.hands.length)) return false;
  for (let seat = 0; seat < g.hands.length; seat++) {
    if (engine.legalMoves(g, seat).length > 0) return false;
  }
  return true;
}

function settleBlocked(room) {
  const g = room.game;
  if (!isBlocked(g)) return false;
  const totals = g.sides.map((seats) => seats.reduce((sum, seat) => sum + engine.handScore(g.hands[seat]), 0));
  const min = Math.min(...totals);
  const lows = totals.flatMap((t, i) => (t === min ? [i] : []));
  g.status = "finished";
  g.reason = "blocked";
  g.winner = null;
  g.winnerSide = lows.length === 1 ? lows[0] : null; // null = bərabərlik
  finalizeIfFinished(room, true);
  return true;
}

// Növbəti raundu kim başlayır: daşlarını bitirən; bağlı oyunda qalib tərəfin ilk oyunçusu; bərabərlikdə əvvəlki başlayan
function nextStarter(room) {
  const lr = room.lastRound;
  if (!lr) return undefined;
  if (lr.winnerSeat !== null) return lr.winnerSeat;
  if (lr.winnerSide !== null) return room.sides[lr.winnerSide][0];
  return room.lastStarter === null ? undefined : room.lastStarter;
}

// Oyunçuya yalnız ona aid olan məlumat göndərilir (rəqiblərin daşları gizli qalır)
function viewFor(room, seat) {
  const g = room.game;
  const view = {
    code: room.code, you: seat, host: seat === 0,
    players: room.players.map((p) => p.name),
    started: !!g,
    sides: room.sides, scores: room.scores, pending: room.pending, attempts: room.attempts,
    entered: room.entered, wins: room.wins, pot: room.pot,
    round: room.round, target: TARGET, entry: ENTRY, entryAttempts: ENTRY_ATTEMPTS,
    matchWinner: room.matchWinner, dry: room.dry, dryValue: DRY_WIN_VALUE,
    volatile: !USE_KV, // KV qoşulmayıbsa otaq RAM-da saxlanılır və itə bilər (client xəbərdarlıq göstərir)
  };
  if (!g) return view;

  Object.assign(view, {
    board: g.board, origin: g.origin,
    hand: g.hands[seat],
    handCounts: g.hands.map((h) => h.length),
    boneyardCount: g.boneyard.length,
    turn: g.turn, status: g.status,
    opening: g.opening,
    moves: g.status === "playing" && g.turn === seat ? engine.legalMoves(g, seat) : [],
    lastRound: g.status === "finished" ? room.lastRound : null, // raund bitəndə hamının daşları açılır
  });
  return view;
}

module.exports = async (req, res) => {
  try {
    const input = req.method === "GET" ? req.query : req.body || {};
    const { action } = input;

    if (action === "create") {
      const name = String(input.name || "").trim().slice(0, 20);
      if (!name) return res.status(400).json({ error: "Ad lazımdır" });
      const token = newToken();
      const room = { code: newCode(), players: [{ name, token }], game: null, sides: [], wins: [0, 0] };
      resetMatch(room);
      await save(room);
      return res.json({ token, view: viewFor(room, 0) });
    }

    if (action === "join") {
      const name = String(input.name || "").trim().slice(0, 20);
      const code = String(input.code || "").trim().toUpperCase();
      if (!name) return res.status(400).json({ error: "Ad lazımdır" });
      const room = await loadRoom(code);
      if (!room) return res.status(404).json({ error: "Otaq tapılmadı" });
      if (room.game) return res.status(409).json({ error: "Oyun artıq başlayıb" });
      if (room.players.length >= MAX_PLAYERS) return res.status(409).json({ error: "Otaq doludur" });
      const token = newToken();
      room.players.push({ name, token });
      await save(room);
      return res.json({ token, view: viewFor(room, room.players.length - 1) });
    }

    // Qalan əməliyyatlar tokenlə oyunçunu tanıyır
    const code = String(input.code || "").trim().toUpperCase();
    const room = await loadRoom(code);
    if (!room) return res.status(404).json({ error: "Otaq tapılmadı" });
    const seat = room.players.findIndex((p) => p.token === input.token);
    if (seat === -1) return res.status(403).json({ error: "Etibarsız token" });

    if (action === "state") {
      if (room.game && settleBlocked(room)) await save(room); // bağlı qalmış oyunu bitir
      return res.json({ view: viewFor(room, seat) });
    }

    if (action === "start") {
      if (seat !== 0) return res.status(403).json({ error: "Oyunu yalnız otağı yaradan başlada bilər" });
      if (room.game) return res.json({ view: viewFor(room, seat) });
      const n = room.players.length;
      if (n < 2 || n > 4) return res.status(400).json({ error: "Oyun 2 nəfər (1×1), 3 nəfər (hər kəs özü üçün) və ya 4 nəfər (2×2) ilə başlayır" });
      room.sides = engine.makeSides(n);
      room.wins = room.sides.map(() => 0);
      resetMatch(room);
      startRound(room, { open11: true }); // oyun [1|1] qoşa ilə başlayır
      await save(room);
      return res.json({ view: viewFor(room, seat) });
    }

    if (!room.game) return res.status(409).json({ error: "Oyun hələ başlamayıb" });

    if (action === "next") {
      if (room.game.status !== "finished" || Number(input.round) !== room.round) {
        return res.json({ view: viewFor(room, seat) }); // artıq başlayıb (başqası basıb)
      }
      if (room.matchWinner !== null) {
        resetMatch(room);
        startRound(room, { open11: true });
      } else {
        startRound(room, { starter: nextStarter(room) });
      }
      await save(room);
      return res.json({ view: viewFor(room, seat) });
    }

    const wasPlaying = room.game.status === "playing";
    if (action === "play") {
      room.game = engine.playTile(room.game, seat, Number(input.tileId), input.side);
    } else if (action === "draw") {
      room.game = engine.drawTile(room.game, seat);
    } else if (action === "pass") {
      room.game = engine.pass(room.game, seat);
    } else {
      return res.status(400).json({ error: "Naməlum action" });
    }
    finalizeIfFinished(room, wasPlaying);
    if (room.game.status === "playing") settleBlocked(room); // hərəkətdən sonra oyun bağlı qalıbsa, bitir

    await save(room);
    return res.json({ view: viewFor(room, seat) });
  } catch (err) {
    return res.status(400).json({ error: err.message || "Xəta" });
  }
};