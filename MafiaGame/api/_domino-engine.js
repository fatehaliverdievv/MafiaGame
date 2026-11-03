// api/_domino-engine.js — Domino məntiqi (CommonJS). "_" ilə başlayan fayl Vercel-də ayrıca endpoint olmur.

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

function newGame(players = 2, handSize = 7) {
  const deck = shuffle(createDeck());
  const hands = [];
  for (let p = 0; p < players; p++) hands.push(deck.splice(0, handSize));

  let turn = 0;
  let best = -1;
  hands.forEach((h, p) =>
    h.forEach((t) => {
      if (t.a === t.b && t.a > best) {
        best = t.a;
        turn = p;
      }
    })
  );

  return { board: [], hands, boneyard: deck, turn, passes: 0, status: "playing", winner: null };
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
      moves.push({ tileId: tile.id, side: "right" });
      continue;
    }
    if (orient(state, tile, "left")) moves.push({ tileId: tile.id, side: "left" });
    if (orient(state, tile, "right")) moves.push({ tileId: tile.id, side: "right" });
  }
  return moves;
}

function assertPlaying(state, player) {
  if (state.status !== "playing") throw new Error("Oyun bitib");
  if (state.turn !== player) throw new Error("Sıra sizdə deyil");
}

const nextTurn = (s) => (s.turn + 1) % s.hands.length;

function playTile(state, player, tileId, side) {
  assertPlaying(state, player);
  const tile = state.hands[player].find((t) => t.id === tileId);
  if (!tile) throw new Error("Bu daş sizin əlinizdə yoxdur");
  const placed = orient(state, tile, side);
  if (!placed) throw new Error("Bu daşı həmin tərəfə qoymaq olmaz");

  const board = side === "left" ? [placed, ...state.board] : [...state.board, placed];
  const hands = state.hands.map((h, i) => (i === player ? h.filter((t) => t.id !== tileId) : h));

  if (hands[player].length === 0) {
    return { ...state, board, hands, passes: 0, status: "finished", winner: player, reason: "empty-hand" };
  }
  return { ...state, board, hands, passes: 0, turn: nextTurn(state) };
}

function drawTile(state, player) {
  assertPlaying(state, player);
  if (legalMoves(state, player).length > 0) throw new Error("Gedişiniz var, daş çəkmək olmaz");
  if (state.boneyard.length === 0) throw new Error("Bazar boşdur");
  const [drawn, ...rest] = state.boneyard;
  return {
    ...state,
    boneyard: rest,
    hands: state.hands.map((h, i) => (i === player ? [...h, drawn] : h)),
  };
}

function pass(state, player) {
  assertPlaying(state, player);
  if (legalMoves(state, player).length > 0) throw new Error("Gedişiniz var, pas keçmək olmaz");
  if (state.boneyard.length > 0) throw new Error("Əvvəlcə bazardan daş çəkin");

  const passes = state.passes + 1;
  if (passes >= state.hands.length) {
    const scores = state.hands.map(handScore);
    const min = Math.min(...scores);
    const winners = scores.flatMap((s, i) => (s === min ? [i] : []));
    return {
      ...state,
      passes,
      status: "finished",
      winner: winners.length === 1 ? winners[0] : null,
      reason: "blocked",
    };
  }
  return { ...state, passes, turn: nextTurn(state) };
}

module.exports = { newGame, legalMoves, playTile, drawTile, pass };
