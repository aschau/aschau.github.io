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
            a: { text: '"Honestly? I\u2019m not a fan, but it\u2019s your head."', scores: [2, 0, 0, 0, 1], react: 'Brutal. Kant is slow-clapping somewhere.' },
            b: { text: '"It looks great on you!" You can always be honest later.', scores: [0, 0, 2, 1, 0], react: 'A kind lie. Aristotle would call that social grace.' },
            quote: '"Act only according to that maxim whereby you can, at the same time, will that it should become a universal law." \u2014 Kant'
        },
        {
            label: 'The Runaway Car',
            scenario: 'A self-driving car\u2019s brakes fail. It can swerve into a wall, injuring you (the passenger), or stay on course and hit a jaywalker who crossed illegally. You designed the algorithm. What does it do?',
            a: { text: 'Stay on course \u2014 the jaywalker broke the rules and accepted the risk.', scores: [1, 0, 0, 2, 0], react: 'Cold logic. The jaywalker had a contract with the crosswalk.' },
            b: { text: 'Swerve into the wall \u2014 you can\u2019t program a car to choose who lives.', scores: [0, 2, 1, 0, 0], react: 'Self-sacrifice by algorithm. Very noble of your code.' },
            quote: '"The needs of the many outweigh the needs of the few." \u2014 Spock (channeling Bentham)',
        },
        {
            label: 'The Credit Thief',
            scenario: 'Your coworker just presented your idea in a meeting and got praised by the boss. They glance at you nervously. The room is waiting for the next topic.',
            a: { text: 'Speak up: "Thanks \u2014 I actually proposed that last week. Happy to walk through the details."', scores: [1, 0, 0, 0, 2], react: 'Authenticity over diplomacy. Sartre would buy you a coffee.' },
            b: { text: 'Let it go. The team benefits either way, and you\u2019ll have other chances.', scores: [0, 2, 0, 1, 0], react: 'The greater good, one swallowed ego at a time.' },
            quote: '"Hell is other people." \u2014 Sartre',
        },
        {
            label: 'The Effective Altruist',
            scenario: 'You have $100 to donate. You can fund one local kid\u2019s summer camp (and see them thrive in person), or vaccinate 50 children overseas (but you\u2019ll never meet them).',
            a: { text: 'Vaccinate 50 kids \u2014 the math is overwhelming and lives are lives.', scores: [0, 2, 0, 1, 0], react: '50 > 1. Mill just shed a single, efficient tear.' },
            b: { text: 'Fund the local kid \u2014 community bonds and visible impact matter.', scores: [0, 0, 2, 0, 1], react: 'You chose the face over the number. That\u2019s very human.' },
            quote: '"It is not enough to do good; one must do it in the right way." \u2014 John Morley (a question Mill spent his career on)',
        },
        {
            label: 'The Wedding Objection',
            scenario: 'Your best friend is about to marry someone you genuinely believe is bad for them. You\u2019ve seen red flags they keep dismissing. The wedding is in two weeks.',
            a: { text: 'Tell them your concerns one last time, clearly and directly. You owe them the truth.', scores: [2, 0, 0, 0, 1], react: 'The hardest conversations are the ones that matter most.' },
            b: { text: 'Support their choice. They\u2019re an adult and this is their life to live.', scores: [0, 0, 1, 2, 0], react: 'Respecting autonomy, even when it hurts to watch.' },
            quote: '"What we owe to each other is not to act on principles that others could reasonably reject." \u2014 Scanlon',
        },
        {
            label: 'The Late Samaritan',
            scenario: 'You\u2019re rushing to an important job interview. An elderly person drops their groceries all over the sidewalk and looks distressed. No one else is stopping.',
            a: { text: 'Stop and help. A person in need right in front of you outweighs a potential opportunity.', scores: [0, 0, 2, 0, 1], react: 'Character is what you do when no one\u2019s timing you.' },
            b: { text: 'Keep going. You have obligations to the people expecting you, and you can\u2019t save everyone.', scores: [0, 1, 0, 2, 0], react: 'You kept a commitment. Scanlon respects the hustle.' },
            quote: '"We are condemned to be free; because once thrown into the world, we are responsible for everything we do." \u2014 Sartre',
        },
        {
            label: 'The Sweatshop Paradox',
            scenario: 'You discover your favorite ethical clothing brand secretly uses sweatshop labor. But the workers say the factory is their best available option and a boycott would cost them their jobs.',
            a: { text: 'Boycott immediately. You can\u2019t reward companies that lie about ethics.', scores: [2, 0, 0, 0, 1], react: 'Principles over pragmatism. Your closet just got a lot emptier.' },
            b: { text: 'Keep buying for now. The workers\u2019 livelihoods matter more than your moral purity.', scores: [0, 2, 0, 1, 0], react: 'Messy but compassionate. Mill would approve the trade-off.' },
            quote: '"Actions are right in proportion as they tend to promote happiness." \u2014 Mill',
        },
        {
            label: 'The Impossible Lifeboat',
            scenario: 'A building is collapsing. You can rush into one of two rooms: one has five strangers, the other has one person you love deeply. You can only reach one room in time.',
            a: { text: 'Save the five strangers. Every life has equal moral weight, including theirs.', scores: [1, 2, 0, 0, 0], react: 'The math checks out. Your heart doesn\u2019t.' },
            b: { text: 'Save your person. Love and loyalty aren\u2019t weaknesses \u2014 they\u2019re what make us human.', scores: [0, 0, 2, 0, 1], react: 'You chose love over logic. Aristotle is weeping proudly.' },
            quote: '"A friend is a second self." \u2014 Aristotle (so what happens when the numbers disagree?)',
        },
        {
            label: 'The Dinner Party Dilemma',
            scenario: 'At a dinner party, your host proudly serves a dish made with ingredients you have strong ethical objections to (factory farmed, environmentally destructive, etc). Everyone else is eating happily.',
            a: { text: 'Politely decline and explain your reasoning if asked. Your principles aren\u2019t negotiable.', scores: [2, 0, 0, 0, 1], react: 'You\u2019d rather go hungry than go along. Respect.' },
            b: { text: 'Eat it. The harm is already done, and respecting your host\u2019s effort is its own kind of ethics.', scores: [0, 0, 1, 2, 0], react: 'Social harmony as its own moral act. Pass the salt.' },
            quote: '"Two things fill the mind with ever new admiration: the starry heavens above me and the moral law within me." \u2014 Kant (who never ate anything he wasn\u2019t sure about)',
        },
        {
            label: 'The Paycheck Glitch',
            scenario: 'Your company accidentally deposits an extra $500 in your account. You know HR is overwhelmed and probably won\u2019t notice. You could really use the money right now.',
            a: { text: 'Report it immediately. Taking what isn\u2019t yours is wrong, full stop.', scores: [2, 0, 1, 0, 0], react: 'You\u2019d return a penny. Kant\u2019s favorite employee.' },
            b: { text: 'Say nothing. The billion-dollar company won\u2019t miss it and you need groceries.', scores: [0, 1, 0, 0, 2], react: 'Robin Hood energy. Sartre says you own this choice.' },
            quote: '"Property is theft." \u2014 Proudhon (but Kant would say keeping it is theft too)',
        },
        {
            label: 'The Broken Promise',
            scenario: 'You promised your friend you\u2019d help them move this Saturday. On Friday night, a stranger on your street has a medical emergency and asks you to drive them to the hospital tomorrow morning (they have a non-urgent but painful condition). Ambulances are backed up.',
            a: { text: 'Help the stranger. A medical need, even a non-critical one, trumps moving boxes.', scores: [0, 2, 1, 0, 0], react: 'Suffering outranks schedules. Your friend will understand.' },
            b: { text: 'Keep your promise. Your word to your friend is a bond you chose to make.', scores: [1, 0, 0, 2, 0], react: 'A promise is a promise. Scanlon wrote a whole book about this.' },
            quote: '"The promise given was a necessity of the past; the word broken is a necessity of the present." \u2014 Machiavelli (Scanlon would not approve)',
        },
        {
            label: 'The Whistleblower',
            scenario: 'You discover your company is quietly dumping waste into a river. Reporting it will likely shut down the factory, costing 200 coworkers their jobs in a town with no other employers. Staying silent means the river keeps getting polluted.',
            a: { text: 'Blow the whistle. The environmental damage and dishonesty can\u2019t be justified, no matter the cost.', scores: [2, 0, 0, 0, 1], react: 'Truth over comfort. You just became the most principled unemployed person in town.' },
            b: { text: 'Try to fix it internally first. 200 families depend on this \u2014 find a solution that doesn\u2019t destroy them.', scores: [0, 1, 0, 2, 0], react: 'Pragmatic justice. You\u2019re playing the long game for everyone.' },
            quote: '"The greatest happiness of the greatest number is the foundation of morals and legislation." \u2014 Bentham',
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

    // ---- Philosopher Profiles (for ID card) ----
    var PROFILES = {
        kantian: {
            title: 'Kantian',
            philosopher: 'Immanuel Kant',
            icon: '\u2696\uFE0F',
            motto: '"Do what is right, though the world may perish."',
            strengths: [
                'Unshakeable moral backbone',
                'Treats everyone with equal respect',
                'Will never lie to you (even when you want them to)'
            ],
            weaknesses: [
                'Overthinks ordering at restaurants',
                'Would let the trolley hit 5 people on principle',
                'Judges you silently for jaywalking'
            ],
            catchphrases: [
                '"I would rather be right than happy \u2014 and I\u2019m always right"',
                '"I don\u2019t make the rules \u2014 well, actually, I do"'
            ],
            peerReviews: [
                { text: 'Absolutely insufferable at parties, but I\u2019d trust them with my life.', author: 'Mill' },
                { text: 'At least they\u2019re consistent. I\u2019ll give them that.', author: 'Sartre' }
            ],
            hiddenTalent: 'Can turn any casual conversation into a moral philosophy lecture',
            scenarios: [
                { label: 'Ordering coffee', text: 'Orders the same thing every time. Has calculated the most ethically sourced option and will not deviate.' },
                { label: 'At a party', text: 'Standing in the corner, quietly judging everyone who double-dipped. Leaves at exactly the time they said they would.' },
                { label: 'In an argument', text: 'Won\u2019t raise their voice but will calmly explain why you\u2019re wrong using a framework you can\u2019t argue with.' }
            ],
            compatibility: { best: 'virtue', worst: 'existentialist' }
        },
        utilitarian: {
            title: 'Utilitarian',
            philosopher: 'John Stuart Mill',
            icon: '\uD83D\uDCCA',
            motto: '"The greatest happiness of the greatest number."',
            strengths: [
                'Always sees the big picture',
                'Genuinely wants the best for everyone',
                'Has a spreadsheet for everything'
            ],
            weaknesses: [
                'Will sacrifice your birthday for the "greater good"',
                'Treats friendships like cost-benefit analyses',
                'Gets paralyzed by the trolley problem'
            ],
            catchphrases: [
                '"But what maximizes well-being?"',
                '"I ran the numbers and your feelings are suboptimal"'
            ],
            peerReviews: [
                { text: 'Efficient but cold. Would not invite to game night.', author: 'Aristotle' },
                { text: 'They\u2019d sell me out if the math checked out.', author: 'Scanlon' }
            ],
            hiddenTalent: 'Can calculate the optimal tip percentage for any group dinner in 3 seconds',
            scenarios: [
                { label: 'Ordering coffee', text: 'Calculates caffeine-to-dollar ratio. Tips 20% because studies show it maximizes barista happiness per dollar.' },
                { label: 'At a party', text: 'Reorganized the snack table for optimal flow. Suggested a better playlist based on aggregate Spotify data.' },
                { label: 'In an argument', text: 'Pulls up a study on their phone mid-sentence. "I\u2019m not saying you\u2019re wrong, I\u2019m saying the data is."' }
            ],
            compatibility: { best: 'contractualist', worst: 'existentialist' }
        },
        virtue: {
            title: 'Virtue Ethicist',
            philosopher: 'Aristotle',
            icon: '\uD83C\uDF3F',
            motto: '"We are what we repeatedly do."',
            strengths: [
                'The friend everyone goes to for advice',
                'Genuinely good person, not just rule-following',
                'Brings homemade food to every gathering'
            ],
            weaknesses: [
                'A little smug about their "character development"',
                'Takes forever to decide ("What would a virtuous person do?")',
                'Secretly judgmental'
            ],
            catchphrases: [
                '"It\u2019s not about what you do, it\u2019s about who you are"',
                '"I\u2019m not judging, I\u2019m... observing"'
            ],
            peerReviews: [
                { text: 'Too focused on vibes, not enough on policy.', author: 'Scanlon' },
                { text: 'Wholesome energy but needs to commit to something.', author: 'Sartre' }
            ],
            hiddenTalent: 'Gives advice so good you feel guilty for not following it',
            scenarios: [
                { label: 'Ordering coffee', text: 'Asks the barista how their day is going and means it. Orders something seasonal because growth means trying new things.' },
                { label: 'At a party', text: 'The one person everyone is genuinely happy to see. Somehow already friends with the host\u2019s dog.' },
                { label: 'In an argument', text: 'Doesn\u2019t argue back. Just asks a question so good it makes you argue with yourself for a week.' }
            ],
            compatibility: { best: 'kantian', worst: 'utilitarian' }
        },
        contractualist: {
            title: 'Contractualist',
            philosopher: 'T.M. Scanlon',
            icon: '\uD83E\uDD1D',
            motto: '"What we owe to each other."',
            strengths: [
                'The fairest person you\u2019ll ever meet',
                'Great at mediating conflicts',
                'Actually reads the group chat before responding'
            ],
            weaknesses: [
                'Takes 20 minutes to split a dinner bill fairly',
                'Can\u2019t make a decision without polling the group',
                'Would filibuster their own birthday party'
            ],
            catchphrases: [
                '"Could anyone reasonably reject this?"',
                '"Let\u2019s make sure everyone\u2019s comfortable with this"'
            ],
            peerReviews: [
                { text: 'Means well but moves at the speed of bureaucracy.', author: 'Sartre' },
                { text: 'Finally, someone who considers other people.', author: 'Mill' }
            ],
            hiddenTalent: 'Can draft a roommate agreement that everyone actually likes',
            scenarios: [
                { label: 'Ordering coffee', text: 'Asks the group what everyone wants first. Suggests splitting a French press because it\u2019s fairest per cup.' },
                { label: 'At a party', text: 'Mediating a disagreement about the music within 10 minutes. Everyone feels heard. No one got their first choice.' },
                { label: 'In an argument', text: '"I hear your point, but could you accept that principle if you were on the other side?" Infuriating because it works.' }
            ],
            compatibility: { best: 'utilitarian', worst: 'existentialist' }
        },
        existentialist: {
            title: 'Existentialist',
            philosopher: 'Jean-Paul Sartre',
            icon: '\uD83D\uDD25',
            motto: '"Man is condemned to be free."',
            strengths: [
                'Authentically themselves at all times',
                'Won\u2019t follow rules just because they exist',
                'Deeply self-aware'
            ],
            weaknesses: [
                'Overthinks their own existence at brunch',
                'Uses "freedom" as an excuse to flake on plans',
                'Will monologue about the void at 2 AM'
            ],
            catchphrases: [
                '"Labels are for jars, not people"',
                '"That\u2019s just, like, society\u2019s construct, man"'
            ],
            peerReviews: [
                { text: 'Exhausting but never boring.', author: 'Aristotle' },
                { text: 'They reject my framework on principle. Respect.', author: 'Kant' }
            ],
            hiddenTalent: 'Can make ordering coffee sound like an act of radical rebellion',
            scenarios: [
                { label: 'Ordering coffee', text: 'Stares at the menu for 3 minutes. Orders something they\u2019ve never tried because routine is a cage. Regrets it immediately.' },
                { label: 'At a party', text: 'Showed up an hour late because "time is a construct." Currently in the kitchen having a deep conversation with someone they just met.' },
                { label: 'In an argument', text: '"You\u2019re only saying that because society told you to think that way." Walks away to smoke a cigarette philosophically.' }
            ],
            compatibility: { best: 'virtue', worst: 'contractualist' }
        }
    };

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
    var nextBtn = document.getElementById('next-btn');
    var retakeBtn = document.getElementById('retake-btn');
    var shareBtn = document.getElementById('share-btn');
    var copyBtn = document.getElementById('copy-btn');
    var saveImgBtn = document.getElementById('save-img-btn');
    var breakdownToggle = document.getElementById('breakdown-toggle');
    var breakdownContent = document.getElementById('breakdown-content');
    var lastResultBtn = document.getElementById('last-result-btn');
    var choosing = false; // prevents double-click

    // ---- Screen Management ----
    var gameContainer = document.querySelector('.game-container');

    function showScreen(screen) {
        [startScreen, questionScreen, resultScreen].forEach(function (s) {
            s.classList.remove('active');
        });
        screen.classList.add('active');

        // Hide game-container when result screen is active (it's outside the container)
        gameContainer.style.display = (screen === resultScreen) ? 'none' : '';
        window.scrollTo(0, 0);
    }

    // ---- Restore saved result ----
    function restoreSavedResult() {
        try {
            var saved = JSON.parse(localStorage.getItem('examined_result'));
            if (saved && saved.scores && saved.answers && saved.answers.length === QUESTIONS.length) {
                return saved;
            }
        } catch (e) { /* ignore */ }
        return null;
    }

    // Show "View Last Result" button if a saved result exists
    var saved = restoreSavedResult();
    if (saved) {
        lastResultBtn.style.display = '';
    }

    lastResultBtn.addEventListener('click', function () {
        var saved = restoreSavedResult();
        if (!saved) return;
        // Restore state
        scores = saved.scores;
        answers = saved.answers;
        currentQuestion = QUESTIONS.length;
        showResults();
    });

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

    document.getElementById('result-back-btn2').addEventListener('click', function (e) {
        e.preventDefault();
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

        var reactionEl = document.getElementById('choice-reaction');
        reactionEl.classList.remove('visible');
        reactionEl.textContent = '';

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
        choiceA.disabled = false;
        choiceB.disabled = false;
        nextBtn.style.display = 'none';
        choosing = false;
    }

    function handleChoice(choice) {
        if (choosing) return;
        choosing = true;

        var q = QUESTIONS[currentQuestion];
        var chosen = choice === 'a' ? q.a : q.b;

        // Apply scores
        for (var i = 0; i < SCHOOL_KEYS.length; i++) {
            scores[SCHOOL_KEYS[i]] += chosen.scores[i];
        }
        answers.push(choice);

        // Show selected state and disable buttons
        var btn = choice === 'a' ? choiceA : choiceB;
        btn.classList.add('selected');
        choiceA.disabled = true;
        choiceB.disabled = true;

        // Show reaction immediately, then quote after a beat
        var reactionEl = document.getElementById('choice-reaction');
        reactionEl.textContent = chosen.react;
        reactionEl.classList.add('visible');

        setTimeout(function () {
            document.getElementById('philosopher-quote').classList.add('visible');
            nextBtn.style.display = 'block';
        }, 600);
    }

    function advanceQuestion() {
        currentQuestion++;
        if (currentQuestion >= QUESTIONS.length) {
            showResults();
        } else {
            renderQuestion();
        }
    }

    choiceA.addEventListener('click', function () { handleChoice('a'); });
    choiceB.addEventListener('click', function () { handleChoice('b'); });
    nextBtn.addEventListener('click', advanceQuestion);

    // ---- Results ----
    // Sort by score descending, ties broken by SCHOOL_KEYS order (stable)
    function getSortedSchools() {
        return SCHOOL_KEYS.slice().sort(function (a, b) {
            var diff = scores[b] - scores[a];
            if (diff !== 0) return diff;
            return SCHOOL_KEYS.indexOf(a) - SCHOOL_KEYS.indexOf(b);
        });
    }

    function getArchetype() {
        var sorted = getSortedSchools();
        var key = sorted[0] + '-' + sorted[1];
        return ARCHETYPES[key] || FALLBACK_ARCHETYPE;
    }

    // ---- Educational Sources ----
    var SCHOOL_EXPLANATIONS = {
        kantian: {
            explanation: 'Your answers suggest you value duty, honesty, and universal moral rules. Kantian ethics holds that morality comes from rational principles that apply to everyone equally \u2014 regardless of consequences. If you wouldn\u2019t want everyone to do it, you shouldn\u2019t do it either.',
            keyWork: 'Groundwork of the Metaphysics of Morals (1785)',
            concept: 'The Categorical Imperative: act only according to rules you could will to be universal laws.',
            source: 'Kant, I. (1785). Groundwork of the Metaphysics of Morals.',
            link: 'https://plato.stanford.edu/entries/kant-moral/'
        },
        utilitarian: {
            explanation: 'Your answers lean toward outcomes and impact. Utilitarianism says the right action is the one that produces the most overall good. You think about consequences, weigh trade-offs, and believe that helping more people is almost always better than helping fewer.',
            keyWork: 'Utilitarianism (1863)',
            concept: 'The Greatest Happiness Principle: actions are right in proportion as they promote happiness.',
            source: 'Mill, J.S. (1863). Utilitarianism.',
            link: 'https://plato.stanford.edu/entries/mill-moral-political/'
        },
        virtue: {
            explanation: 'Your answers focus on character, relationships, and being a good person \u2014 not just doing good things. Virtue ethics says morality isn\u2019t about following rules or maximizing outcomes, but about cultivating excellent character traits (virtues) through practice and habit.',
            keyWork: 'Nicomachean Ethics (c. 340 BC)',
            concept: 'The Golden Mean: virtue lies between extremes of excess and deficiency.',
            source: 'Aristotle. (c. 340 BC). Nicomachean Ethics.',
            link: 'https://plato.stanford.edu/entries/aristotle-ethics/'
        },
        contractualist: {
            explanation: 'Your answers prioritize fairness, mutual agreement, and considering others\u2019 perspectives. Scanlon\u2019s contractualism asks: could anyone reasonably reject the principle behind your action? If so, it\u2019s wrong. Morality is about what we owe to each other.',
            keyWork: 'What We Owe to Each Other (1998)',
            concept: 'Reasonable Rejection: an action is wrong if it violates principles no one could reasonably reject.',
            source: 'Scanlon, T.M. (1998). What We Owe to Each Other.',
            link: 'https://plato.stanford.edu/entries/contractualism/'
        },
        existentialist: {
            explanation: 'Your answers reflect a commitment to authenticity, personal freedom, and self-determination. Existentialism says there are no pre-given moral rules \u2014 you must create your own values through your choices. With radical freedom comes radical responsibility.',
            keyWork: 'Being and Nothingness (1943)',
            concept: 'Radical Freedom: existence precedes essence \u2014 you define yourself through your choices.',
            source: 'Sartre, J.-P. (1943). Being and Nothingness.',
            link: 'https://plato.stanford.edu/entries/sartre/'
        }
    };

    function showResults() {
        showScreen(resultScreen);

        var sorted = getSortedSchools();
        var primaryKey = sorted[0];
        var secondaryKey = sorted[1];
        var profile = PROFILES[primaryKey];
        var secondaryProfile = PROFILES[secondaryKey];
        var archetype = getArchetype();
        var school = SCHOOLS[primaryKey];
        var secondarySchool = SCHOOLS[secondaryKey];

        // Calculate total and percentages
        var totalScore = 0;
        for (var i = 0; i < SCHOOL_KEYS.length; i++) totalScore += scores[SCHOOL_KEYS[i]];
        if (totalScore === 0) totalScore = 1;

        // ---- Populate ID Card ----
        document.getElementById('card-icon').textContent = school.emoji + secondarySchool.emoji;
        document.getElementById('card-title').textContent = archetype.name;
        document.getElementById('card-school').textContent = profile.title + ' + ' + secondaryProfile.title;
        document.getElementById('card-archetype-desc').textContent = archetype.desc;
        document.getElementById('card-motto').textContent = profile.motto;

        // Strengths
        var strengthsEl = document.getElementById('card-strengths');
        strengthsEl.textContent = '';
        for (var s = 0; s < profile.strengths.length; s++) {
            var li = document.createElement('li');
            li.textContent = profile.strengths[s];
            strengthsEl.appendChild(li);
        }

        // Weaknesses
        var weaknessesEl = document.getElementById('card-weaknesses');
        weaknessesEl.textContent = '';
        for (var w = 0; w < profile.weaknesses.length; w++) {
            var wli = document.createElement('li');
            wli.textContent = profile.weaknesses[w];
            weaknessesEl.appendChild(wli);
        }

        // The Mix — what the secondary school adds
        var mixEl = document.getElementById('card-mix');
        var primaryPct = Math.round((scores[primaryKey] / totalScore) * 100);
        var secondaryPct = Math.round((scores[secondaryKey] / totalScore) * 100);
        var mixDescs = {
            kantian: 'Your Kantian side keeps you grounded in principles \u2014 you won\u2019t bend the rules, even when it\u2019d be easier.',
            utilitarian: 'Your Utilitarian side keeps one eye on the bigger picture \u2014 outcomes matter, even when rules don\u2019t.',
            virtue: 'Your Virtue Ethics side cares about being a good person, not just doing the right thing on paper.',
            contractualist: 'Your Contractualist side means you always ask: is this fair to everyone involved?',
            existentialist: 'Your Existentialist side refuses to follow any rule you didn\u2019t choose for yourself.'
        };
        mixEl.textContent = primaryPct + '% ' + school.name + ', ' + secondaryPct + '% ' + secondarySchool.name + '. ' + mixDescs[secondaryKey];

        // Catchphrases
        var catchEl = document.getElementById('card-catchphrases');
        catchEl.textContent = '';
        for (var c = 0; c < profile.catchphrases.length; c++) {
            var cp = document.createElement('p');
            cp.className = 'id-catchphrase';
            cp.textContent = profile.catchphrases[c];
            catchEl.appendChild(cp);
        }

        // Alignment bars
        var alignEl = document.getElementById('card-alignment');
        alignEl.textContent = '';
        for (var a = 0; a < sorted.length; a++) {
            var key = sorted[a];
            var pct = Math.round((scores[key] / totalScore) * 100);
            var row = document.createElement('div');
            row.className = 'id-alignment-row';

            var label = document.createElement('span');
            label.className = 'id-alignment-label';
            label.textContent = SCHOOLS[key].name;

            var track = document.createElement('div');
            track.className = 'id-alignment-track';

            var fill = document.createElement('div');
            fill.className = 'id-alignment-fill';
            fill.style.width = '0%';
            fill.style.background = SCHOOLS[key].color;
            track.appendChild(fill);

            var pctEl = document.createElement('span');
            pctEl.className = 'id-alignment-pct';
            pctEl.textContent = pct + '%';

            row.appendChild(label);
            row.appendChild(track);
            row.appendChild(pctEl);
            alignEl.appendChild(row);

            // Animate bar fill
            (function (fillEl, pctVal) {
                setTimeout(function () {
                    fillEl.style.width = pctVal + '%';
                }, 100);
            })(fill, pct);
        }

        // Hidden talent
        document.getElementById('card-hidden-talent').textContent = profile.hiddenTalent;

        // Peer reviews
        var reviewsEl = document.getElementById('card-reviews');
        reviewsEl.textContent = '';
        for (var r = 0; r < profile.peerReviews.length; r++) {
            var review = document.createElement('div');
            review.className = 'id-review';

            var reviewText = document.createElement('span');
            reviewText.className = 'id-review-text';
            reviewText.textContent = '\u201C' + profile.peerReviews[r].text + '\u201D ';

            var reviewAuthor = document.createElement('span');
            reviewAuthor.className = 'id-review-author';
            reviewAuthor.textContent = '\u2014 ' + profile.peerReviews[r].author;

            review.appendChild(reviewText);
            review.appendChild(reviewAuthor);
            reviewsEl.appendChild(review);
        }

        // Scenarios
        var scenariosEl = document.getElementById('card-scenarios');
        scenariosEl.textContent = '';
        for (var sc = 0; sc < profile.scenarios.length; sc++) {
            var scenario = document.createElement('div');
            scenario.className = 'id-scenario';

            var scLabel = document.createElement('span');
            scLabel.className = 'id-scenario-label';
            scLabel.textContent = profile.scenarios[sc].label;

            scenario.appendChild(scLabel);
            scenario.appendChild(document.createTextNode(profile.scenarios[sc].text));
            scenariosEl.appendChild(scenario);
        }

        // Compatibility
        var compatEl = document.getElementById('card-compatibility');
        compatEl.textContent = '';

        var bestRow = document.createElement('div');
        bestRow.className = 'id-compat-row';
        var bestLabel = document.createElement('span');
        bestLabel.className = 'id-compat-label id-compat-label--best';
        bestLabel.textContent = 'Best with';
        var bestValue = document.createElement('span');
        bestValue.className = 'id-compat-value';
        bestValue.textContent = SCHOOLS[profile.compatibility.best].name + ' \u2014 ' + PROFILES[profile.compatibility.best].philosopher;
        bestRow.appendChild(bestLabel);
        bestRow.appendChild(bestValue);
        compatEl.appendChild(bestRow);

        var worstRow = document.createElement('div');
        worstRow.className = 'id-compat-row';
        var worstLabel = document.createElement('span');
        worstLabel.className = 'id-compat-label id-compat-label--worst';
        worstLabel.textContent = 'Avoid';
        var worstValue = document.createElement('span');
        worstValue.className = 'id-compat-value';
        worstValue.textContent = SCHOOLS[profile.compatibility.worst].name + ' \u2014 ' + PROFILES[profile.compatibility.worst].philosopher;
        worstRow.appendChild(worstLabel);
        worstRow.appendChild(worstValue);
        compatEl.appendChild(worstRow);

        // Archetype subtitle in footer
        document.getElementById('card-archetype').textContent = archetype.name;

        // ---- Build Learn More section ----
        buildLearnMore(sorted, totalScore);

        // ---- Build Alignment Compass ----
        buildResultCompass(totalScore);

        // ---- Build Answer Breakdown ----
        buildBreakdown();

        // Update progress bar to full
        document.getElementById('progress-fill').style.width = '100%';

        // Save result
        try {
            localStorage.setItem('examined_result', JSON.stringify({
                archetype: archetype.name,
                primary: primaryKey,
                scores: scores,
                answers: answers,
                date: new Date().toISOString()
            }));
        } catch (e) { /* localStorage may be unavailable */ }

        // Pre-render card image in the background so share/save can
        // use the cached blob synchronously (preserves user gesture on iOS).
        cachedCardBlob = null;
        preRenderCard();
    }

    // ---- Learn More / Educational Section ----
    function buildLearnMore(sorted, totalScore) {
        // Remove existing learn-more if retaking
        var existing = document.querySelector('.id-learn-more');
        if (existing) existing.remove();

        var container = document.createElement('div');
        container.className = 'id-learn-more';

        // Toggle button
        var toggleBtn = document.createElement('button');
        toggleBtn.className = 'learn-more-toggle';
        toggleBtn.innerHTML = 'Why these results? Learn the philosophy <span class="toggle-arrow">\u25BC</span>';
        container.appendChild(toggleBtn);

        // Content area
        var content = document.createElement('div');
        content.className = 'learn-more-content';

        for (var i = 0; i < sorted.length; i++) {
            var key = sorted[i];
            var school = SCHOOLS[key];
            var info = SCHOOL_EXPLANATIONS[key];
            var pct = Math.round((scores[key] / totalScore) * 100);

            var card = document.createElement('div');
            card.className = 'learn-more-card';
            if (i === 0) card.classList.add('open'); // Primary school starts open

            // Header (clickable)
            var header = document.createElement('div');
            header.className = 'learn-more-header';

            var dot = document.createElement('span');
            dot.className = 'learn-more-dot';
            dot.style.background = school.color;

            var schoolName = document.createElement('span');
            schoolName.className = 'learn-more-school';
            schoolName.textContent = school.name + ' (' + school.philosopher + ')';

            var pctLabel = document.createElement('span');
            pctLabel.className = 'learn-more-pct';
            pctLabel.textContent = pct + '%';

            var arrow = document.createElement('span');
            arrow.className = 'learn-more-arrow';
            arrow.textContent = '\u25BC';

            header.appendChild(dot);
            header.appendChild(schoolName);
            header.appendChild(pctLabel);
            header.appendChild(arrow);

            // Body
            var body = document.createElement('div');
            body.className = 'learn-more-body';

            var explanation = document.createElement('p');
            explanation.className = 'learn-more-explanation';
            explanation.textContent = info.explanation;

            var conceptP = document.createElement('p');
            conceptP.className = 'learn-more-explanation';
            var conceptStrong = document.createElement('strong');
            conceptStrong.textContent = 'Key concept: ';
            conceptP.appendChild(conceptStrong);
            conceptP.appendChild(document.createTextNode(info.concept));

            var sourceP = document.createElement('p');
            sourceP.className = 'learn-more-source';

            var sourceText = document.createTextNode(info.source + ' ');
            sourceP.appendChild(sourceText);

            var sourceLink = document.createElement('a');
            sourceLink.href = info.link;
            sourceLink.target = '_blank';
            sourceLink.rel = 'noopener noreferrer';
            sourceLink.textContent = 'Read more on SEP \u2192';
            sourceP.appendChild(sourceLink);

            body.appendChild(explanation);
            body.appendChild(conceptP);
            body.appendChild(sourceP);

            card.appendChild(header);
            card.appendChild(body);
            content.appendChild(card);

            // Toggle individual cards
            (function (cardEl) {
                cardEl.querySelector('.learn-more-header').addEventListener('click', function () {
                    cardEl.classList.toggle('open');
                });
            })(card);
        }

        container.appendChild(content);

        // Insert after the ID card
        var idCard = document.getElementById('id-card');
        idCard.parentNode.insertBefore(container, idCard.nextSibling);

        // Toggle button listener
        toggleBtn.addEventListener('click', function () {
            toggleBtn.classList.toggle('open');
            content.classList.toggle('visible');
        });
    }

    // ---- Share ----
    function generateShareText() {
        var archetype = getArchetype();
        var sorted = getSortedSchools();
        var profile = PROFILES[sorted[0]];

        var totalScore = 0;
        for (var i = 0; i < SCHOOL_KEYS.length; i++) totalScore += scores[SCHOOL_KEYS[i]];
        if (totalScore === 0) totalScore = 1;

        var lines = [
            profile.icon + ' I\u2019m a ' + profile.title + '! (' + archetype.name + ')',
            profile.motto,
            ''
        ];

        for (var j = 0; j < sorted.length; j++) {
            var key = sorted[j];
            var pct = Math.round((scores[key] / totalScore) * 100);
            var bar = '';
            var barLen = Math.round(pct / 10);
            for (var k = 0; k < barLen; k++) bar += '\u2588';
            for (var m = barLen; m < 10; m++) bar += '\u2591';
            lines.push(SCHOOLS[key].name + ' ' + bar + ' ' + pct + '%');
        }

        lines.push('');
        lines.push('What\u2019s your moral philosophy?');

        return lines.join('\n');
    }

    // ---- Image Capture ----
    var isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
        (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    var isMobile = isIOS || /Android/i.test(navigator.userAgent);

    // Pre-rendered card image, populated when results are shown.
    // Lets share/save use the blob synchronously in the click handler,
    // preserving the user gesture context on iOS.
    var cachedCardBlob = null;

    // html2canvas can't render background-clip: text, so we temporarily
    // swap gradient text to solid color before capture and restore after.
    // Waits for fonts to load first — html2canvas fails on mobile if
    // custom @font-face fonts haven't finished loading.
    function captureCard() {
        var fontsReady = (document.fonts && document.fonts.ready)
            ? document.fonts.ready
            : Promise.resolve();

        return fontsReady.then(function () {
            var card = document.getElementById('id-card');
            var gradientEls = card.querySelectorAll('.id-card-title');
            var saved = [];

            for (var i = 0; i < gradientEls.length; i++) {
                var el = gradientEls[i];
                saved.push({
                    el: el,
                    bg: el.style.background,
                    clip: el.style.webkitBackgroundClip,
                    fill: el.style.webkitTextFillColor
                });
                el.style.background = 'none';
                el.style.webkitBackgroundClip = '';
                el.style.webkitTextFillColor = '#e8e6f0';
            }

            function restoreGradients() {
                for (var j = 0; j < saved.length; j++) {
                    var s = saved[j];
                    s.el.style.background = s.bg;
                    s.el.style.webkitBackgroundClip = s.clip;
                    s.el.style.webkitTextFillColor = s.fill;
                }
            }

            return html2canvas(card, {
                backgroundColor: '#12122a',
                scale: isMobile ? 1 : 2,
                useCORS: true,
                allowTaint: true,
                logging: false
            }).then(function (canvas) {
                restoreGradients();
                return canvas;
            }).catch(function (err) {
                restoreGradients();
                throw err;
            });
        });
    }

    function preRenderCard() {
        captureCard().then(function (canvas) {
            canvas.toBlob(function (blob) {
                if (blob) cachedCardBlob = blob;
            }, 'image/png');
        }).catch(function () { /* non-critical */ });
    }

    // Helper: get cached blob or capture fresh
    function getCardBlob() {
        if (cachedCardBlob) return Promise.resolve(cachedCardBlob);
        return captureCard().then(function (canvas) {
            return new Promise(function (resolve, reject) {
                canvas.toBlob(function (blob) {
                    if (!blob) return reject(new Error('empty blob'));
                    cachedCardBlob = blob;
                    resolve(blob);
                }, 'image/png');
            });
        });
    }

    saveImgBtn.addEventListener('click', function () {
        if (isMobile && cachedCardBlob) {
            // Cached blob ready — share with file synchronously (user gesture preserved)
            var file = new File([cachedCardBlob], 'philosopher-id.png', { type: 'image/png' });
            var shareData = { files: [file] };
            if (navigator.share && navigator.canShare && navigator.canShare(shareData)) {
                navigator.share(shareData).catch(function () { /* user cancelled */ });
                return;
            }
        }

        // Fallback: generate (or re-generate) and download/overlay
        saveImgBtn.disabled = true;
        saveImgBtn.textContent = 'Generating...';
        getCardBlob().then(function (blob) {
            if (isMobile) {
                var url = URL.createObjectURL(blob);
                showSaveOverlay(url);
            } else {
                var link = document.createElement('a');
                link.download = 'philosopher-id.png';
                link.href = URL.createObjectURL(blob);
                link.click();
                setTimeout(function () { URL.revokeObjectURL(link.href); }, 5000);
                showToast('Image saved!');
            }
        }).catch(function () {
            showToast('Could not generate image');
        }).finally(function () {
            saveImgBtn.disabled = false;
            saveImgBtn.textContent = 'Save ID Card as Image';
        });
    });

    function showSaveOverlay(imgSrc) {
        var existing = document.getElementById('save-overlay');
        if (existing) existing.remove();

        var overlay = document.createElement('div');
        overlay.id = 'save-overlay';
        overlay.className = 'save-overlay';
        overlay.innerHTML =
            '<div class="save-overlay-content">' +
                '<p class="save-overlay-hint">Long press the image to save to Photos</p>' +
                '<img src="' + imgSrc + '" alt="Philosopher ID Card" class="save-overlay-img">' +
                '<button class="btn-secondary save-overlay-close">Done</button>' +
            '</div>';
        document.body.appendChild(overlay);

        overlay.querySelector('.save-overlay-close').addEventListener('click', function () {
            overlay.remove();
        });
        overlay.addEventListener('click', function (e) {
            if (e.target === overlay) overlay.remove();
        });
    }

    copyBtn.addEventListener('click', function () {
        copyBtn.disabled = true;
        copyBtn.textContent = 'Generating...';
        getCardBlob().then(function (blob) {
            if (navigator.clipboard && navigator.clipboard.write) {
                return navigator.clipboard.write([
                    new ClipboardItem({ 'image/png': blob })
                ]).then(function () {
                    showToast('Image copied to clipboard!');
                });
            }
            throw new Error('clipboard unavailable');
        }).catch(function () {
            copyToClipboard(generateShareText());
        }).finally(function () {
            copyBtn.disabled = false;
            copyBtn.textContent = 'Copy Image';
        });
    });

    var quizUrl = 'https://www.raggedydoc.com/games/philosophy/';

    shareBtn.addEventListener('click', function () {
        var text = generateShareText();
        var fullText = text + '\n' + quizUrl;

        // Mobile: if cached blob is ready, share image + text + URL
        // synchronously in the click handler (preserves user gesture).
        // URL without protocol avoids link preview that overrides image.
        if (isMobile && cachedCardBlob && navigator.share && navigator.canShare) {
            var file = new File([cachedCardBlob], 'philosopher-id.png', { type: 'image/png' });
            var imgText = text + '\nraggedydoc.com/examined';
            var shareData = { text: imgText, files: [file] };
            if (navigator.canShare(shareData)) {
                navigator.share(shareData).catch(function () { /* user cancelled */ });
                return;
            }
        }

        // Mobile fallback: share text only (no image)
        if (isMobile && navigator.share) {
            navigator.share({
                title: 'Examined — Philosophy Alignment Quiz',
                text: text,
                url: quizUrl
            }).catch(function () { /* user cancelled */ });
            return;
        }

        // Desktop: copy image to clipboard
        shareBtn.disabled = true;
        shareBtn.textContent = 'Generating...';
        getCardBlob().then(function (blob) {
            if (navigator.clipboard && navigator.clipboard.write) {
                return navigator.clipboard.write([
                    new ClipboardItem({ 'image/png': blob })
                ]).then(function () {
                    showToast('Image copied to clipboard!');
                });
            }
            throw new Error('clipboard unavailable');
        }).catch(function () {
            copyToClipboard(fullText);
        }).finally(function () {
            shareBtn.disabled = false;
            shareBtn.textContent = 'Share';
        });
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

    // ---- Alignment Compass on Result ----
    // Maps each school to a position on the 2D compass:
    //   X axis: individual (left) ↔ collective (right)
    //   Y axis: rules (top) ↔ outcomes (bottom)
    var COMPASS_POSITIONS = {
        kantian:        { x: 60, y: 18 },
        utilitarian:    { x: 75, y: 72 },
        virtue:         { x: 45, y: 45 },
        contractualist: { x: 78, y: 35 },
        existentialist: { x: 22, y: 65 }
    };

    function buildResultCompass(totalScore) {
        var container = document.getElementById('result-compass');
        container.textContent = '';

        // Calculate "You" position as weighted average of school positions
        var youX = 0, youY = 0;
        for (var i = 0; i < SCHOOL_KEYS.length; i++) {
            var key = SCHOOL_KEYS[i];
            var weight = scores[key] / totalScore;
            youX += COMPASS_POSITIONS[key].x * weight;
            youY += COMPASS_POSITIONS[key].y * weight;
        }

        var compass = document.createElement('div');
        compass.className = 'alignment-compass';

        var title = document.createElement('div');
        title.className = 'compass-title';
        title.textContent = 'Where you fall';
        compass.appendChild(title);

        var disclaimer = document.createElement('p');
        disclaimer.className = 'explore-compass-disclaimer';
        disclaimer.textContent = 'Approximate positions \u2014 real philosophy is messier than a 2D chart.';
        compass.appendChild(disclaimer);

        var grid = document.createElement('div');
        grid.className = 'compass-grid';

        var topLabel = document.createElement('div');
        topLabel.className = 'compass-label compass-label--top';
        topLabel.textContent = '\u2191 Rules matter most';
        grid.appendChild(topLabel);

        var area = document.createElement('div');
        area.className = 'compass-area';

        var axes = document.createElement('div');
        axes.className = 'compass-axes';
        area.appendChild(axes);

        // School dots (dimmed)
        for (var s = 0; s < SCHOOL_KEYS.length; s++) {
            var sk = SCHOOL_KEYS[s];
            var pos = COMPASS_POSITIONS[sk];
            var dot = document.createElement('div');
            dot.className = 'compass-dot';
            dot.style.top = pos.y + '%';
            dot.style.left = pos.x + '%';
            dot.style.background = SCHOOLS[sk].color;
            dot.style.width = '10px';
            dot.style.height = '10px';
            dot.style.opacity = '0.7';

            var dotLabel = document.createElement('span');
            dotLabel.className = 'compass-dot-label';
            dotLabel.textContent = SCHOOLS[sk].name;
            dot.appendChild(dotLabel);
            area.appendChild(dot);
        }

        // "You" dot
        var youDot = document.createElement('div');
        youDot.className = 'compass-you';
        youDot.style.top = youY + '%';
        youDot.style.left = youX + '%';
        var youLabel = document.createElement('span');
        youLabel.className = 'compass-you-label';
        youLabel.textContent = 'You';
        youDot.appendChild(youLabel);
        area.appendChild(youDot);

        grid.appendChild(area);

        var bottomLabel = document.createElement('div');
        bottomLabel.className = 'compass-label compass-label--bottom';
        bottomLabel.textContent = '\u2193 Outcomes matter most';
        grid.appendChild(bottomLabel);

        compass.appendChild(grid);
        container.appendChild(compass);
    }

    // ---- Answer Breakdown ----
    function buildBreakdown() {
        breakdownContent.textContent = '';
        for (var i = 0; i < QUESTIONS.length; i++) {
            var q = QUESTIONS[i];
            var choice = answers[i];
            var chosen = choice === 'a' ? q.a : q.b;

            var item = document.createElement('div');
            item.className = 'breakdown-item';

            var header = document.createElement('div');
            header.className = 'breakdown-header';

            var label = document.createElement('span');
            label.className = 'breakdown-label';
            label.textContent = q.label;

            var num = document.createElement('span');
            num.className = 'breakdown-num';
            num.textContent = 'Q' + (i + 1);

            header.appendChild(label);
            header.appendChild(num);

            var choiceText = document.createElement('p');
            choiceText.className = 'breakdown-choice';
            choiceText.textContent = chosen.text;

            var scoreTags = document.createElement('div');
            scoreTags.className = 'breakdown-scores';

            for (var j = 0; j < SCHOOL_KEYS.length; j++) {
                var pts = chosen.scores[j];
                if (pts > 0) {
                    var tag = document.createElement('span');
                    tag.className = 'breakdown-score-tag';
                    tag.style.borderColor = SCHOOLS[SCHOOL_KEYS[j]].color;
                    tag.style.color = SCHOOLS[SCHOOL_KEYS[j]].color;
                    tag.textContent = SCHOOLS[SCHOOL_KEYS[j]].name + ' +' + pts;
                    scoreTags.appendChild(tag);
                }
            }

            item.appendChild(header);
            item.appendChild(choiceText);
            item.appendChild(scoreTags);
            breakdownContent.appendChild(item);
        }
    }

    breakdownToggle.addEventListener('click', function () {
        breakdownToggle.classList.toggle('open');
        breakdownContent.classList.toggle('visible');
    });

})();
