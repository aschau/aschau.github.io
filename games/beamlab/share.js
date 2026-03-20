// ============================================
// Beamlab — Share Results
// ============================================

function generateShareText(puzzleNumber, piecesUsed, par, streak, gotGem, totalGems, username, puzzleInfo) {
    var diff = piecesUsed - par;
    var scoreLabel;
    if (diff <= -3) scoreLabel = 'Brilliant!';
    else if (diff === -2) scoreLabel = 'Focused!';
    else if (diff === -1) scoreLabel = 'Precise!';
    else if (diff === 0) scoreLabel = 'Aligned';
    else if (diff === 1) scoreLabel = 'Scattered';
    else scoreLabel = 'Refracted (+' + diff + ')';

    // Header with name
    var header;
    if (username) {
        header = username + "'s Beamlab #" + puzzleNumber + ' \u26A1';
    } else {
        header = 'Beamlab #' + puzzleNumber + ' \u26A1';
    }

    // Score line with gem
    var scoreLine = scoreLabel + ' (' + piecesUsed + '/' + par + ')' + (gotGem ? ' \uD83D\uDC8E' : '');

    // Puzzle preview line (what they're up against — spoiler-free)
    var previewParts = [];
    if (puzzleInfo) {
        if (puzzleInfo.fixed > 0) previewParts.push('\uD83D\uDD12 ' + puzzleInfo.fixed + ' fixed');
        if (puzzleInfo.targets > 1) previewParts.push('\uD83C\uDFAF ' + puzzleInfo.targets + ' targets');
        if (puzzleInfo.walls > 0) previewParts.push('\uD83E\uDDF1 ' + puzzleInfo.walls + ' walls');
    }

    var lines = [header, scoreLine];

    if (previewParts.length > 0) {
        lines.push(previewParts.join(' \u00B7 '));
    }

    if (streak > 1) {
        lines.push('\uD83D\uDD25 ' + streak + ' day streak');
    }

    lines.push('https://aschau.github.io/games/beamlab');

    return lines.join('\n');
}
