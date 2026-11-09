/* Satranç motoru güçlendirmesi: farklı seviyeler + daha derin hamle önerisi */
(function () {
  "use strict";

  if (typeof game === "undefined" || typeof evaluate !== "function") return;

  const LEVELS = {
    1: { depth: 1, nodes: 350, branch: 5, variety: 5 },
    2: { depth: 2, nodes: 1100, branch: 7, variety: 4 },
    3: { depth: 3, nodes: 3000, branch: 10, variety: 2 },
    4: { depth: 4, nodes: 7000, branch: 13, variety: 1 },
    5: { depth: 5, nodes: 14000, branch: 17, variety: 1 }
  };

  const MATE = 100000;
  let searchNodes = 0;
  let nodeLimit = 0;
  let stopped = false;
  let table = new Map();

  function sideScore() {
    const score = evaluate(); // Mevcut değerlendirme: siyah lehine pozitif
    return game.turn() === "b" ? score : -score;
  }

  function terminalScore(ply) {
    if (game.in_checkmate()) return -MATE + ply;
    if (game.in_draw() || game.in_stalemate()) return 0;
    return null;
  }

  function ordered(list) {
    list.sort((a, b) => {
      const pa = (typeof movePriority === "function" ? movePriority(a) : 0)
        + (a.san && a.san.includes("+") ? 70 : 0)
        + (a.san && a.san.includes("#") ? 100000 : 0);
      const pb = (typeof movePriority === "function" ? movePriority(b) : 0)
        + (b.san && b.san.includes("+") ? 70 : 0)
        + (b.san && b.san.includes("#") ? 100000 : 0);
      return pb - pa;
    });
    return list;
  }

  function quiescence(alpha, beta, ply, remaining) {
    searchNodes++;
    if (searchNodes > nodeLimit) {
      stopped = true;
      return sideScore();
    }

    const terminal = terminalScore(ply);
    if (terminal !== null) return terminal;

    const inCheck = game.in_check();
    let stand = sideScore();

    if (!inCheck) {
      if (stand >= beta) return beta;
      if (stand > alpha) alpha = stand;
      if (remaining <= 0) return stand;
    } else if (remaining <= 0) {
      return stand;
    }

    let moves = ordered(game.moves({ verbose: true }));
    if (!inCheck) {
      moves = moves.filter(m => m.captured || m.promotion);
    }

    for (const m of moves) {
      if (stopped) break;
      game.move({ from: m.from, to: m.to, promotion: m.promotion || "q" });
      let score;
      try {
        score = -quiescence(-beta, -alpha, ply + 1, remaining - 1);
      } finally {
        game.undo();
      }
      if (score >= beta) return beta;
      if (score > alpha) alpha = score;
    }
    return alpha;
  }

  function negamax(depth, alpha, beta, ply, branch) {
    searchNodes++;
    if (searchNodes > nodeLimit) {
      stopped = true;
      return sideScore();
    }

    const terminal = terminalScore(ply);
    if (terminal !== null) return terminal;
    if (depth <= 0) return quiescence(alpha, beta, ply, 4);

    const originalAlpha = alpha;
    let key = "";
    try { key = game.fen(); } catch (_) {}
    const cached = key ? table.get(key) : null;
    if (cached && cached.depth >= depth) {
      if (cached.flag === 0) return cached.score;
      if (cached.flag === 1 && cached.score >= beta) return cached.score;
      if (cached.flag === 2 && cached.score <= alpha) return cached.score;
    }

    let moves = ordered(game.moves({ verbose: true }));
    if (!moves.length) return game.in_check() ? -MATE + ply : 0;
    if (branch && moves.length > branch) moves = moves.slice(0, branch);

    let best = -Infinity;
    for (const m of moves) {
      if (stopped) break;
      game.move({ from: m.from, to: m.to, promotion: m.promotion || "q" });
      let score;
      try {
        score = -negamax(depth - 1, -beta, -alpha, ply + 1, branch);
      } finally {
        game.undo();
      }
      if (score > best) best = score;
      if (score > alpha) alpha = score;
      if (alpha >= beta) break;
    }

    if (key && Number.isFinite(best)) {
      const flag = best <= originalAlpha ? 2 : best >= beta ? 1 : 0;
      if (table.size > 18000) table.clear();
      table.set(key, { depth, score: best, flag });
    }
    return Number.isFinite(best) ? best : sideScore();
  }

  function prepareSearch(limit) {
    searchNodes = 0;
    nodeLimit = limit;
    stopped = false;
    table = new Map();
  }

  function pickFromTop(scored, variety) {
    scored.sort((a, b) => b.score - a.score);
    const count = Math.min(variety, scored.length);
    const pool = scored.slice(0, count);
    return pool[Math.floor(Math.random() * pool.length)];
  }

  function activeMode() {
    const active = document.querySelector('#modeChoices button.active');
    return active ? active.getAttribute("data-mode") : "computer";
  }

  /* Bilgisayar hamlesi: seviyeye göre gerçekten artan arama derinliği. */
  window.computerMove = function () {
    if (!game || game.game_over() || game.turn() !== "b") {
      thinking = false;
      if (typeof draw === "function") draw();
      return;
    }
    if (activeMode() === "local") {
      thinking = false;
      if (typeof draw === "function") draw();
      return;
    }

    const token = gameToken;
    const levelValue = Number(document.getElementById("level").value) || 3;
    const cfg = LEVELS[Math.max(1, Math.min(5, levelValue))];
    const rootMoves = ordered(game.moves({ verbose: true }));
    if (!rootMoves.length) {
      thinking = false;
      draw();
      return;
    }

    let chosen = rootMoves[0];
    let completedDepth = 0;
    let depth = 1;

    function runIteration() {
      if (token !== gameToken || !game || game.game_over() || game.turn() !== "b") {
        thinking = false;
        if (token === gameToken) draw();
        return;
      }

      prepareSearch(cfg.nodes);
      const scored = [];
      let index = 0;

      function batch() {
        if (token !== gameToken || !game || game.game_over() || game.turn() !== "b") {
          thinking = false;
          if (token === gameToken) draw();
          return;
        }

        const end = Math.min(index + 2, rootMoves.length);
        while (index < end && !stopped) {
          const m = rootMoves[index++];
          game.move({ from: m.from, to: m.to, promotion: m.promotion || "q" });
          let score;
          try {
            score = -negamax(depth - 1, -Infinity, Infinity, 1, cfg.branch);
          } finally {
            game.undo();
          }
          scored.push({ move: m, score });
        }

        if (index < rootMoves.length && !stopped) {
          setTimeout(batch, 0);
          return;
        }

        if (scored.length) {
          scored.sort((a, b) => b.score - a.score);
          if (!stopped || completedDepth === 0) {
            chosen = pickFromTop(scored, cfg.variety).move;
            completedDepth = depth;
          }
        }

        if (depth < cfg.depth && !stopped) {
          depth++;
          setTimeout(runIteration, 0);
          return;
        }

        const result = game.move({
          from: chosen.from,
          to: chosen.to,
          promotion: chosen.promotion || "q"
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
        if (game.game_over()) {
          draw();
          if (typeof showFinalReport === "function") showFinalReport();
        } else {
          draw();
        }
      }

      batch();
    }

    runIteration();
  };

  /* Öneri düğmesi: daha derin arama, rakibin karşı hamlelerini de hesaba katar. */
  window.getHint = function () {
    if (!game || game.game_over()) {
      if (typeof coachMessage === "function") coachMessage("Yeni bir oyun başlatıp tekrar öneri iste.");
      return;
    }
    if (game.turn() !== "w" || thinking || analysisBusy) {
      if (typeof coachMessage === "function") coachMessage("Sıra sana geldiğinde hamle önerisi alabilirsin.");
      return;
    }

    const button = document.getElementById("hintButton");
    const token = gameToken;
    button.disabled = true;
    analysisBusy = true;
    if (typeof coachMessage === "function") {
      coachMessage("Derin analiz yapılıyor: rakibin olası cevapları da inceleniyor...");
    }

    const roots = ordered(game.moves({ verbose: true }));
    let best = roots[0] || null;
    let bestScore = -Infinity;
    let index = 0;
    prepareSearch(11000);
    table = new Map();

    function batchHint() {
      if (token !== gameToken || !game || game.turn() !== "w") {
        analysisBusy = false;
        button.disabled = false;
        return;
      }

      const end = Math.min(index + 2, roots.length);
      while (index < end && !stopped) {
        const m = roots[index++];
        game.move({ from: m.from, to: m.to, promotion: m.promotion || "q" });
        let score;
        try {
          score = -negamax(4, -Infinity, Infinity, 1, 16);
        } finally {
          game.undo();
        }
        if (score > bestScore) {
          bestScore = score;
          best = m;
        }
      }

      if (index < roots.length && !stopped) {
        setTimeout(batchHint, 0);
        return;
      }

      analysisBusy = false;
      button.disabled = false;

      if (!best) {
        if (typeof coachMessage === "function") coachMessage("Önerilecek yasal hamle bulunamadı.");
        return;
      }

      hintMove = { from: best.from, to: best.to };
      selected = best.from;
      legal = game.moves({ square: best.from, verbose: true });
      draw();

      let tip = "Güçlü öneri: " + best.piece + " " + best.from + " → " + best.to + " (" + best.san + ").";
      if (best.captured) tip += " Rakibin " + best.captured + " taşını kazanıyorsun.";
      if (best.promotion) tip += " Piyon terfi ediyor.";
      if (best.san && best.san.includes("+")) tip += " Şah tehdidi oluşturuyor.";
      tip += " Öneri, rakibin cevaplarını da içeren derin yerel aramaya dayanıyor.";
      if (typeof coachMessage === "function") coachMessage(tip);
    }

    if (!roots.length) {
      analysisBusy = false;
      button.disabled = false;
      if (typeof coachMessage === "function") coachMessage("Yasal hamle bulunamadı.");
      return;
    }
    batchHint();
  };

})();
