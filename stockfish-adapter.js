
(function () {
  "use strict";

  const CACHE_NAME = "satranc-stockfish-engine-v1";
const REMOTE_JS =
  "https://unpkg.com/stockfish@19.0.1/stockfish-19-single.js";

const REMOTE_WASM =
  "https://unpkg.com/stockfish@19.0.1/stockfish-19-single.wasm";



  const LOCAL_JS = new URL(
    "./stockfish-19-single.js", location.href
  ).href;

  const LOCAL_WASM = new URL(
    "./stockfish-19-single.wasm", location.href
  ).href;

  const fallbackComputerMove = window.computerMove;
  const fallbackGetHint = window.getHint;

  let worker = null;
  let readyPromise = null;
  let activeSearch = null;
  let lastAnalysis = [];

  async function saveEngineFile(cache, remote, local, name) {
    let saved = await cache.match(local);

    if (saved) return;

    if (!navigator.onLine) {
      throw new Error(name + " henüz indirilmemiş.");
    }

    if (typeof coachMessage === "function") {
      coachMessage(name + " indiriliyor. Lütfen bekle...");
    }

    const response = await fetch(remote);

    if (!response.ok) {
      throw new Error(name + " indirilemedi.");
    }

    await cache.put(local, response);
  }

  async function startEngine() {
    if (readyPromise) return readyPromise;

    readyPromise = (async function () {
      const cache = await caches.open(CACHE_NAME);

      await saveEngineFile(
        cache, REMOTE_JS, LOCAL_JS, "Stockfish JS"
      );

      await saveEngineFile(
        cache, REMOTE_WASM, LOCAL_WASM, "Stockfish WASM"
      );

      worker = new Worker(LOCAL_JS);

      await new Promise((resolve, reject) => {
        let stage = "uci";

        const timeout = setTimeout(() => {
          reject(new Error("Motor başlatılamadı."));
        }, 120000);

        worker.onmessage = function (event) {
          const line = String(event.data || "");

          if (stage === "uci" && line.includes("uciok")) {
            stage = "ready";
            worker.postMessage("setoption name Hash value 64");
            worker.postMessage("setoption name MultiPV value 1");
            worker.postMessage("isready");
          } else if (
            stage === "ready" && line.includes("readyok")
          ) {
            clearTimeout(timeout);
            resolve();
                   } else if (
            line.startsWith("info ") && activeSearch
          ) {
            const depth = Number(
              line.match(/\bdepth (\d+)/)?.[1] || 0
            );
            const index = Number(
              line.match(/\bmultipv (\d+)/)?.[1] || 1
            );
            const scoreMatch = line.match(
              /\bscore (cp|mate) (-?\d+)/
            );
            const pvMatch = line.match(/\bpv (.+)$/);

            if (scoreMatch && pvMatch) {
              const previous = activeSearch.lines[index];

              if (!previous || depth >= previous.depth) {
                activeSearch.lines[index] = {
                  index,
                  depth,
                  type: scoreMatch[1],
                  score: Number(scoreMatch[2]),
                  pv: pvMatch[1].trim()
                };
              }
            } } else if (
            line.startsWith("bestmove ") && activeSearch
          ) {
            const job = activeSearch;
            activeSearch = null;
            clearTimeout(job.timeout);

            const move = line.split(/\s+/)[1];
            lastAnalysis = Object.values(job.lines)
  .sort((a, b) => a.index - b.index);

            if (!move || move === "(none)") {
              job.reject(new Error("Hamle bulunamadı."));
            } else {
              job.resolve(move);
            }
          }
        };

        
worker.onerror = function (error) {
  clearTimeout(timeout);

  const detail =
    error.message ||
    error.type ||
    "Worker yüklenemedi";

  if (activeSearch) {
    clearTimeout(activeSearch.timeout);
    activeSearch.reject(new Error(detail));
    activeSearch = null;
  }

  reject(new Error(detail));
};


          reject(error);
        };

        worker.postMessage("uci");
      });

      return worker;
    })().catch(error => {
      if (worker) worker.terminate();
      worker = null;
      readyPromise = null;
      throw error;
    });

    return readyPromise;
  }

  function thinkTime() {
    const level = Number(
      document.getElementById("level")?.value || 3
    );

    return [0, 2000, 5000, 8000, 12000, 20000][
      Math.max(1, Math.min(5, level))
    ];
  }

  async function bestMove(fen, milliseconds) {
    const engine = await startEngine();

    return new Promise((resolve, reject) => {
      if (activeSearch) {
        reject(new Error("Analiz devam ediyor."));
        return;
      }

            const job = {
        resolve,
        reject,
        lines: {},
        timeout: setTimeout(() => {
          activeSearch = null;
          reject(new Error("Analiz zaman aşımı."));
        }, milliseconds + 60000)
      };

      activeSearch = job;

      engine.postMessage("position fen " + fen);
      engine.postMessage("go movetime " + milliseconds);
    });
  }

  window.computerMove = async function () {
    if (!game || game.game_over() || game.turn() !== "b") return;

    const token = gameToken;
    thinking = true;
    draw();

    try {
      const uci = await bestMove(game.fen(), thinkTime());

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
          "Yeni motor kullanılamadı. Eski motor devreye giriyor."
        );
      }

      if (fallbackComputerMove) fallbackComputerMove();
    }
  };

    window.getHint = async function () {
    if (!game) {
      coachMessage("Hata: Oyun yüklenmemiş.");
      return;
    }

    if (game.game_over()) {
      coachMessage("Oyun bitmiş. Yeni oyun başlat.");
      return;
    }

    if (game.turn() !== "w") {
      coachMessage("Şu anda siyahın sırası. Beyazın sırasını bekle.");
      return;
    }

    if (thinking || analysisBusy) {
      coachMessage("Motor şu anda başka bir işlem yapıyor. Biraz bekle.");
      return;
    }

    const token = gameToken;
    const button = document.getElementById("hintButton");

    if (button) button.disabled = true;

    analysisBusy = true;
    coachMessage("Stockfish en iyi hamleyi derinlemesine hesaplıyor...");

    try {
      const uci = await bestMove(
        game.fen(),
        Math.max(10000, thinkTime())
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
            if (lastAnalysis.length) {
        message += "\n\nStockfish'in 3 aday analizi:";

        lastAnalysis.forEach((item, i) => {
          const evaluation = item.type === "mate"
            ? "Zorunlu mat: " + item.score
            : "Değerlendirme: " +
              (item.score > 0 ? "+" : "") +
              (item.score / 100).toFixed(2);

          message += "\n" + (i + 1) + ". " +
            item.pv.split(/\s+/).slice(0, 4).join(" ") +
            " — " + evaluation;
        });
      }
      if (best.san.includes("+")) message += " Şah tehdidi!";

      coachMessage(message);

        } catch (error) {
      if (token === gameToken) {
        analysisBusy = false;
        coachMessage(
          "Stockfish hata verdi: " +
          (error.message || error)
        );
      }
    } finally {
      if (token === gameToken) {
        analysisBusy = false;
        if (button) button.disabled = false;
      }
    }
  };
})();
