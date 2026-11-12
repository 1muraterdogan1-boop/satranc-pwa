
(function () {
  "use strict";

  const CACHE_NAME = "satranc-stockfish-engine-v1";
  const REMOTE_JS = "https://unpkg.com/stockfish@19.0.1/stockfish-19-single.js";
  const REMOTE_WASM = "https://unpkg.com/stockfish@19.0.1/stockfish-19-single.wasm";
  const LOCAL_JS = new URL("./stockfish-19-single.js", location.href).href;
  const LOCAL_WASM = new URL("./stockfish-19-single.wasm", location.href).href;

  const fallbackComputerMove = window.computerMove;
  const fallbackGetHint = window.getHint;

  let worker = null;
  let readyPromise = null;
  let activeSearch = null;
  let lastAnalysis = [];
  let startupReject = null;

  async function saveEngineFile(cache, remote, local, name) {
    if (await cache.match(local)) return;
    if (!navigator.onLine) {
      throw new Error(name + " henüz indirilmemiş; internet bağlantısı gerekli.");
    }

    if (typeof coachMessage === "function") {
      coachMessage(name + " indiriliyor. Lütfen bekle...");
    }

    const response = await fetch(remote);
    if (!response.ok) {
      throw new Error(name + " indirilemedi (HTTP " + response.status + ").");
    }
    await cache.put(local, response);
  }

  async function startEngine() {
    if (readyPromise) return readyPromise;

    readyPromise = (async function () {
      if (!("caches" in window)) {
        throw new Error("Tarayıcı motor önbelleğini desteklemiyor.");
      }
      if (!("Worker" in window)) {
        throw new Error("Tarayıcı Worker desteği sunmuyor.");
      }

      const cache = await caches.open(CACHE_NAME);
      await saveEngineFile(cache, REMOTE_JS, LOCAL_JS, "Stockfish JS");
      await saveEngineFile(cache, REMOTE_WASM, LOCAL_WASM, "Stockfish WASM");

      worker = new Worker(LOCAL_JS);

      await new Promise((resolve, reject) => {
        let stage = "uci";
        let settled = false;

        const timeout = setTimeout(
          () => finish(new Error("Stockfish başlatma zaman aşımı.")),
          120000
        );

        function finish(error) {
          if (settled) return;
          settled = true;
          clearTimeout(timeout);
          startupReject = null;

          if (error) reject(error);
          else resolve();
        }

        startupReject = finish;

        worker.onmessage = function (event) {
          const line = String(event.data || "");

          if (stage === "uci" && line.includes("uciok")) {
            stage = "ready";
            worker.postMessage("setoption name Hash value 48");
            worker.postMessage("setoption name MultiPV value 3");
            worker.postMessage("isready");
            return;
          }

          if (stage === "ready" && line.includes("readyok")) {
            stage = "running";
            finish();
            return;
          }

          if (line.startsWith("info ") && activeSearch) {
            const depth = Number(line.match(/\bdepth (\d+)/)?.[1] || 0);
            const index = Number(line.match(/\bmultipv (\d+)/)?.[1] || 1);
            const scoreMatch = line.match(/\bscore (cp|mate) (-?\d+)/);
            const pvMatch = line.match(/\bpv (.+)$/);

            if (scoreMatch && pvMatch) {
              const previous = activeSearch.lines[index];

              if (!previous || depth >= previous.depth) {
                activeSearch.lines[index] = {
                  index: index,
                  depth: depth,
                  type: scoreMatch[1],
                  score: Number(scoreMatch[2]),
                  pv: pvMatch[1].trim()
                };
              }
            }
            return;
          }

          if (line.startsWith("bestmove ") && activeSearch) {
            const job = activeSearch;
            activeSearch = null;
            clearTimeout(job.timeout);

            lastAnalysis = Object.values(job.lines)
              .sort((a, b) => a.index - b.index);

            const move = line.split(/\s+/)[1];

            if (!move || move === "(none)") {
              job.reject(new Error("Motor yasal hamle bulamadı."));
            } else {
              job.resolve(move);
            }
          }
        };

        worker.onerror = function (event) {
          const detail =
            event && (event.message || event.type) ||
            "Worker yüklenemedi.";

          const error = new Error(detail);

          if (startupReject) startupReject(error);

          if (activeSearch) {
            const job = activeSearch;
            activeSearch = null;
            clearTimeout(job.timeout);
            job.reject(error);
          }
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
    lastAnalysis = [];

    const engine = await startEngine();

    if (activeSearch) {
      throw new Error("Başka bir motor analizi devam ediyor.");
    }

    return new Promise((resolve, reject) => {
      const job = {
        resolve: resolve,
        reject: reject,
        lines: {},
        timeout: setTimeout(() => {
          if (activeSearch === job) activeSearch = null;

          try {
            engine.postMessage("stop");
          } catch (_) {}

          reject(new Error("Motor analiz zaman aşımına uğradı."));
        }, milliseconds + 30000)
      };

      activeSearch = job;
      engine.postMessage("position fen " + fen);
      engine.postMessage("go movetime " + milliseconds);
    });
  }

  function showEngineCandidates() {
    if (!lastAnalysis.length) return "";

    let message = "\n\nStockfish'in aday hamleleri:";

    lastAnalysis.slice(0, 3).forEach((item, index) => {
      const evaluation = item.type === "mate"
        ? "Mat: " + item.score
        : "Değerlendirme: " +
          (item.score > 0 ? "+" : "") +
          (item.score / 100).toFixed(2);

      message += "\n" + (index + 1) + ". " +
        item.pv.split(/\s+/).slice(0, 5).join(" ") +
        " — " + evaluation;
    });

    return message;
  }

  window.computerMove = async function () {
    if (!game || game.game_over() || game.turn() !== "b") return;

    const token = gameToken;
    thinking = true;
    draw();

    try {
      const uci = await bestMove(game.fen(), thinkTime());

      if (token !== gameToken || !game || game.turn() !== "b") return;

      const result = game.move({
        from: uci.slice(0, 2),
        to: uci.slice(2, 4),
        promotion: uci[4] || "q"
      });

      if (!result) {
        throw new Error("Stockfish hamlesi satranç kurallarına uymuyor.");
      }

      lastMove = {
        from: result.from,
        to: result.to
      };

      if (typeof sound === "function") {
        sound(result.captured ? "capture" : "move");
        if (game.in_check()) sound("check");
      }

      if (typeof rebuildCaptured === "function") {
        rebuildCaptured();
      }

      thinking = false;
      draw();

      if (
        game.game_over() &&
        typeof showFinalReport === "function"
      ) {
        showFinalReport();
      }

    } catch (error) {
      if (token !== gameToken) return;

      thinking = false;
      draw();

      if (typeof coachMessage === "function") {
        coachMessage(
          "Stockfish kullanılamadı; yerel bilgisayar motoru devreye giriyor."
        );
      }

      if (fallbackComputerMove) fallbackComputerMove();
    }
  };

  window.getHint = async function () {
    if (!game) {
      coachMessage("Oyun henüz yüklenmemiş.");
      return;
    }

    if (game.game_over()) {
      coachMessage("Oyun bitmiş. Yeni oyun başlatabilirsin.");
      return;
    }

    if (game.turn() !== "w") {
      coachMessage("Öneri almak için beyazın sırasını bekle.");
      return;
    }

    if (thinking || analysisBusy) {
      coachMessage("Motor başka bir işlem yapıyor. Biraz bekle.");
      return;
    }

    const token = gameToken;
    const button = document.getElementById("hintButton");

    if (button) button.disabled = true;

    analysisBusy = true;
    coachMessage("Stockfish rakibin olası cevaplarını hesaplıyor...");

    let fallbackError = null;

    try {
      const uci = await bestMove(
        game.fen(),
        Math.max(10000, thinkTime())
      );

      if (token !== gameToken || !game || game.turn() !== "w") return;

      const best = game.moves({ verbose: true }).find(move =>
        move.from === uci.slice(0, 2) &&
        move.to === uci.slice(2, 4) &&
        (move.promotion || "") === (uci[4] || "")
      );

      if (!best) {
        throw new Error("Önerilen hamle yasal hamleler arasında bulunamadı.");
      }

      hintMove = {
        from: best.from,
        to: best.to
      };

      selected = best.from;
      legal = game.moves({
        square: best.from,
        verbose: true
      });

      draw();

      let message =
        "Güçlü öneri: " +
        best.from + " → " + best.to +
        " (" + best.san + ").";

      if (best.captured) {
        message += " Rakibin taşını alıyorsun.";
      }

      if (best.promotion) {
        message += " Piyon terfi ediyor.";
      }

      if (best.san && best.san.includes("+")) {
        message += " Şah tehdidi oluşturuyor.";
      }

      message += showEngineCandidates();
      coachMessage(message);

    } catch (error) {
      fallbackError = error;

    } finally {
      if (token === gameToken) {
        analysisBusy = false;
        if (button) button.disabled = false;
      }
    }

    // Önce analiz kilidini kaldır, sonra yerel öneri motorunu çalıştır.
    if (fallbackError && token === gameToken) {
      const reason = fallbackError.message || String(fallbackError);

      coachMessage(
        "Stockfish açılamadı (" + reason +
        "). Yerel motorla hamle önerisi hazırlanıyor..."
      );

      if (fallbackGetHint) {
        fallbackGetHint();
      } else {
        coachMessage(
          "Hamle öneri motoru kullanılamıyor. Sayfayı yenileyip tekrar dene."
        );
      }
    }
  };

})();
