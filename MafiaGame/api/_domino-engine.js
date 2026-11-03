// api/_domino-engine.js — Domino məntiqi (bir raund). "_" ilə başlayan fayl Vercel-də endpoint olmur.
// Tərəflər (sides): 2 nəfər → [[0],[1]] ; 4 nəfər → [[0,2],[1,3]] (tərəfdaşlar qarşı-qarşıya oturur)

const TILE_11 = 7; // [1|1] qoşa daşının id-si (createDeck sırasına görə)

function createDeck() {
  const deck = [];
  let id = 0;
  for (let i = 0; i <= 6; i++) for (let j = i; j <= 6; j++) deck.push({ id: id++, a: i, b: j });
  return deck;
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const handScore = (h) => h.reduce((s, t) => s + t.a + t.b, 0);
const leftEnd = (s) => (s.board.length ? s.board[0].a : null);
const rightEnd = (s) => (s.board.length ? s.board[s.board.length - 1].b : null);

function makeSides(players) {
  return players === 4 ? [[0, 2], [1, 3]] : [[0], [1]];
}
const sideOf = (state, seat) => state.sides.findIndex((s) => s.includes(seat));

// Qayda: eyni sayda 5 və ya daha çox daş varsa, onların arasında həmin sayın qoşası da olmalıdır.
// Əks halda belə paylama keçərsizdir (daşlar yenidən qarışdırılır).
function dealIsValid(hands) {
  for (const h of hands) {
    for (let n = 0; n <= 6; n++) {
      const count = h.filter((t) => t.a === n || t.b === n).length;
      const hasDouble = h.some((t) => t.a === n && t.b === n);
      if (count >= 5 && !hasDouble) return false;
    }
  }
  return true;
}

// opts.open11: raund [1|1] qoşa ilə başlayır (oyunun ilk raundu), [1|1] olan oyunçu başlayır
// opts.starter: açıq başlanğıc üçün başlayan oyunçu (open11 yoxdursa)
function newGame(players = 2, handSize = 7, opts = {}) {
  let hands, deck, tries = 0;
  for (;;) {
    deck = shuffle(createDeck());
    hands = [];
    for (let p = 0; p < players; p++) hands.push(deck.splice(0, handSize));
    tries++;
    if (!dealIsValid(hands) && tries < 2000) continue;
    if (opts.open11 && !hands.some((h) => h.some((t) => t.id === TILE_11)) && tries < 2000) continue;
    break;
  }

  let turn = 0;
  if (opts.open11) {
    turn = hands.findIndex((h) => h.some((t) => t.id === TILE_11));
    if (turn < 0) turn = 0;
  } else if (typeof opts.starter === "number") {
    turn = opts.starter;
  } else {
    let bestDouble = -1, doubleSeat = -1, bestSum = -1, sumSeat = 0;
    hands.forEach((h, p) => h.forEach((t) => {
      if (t.a === t.b && t.a > bestDouble) { bestDouble = t.a; doubleSeat = p; }
      if (t.a + t.b > bestSum) { bestSum = t.a + t.b; sumSeat = p; }
    }));
    turn = doubleSeat >= 0 ? doubleSeat : sumSeat;
  }

  return {
    board: [], origin: 0, hands, boneyard: deck, turn, passes: 0,
    sides: makeSides(players),
    opening: opts.open11 ? TILE_11 : null, // ilk gediş yalnız bu daşla ola bilər
    status: "playing", winner: null, winnerSide: null,
  };
}

function orient(state, tile, side) {
  if (state.board.length === 0) return { ...tile };
  if (side === "right") {
    const end = rightEnd(state);
    if (tile.a === end) return { ...tile };
    if (tile.b === end) return { ...tile, a: tile.b, b: tile.a };
  } else {
    const end = leftEnd(state);
    if (tile.b === end) return { ...tile };
    if (tile.a === end) return { ...tile, a: tile.b, b: tile.a };
  }
  return null;
}

function legalMoves(state, player = state.turn) {
  const moves = [];
  for (const tile of state.hands[player]) {
    if (state.board.length === 0) {
      if (state.opening !== null && tile.id !== state.opening) continue;
      moves.push({ tileId: tile.id, side: "right" });
      continue;
    }
    if (orient(state, tile, "left")) moves.push({ tileId: tile.id, side: "left" });
    if (orient(state, tile, "right")) moves.push({ tileId: tile.id, side: "right" });
  }
  return moves;
}

function assertPlaying(state, player) {
  if (state.status !== "playing") throw new Error("Raund bitib");
  if (state.turn !== player) throw new Error("Sıra sizdə deyil");
}

const nextTurn = (s) => (s.turn + 1) % s.hands.length;

function playTile(state, player, tileId, side) {
  assertPlaying(state, player);
  const tile = state.hands[player].find((t) => t.id === tileId);
  if (!tile) throw new Error("Bu daş sizin əlinizdə yoxdur");
  if (state.board.length === 0 && state.opening !== null && tileId !== state.opening)
    throw new Error("Oyun [1|1] qoşa daşı ilə başlamalıdır");
  const placed = orient(state, tile, side);
  if (!placed) throw new Error("Bu daşı həmin tərəfə qoymaq olmaz");

  const wasEmpty = state.board.length === 0;
  const board = side === "left" && !wasEmpty ? [placed, ...state.board] : [...state.board, placed];
  const origin = side === "left" && !wasEmpty ? state.origin + 1 : state.origin;
  const hands = state.hands.map((h, i) => (i === player ? h.filter((t) => t.id !== tileId) : h));

  if (hands[player].length === 0) {
    return {
      ...state, board, origin, hands, passes: 0, status: "finished",
      winner: player, winnerSide: sideOf(state, player), reason: "empty-hand",
    };
  }
  return { ...state, board, origin, hands, passes: 0, turn: nextTurn(state) };
}

function drawTile(state, player) {
  assertPlaying(state, player);
  if (legalMoves(state, player).length > 0) throw new Error("Gedişiniz var, daş çəkmək olmaz");
  if (state.boneyard.length === 0) throw new Error("Bazar boşdur");
  const [drawn, ...rest] = state.boneyard;
  return { ...state, boneyard: rest, hands: state.hands.map((h, i) => (i === player ? [...h, drawn] : h)) };
}

const sideTotals = (state) =>
  state.sides.map((seats) => seats.reduce((sum, seat) => sum + handScore(state.hands[seat]), 0));

function pass(state, player) {
  assertPlaying(state, player);
  if (legalMoves(state, player).length > 0) throw new Error("Gedişiniz var, pas keçmək olmaz");
  if (state.boneyard.length > 0) throw new Error("Əvvəlcə bazardan daş çəkin");

  const passes = state.passes + 1;
  // Hər iki tərəfdən gediş bitdi → oyun bağlı gəlib
  if (passes >= state.hands.length) {
    const totals = sideTotals(state);
    const min = Math.min(...totals);
    const lows = totals.flatMap((t, i) => (t === min ? [i] : []));
    return {
      ...state, passes, status: "finished", reason: "blocked",
      winner: null, winnerSide: lows.length === 1 ? lows[0] : null, // null = bərabərlik
    };
  }
  return { ...state, passes, turn: nextTurn(state) };
}

// Raundun nəticəsi.
// - Daşlarını bitirən tərəf: rəqib tərəfin əlində qalan daşların cəmini alır.
// - Bağlı oyun: əlində daşların cəmi AZ olan tərəf qalib; ÇOX olan tərəfin cəmini alır.
// - Bərabərlik: tie=true, heç kim xal almır (xal növbəti raunda keçir).
function roundResult(state) {
  if (state.status !== "finished") return null;
  const totals = sideTotals(state);
  if (state.winnerSide === null) return { winnerSide: null, tie: true, points: 0, sideTotals: totals };
  const points = totals.reduce((a, b) => a + b, 0) - totals[state.winnerSide];
  return { winnerSide: state.winnerSide, tie: false, points, sideTotals: totals, winnerSeat: state.winner };
}

module.exports = {
  newGame, legalMoves, playTile, drawTile, pass, roundResult, handScore, makeSides, dealIsValid, TILE_11,
};