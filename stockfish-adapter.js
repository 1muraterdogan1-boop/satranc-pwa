
(function () {
  "use strict";

  const ENGINE_URL =
    "https://cdn.jsdelivr.net/npm/stockfish@19.0.1/bin/stockfish-19-asm.js";
  const CACHE_NAME = "satranc-stockfish-engine-v1";

  const fallbackComputerMove = window.computerMove;
  const fallbackGetHint = window.getHint;

  let worker = null;
  let readyPromise = null;
  let activeSearch = null;

  function startEngine() {
    if (readyPromise) return readyPromise;

    readyPromise = (async function () {
      const cache = await caches.open(CACHE_NAME);
      let response = await cache.match(ENGINE_URL);

      if (!response) {
        if (!navigator.onLine) {
          throw new Error("Motor henüz indirilmedi.");
        }

        response = await fetch(ENGINE_URL);
        if (!response.ok) throw new Error("Motor indirilemedi.");

        await cache.put(ENGINE_URL, response.clone());
      }

      const source = await response.text();
      const blob = new Blob([source], {
        type: "text/javascript"
      });

      const blobUrl = URL.createObjectURL(blob);

      try {
        worker = new Worker(blobUrl);

        await new Promise((resolve, reject) => {
          let stage = "uci";

          const timeout = setTimeout(() => {
            reject(new Error("Motor başlatma zaman aşımı."));
          }, 30000);

          worker.onmessage = function (event) {
            const line = String(event.data || "");

            if (stage === "uci" && line.includes("uciok")) {
              stage = "ready";
              worker.postMessage("isready");
            } else if (
              stage === "ready" &&
              line.includes("readyok")
            ) {
              clearTimeout(timeout);
              resolve();
            } else if (
              line.startsWith("bestmove ") &&
              activeSearch
            ) {
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

          worker.onerror = function (error) {
            clearTimeout(timeout);
            reject(error);
          };

          worker.postMessage("uci");
        });
      } finally {
        URL.revokeObjectURL(blobUrl);
      }

      return worker;
    })().catch(error => {
      readyPromise = null;
      if (worker) worker.terminate();
      worker = null;
      throw error;
    });

    return readyPromise;
  }

  async function bestMove(fen, depth) {
    const engine = await startEngine();

    return new Promise((resolve, reject) => {
      if (activeSearch) {
        reject(new Error("Önceki analiz devam ediyor."));
        return;
      }

      activeSearch = { resolve, reject };
      engine.postMessage("position fen " + fen);
      engine.postMessage("go depth " + depth);
    });
  }

  function searchDepth() {
    const level = Number(
      document.getElementById("level")?.value || 3
    );

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
      const uci = await bestMove(game.fen(), searchDepth());

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

        if (typeof rebuildCaptured === "function") {
          rebuildCaptured();
        }
      }

      thinking = false;
      draw();

      if (game.game_over() &&
          typeof showFinalReport === "function") {
        showFinalReport();
      }
    } catch (error) {
      if (token !== gameToken) return;

      thinking = false;
      draw();

      if (typeof coachMessage === "function") {
        coachMessage(
          "Stockfish kullanılamadı. Mevcut motor devreye giriyor."
        );
      }

      if (fallbackComputerMove) fallbackComputerMove();
    }
  };

  window.getHint = async function () {
    if (!game || game.game_over() ||
        game.turn() !== "w" || thinking || analysisBusy) {
      if (fallbackGetHint) fallbackGetHint();
      return;
    }

    const token = gameToken;
    const button = document.getElementById("hintButton");

    if (button) button.disabled = true;

    analysisBusy = true;
    coachMessage("Stockfish en iyi hamleyi hesaplıyor...");

    try {
      const uci = await bestMove(
        game.fen(),
        Math.max(12, searchDepth())
      );

      if (token !== gameToken || game.turn() !== "w") return;

      const best = game.moves({ verbose: true }).find(m =>
        m.from === uci.slice(0, 2) &&
        m.to === uci.slice(2, 4)
      );

      if (!best) throw new Error("Öneri bulunamadı.");

      hintMove = { from: best.from, to: best.to };
      selected = best.from;
      legal = game.moves({
        square: best.from,
        verbose: true
      });

      draw();

      let message =
        "Stockfish önerisi: " +
        best.from + " → " + best.to +
        " (" + best.san + ").";

      if (best.captured) message += " Taş kazanıyorsun.";
      if (best.san.includes("+")) message += " Şah tehdidi!";

      coachMessage(message);

    } catch (error) {
      if (token === gameToken) {
        analysisBusy = false;
        if (fallbackGetHint) fallbackGetHint();
      }
    } finally {
      if (token === gameToken) {
        analysisBusy = false;
        if (button) button.disabled = false;
      }
    }
  };
})();
