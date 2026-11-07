
"use strict";

const ChessCoach = (() => {
  const values = {
    p: 100,
    n: 320,
    b: 330,
    r: 500,
    q: 900,
    k: 20000
  };

  function evaluate(game) {
    const board = game.board();
    let score = 0;

    board.forEach(row => {
      row.forEach(piece => {
        if (!piece) return;

        const value = values[piece.type] || 0;
        score += piece.color === "w" ? value : -value;
      });
    });

    return score;
  }

  function getAdvice(game) {
    if (game.isCheckmate()) {
      return "Şah mat! Oyun sona erdi.";
    }

    if (game.isDraw()) {
      return "Oyun berabere sonuçlandı.";
    }

    if (game.isCheck()) {
      return "Dikkat! Şahın tehdit altında. Öncelikle şahını güvene almalısın.";
    }

    const moves = game.moves({ verbose: true });

    if (!moves.length) {
      return "Yasal hamle kalmadı.";
    }

    const captures = moves.filter(move => move.captured);
    const promotions = moves.filter(move => move.promotion);

    if (promotions.length) {
      return "Piyonlarından biri terfi edebilir. Terfi fırsatını değerlendir!";
    }

    if (captures.length) {
      return "Taş alma fırsatın var. Ancak karşı tarafın cevabını da hesapla.";
    }

    return "Taşlarını geliştir, merkezin kontrolünü koru ve şah güvenliğine dikkat et.";
  }

  function getReport(game) {
    const history = game.history();
    const score = evaluate(game);

    return {
      totalMoves: history.length,
      materialBalance: score,
      advice: getAdvice(game),
      result: game.isCheckmate()
        ? "Şah mat"
        : game.isDraw()
          ? "Beraberlik"
          : "Oyun devam ediyor"
    };
  }

  return {
    evaluate,
    getAdvice,
    getReport
  };
})();

// Koçun tavsiyesini ekranda göster.
function coachAdvice() {
  $("coachMessage").textContent =
    ChessCoach.getAdvice(game);
}

// Oyun raporunu güncelle.
function coachReport() {
  const report = ChessCoach.getReport(game);

  $("gameReport").textContent =
    "Durum: " + report.result +
    " | Toplam yarım hamle: " + report.totalMoves +
    " | Materyal dengesi: " + report.materialBalance;
}
