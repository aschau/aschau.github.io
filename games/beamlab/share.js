// ============================================
// Beamlab — Share Results
// ============================================

function generateShareText(puzzleNumber, piecesUsed, par, streak, gotGem, totalGems, username) {
    var diff = piecesUsed - par;
    var scoreLabel;
    if (diff < 0) scoreLabel = 'Under Par!';
    else if (diff === 0) scoreLabel = 'Par';
    else if (diff === 1) scoreLabel = 'Bogey';
    else if (diff === 2) scoreLabel = 'Double Bogey';
    else scoreLabel = '+' + diff;

    var header;
    if (username) {
        header = username + "'s Beamlab #" + puzzleNumber + ' \uD83D\uDD35' + (gotGem ? ' \uD83D\uDC8E' : '');
    } else {
        header = 'Beamlab #' + puzzleNumber + ' \uD83D\uDD35' + (gotGem ? ' \uD83D\uDC8E' : '');
    }

    var lines = [
        header,
        scoreLabel + ' (' + piecesUsed + ' pieces)',
    ];

    if (streak > 1) {
        lines.push('\uD83D\uDD25 ' + streak + ' day streak');
    }

    if (totalGems > 0) {
        lines.push('\uD83D\uDC8E ' + totalGems + ' gems collected');
    }

    lines.push('https://aschau.github.io/games/beamlab');

    return lines.join('\n');
}
