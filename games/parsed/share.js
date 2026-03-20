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

    // Extract leading emoji from shareResult (e.g. "🏅 Points: 40!" → "🏅")
    var themeEmoji = '';
    if (shareResult) {
        var emojiMatch = shareResult.match(/^(\p{Emoji_Presentation}|\p{Emoji}\uFE0F?)/u);
        if (emojiMatch) themeEmoji = emojiMatch[0] + ' ';
    }

    var scoreLine = themeEmoji + scoreLabel + ' Swaps (' + swaps + '/' + par + ')';

    var lines = [header, scoreLine];

    if (streak > 1) {
        lines.push('\uD83D\uDD25 ' + streak + ' day streak');
    }

    lines.push('https://aschau.github.io/games/parsed');

    return lines.join('\n');
}
