// ============================================
// Examined — Share Results
// ============================================

function generateShareText(archetypeName, scores, schools, schoolKeys) {
    // Sort schools by score descending
    var sorted = schoolKeys.slice().sort(function (a, b) {
        return scores[b] - scores[a];
    });

    // Build emoji bar from top 3 schools
    var emojis = '';
    for (var i = 0; i < 3 && i < sorted.length; i++) {
        emojis += schools[sorted[i]].emoji;
    }

    var lines = [
        emojis + ' I got "' + archetypeName + '" on Examined!',
        '',
        'Top schools:'
    ];

    // Show score distribution
    for (var j = 0; j < sorted.length; j++) {
        var key = sorted[j];
        var bar = '';
        for (var k = 0; k < scores[key]; k++) bar += '\u2588';
        if (bar.length > 0) {
            lines.push('  ' + schools[key].name + ': ' + bar + ' ' + scores[key]);
        }
    }

    lines.push('');
    lines.push('What\u2019s your moral philosophy?');
    lines.push('https://www.raggedydoc.com/games/philosophy/');

    return lines.join('\n');
}
