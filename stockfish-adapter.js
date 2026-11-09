
(function () {
  "use strict";

  const fallbackComputerMove = window.computerMove;
  const fallbackGetHint = window.getHint;
  const ENGINE_FILE = "./stockfish-19-lite-single.js";

  let worker = null;
  let readyPromise = null;
  let activeSearch = null;

  function startEngine() {
    if (readyPromise) return readyPromise;

    readyPromise = new Promise((resolve, reject) => {
      try {
        worker = new Worker(ENGINE_FILE);
      } catch (error) {
        readyPromise = null;
        reject(error);
        return;
      }

      let stage = "uci";

      const timeout = setTimeout(() => {
        worker.terminate();
        worker = null;
        readyPromise = null;
        reject(new Error("Motor yüklenemedi."));
      }, 20000);

      worker.onmessage = event => {
        const line = String(event.data || "");

        if (stage === "uci" && line.includes("uciok")) {
          stage = "ready";
          worker.postMessage("isready");
        } else if (stage === "ready" && line.includes("readyok")) {
          clearTimeout(timeout);
          resolve(worker);
        } else if (line.startsWith("bestmove ") && activeSearch) {
          const job = activeSearch;
          activeSearch = null;
          const move = line.split(/\s+/)[1];

          if (!move || move === "(none)") {
            job.reject(new Error("Hamle bulunamadı."));
          } else {
            job.resolve(move);
          }
        }
      };

      worker.onerror = error => {
        clearTimeout(timeout);
        reject(error);
      };

      worker.postMessage("uci");
    });

    return readyPromise;
  }

  async function bestMove(fen, depth) {
    const engine = await startEngine();

    if (activeSearch) {
      engine.postMessage("stop");
      activeSearch = null;
    }

    return new Promise((resolve, reject) => {
      activeSearch = { resolve, reject };
      engine.postMessage("position fen " + fen);
      engine.postMessage("go depth " + depth);
    });
  }

  function depth() {
    const level = Number(document.getElementById("level")?.value || 3);
    return [0, 7, 9, 12, 15, 17][
      Math.max(1, Math.min(5, level))
    ];
  }

  window.computerMove = async function () {
    if (!game || game.game_over() || game.turn() !== "b") return;

    const token = gameToken;
    thinking = true;
    draw();

    try {
      const uci = await bestMove(game.fen(), depth());

      if (token !== gameToken || game.turn() !== "b") return;

      const result = game.move({
        from: uci.slice(0, 2),
        to: uci.slice(2, 4),
        promotion: uci[4] || "q"
      });

      if (result) {
        lastMove = { from: result.from, to: result.to };
        if (typeof sound === "function") {
          sound(result.captured ? "capture" : "move");
          if (game.in_check()) sound("check");
        }
        if (typeof rebuildCaptured === "function") rebuildCaptured();
      }

      thinking = false;
      draw();

      if (game.game_over() && typeof showFinalReport === "function") {
        showFinalReport();
      }
    } catch (error) {
      if (token !== gameToken) return;
      thinking = false;
      draw();
      if (typeof coachMessage === "function") {
        coachMessage("Stockfish yüklenemedi. Eski motor kullanılıyor.");
      }
      if (fallbackComputerMove) fallbackComputerMove();
    }
  };

  window.getHint = async function () {
    if (!game || game.game_over() || game.turn() !== "w" ||
        thinking || analysisBusy) {
      if (fallbackGetHint) fallbackGetHint();
      return;
    }

    const token = gameToken;
    const button = document.getElementById("hintButton");
    if (button) button.disabled = true;

    analysisBusy = true;
    coachMessage("Stockfish en iyi hamleyi hesaplıyor...");

    try {
      const uci = await bestMove(game.fen(), Math.max(12, depth()));

      if (token !== gameToken || game.turn() !== "w") return;

      const best = game.moves({ verbose: true }).find(m =>
        m.from === uci.slice(0, 2) &&
        m.to === uci.slice(2, 4)
      );

      if (!best) throw new Error("Hamle bulunamadı.");

      hintMove = { from: best.from, to: best.to };
      selected = best.from;
      legal = game.moves({ square: best.from, verbose: true });
      draw();

      let message = "Stockfish önerisi: " +
        best.from + " → " + best.to + " (" + best.san + ").";

      if (best.captured) message += " Taş kazanıyorsun.";
      if (best.san.includes("+")) message += " Şah tehdidi!";

      coachMessage(message);

    } catch (error) {
      if (token === gameToken && fallbackGetHint) fallbackGetHint();
    } finally {
      if (token === gameToken) {
        analysisBusy = false;
        if (button) button.disabled = false;
      }
    }
  };
})();
