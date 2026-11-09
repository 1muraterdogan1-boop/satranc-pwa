/* Premium Satranç - güvenli ek özellik paketi */
(function () {
  if (typeof Chess === "undefined" || typeof game === "undefined") return;

  const style = document.createElement("style");
  style.textContent = `
    .piece:not(.pawn) svg{width:94%;height:94%}
    #extraControls{display:flex;gap:7px;justify-content:center;flex-wrap:wrap;margin:10px auto}
    #extraControls select{max-width:48%;min-width:135px}
    #gameClock{display:flex;justify-content:center;gap:18px;margin:8px auto;color:#f0d59a;font-size:22px;font-weight:bold}
    #gameClock span{padding:8px 14px;background:#26383c;border:1px solid #8f7549;border-radius:9px}
  `;
  document.head.appendChild(style);

  const controls = document.createElement("div");
  controls.id = "extraControls";
  controls.innerHTML = `
    <select id="playMode" aria-label="Oyun modu">
      <option value="computer">Bilgisayara karşı</option>
      <option value="local">İki kişilik</option>
      <option value="training">Antrenman modu</option>
    </select>
    <select id="playTime" aria-label="Oyun süresi">
      <option value="0">Süresiz</option><option value="180">3 dakika</option>
      <option value="300" selected>5 dakika</option><option value="600">10 dakika</option>
      <option value="900">15 dakika</option><option value="1800">30 dakika</option>
    </select>`;
  const status = document.getElementById("status");
  status.parentNode.insertBefore(controls, status);

  const clock = document.createElement("div");
  clock.id = "gameClock";
  clock.innerHTML = '<span id="clockWhite">05:00</span><span id="clockBlack">05:00</span>';
  status.parentNode.insertBefore(clock, status.nextSibling);

  let mode = "computer", initial = 300, left = { w: 300, b: 300 };
  let started = false, expired = false, tick = null;
  const originalTap = window.tapSquare;
  const originalComputerMove = window.computerMove;

  function showClock() {
    const fmt = n => String(Math.floor(Math.max(0,n)/60)).padStart(2,"0")+":"+String(Math.max(0,n)%60).padStart(2,"0");
    document.getElementById("clockWhite").textContent = fmt(left.w);
    document.getElementById("clockBlack").textContent = fmt(left.b);
    document.getElementById("clockWhite").style.opacity = game && game.turn()==="w" ? "1" : ".6";
    document.getElementById("clockBlack").style.opacity = game && game.turn()==="b" ? "1" : ".6";
    clock.style.display = initial ? "flex" : "none";
  }
  function resetClock() {
    initial = Number(document.getElementById("playTime").value);
    left = { w: initial, b: initial }; started = false; expired = false;
    if (tick) clearInterval(tick);
    showClock();
    tick = setInterval(() => {
      if (!initial || !started || expired || !game || game.game_over()) return;
      const side = game.turn();
      left[side] = Math.max(0, left[side] - 1);
      showClock();
      if (left[side] === 0) {
        expired = true;
        document.getElementById("status").textContent =
          (side === "w" ? "Beyaz" : "Siyah") + " süresi doldu. " +
          (side === "w" ? "Siyah" : "Beyaz") + " kazandı.";
      }
    }, 1000);
  }

  document.getElementById("playMode").addEventListener("change", e => {
    mode = e.target.value;
    if (mode === "training") {
      const h = document.getElementById("hintButton");
      if (h) h.textContent = "🎓 Antrenman ipucu";
    } else {
      const h = document.getElementById("hintButton");
      if (h) h.textContent = "💡 Daha iyi hamle öner";
    }
    if (typeof newGame === "function") newGame();
  });
  document.getElementById("playTime").addEventListener("change", () => {
    if (typeof newGame === "function") newGame();
  });

  const oldNewGame = window.newGame;
  window.newGame = function () {
    const result = oldNewGame.apply(this, arguments);
    resetClock();
    return result;
  };

  window.tapSquare = function (name) {
    if (!game || expired || thinking || analysisBusy || game.game_over()) return;
    if (mode !== "local" && game.turn() === "b") return;
    if (selected) {
      const m = legal.find(x => x.to === name);
      if (m) {
        let promotion = "q";
        if (m.promotion) {
          let a = prompt("Piyon hangi taşa dönüşsün? q=Vezir, r=Kale, b=Fil, n=At", "q");
          a = (a || "q").toLowerCase();
          promotion = ["q","r","b","n"].includes(a) ? a : "q";
        }
        hintMove = null;
        started = true;
        window.playMove({from:selected,to:name,promotion});
        showClock();
        return;
      }
    }
    const p = game.get(name);
    if (p && p.color === game.turn()) {
      selected = name;
      legal = game.moves({square:name,verbose:true});
    } else {
      selected = null; legal = [];
    }
    draw();
  };

  window.computerMove = function () {
    if (mode === "local") { thinking = false; draw(); return; }
    return originalComputerMove.apply(this, arguments);
  };

  const oldUpdateStatus = window.updateStatus;
  window.updateStatus = function () {
    oldUpdateStatus.apply(this, arguments);
    if (expired) document.getElementById("status").textContent = "Süre doldu.";
  };

  resetClock();
  showClock();
})();
