// ============================================
// Parsed — Share Results
// Themed execution results, not just scores
// ============================================

function generateShareText(puzzleNumber, swaps, par, shareResult, streak, username) {
    var diff = swaps - par;
    var scoreLabel;
    if (diff <= -3) scoreLabel = 'Genius!';
    else if (diff === -2) scoreLabel = 'Hacker!';
    else if (diff === -1) scoreLabel = 'Optimized!';
    else if (diff === 0) scoreLabel = 'Compiled';
    else if (diff === 1) scoreLabel = 'Verbose';
    else scoreLabel = 'Spaghetti (+' + diff + ')';

    var header;
    if (username) {
        header = username + "'s Parsed #" + puzzleNumber + ' \uD83D\uDFE2';
    } else {
        header = 'Parsed #' + puzzleNumber + ' \uD83D\uDFE2';
    }

    var scoreLine = scoreLabel + ' (' + swaps + '/' + par + ')';

    var lines = [header, scoreLine];

    if (shareResult) {
        lines.push(shareResult);
    }

    lines.push(swaps + ' swap' + (swaps !== 1 ? 's' : ''));

    if (streak > 1) {
        lines.push('\uD83D\uDD25 ' + streak + ' day streak');
    }

    lines.push('https://aschau.github.io/games/parsed');

    return lines.join('\n');
}
