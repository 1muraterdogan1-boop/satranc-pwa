
"use strict";

let game = new Chess();
let selectedSquare = null;
let legalMoves = [];
let boardFlipped = false;
let soundEnabled = true;
let thinking = false;
let capturedWhite = [];
let capturedBlack = [];
let previousPosition = null;

const $ = id => document.getElementById(id);

const pieceSymbols = {
  w: { k: "♔", q: "♕", r: "♖", b: "♗", n: "♘", p: "♙" },
  b: { k: "♚", q: "♛", r: "♜", b: "♝", n: "♞", p: "♟" }
};

const pieceNames = {
  p: "Piyon", n: "At", b: "Fil",
  r: "Kale", q: "Vezir", k: "Şah"
};

const pieceValues = {
  p: 100, n: 320, b: 330,
  r: 500, q: 900, k: 20000
};

function currentMode() {
  return $("gameMode").value;
}

function currentDifficulty() {
  return Number($("difficulty").value);
}

function playSound(frequency = 420, duration = 70) {
  if (!soundEnabled) return;

  try {
    const AudioContextClass =
      window.AudioContext || window.webkitAudioContext;

    if (!AudioContextClass) return;

    const context = new AudioContextClass();
    const oscillator = context.createOscillator();
    const gain = context.createGain();

    oscillator.frequency.value = frequency;
    oscillator.type = "sine";
    gain.gain.value = 0.06;

    oscillator.connect(gain);
    gain.connect(context.destination);

    oscillator.start();
    oscillator.stop(context.currentTime + duration / 1000);
    oscillator.onended = () => context.close();
  } catch (error) {
    console.warn("Ses oynatılamadı:", error);
  }
}

function newGame() {
  game.reset();
  selectedSquare = null;
  legalMoves = [];
  thinking = false;
  capturedWhite = [];
  capturedBlack = [];
  previousPosition = null;

  renderBoard();
  updateInterface();
  $("coachMessage").textContent =
    "Oyun başladı. Tahtayı incele ve ilk hamleni yap.";
  $("gameReport").textContent = "Henüz oyun tamamlanmadı.";
}

function renderBoard() {
  const boardElement = $("chessBoard");
  boardElement.innerHTML = "";

  const board = game.board();
  const ranks = boardFlipped
    ? [7, 6, 5, 4, 3, 2, 1, 0]
    : [0, 1, 2, 3, 4, 5, 6, 7];

  const files = boardFlipped
    ? [7, 6, 5, 4, 3, 2, 1, 0]
    : [0, 1, 2, 3, 4, 5, 6, 7];

  ranks.forEach(row => {
    files.forEach(col => {
      const squareName =
        "abcdefgh"[col] + (8 - row);

      const piece = board[row][col];
      const square = document.createElement("div");

      square.className =
        "square " + ((row + col) % 2 ? "dark" : "light");

      square.dataset.square = squareName;

      if (selectedSquare === squareName) {
        square.classList.add("selected");
      }

      if (legalMoves.some(move => move.to === squareName)) {
        square.classList.add("legal");
        if (piece) square.classList.add("has-piece");
      }

      if (piece) {
        const symbol = document.createElement("span");
        symbol.className = "piece " +
          (piece.color === "w" ? "white" : "black");
        symbol.textContent =
          pieceSymbols[piece.color][piece.type];
        square.appendChild(symbol);
      }

      if (col === (boardFlipped ? 7 : 0)) {
        const rank = document.createElement("span");
        rank.className = "coordinates coordinate-rank";
        rank.textContent = String(8 - row);
        square.appendChild(rank);
      }

      if (row === (boardFlipped ? 0 : 7)) {
        const file = document.createElement("span");
        file.className = "coordinates coordinate-file";
        file.textContent = "abcdefgh"[col];
        square.appendChild(file);
      }

      square.addEventListener("click", () => {
        tapSquare(squareName);
      });

      boardElement.appendChild(square);
    });
  });
}

function tapSquare(squareName) {
  if (thinking || game.isGameOver()) return;

  if (currentMode() === "computer" && game.turn() === "b") {
    return;
  }

  const piece = game.get(squareName);

  if (!selectedSquare) {
    if (piece && piece.color === game.turn()) {
      selectSquare(squareName);
    }
    return;
  }

  if (selectedSquare === squareName) {
    selectedSquare = null;
    legalMoves = [];
    renderBoard();
    return;
  }

  const matchingMove = legalMoves.find(
    move => move.to === squareName
  );

  if (matchingMove) {
    playMove(selectedSquare, squareName);
    return;
  }

  if (piece && piece.color === game.turn()) {
    selectSquare(squareName);
  } else {
    selectedSquare = null;
    legalMoves = [];
    renderBoard();
  }
}

function selectSquare(squareName) {
  selectedSquare = squareName;
  legalMoves = game.moves({
    square: squareName,
    verbose: true
  });

  renderBoard();
}

function playMove(from, to) {
  const movingPiece = game.get(from);

  if (!movingPiece) return;

  let move = game.move({
    from,
    to,
    promotion: "q"
  });

  if (!move) return;

  if (move.captured) {
    const captured = {
      color: movingPiece.color === "w" ? "b" : "w",
      type: move.captured
    };

    if (movingPiece.color === "w") {
      capturedWhite.push(captured);
    } else {
      capturedBlack.push(captured);
    }
  }

  selectedSquare = null;
  legalMoves = [];

  playSound(move.captured ? 260 : 440);

  renderBoard();
  updateInterface();

  if (game.isGameOver()) {
    finishGame();
    return;
  }

  if (currentMode() === "computer" && game.turn() === "b") {
    thinking = true;
    $("gameStatus").textContent = "Bilgisayar düşünüyor...";
    setTimeout(computerMove, 350);
  }
}

function updateInterface() {
  const turn = game.turn() === "w" ? "Beyaz" : "Siyah";

  let status = turn + " oynuyor.";

  if (game.isCheck()) status += " ŞAH!";

  $("gameStatus").textContent = status;

  const history = game.history();

  $("moveHistory").innerHTML = "";

  for (let i = 0; i < history.length; i += 2) {
    const item = document.createElement("li");
    item.textContent =
      `${Math.floor(i / 2) + 1}. ${history[i]}` +
      (history[i + 1] ? "  " + history[i + 1] : "");
    $("moveHistory").appendChild(item);
  }

  $("whiteCaptured").textContent =
    capturedWhite.map(p => pieceSymbols[p.color][p.type]).join(" ") || "—";

  $("blackCaptured").textContent =
    capturedBlack.map(p => pieceSymbols[p.color][p.type]).join(" ") || "—";

  $("blackPlayer").textContent =
    currentMode() === "computer"
      ? "Siyah — Bilgisayar"
      : "Siyah oyuncu";

  $("whitePlayer").textContent = "Beyaz oyuncu";
}

function finishGame() {
  let result = "Oyun bitti.";

  if (game.isCheckmate()) {
    result = (game.turn() === "w" ? "Siyah" : "Beyaz") +
      " kazandı. Şah mat!";
  } else if (game.isDraw()) {
    result = "Oyun berabere bitti.";
  }

  $("gameStatus").textContent = result;
  $("gameReport").textContent =
    result + " Toplam hamle: " + game.history().length;

  $("coachMessage").textContent =
    "Oyun tamamlandı. Hamlelerini inceleyebilirsin.";

  playSound(620, 180);
}

function evaluateBoard() {
  let score = 0;
  const board = game.board();

  board.forEach(row => {
    row.forEach(piece => {
      if (!piece) return;

      const value = pieceValues[piece.type] || 0;
      score += piece.color === "b" ? value : -value;
    });
  });

  return score;
}

function minimax(depth, alpha, beta, maximizing) {
  if (depth === 0 || game.isGameOver()) {
    return evaluateBoard();
  }

  const moves = game.moves({ verbose: true });

  if (maximizing) {
    let best = -Infinity;

    for (const move of moves) {
      game.move(move);
      const value = minimax(depth - 1, alpha, beta, false);
      game.undo();

      best = Math.max(best, value);
      alpha = Math.max(alpha, value);

      if (beta <= alpha) break;
    }

    return best;
  }

  let best = Infinity;

  for (const move of moves) {
    game.move(move);
    const value = minimax(depth - 1, alpha, beta, true);
    game.undo();

    best = Math.min(best, value);
    beta = Math.min(beta, value);

    if (beta <= alpha) break;
  }

  return best;
}

function computerMove() {
  if (game.isGameOver() || game.turn() !== "b") {
    thinking = false;
    return;
  }

  const moves = game.moves({ verbose: true });

  if (!moves.length) {
    thinking = false;
    finishGame();
    return;
  }

  const depth = [1, 1, 2, 3, 3][currentDifficulty() - 1];

  let bestScore = -Infinity;
  let bestMoves = [];

  for (const move of moves) {
    game.move(move);

    const score = minimax(
      depth - 1,
      -Infinity,
      Infinity,
      true
    );

    game.undo();

    const adjusted = -score;

    if (adjusted > bestScore) {
      bestScore = adjusted;
      bestMoves = [move];
    } else if (adjusted === bestScore) {
      bestMoves.push(move);
    }
  }

  const chosen = bestMoves[
    Math.floor(Math.random() * bestMoves.length)
  ];

  thinking = false;
  playMove(chosen.from, chosen.to);
}

function undoMove() {
  if (!game.history().length || thinking) return;

  if (currentMode() === "computer") {
    if (game.history().length >= 2) {
      game.undo();
      game.undo();
    } else {
      game.undo();
    }
  } else {
    game.undo();
  }

  const history = game.history({ verbose: true });

  capturedWhite = [];
  capturedBlack = [];

  history.forEach(move => {
    if (move.captured) {
      const captured = {
        color: move.color === "w" ? "b" : "w",
        type: move.captured
      };

      if (move.color === "w") {
        capturedWhite.push(captured);
      } else {
        capturedBlack.push(captured);
      }
    }
  });

  selectedSquare = null;
  legalMoves = [];
  renderBoard();
  updateInterface();
}

function showHint() {
  if (game.isGameOver()) return;

  const moves = game.moves({ verbose: true });

  if (!moves.length) return;

  const chosen = moves[Math.floor(Math.random() * moves.length)];

  $("coachMessage").textContent =
    `${chosen.from} karesinden ${chosen.to} karesine ` +
    `${pieceNames[chosen.piece]} hamlesini değerlendirebilirsin.`;

  playSound(540);
}

function analyzePosition() {
  if (game.isGameOver()) {
    $("coachMessage").textContent = "Oyun tamamlandı.";
    return;
  }

  const score = evaluateBoard();

  let message = "Konum dengeli görünüyor.";

  if (score > 200) {
    message = "Siyah taraf materyal üstünlüğüne sahip.";
  } else if (score < -200) {
    message = "Beyaz taraf materyal üstünlüğüne sahip.";
  }

  if (game.isCheck()) {
    message += " Şah tehdidi var; dikkatli oyna.";
  }

  $("coachMessage").textContent = message;
}

function flipBoard() {
  boardFlipped = !boardFlipped;
  renderBoard();
}

$("newGame").addEventListener("click", newGame);
$("undoMove").addEventListener("click", undoMove);
$("hintButton").addEventListener("click", showHint);
$("analyzeButton").addEventListener("click", analyzePosition);
$("flipBoard").addEventListener("click", flipBoard);

$("soundToggle").addEventListener("click", () => {
  soundEnabled = !soundEnabled;
  $("soundToggle").textContent =
    soundEnabled ? "Sesi kapat" : "Sesi aç";
});

$("gameMode").addEventListener("change", newGame);
$("difficulty").addEventListener("change", () => {
  if (currentMode() === "computer") newGame();
});

newGame();
