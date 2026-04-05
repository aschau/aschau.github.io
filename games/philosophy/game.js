// ============================================
// Examined — Philosophy Alignment Quiz
// ============================================

(function () {
    'use strict';

    // ---- Schools of Philosophy ----
    var SCHOOLS = {
        kantian:        { name: 'Kantian',        philosopher: 'Immanuel Kant',    color: '#7eb8da', emoji: '\u2696\uFE0F' },
        utilitarian:    { name: 'Utilitarian',     philosopher: 'John Stuart Mill', color: '#f0c674', emoji: '\uD83D\uDCCA' },
        virtue:         { name: 'Virtue Ethics',   philosopher: 'Aristotle',        color: '#a8d5a2', emoji: '\uD83C\uDF3F' },
        contractualist: { name: 'Contractualist',  philosopher: 'T.M. Scanlon',     color: '#d4a0d0', emoji: '\uD83E\uDD1D' },
        existentialist: { name: 'Existentialist',  philosopher: 'Jean-Paul Sartre', color: '#e8917a', emoji: '\uD83D\uDD25' }
    };

    var SCHOOL_KEYS = ['kantian', 'utilitarian', 'virtue', 'contractualist', 'existentialist'];

    // ---- Questions ----
    // Each choice awards points to philosophical schools.
    // Scores are [kantian, utilitarian, virtue, contractualist, existentialist]
    var QUESTIONS = [
        {
            label: 'The White Lie',
            scenario: 'Your friend just got a dramatic new haircut and is clearly excited about it. You think it looks terrible. They ask, "What do you think?"',
            a: { text: '"Honestly? I\u2019m not a fan, but it\u2019s your head."', scores: [2, 0, 0, 0, 1] },
            b: { text: '"It looks great on you!" You can always be honest later.', scores: [0, 0, 2, 1, 0] },
            quote: '"Act only according to that maxim whereby you can, at the same time, will that it should become a universal law." \u2014 Kant'
        },
        {
            label: 'The Runaway Car',
            scenario: 'A self-driving car\u2019s brakes fail. It can swerve into a wall, injuring you (the passenger), or stay on course and hit a jaywalker who crossed illegally. You designed the algorithm. What does it do?',
            a: { text: 'Stay on course \u2014 the jaywalker broke the rules and accepted the risk.', scores: [1, 0, 0, 2, 0] },
            b: { text: 'Swerve into the wall \u2014 you can\u2019t program a car to choose who lives.', scores: [0, 2, 1, 0, 0] },
            quote: '"The needs of the many outweigh the needs of the few." \u2014 Spock (channeling Bentham)'
        },
        {
            label: 'The Credit Thief',
            scenario: 'Your coworker just presented your idea in a meeting and got praised by the boss. They glance at you nervously. The room is waiting for the next topic.',
            a: { text: 'Speak up: "Thanks \u2014 I actually proposed that last week. Happy to walk through the details."', scores: [1, 0, 0, 0, 2] },
            b: { text: 'Let it go. The team benefits either way, and you\u2019ll have other chances.', scores: [0, 2, 0, 1, 0] },
            quote: '"Hell is other people." \u2014 Sartre'
        },
        {
            label: 'The Effective Altruist',
            scenario: 'You have $100 to donate. You can fund one local kid\u2019s summer camp (and see them thrive in person), or vaccinate 50 children overseas (but you\u2019ll never meet them).',
            a: { text: 'Vaccinate 50 kids \u2014 the math is overwhelming and lives are lives.', scores: [0, 2, 0, 1, 0] },
            b: { text: 'Fund the local kid \u2014 community bonds and visible impact matter.', scores: [0, 0, 2, 0, 1] },
            quote: '"It is the mark of an educated mind to be able to entertain a thought without accepting it." \u2014 Aristotle'
        },
        {
            label: 'The Wedding Objection',
            scenario: 'Your best friend is about to marry someone you genuinely believe is bad for them. You\u2019ve seen red flags they keep dismissing. The wedding is in two weeks.',
            a: { text: 'Tell them your concerns one last time, clearly and directly. You owe them the truth.', scores: [2, 0, 0, 0, 1] },
            b: { text: 'Support their choice. They\u2019re an adult and this is their life to live.', scores: [0, 0, 1, 2, 0] },
            quote: '"What we owe to each other is not to act on principles that others could reasonably reject." \u2014 Scanlon'
        },
        {
            label: 'The Late Samaritan',
            scenario: 'You\u2019re rushing to an important job interview. An elderly person drops their groceries all over the sidewalk and looks distressed. No one else is stopping.',
            a: { text: 'Stop and help. A person in need right in front of you outweighs a potential opportunity.', scores: [0, 0, 2, 0, 1] },
            b: { text: 'Keep going. You have obligations to the people expecting you, and you can\u2019t save everyone.', scores: [0, 1, 0, 2, 0] },
            quote: '"We are condemned to be free; because once thrown into the world, we are responsible for everything we do." \u2014 Sartre'
        },
        {
            label: 'The Sweatshop Paradox',
            scenario: 'You discover your favorite ethical clothing brand secretly uses sweatshop labor. But the workers say the factory is their best available option and a boycott would cost them their jobs.',
            a: { text: 'Boycott immediately. You can\u2019t reward companies that lie about ethics.', scores: [2, 0, 0, 0, 1] },
            b: { text: 'Keep buying for now. The workers\u2019 livelihoods matter more than your moral purity.', scores: [0, 2, 0, 1, 0] },
            quote: '"Actions are right in proportion as they tend to promote happiness." \u2014 Mill'
        },
        {
            label: 'The Impossible Lifeboat',
            scenario: 'A building is collapsing. You can rush into one of two rooms: one has five strangers, the other has one person you love deeply. You can only reach one room in time.',
            a: { text: 'Save the five strangers. Every life has equal moral weight, including theirs.', scores: [1, 2, 0, 0, 0] },
            b: { text: 'Save your person. Love and loyalty aren\u2019t weaknesses \u2014 they\u2019re what make us human.', scores: [0, 0, 2, 0, 1] },
            quote: '"Excellence is not an act, but a habit." \u2014 Aristotle'
        },
        {
            label: 'The Dinner Party Dilemma',
            scenario: 'At a dinner party, your host proudly serves a dish made with ingredients you have strong ethical objections to (factory farmed, environmentally destructive, etc). Everyone else is eating happily.',
            a: { text: 'Politely decline and explain your reasoning if asked. Your principles aren\u2019t negotiable.', scores: [2, 0, 0, 0, 1] },
            b: { text: 'Eat it. The harm is already done, and respecting your host\u2019s effort is its own kind of ethics.', scores: [0, 0, 1, 2, 0] },
            quote: '"No one can be perfectly free till all are free; no one can be perfectly moral till all are moral." \u2014 Herbert Spencer'
        },
        {
            label: 'The Paycheck Glitch',
            scenario: 'Your company accidentally deposits an extra $500 in your account. You know HR is overwhelmed and probably won\u2019t notice. You could really use the money right now.',
            a: { text: 'Report it immediately. Taking what isn\u2019t yours is wrong, full stop.', scores: [2, 0, 1, 0, 0] },
            b: { text: 'Say nothing. The billion-dollar company won\u2019t miss it and you need groceries.', scores: [0, 1, 0, 0, 2] },
            quote: '"Man is nothing else but what he makes of himself." \u2014 Sartre'
        },
        {
            label: 'The Broken Promise',
            scenario: 'You promised your friend you\u2019d help them move this Saturday. On Friday night, a stranger on your street has a medical emergency and asks you to drive them to the hospital tomorrow morning (they have a non-urgent but painful condition). Ambulances are backed up.',
            a: { text: 'Help the stranger. A medical need, even a non-critical one, trumps moving boxes.', scores: [0, 2, 1, 0, 0] },
            b: { text: 'Keep your promise. Your word to your friend is a bond you chose to make.', scores: [1, 0, 0, 2, 0] },
            quote: '"To be is to be perceived... or to perceive." \u2014 Berkeley (but Scanlon would disagree)'
        },
        {
            label: 'The Whistleblower',
            scenario: 'You discover your company is quietly dumping waste into a river. Reporting it will likely shut down the factory, costing 200 coworkers their jobs in a town with no other employers. Staying silent means the river keeps getting polluted.',
            a: { text: 'Blow the whistle. The environmental damage and dishonesty can\u2019t be justified, no matter the cost.', scores: [2, 0, 0, 0, 1] },
            b: { text: 'Try to fix it internally first. 200 families depend on this \u2014 find a solution that doesn\u2019t destroy them.', scores: [0, 1, 0, 2, 0] },
            quote: '"The greatest happiness of the greatest number is the foundation of morals and legislation." \u2014 Bentham'
        }
    ];

    // ---- Archetypes ----
    // Keyed by "primary-secondary" school combination
    var ARCHETYPES = {
        'kantian-utilitarian':        { name: 'The Dutiful Analyst',       desc: 'You believe in doing the right thing \u2014 and you\u2019ve got the spreadsheet to prove it. Rules matter, but so do results. You\u2019re the person who follows the speed limit AND calculates the optimal route.' },
        'kantian-virtue':             { name: 'The Moral Compass',         desc: 'You\u2019re the friend everyone comes to for advice, because you somehow always know the right thing to do. Kant would be proud. Aristotle would buy you a drink.' },
        'kantian-contractualist':     { name: 'The Rule Architect',        desc: 'You believe society works best when everyone agrees to fair principles and actually follows them. You\u2019re the person who reads the Terms of Service \u2014 and sends feedback.' },
        'kantian-existentialist':     { name: 'The Principled Rebel',      desc: 'You have an unshakable moral code, but you built it yourself. You follow rules because they\u2019re right, not because someone told you to. Kant with a leather jacket.' },
        'utilitarian-kantian':        { name: 'The Principled Calculator', desc: 'You want the best outcome for everyone, but you won\u2019t cross certain lines to get there. You\u2019d save the world, but not by lying. The trolley problem keeps you up at night.' },
        'utilitarian-virtue':         { name: 'The Compassionate Optimizer', desc: 'You genuinely care about people AND you\u2019re good at math. You\u2019d donate to the most effective charity and then volunteer at the local one too. Maximum impact with maximum heart.' },
        'utilitarian-contractualist': { name: 'The Social Engineer',       desc: 'You see society as a system that can be optimized for fairness. You\u2019d redesign the trolley tracks so no one has to choose. Why solve the dilemma when you can eliminate it?' },
        'utilitarian-existentialist': { name: 'The Pragmatic Rebel',       desc: 'You want the best outcome and you\u2019re not precious about how to get there. Rules are tools, not commandments. You\u2019d hack the trolley\u2019s GPS.' },
        'virtue-kantian':             { name: 'The Noble Guardian',        desc: 'You strive to be good in the deepest sense \u2014 not just doing right things, but being a right person. You\u2019re the protagonist of a novel no one has written yet.' },
        'virtue-utilitarian':         { name: 'The Wise Pragmatist',       desc: 'You lead with character but never lose sight of consequences. The kind of person who\u2019d be a great ruler in an Aristotle thought experiment \u2014 wise, measured, and surprisingly effective.' },
        'virtue-contractualist':      { name: 'The Community Builder',     desc: 'You believe good people make good societies, and good societies make good people. You\u2019re the neighbor everyone wishes they had. You probably bring pie.' },
        'virtue-existentialist':      { name: 'The Authentic Soul',        desc: 'You\u2019re not good because society told you to be \u2014 you\u2019re good because you chose to be. Your character is your own project, and you take it seriously. Aristotle meets Camus at a coffee shop.' },
        'contractualist-kantian':     { name: 'The Justice Seeker',        desc: 'Fairness is your north star. You believe in rules, but only rules that no one could reasonably reject. You\u2019d rewrite the social contract and proofread it twice.' },
        'contractualist-utilitarian': { name: 'The Fair Maximizer',        desc: 'You want the best for everyone, but "everyone" actually means everyone \u2014 not just the majority. Scanlon\u2019s favorite student. You\u2019d filibuster the trolley.' },
        'contractualist-virtue':      { name: 'The Fair Mentor',           desc: 'You believe we owe each other not just fairness, but genuine care. You\u2019re the teacher who stays after class, the friend who remembers birthdays. The social contract, but make it warm.' },
        'contractualist-existentialist': { name: 'The Reluctant Lawmaker', desc: 'You see the need for social agreements but chafe against anything that limits freedom. You\u2019d sign the social contract \u2014 in pencil, with amendments attached.' },
        'existentialist-kantian':     { name: 'The Absurd Knight',         desc: 'You live by a strict moral code in a universe you know is meaningless. It\u2019s Sisyphus, but he wrote his own ethics textbook on the way up the hill. Beautifully stubborn.' },
        'existentialist-utilitarian': { name: 'The Free Thinker',          desc: 'You refuse to follow anyone else\u2019s rules, but you still care about making things better. You\u2019re the philosopher who quits academia to start a nonprofit.' },
        'existentialist-virtue':      { name: 'The Authentic Sage',        desc: 'You\u2019ve chosen your own values through radical self-examination, and they happen to be pretty good ones. Sartre and Aristotle\u2019s unlikely friendship, personified.' },
        'existentialist-contractualist': { name: 'The Reluctant Citizen',  desc: 'You value freedom above all, but you grudgingly admit that other people exist and maybe you owe them something. You\u2019d live off the grid \u2014 but you\u2019d still recycle.' }
    };

    // Fallback if primary === secondary somehow
    var FALLBACK_ARCHETYPE = { name: 'The Philosopher', desc: 'You defy categorization. Every school of thought has something to offer you, and you refuse to be pinned down. Socrates would approve \u2014 the only thing you know is that you know nothing.' };

    // ---- State ----
    var scores = { kantian: 0, utilitarian: 0, virtue: 0, contractualist: 0, existentialist: 0 };
    var currentQuestion = 0;
    var answers = [];

    // ---- DOM Elements ----
    var startScreen = document.getElementById('start-screen');
    var questionScreen = document.getElementById('question-screen');
    var resultScreen = document.getElementById('result-screen');
    var startBtn = document.getElementById('start-btn');
    var choiceA = document.getElementById('choice-a');
    var choiceB = document.getElementById('choice-b');
    var retakeBtn = document.getElementById('retake-btn');
    var shareBtn = document.getElementById('share-btn');

    // ---- Screen Management ----
    function showScreen(screen) {
        [startScreen, questionScreen, resultScreen].forEach(function (s) {
            s.classList.remove('active');
        });
        screen.classList.add('active');
    }

    // ---- Game Flow ----
    startBtn.addEventListener('click', function () {
        scores = { kantian: 0, utilitarian: 0, virtue: 0, contractualist: 0, existentialist: 0 };
        currentQuestion = 0;
        answers = [];
        showScreen(questionScreen);
        renderQuestion();
    });

    retakeBtn.addEventListener('click', function () {
        showScreen(startScreen);
    });

    function renderQuestion() {
        var q = QUESTIONS[currentQuestion];
        document.getElementById('progress-fill').style.width = ((currentQuestion / QUESTIONS.length) * 100) + '%';
        document.getElementById('question-count').textContent = (currentQuestion + 1) + ' / ' + QUESTIONS.length;
        document.getElementById('scenario-label').textContent = q.label;
        document.getElementById('scenario-text').textContent = q.scenario;
        document.getElementById('choice-a-text').textContent = q.a.text;
        document.getElementById('choice-b-text').textContent = q.b.text;

        var quoteEl = document.getElementById('philosopher-quote');
        quoteEl.classList.remove('visible');
        quoteEl.textContent = q.quote;

        // Re-trigger animation
        var content = document.getElementById('question-content');
        content.style.animation = 'none';
        content.offsetHeight; // force reflow
        content.style.animation = '';

        choiceA.classList.remove('selected');
        choiceB.classList.remove('selected');
    }

    function handleChoice(choice) {
        var q = QUESTIONS[currentQuestion];
        var chosen = choice === 'a' ? q.a : q.b;

        // Apply scores
        for (var i = 0; i < SCHOOL_KEYS.length; i++) {
            scores[SCHOOL_KEYS[i]] += chosen.scores[i];
        }
        answers.push(choice);

        // Show selected state briefly
        var btn = choice === 'a' ? choiceA : choiceB;
        btn.classList.add('selected');

        // Show philosopher quote
        document.getElementById('philosopher-quote').classList.add('visible');

        // Advance after delay
        setTimeout(function () {
            currentQuestion++;
            if (currentQuestion >= QUESTIONS.length) {
                showResults();
            } else {
                renderQuestion();
            }
        }, 1200);
    }

    choiceA.addEventListener('click', function () { handleChoice('a'); });
    choiceB.addEventListener('click', function () { handleChoice('b'); });

    // ---- Results ----
    function getArchetype() {
        // Sort schools by score descending
        var sorted = SCHOOL_KEYS.slice().sort(function (a, b) {
            return scores[b] - scores[a];
        });

        var primary = sorted[0];
        var secondary = sorted[1];

        // Handle tie for primary — pick by question order bias (first school encountered)
        if (scores[primary] === scores[secondary]) {
            // Keep the natural sort order (alphabetical tiebreak is fine)
        }

        var key = primary + '-' + secondary;
        return ARCHETYPES[key] || FALLBACK_ARCHETYPE;
    }

    function getTopSchools() {
        var sorted = SCHOOL_KEYS.slice().sort(function (a, b) {
            return scores[b] - scores[a];
        });
        return sorted;
    }

    function showResults() {
        showScreen(resultScreen);

        var archetype = getArchetype();
        document.getElementById('archetype-name').textContent = archetype.name;
        document.getElementById('archetype-desc').textContent = archetype.desc;

        // Score breakdown tags
        var sorted = getTopSchools();
        var breakdownEl = document.getElementById('score-breakdown');
        breakdownEl.innerHTML = '';
        for (var i = 0; i < sorted.length; i++) {
            var key = sorted[i];
            var school = SCHOOLS[key];
            var tag = document.createElement('span');
            tag.className = 'score-tag';
            tag.style.background = school.color + '18';
            tag.style.color = school.color;
            tag.innerHTML = '<span class="score-dot" style="background:' + school.color + '"></span>' +
                school.emoji + ' ' + school.name + ': ' + scores[key];
            breakdownEl.appendChild(tag);
        }

        // Draw radar chart
        drawRadarChart();

        // Update progress bar to full
        document.getElementById('progress-fill').style.width = '100%';

        // Save result
        try {
            localStorage.setItem('examined_result', JSON.stringify({
                archetype: archetype.name,
                scores: scores,
                answers: answers,
                date: new Date().toISOString()
            }));
        } catch (e) { /* localStorage may be unavailable */ }
    }

    // ---- Radar Chart ----
    function drawRadarChart() {
        var canvas = document.getElementById('radar-chart');
        var ctx = canvas.getContext('2d');
        var dpr = window.devicePixelRatio || 1;

        canvas.width = 300 * dpr;
        canvas.height = 300 * dpr;
        canvas.style.width = '300px';
        canvas.style.height = '300px';
        ctx.scale(dpr, dpr);

        var cx = 150, cy = 150;
        var maxRadius = 110;
        var sides = 5;
        var angleStep = (Math.PI * 2) / sides;
        var startAngle = -Math.PI / 2; // Start from top

        // Find max score for normalization
        var maxScore = 0;
        for (var i = 0; i < SCHOOL_KEYS.length; i++) {
            if (scores[SCHOOL_KEYS[i]] > maxScore) maxScore = scores[SCHOOL_KEYS[i]];
        }
        if (maxScore === 0) maxScore = 1;

        // Draw grid rings
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
        ctx.lineWidth = 1;
        for (var ring = 1; ring <= 4; ring++) {
            var r = (ring / 4) * maxRadius;
            ctx.beginPath();
            for (var j = 0; j <= sides; j++) {
                var a = startAngle + j * angleStep;
                var x = cx + r * Math.cos(a);
                var y = cy + r * Math.sin(a);
                if (j === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }
            ctx.stroke();
        }

        // Draw axis lines
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
        for (var k = 0; k < sides; k++) {
            var angle = startAngle + k * angleStep;
            ctx.beginPath();
            ctx.moveTo(cx, cy);
            ctx.lineTo(cx + maxRadius * Math.cos(angle), cy + maxRadius * Math.sin(angle));
            ctx.stroke();
        }

        // Draw data polygon
        var schoolOrder = SCHOOL_KEYS;
        ctx.beginPath();
        for (var m = 0; m < sides; m++) {
            var val = scores[schoolOrder[m]] / maxScore;
            var rad = val * maxRadius;
            var ang = startAngle + m * angleStep;
            var px = cx + rad * Math.cos(ang);
            var py = cy + rad * Math.sin(ang);
            if (m === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
        }
        ctx.closePath();

        // Fill
        ctx.fillStyle = 'rgba(139, 124, 247, 0.2)';
        ctx.fill();

        // Stroke
        ctx.strokeStyle = 'rgba(139, 124, 247, 0.8)';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Draw data points and labels
        for (var n = 0; n < sides; n++) {
            var school = SCHOOLS[schoolOrder[n]];
            var sVal = scores[schoolOrder[n]] / maxScore;
            var sRad = sVal * maxRadius;
            var sAng = startAngle + n * angleStep;
            var sx = cx + sRad * Math.cos(sAng);
            var sy = cy + sRad * Math.sin(sAng);

            // Dot
            ctx.beginPath();
            ctx.arc(sx, sy, 4, 0, Math.PI * 2);
            ctx.fillStyle = school.color;
            ctx.fill();

            // Label
            var labelDist = maxRadius + 22;
            var lx = cx + labelDist * Math.cos(sAng);
            var ly = cy + labelDist * Math.sin(sAng);

            ctx.fillStyle = school.color;
            ctx.font = '500 11px Inter, sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';

            // Adjust label position for readability
            if (sAng > Math.PI * 0.1 && sAng < Math.PI * 0.9) ly += 4;
            if (sAng > -Math.PI * 0.9 && sAng < -Math.PI * 0.1) ly -= 4;

            ctx.fillText(school.name, lx, ly);
        }
    }

    // ---- Share ----
    shareBtn.addEventListener('click', function () {
        if (typeof generateShareText === 'function') {
            var archetype = getArchetype();
            var text = generateShareText(archetype.name, scores, SCHOOLS, SCHOOL_KEYS);
            if (navigator.share) {
                navigator.share({ text: text }).catch(function () {
                    copyToClipboard(text);
                });
            } else {
                copyToClipboard(text);
            }
        }
    });

    function copyToClipboard(text) {
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text).then(function () {
                showToast('Copied to clipboard!');
            }).catch(function () {
                fallbackCopy(text);
            });
        } else {
            fallbackCopy(text);
        }
    }

    function fallbackCopy(text) {
        var ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.left = '-9999px';
        document.body.appendChild(ta);
        ta.select();
        try {
            document.execCommand('copy');
            showToast('Copied to clipboard!');
        } catch (e) {
            showToast('Could not copy \u2014 try manually');
        }
        document.body.removeChild(ta);
    }

    function showToast(message) {
        var existing = document.querySelector('.share-toast');
        if (existing) existing.remove();

        var toast = document.createElement('div');
        toast.className = 'share-toast';
        toast.textContent = message;
        document.body.appendChild(toast);

        requestAnimationFrame(function () {
            toast.classList.add('visible');
        });

        setTimeout(function () {
            toast.classList.remove('visible');
            setTimeout(function () { toast.remove(); }, 300);
        }, 2500);
    }

    // Expose for share.js
    window.ExaminedGame = {
        getArchetype: getArchetype,
        getScores: function () { return scores; },
        getSchools: function () { return SCHOOLS; },
        getSchoolKeys: function () { return SCHOOL_KEYS; }
    };

})();
