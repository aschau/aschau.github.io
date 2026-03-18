// ============================================
// Parsed — Share Results
// Themed execution results, not just scores
// ============================================

function generateShareText(puzzleNumber, swaps, shareResult, streak, username) {
    var header;
    if (username) {
        header = username + "'s Parsed #" + puzzleNumber + ' \uD83D\uDFE2';
    } else {
        header = 'Parsed #' + puzzleNumber + ' \uD83D\uDFE2';
    }

    var lines = [header, ''];

    if (shareResult) {
        lines.push(shareResult);
        lines.push('');
    }

    lines.push('Solved in ' + swaps + ' swap' + (swaps !== 1 ? 's' : ''));

    if (streak > 1) {
        lines.push('\uD83D\uDD25 ' + streak + ' day streak');
    }

    lines.push('https://aschau.github.io/games/parsed');

    return lines.join('\n');
}
