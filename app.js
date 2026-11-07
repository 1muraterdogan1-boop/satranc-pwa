
const game = new Chess();

let selectedSquare = null;
let legalTargets = [];
let flipped = false;

const boardElement = document.getElementById("board");
const statusElement = document.getElementById("status");

const pieces = {
  w: {
    k: "♔", q: "♕", r: "♖",
    b: "♗", n: "♘", p: "♙"
  },
  b: {
    k: "♚", q: "♛", r: "♜",
    b: "♝", n: "♞", p: "♟"
  }
};

function renderBoard() {
  boardElement.innerHTML = "";

  const board = game.board();
  const files = flipped
    ? ["h","g","f","e","d","c","b","a"]
    : ["a","b","c","d","e","f","g","h"];

  const ranks = flipped
    ? [0,1,2,3,4,5,6,7]
    : [7,6,5,4,3,2,1,0];

  ranks.forEach((rank) => {
    files.forEach((file) => {
      const squareName = file + (rank + 1);
      const fileIndex = file.charCodeAt(0) - 97;
      const piece = board[rank][fileIndex];

      const square = document.createElement("div");
      square.className = "square";

      const isLight =
        (fileIndex + rank) % 2 === 1;

      square.classList.add(
        isLight ? "light" : "dark"
      );

      if (selectedSquare === squareName) {
        square.classList.add("selected");
      }

      if (legalTargets.includes(squareName)) {
        square.classList.add("selected");
      }

      if (piece) {
        square.textContent =
          pieces[piece.color][piece.type];
      }

      square.addEventListener("click", () => {
        handleSquareClick(squareName);
      });

      boardElement.appendChild(square);
    });
  });

  updateStatus();
  updateHistory();
  updateCaptured();
}

function handleSquareClick(squareName) {
  if (game.game_over()) return;

  const clickedPiece = game.get(squareName);

  if (selectedSquare) {
    const move = game.move({
      from: selectedSquare,
      to: squareName,
      promotion: "q"
    });

    if (move) {
      selectedSquare = null;
      legalTargets = [];
      renderBoard();
      return;
    }
  }

  if (
    clickedPiece &&
    clickedPiece.color === game.turn()
  ) {
    selectedSquare = squareName;

    legalTargets = game.moves({
      square: squareName,
      verbose: true
    }).map(move => move.to);
  } else {
    selectedSquare = null;
    legalTargets = [];
  }

  renderBoard();
}

function updateStatus() {
  if (game.in_checkmate()) {
    statusElement.textContent =
      "Şah mat! " +
      (game.turn() === "w" ? "Siyah" : "Beyaz") +
      " kazandı.";
  } else if (game.in_draw()) {
    statusElement.textContent = "Oyun berabere!";
  } else if (game.in_check()) {
    statusElement.textContent =
      (game.turn() === "w" ? "Beyaz" : "Siyah") +
      " şah altında!";
  } else {
    statusElement.textContent =
      (game.turn() === "w" ? "Beyazın" : "Siyahın") +
      " sırası";
  }
}

function updateHistory() {
  const historyElement =
    document.getElementById("moveHistory");

  const history = game.history();

  historyElement.innerHTML = "";

  for (let i = 0; i < history.length; i += 2) {
    const line = document.createElement("div");
    line.textContent =
      (Math.floor(i / 2) + 1) + ". " +
      history[i] + " " +
      (history[i + 1] || "");

    historyElement.appendChild(line);
  }
}

function updateCaptured() {
  const whiteElement =
    document.getElementById("capturedWhite");

  const blackElement =
    document.getElementById("capturedBlack");

  const history = game.history({ verbose: true });

  const whiteCaptured = [];
  const blackCaptured = [];

  history.forEach(move => {
    if (move.captured) {
      const symbol = pieces[move.color][move.captured];

      if (move.color === "w") {
        whiteCaptured.push(symbol);
      } else {
        blackCaptured.push(symbol);
      }
    }
  });

  whiteElement.textContent =
    "Beyazın aldığı: " + whiteCaptured.join(" ");

  blackElement.textContent =
    "Siyahın aldığı: " + blackCaptured.join(" ");
}

document.getElementById("newGameBtn")
  .addEventListener("click", () => {
    game.reset();
    selectedSquare = null;
    legalTargets = [];
    renderBoard();
  });

document.getElementById("undoBtn")
  .addEventListener("click", () => {
    game.undo();
    selectedSquare = null;
    legalTargets = [];
    renderBoard();
  });

document.getElementById("flipBtn")
  .addEventListener("click", () => {
    flipped = !flipped;
    renderBoard();
  });

document.getElementById("hintBtn")
  .addEventListener("click", () => {
    const moves = game.moves({ verbose: true });

    const message =
      moves.length
        ? "Öneri: " + moves[0].from +
          " karesinden " + moves[0].to +
          " karesine oynayabilirsin."
        : "Yapılabilecek hamle yok.";

    document.getElementById("coachMessage")
      .textContent = message;
  });

document.getElementById("analyzeBtn")
  .addEventListener("click", () => {
    document.getElementById("coachMessage")
      .textContent =
      "Hamle sayısı: " + game.history().length +
      ". Sıra: " +
      (game.turn() === "w" ? "Beyaz" : "Siyah");
  });

document.getElementById("reportBtn")
  .addEventListener("click", () => {
    document.getElementById("coachMessage")
      .textContent =
      "Oyun raporu: " + game.history().length +
      " hamle oynandı. " +
      (game.game_over() ? "Oyun sona erdi." : "Oyun devam ediyor.");
  });

renderBoard();
