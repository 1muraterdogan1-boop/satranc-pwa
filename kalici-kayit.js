
/*
 * Premium Satranç - kalıcı oyun kaydı
 * Hamle geçmişini, seviyeyi, tahta yönünü ve analiz özetini saklar.
 */
(function () {
  "use strict";

  if (typeof game === "undefined" || typeof Chess !== "function") {
    console.warn("Kalıcı kayıt: Satranç oyunu yüklenemedi.");
    return;
  }

  const STORAGE_KEY = "premium-satranc-kayit-v1";
  let restoring = false;
  let saveQueued = false;

  function saveGame() {
    if (restoring || typeof game === "undefined" || !game) return;

    try {
      const level = document.getElementById("level");

      const data = {
        version: 1,
        history: game.history(),
        level: level ? level.value : "3",
        flipped: Boolean(flipped),
        moveAnalysis: Array.isArray(moveAnalysis) ? moveAnalysis : [],
        savedAt: Date.now()
      };

      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (error) {
      console.warn("Oyun kaydedilemedi:", error);
    }
  }

  function queueSave() {
    if (saveQueued || restoring) return;
    saveQueued = true;

    Promise.resolve().then(function () {
      saveQueued = false;
      saveGame();
    });
  }

  function clearSavedGame() {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (error) {
      console.warn("Eski kayıt temizlenemedi:", error);
    }
  }

  function loadSavedGame() {
    let data;

    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return false;
      data = JSON.parse(raw);
    } catch (error) {
      console.warn("Kayıt okunamadı:", error);
      clearSavedGame();
      return false;
    }

    if (!data || data.version !== 1 || !Array.isArray(data.history)) {
      clearSavedGame();
      return false;
    }

    restoring = true;

    try {
      const restoredGame = new Chess();

      for (const san of data.history) {
        if (!restoredGame.move(san)) {
          throw new Error("Kayıtlı hamlelerden biri geçersiz.");
        }
      }

      game = restoredGame;
      selected = null;
      legal = [];
      thinking = false;
      analysisBusy = false;
      hintMove = null;
      lastMove = null;

      const verbose = restoredGame.history({ verbose: true });
      if (verbose.length) {
        const last = verbose[verbose.length - 1];
        lastMove = { from: last.from, to: last.to };
      }

      moveAnalysis = Array.isArray(data.moveAnalysis)
        ? data.moveAnalysis
        : [];

      capturedWhite = [];
      capturedBlack = [];

      if (typeof data.flipped === "boolean") {
        flipped = data.flipped;
      }

      const level = document.getElementById("level");
      if (level && ["1", "2", "3", "4", "5"].includes(String(data.level))) {
        level.value = String(data.level);
      }

      const report = document.getElementById("report");
      if (report) report.style.display = "none";

      if (typeof rebuildCaptured === "function") rebuildCaptured();
      if (typeof draw === "function") draw();

      const status = document.getElementById("status");
      if (status && !restoredGame.game_over()) {
        status.textContent = "Kaldığın oyuna devam edebilirsin.";
      }

      if (typeof coachMessage === "function") {
        coachMessage(
          "Önceki oyunun geri yüklendi. Kaldığın yerden devam edebilirsin."
        );
      }

      return true;
    } catch (error) {
      console.warn("Kayıt geri yüklenemedi:", error);
      clearSavedGame();
      return false;
    } finally {
      restoring = false;
    }
  }

  /* Hamle ve tahta güncellemelerinden sonra otomatik kaydet. */
  if (typeof window.draw === "function") {
    const originalDraw = window.draw;

    window.draw = function () {
      const result = originalDraw.apply(this, arguments);
      queueSave();
      return result;
    };
  }

  /* Yeni oyun başlatılınca önceki oyunun kaydını temizle. */
  if (typeof window.newGame === "function") {
    const originalNewGame = window.newGame;

    window.newGame = function () {
      clearSavedGame();
      const result = originalNewGame.apply(this, arguments);
      queueSave();
      return result;
    };
  }

  window.addEventListener("pagehide", saveGame);

  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "hidden") saveGame();
  });

  const restored = loadSavedGame();

  if (!restored) {
    saveGame();
  } else if (
    game &&
    !game.game_over() &&
    game.turn() === "b" &&
    typeof window.computerMove === "function"
  ) {
    thinking = true;
    window.computerMove();
  }

  console.log("Kalıcı oyun kaydı etkin.");
})();
