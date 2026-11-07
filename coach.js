
window.ChessCoach = {
  greeting() {
    return "Satranç koçuna hoş geldin! Güzel bir oyun dilerim.";
  },

  getMoveCount(game) {
    return game.history().length;
  },

  getTurn(game) {
    return game.turn() === "w" ? "Beyaz" : "Siyah";
  },

  getAdvice(game) {
    if (game.in_checkmate()) {
      return "Şah mat! Oyun sona erdi.";
    }

    if (game.in_draw()) {
      return "Oyun berabere.";
    }

    if (game.in_check()) {
      return "Dikkat! Şahın tehdit altında.";
    }

    const moves = game.moves({ verbose: true });

    if (moves.length === 0) {
      return "Yasal hamle bulunamadı.";
    }

    return "Önerilen hamle: " +
      moves[0].from + " → " + moves[0].to;
  }
};
