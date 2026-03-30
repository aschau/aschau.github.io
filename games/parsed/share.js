// ============================================
// Parsed — Share Results
// Themed execution results, not just scores
// ============================================

function generateShareText(puzzleNumber, swaps, par, shareResult, streak, username, isArchive) {
    var diff = swaps - par;
    var scoreLabel;
    if (diff <= -3) scoreLabel = 'Genius!';
    else if (diff === -2) scoreLabel = 'Hacker!';
    else if (diff === -1) scoreLabel = 'Optimized!';
    else if (diff === 0) scoreLabel = 'Compiled';
    else if (diff === 1) scoreLabel = 'Verbose';
    else scoreLabel = 'Spaghetti (+' + diff + ')';

    var puzzleLabel = 'Parsed #' + puzzleNumber + (isArchive ? ' (Archive)' : '');
    var header;
    if (username) {
        header = username + "'s " + puzzleLabel + ' \uD83D\uDFE2';
    } else {
        header = puzzleLabel + ' \uD83D\uDFE2';
    }

    // Extract leading emoji from shareResult (e.g. "🏅 Points: 40!" → "🏅")
    var themeEmoji = '';
    if (shareResult) {
        var emojiMatch = shareResult.match(/^(\p{Emoji_Presentation}|\p{Emoji}\uFE0F?)/u);
        if (emojiMatch) themeEmoji = emojiMatch[0] + ' ';
    }

    var scoreLine = themeEmoji + scoreLabel + ' Swaps (' + swaps + '/' + par + ')';

    var lines = [header, scoreLine];

    if (!isArchive && streak > 1) {
        lines.push('\uD83D\uDD25 ' + streak + ' day streak');
    }

    var url = 'https://raggedydoc.com/games/parsed';
    if (isArchive) url += '?day=' + puzzleNumber;
    lines.push(url);

    return lines.join('\n');
}
