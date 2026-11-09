/* Premium Satranç - düzeltilmiş saat, mod, motor ve kısa rapor */
(function () {
  if (typeof Chess === "undefined" || typeof game === "undefined") return;

  const style = document.createElement("style");
  style.textContent = `
    .piece:not(.pawn) svg{width:94%;height:94%}
    #extraControls{display:flex;flex-direction:column;gap:9px;align-items:center;justify-content:center;margin:10px auto;padding:10px;background:#26383c;border:1px solid #8f7549;border-radius:10px}
    #extraControls .extra-label{font-size:12px;color:#f0d59a;font-weight:bold}
    #timeChoices,#modeChoices{display:flex;flex-wrap:wrap;justify-content:center;gap:6px;width:100%}
    #extraControls button{min-width:54px;padding:10px 12px;border-radius:9px;font-size:13px}
    #extraControls button.active{background:#fff0c8;border:2px solid #fff;color:#251b10;box-shadow:0 0 0 2px #b58b4e}
    #gameClock{display:flex;justify-content:center;gap:18px;margin:8px auto;color:#f0d59a;font-size:22px;font-weight:bold}
    #gameClock span{min-width:105px;padding:8px 14px;background:#26383c;border:1px solid #8f7549;border-radius:9px}
    #gameClock span.active-clock{border:2px solid #f0d59a;color:#fff}
    #reportContent .report-item{font-size:14px}
  `;
  document.head.appendChild(style);

  const status = document.getElementById("status");
  const controls = document.createElement("div");
  controls.id = "extraControls";
  controls.innerHTML = `
    <div class="extra-label">OYUN MODU</div>
    <div id="modeChoices">
      <button type="button" data-mode="computer" class="active">Bilgisayara karşı</button>
      <button type="button" data-mode="local">2 kişilik</button>
      <button type="button" data-mode="training">Antrenman</button>
    </div>
    <div class="extra-label">OYUN SÜRESİ — BİR SEÇENEĞE DOKUN</div>
    <div id="timeChoices">
      <button type="button" data-time="0">Süresiz</button>
      <button type="button" data-time="180">3 dk</button>
      <button type="button" data-time="300" class="active">5 dk</button>
      <button type="button" data-time="600">10 dk</button>
      <button type="button" data-time="900">15 dk</button>
      <button type="button" data-time="1800">30 dk</button>
    </div>`;
  status.parentNode.insertBefore(controls, status);

  const clock = document.createElement("div");
  clock.id = "gameClock";
  clock.innerHTML = '<span id="clockWhite">05:00</span><span id="clockBlack">05:00</span>';
  status.parentNode.insertBefore(clock, status.nextSibling);

  let mode = "computer";
  let initial = 300;
  let left = { w: 300, b: 300 };
  let started = false, expired = false, tick = null;

  function fmt(n) {
    n = Math.max(0, Math.floor(n));
    return String(Math.floor(n / 60)).padStart(2, "0") + ":" + String(n % 60).padStart(2, "0");
  }
  function showClock() {
    const w = document.getElementById("clockWhite");
    const b = document.getElementById("clockBlack");
    w.textContent = fmt(left.w);
    b.textContent = fmt(left.b);
    w.classList.toggle("active-clock", !!game && game.turn() === "w");
    b.classList.toggle("active-clock", !!game && game.turn() === "b");
    clock.style.display = initial ? "flex" : "none";
  }
  function resetClock() {
    left = { w: initial, b: initial };
    started = false;
    expired = false;
    if (tick) clearInterval(tick);
    showClock();
    tick = setInterval(() => {
      if (!initial || !started || expired || !game || game.game_over()) return;
      const side = game.turn();
      left[side] = Math.max(0, left[side] - 1);
      showClock();
      if (left[side] <= 0) {
        expired = true;
        document.getElementById("status").textContent =
          (side === "w" ? "Beyaz" : "Siyah") + " süresi doldu. " +
          (side === "w" ? "Siyah" : "Beyaz") + " kazandı.";
      }
    }, 1000);
  }
  function markActive(selector, attr, value) {
    document.querySelectorAll(selector).forEach(btn =>
      btn.classList.toggle("active", btn.getAttribute(attr) === String(value))
    );
  }

  controls.addEventListener("click", e => {
    const timeBtn = e.target.closest("button[data-time]");
    const modeBtn = e.target.closest("button[data-mode]");
    if (timeBtn) {
      initial = Number(timeBtn.dataset.time);
      markActive("#timeChoices button", "data-time", initial);
      if (typeof window.newGame === "function") window.newGame();
      return;
    }
    if (modeBtn) {
      mode = modeBtn.dataset.mode;
      markActive("#modeChoices button", "data-mode", mode);
      if (typeof window.newGame === "function") window.newGame();
    }
  });

  const originalNewGame = window.newGame;
  window.newGame = function () {
    const result = originalNewGame.apply(this, arguments);
    resetClock();
    return result;
  };

  const originalTap = window.tapSquare;
  window.tapSquare = function (name) {
    if (!game || expired || thinking || analysisBusy || game.game_over()) return;
    if (mode !== "local" && game.turn() === "b") return;
    const p = game.get(name);
    if (selected) {
      const m = legal.find(x => x.to === name);
      if (m) {
        let promotion = "q";
        if (m.promotion) {
          let a = prompt("Piyon hangi taşa dönüşsün? q=Vezir, r=Kale, b=Fil, n=At", "q");
          a = (a || "q").toLowerCase();
          promotion = ["q", "r", "b", "n"].includes(a) ? a : "q";
        }
        hintMove = null;
        started = true;
        window.playMove({ from: selected, to: name, promotion });
        showClock();
        return;
      }
    }
    if (p && p.color === game.turn()) {
      selected = name;
      legal = game.moves({ square: name, verbose: true });
    } else {
      selected = null;
      legal = [];
    }
    draw();
  };

  const originalUpdateStatus = window.updateStatus;
  window.updateStatus = function () {
    originalUpdateStatus.apply(this, arguments);
    if (expired) document.getElementById("status").textContent = "Süre doldu.";
  };

  /* Daha derin arama: siyahın değerlendirmesi maksimize edilir. */
  window.computerMove = function () {
    if (!game || game.game_over() || game.turn() !== "b" || expired) {
      thinking = false;
      draw();
      return;
    }
    if (mode === "local") {
      thinking = false;
      draw();
      return;
    }

    const token = gameToken;
    const level = Number(document.getElementById("level").value);
    const depth = [1, 2, 2, 3, 4][level - 1] || 2;
    const branch = [5, 7, 9, 11, 13][level - 1] || 9;
    const moves = orderedMoves(branch);
    let index = 0, scored = [];

    function scoreBatch() {
      if (token !== gameToken || !game || game.game_over() || game.turn() !== "b" || expired) {
        thinking = false;
        if (token === gameToken) draw();
        return;
      }
      const stop = Math.min(index + 2, moves.length);
      while (index < stop) {
        const m = moves[index++];
        game.move({ from: m.from, to: m.to, promotion: m.promotion || "q" });
        const score = game.game_over()
          ? (game.in_checkmate() ? 100000 : 0)
          : search(depth, -Infinity, Infinity, 1, branch);
        game.undo();
        scored.push({ move: m, score });
      }
      if (index < moves.length) {
        setTimeout(scoreBatch, 0);
        return;
      }

      scored.sort((a, b) => b.score - a.score);
      const poolSize = level <= 2 ? Math.min(3, scored.length) : level === 3 ? Math.min(2, scored.length) : 1;
      const pool = scored.slice(0, poolSize);
      const chosen = pool[Math.floor(Math.random() * pool.length)];
      if (!chosen || expired) {
        thinking = false;
        draw();
        return;
      }
      const result = game.move({
        from: chosen.move.from,
        to: chosen.move.to,
        promotion: chosen.move.promotion || "q"
      });
      if (result) {
        lastMove = { from: result.from, to: result.to };
        sound(result.captured ? "capture" : "move");
        if (game.in_check()) sound("check");
        rebuildCaptured();
      }
      thinking = false;
      if (game.game_over()) {
        draw();
        showFinalReport();
        return;
      }
      draw();
      showClock();
    }
    scoreBatch();
  };

  /* Kısa maç sonu raporu: yalnızca önemli hatalar. */
  window.showFinalReport = function () {
    const report = document.getElementById("report");
    const content = document.getElementById("reportContent");
    report.style.display = "block";
    const mistakes = moveAnalysis.filter(x => x.loss >= 180);
    const small = moveAnalysis.filter(x => x.loss >= 70 && x.loss < 180);
    const good = moveAnalysis.filter(x => x.loss < 70);
    let html = `<p><strong>Hamle özeti:</strong> ${moveAnalysis.length} hamle</p>`;
    html += `<p><strong>İyi:</strong> ${good.length} &nbsp; <strong>Küçük hata:</strong> ${small.length} &nbsp; <strong>Önemli hata:</strong> ${mistakes.length}</p>`;
    if (game.in_checkmate()) {
      html += `<p><strong>Sonuç:</strong> ${game.turn() === "w" ? "Bilgisayar kazandı." : "Sen kazandın!"}</p>`;
    } else {
      html += `<p><strong>Sonuç:</strong> Berabere veya oyun sona erdi.</p>`;
    }
    if (mistakes.length) {
      html += "<h4>Üzerinde çalışman gereken hamleler</h4>";
      mistakes.slice(0, 3).forEach(x => {
        html += `<div class="report-item bad"><strong>${x.number}. ${x.san || x.from + " → " + x.to} — ${x.label}</strong><p>${x.explanation}</p>${x.best ? `<p><strong>Daha iyi seçenek:</strong> ${x.best}</p>` : ""}</div>`;
      });
    } else {
      html += "<p>Belirgin bir büyük hata kaydedilmedi. Güzel iş!</p>";
    }
    html += "<div class='report-item'>Bir sonraki maçta her hamleden önce rakibin tehdidini ve oynadığın taşın korunup korunmadığını kontrol et.</div>";
    html += "<p class='small'>Analiz hızlı, sınırlı derinlikteki yerel motora dayanır; profesyonel motor kesinliğinde değildir.</p>";
    content.innerHTML = html;
    report.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const oldHint = document.getElementById("hintButton");
  if (oldHint) oldHint.textContent = mode === "training" ? "🎓 Antrenman ipucu" : "💡 Daha iyi hamle öner";
  resetClock();
  showClock();

  /* Taş çizimleri: at ve fil daha iri; şah artı işaretsiz, taçlı. */
  const previousPieceSVG = window.pieceSVG;
  window.pieceSVG = function(type, color) {
    if (!["n", "b", "k"].includes(type)) return previousPieceSVG(type, color);
    const white = color === "w";
    const fill = white ? "#f4e7c8" : "#343a40";
    const edge = white ? "#796447" : "#090c0f";
    const shade = white ? "#b49a70" : "#858c92";
    const shine = white ? "#fffaf0" : "#b9c0c5";
    let art = "";
    if (type === "n") {
      art = `
        <path d="M19 84 Q20 78 30 76 L70 76 Q80 78 81 84 L76 91 L24 91 Z" fill="${fill}" stroke="${edge}" stroke-width="2.6"/>
        <path d="M29 76 Q34 68 31 60 Q26 52 31 43 Q35 35 46 32 L57 34 Q68 40 69 52 Q67 62 75 76 Z" fill="${fill}" stroke="${edge}" stroke-width="2.8" stroke-linejoin="round"/>
        <path d="M39 43 Q32 35 36 26 L44 20 L47 9 L57 22 Q68 22 75 31 L85 39 Q89 44 83 49 L72 49 Q65 46 59 42 L54 53 L42 53 Z" fill="${fill}" stroke="${edge}" stroke-width="2.8" stroke-linejoin="round"/>
        <path d="M43 23 L41 8 L55 23" fill="${fill}" stroke="${edge}" stroke-width="2.5" stroke-linejoin="round"/>
        <circle cx="73" cy="34" r="2.8" fill="${edge}"/>
        <path d="M79 43 Q84 41 88 44 L83 49" fill="none" stroke="${edge}" stroke-width="2" stroke-linecap="round"/>
        <path d="M38 57 Q48 64 56 59 M42 70 Q55 74 68 69" fill="none" stroke="${shade}" stroke-width="2"/>
        <path d="M47 27 L54 35" fill="none" stroke="${shine}" stroke-width="2.2" stroke-linecap="round"/>
      `;
    } else if (type === "b") {
      art = `
        <path d="M18 84 Q19 78 29 76 L71 76 Q81 78 82 84 L77 91 L23 91 Z" fill="${fill}" stroke="${edge}" stroke-width="2.6"/>
        <path d="M34 77 Q40 69 37 60 Q30 49 36 38 Q41 29 50 25 Q59 29 64 38 Q70 49 63 60 Q60 69 66 77 Z" fill="${fill}" stroke="${edge}" stroke-width="2.8"/>
        <path d="M50 7 Q65 17 65 31 Q64 43 50 50 Q36 43 35 31 Q35 17 50 7 Z" fill="${fill}" stroke="${edge}" stroke-width="2.8"/>
        <path d="M43 15 L57 35" fill="none" stroke="${edge}" stroke-width="4.2" stroke-linecap="round"/>
        <path d="M43 14 L54 29" fill="none" stroke="${shine}" stroke-width="2" stroke-linecap="round"/>
        <path d="M37 55 Q50 63 63 55 M36 69 Q50 75 64 69" fill="none" stroke="${shade}" stroke-width="2"/>
      `;
    } else {
      art = `
        <path d="M18 84 Q19 78 29 76 L71 76 Q81 78 82 84 L77 91 L23 91 Z" fill="${fill}" stroke="${edge}" stroke-width="2.6"/>
        <path d="M34 77 Q40 68 38 59 Q32 49 38 39 Q42 32 50 28 Q58 32 62 39 Q68 49 62 59 Q60 68 66 77 Z" fill="${fill}" stroke="${edge}" stroke-width="2.8"/>
        <path d="M30 31 L34 15 L43 25 L50 9 L57 25 L66 15 L70 31 Q68 37 63 39 L37 39 Q32 37 30 31 Z" fill="${fill}" stroke="${edge}" stroke-width="2.8" stroke-linejoin="round"/>
        <circle cx="34" cy="14" r="4.5" fill="${fill}" stroke="${edge}" stroke-width="2"/>
        <circle cx="50" cy="8" r="5" fill="${fill}" stroke="${edge}" stroke-width="2"/>
        <circle cx="66" cy="14" r="4.5" fill="${fill}" stroke="${edge}" stroke-width="2"/>
        <path d="M39 43 Q50 48 61 43 M38 59 Q50 65 62 59 M37 70 Q50 74 63 70" fill="none" stroke="${shade}" stroke-width="2"/>
        <path d="M42 33 Q50 37 58 33" fill="none" stroke="${shine}" stroke-width="2"/>
      `;
    }
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet"><defs><linearGradient id="piece-${type}-${color}" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="${white ? "#fffdf5" : "#92999e"}"/><stop offset="48%" stop-color="${fill}"/><stop offset="100%" stop-color="${white ? "#a58a60" : "#080a0c"}"/></linearGradient></defs><g fill="url(#piece-${type}-${color})">${art}</g></svg>`;
  };

})();
