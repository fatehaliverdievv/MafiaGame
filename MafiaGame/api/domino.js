// api/domino.js — Domino otaqları (Vercel KV ilə). Bütün əməliyyatlar bir endpoint-dədir.
//   POST {action:"create", name}
//   POST {action:"join", code, name}
//   GET  ?action=state&code=..&token=..          (polling)
//   POST {action:"play", code, token, tileId, side}
//   POST {action:"draw" | "pass", code, token}

const crypto = require("crypto");
const engine = require("./_domino-engine");

const TTL = 60 * 60 * 6; // otaq 6 saat saxlanılır
const roomKey = (code) => `domino:${code}`;

// Saxlama: KV açarları varsa Vercel KV, yoxdursa yaddaşda (RAM) saxlanılır.
// DİQQƏT: RAM rejimi yalnız lokal test üçündür; Vercel-də instance-lar arasında paylaşılmır.
const USE_KV = !!(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
const kv = USE_KV ? require("@vercel/kv").kv : null;
const mem = (globalThis.__dominoRooms = globalThis.__dominoRooms || new Map());

async function loadRoom(code) {
  if (USE_KV) return kv.get(roomKey(code));
  return mem.get(roomKey(code)) || null;
}
const newCode = () => crypto.randomBytes(3).toString("hex").toUpperCase();
const newToken = () => crypto.randomBytes(16).toString("hex");

// Oyunçuya yalnız ona aid olan məlumat göndərilir (rəqibin daşları gizli qalır)
function viewFor(room, seat) {
  const view = {
    code: room.code,
    you: seat,
    players: room.players.map((p) => p.name),
    started: !!room.game,
  };
  const g = room.game;
  if (!g) return view;

  Object.assign(view, {
    board: g.board,
    hand: g.hands[seat],
    handCounts: g.hands.map((h) => h.length),
    boneyardCount: g.boneyard.length,
    turn: g.turn,
    status: g.status,
    winner: g.winner,
    reason: g.reason || null,
    moves: g.status === "playing" && g.turn === seat ? engine.legalMoves(g, seat) : [],
  });
  return view;
}

async function save(room) {
  if (USE_KV) await kv.set(roomKey(room.code), room, { ex: TTL });
  else mem.set(roomKey(room.code), room);
}

module.exports = async (req, res) => {
  try {
    const input = req.method === "GET" ? req.query : req.body || {};
    const { action } = input;

    if (action === "create") {
      const name = String(input.name || "").trim().slice(0, 20);
      if (!name) return res.status(400).json({ error: "Ad lazımdır" });

      const token = newToken();
      const room = { code: newCode(), players: [{ name, token }], game: null };
      await save(room);
      return res.json({ token, view: viewFor(room, 0) });
    }

    if (action === "join") {
      const name = String(input.name || "").trim().slice(0, 20);
      const code = String(input.code || "").trim().toUpperCase();
      if (!name) return res.status(400).json({ error: "Ad lazımdır" });

      const room = await loadRoom(code);
      if (!room) return res.status(404).json({ error: "Otaq tapılmadı" });
      if (room.players.length >= 2) return res.status(409).json({ error: "Otaq doludur" });

      const token = newToken();
      room.players.push({ name, token });
      room.game = engine.newGame(2); // 2 nəfər olanda oyun başlayır
      await save(room);
      return res.json({ token, view: viewFor(room, room.players.length - 1) });
    }

    // Aşağıdakı bütün əməliyyatlar tokenlə oyunçunu tanıyır
    const code = String(input.code || "").trim().toUpperCase();
    const room = await loadRoom(code);
    if (!room) return res.status(404).json({ error: "Otaq tapılmadı" });

    const seat = room.players.findIndex((p) => p.token === input.token);
    if (seat === -1) return res.status(403).json({ error: "Etibarsız token" });

    if (action === "state") return res.json({ view: viewFor(room, seat) });

    if (!room.game) return res.status(409).json({ error: "Oyun hələ başlamayıb" });

    if (action === "play") {
      room.game = engine.playTile(room.game, seat, Number(input.tileId), input.side);
    } else if (action === "draw") {
      room.game = engine.drawTile(room.game, seat);
    } else if (action === "pass") {
      room.game = engine.pass(room.game, seat);
    } else {
      return res.status(400).json({ error: "Naməlum action" });
    }

    await save(room);
    return res.json({ view: viewFor(room, seat) });
  } catch (err) {
    // Oyun qaydası xətaları (məs. "Sıra sizdə deyil") 400 kimi qayıdır
    return res.status(400).json({ error: err.message || "Xəta" });
  }
};