// ============================================
// Examined — Share Results
// ============================================

function generateShareText(archetypeName, primaryProfile, scores, schools, schoolKeys) {
    // Sort schools by score descending
    var sorted = schoolKeys.slice().sort(function (a, b) {
        return scores[b] - scores[a];
    });

    var totalScore = 0;
    for (var i = 0; i < schoolKeys.length; i++) totalScore += scores[schoolKeys[i]];
    if (totalScore === 0) totalScore = 1;

    var lines = [
        primaryProfile.icon + ' I\u2019m a ' + primaryProfile.title + '! (' + archetypeName + ')',
        primaryProfile.motto,
        ''
    ];

    // Show alignment percentages
    for (var j = 0; j < sorted.length; j++) {
        var key = sorted[j];
        var pct = Math.round((scores[key] / totalScore) * 100);
        var bar = '';
        var barLen = Math.round(pct / 10);
        for (var k = 0; k < barLen; k++) bar += '\u2588';
        for (var m = barLen; m < 10; m++) bar += '\u2591';
        lines.push(schools[key].name + ' ' + bar + ' ' + pct + '%');
    }

    lines.push('');
    lines.push('What\u2019s your moral philosophy?');
    lines.push('https://www.raggedydoc.com/games/philosophy/');

    return lines.join('\n');
}
