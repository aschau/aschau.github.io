/* Portfolio data for the scroll + minimal variants.
   Mirrors the current arcade site's sections/*.html content. Arcade is the
   source of truth — when editing a card, update both this file and the
   corresponding section fragment. */
window.PORTFOLIO_DATA = {
  cabinets: [
    { id:'home',     name:'Home',     cc:'#7ab8ff' },
    { id:'about',    name:'About',    cc:'#50e3a4' },
    { id:'journey',  name:'Journey',  cc:'#ffd166' },
    { id:'work',     name:'Work',     cc:'#ff8a50' },
    { id:'personal', name:'Personal', cc:'#ff6b9d' },
    { id:'play',     name:'Play',     cc:'#9b6dff' }
  ],

  commander: {
    name:'Andrew Steven Chau',
    type:'Legendary Creature \u2014 Senior Engineer',
    flavor:'Senior Software Engineer at Blizzard on Hearthstone. Co-founder of Friend Castle. 10+ years in games, 30+ titles shipped across Blizzard, MobilityWare, Sega Atlus, Trigger Global, and more.',
    abilities:[
      ['Haste', 'replies within 24h'],
      ['Vigilance', 'ships daily']
    ],
    stats:[ ['10+','YEARS'], ['30+','TITLES'], ['5','STUDIOS'] ],
    pt:'10/30'
  },

  battlefield: [
    { abbr:'Blizzard',     name:'Blizzard',     when:'2025 \u2014 Current', role:'Sr. Software Engineer',     cc:'#148EFF', body:'Hearthstone Client Team. Managing critical SDKs \u2014 Firebase, AppsFlyer, Braze. Modernizing macOS and iOS platform support.' },
    { abbr:'MobilityWare', name:'MobilityWare', when:'2020 \u2014 2025',    role:'Software Engineer II',      cc:'#f26835', body:'Spark Studio Yellow Team. Engineering across 30+ titles. Privacy/compliance lead \u2014 GDPR, CCPA, Google Privacy Sandbox.' },
    { abbr:'Sega Atlus',   name:'Sega Atlus',   when:'2016 \u2014 2020',    role:'Quality Assurance',         cc:'#0060A8', body:'QA tested Persona 5 Royal, Yakuza 5 Remastered, Catherine: Full Body, and Yakuza 0.' },
    { abbr:'Trigger',      name:'Trigger',      when:'2018 \u2014 2019',    role:'AR Developer',              cc:'#00C9DB', body:'Shipped AR experiences for the NBA, NHL, NFL, and major brands. Deployed on-site at stadiums with Intel.' },
    { abbr:'Friend Castle',name:'Friend Castle',when:'2023 \u2014 Current', role:'Co-Founder',                cc:'#c13e5d', body:'Indie game development LLC. Ships original titles (Schedazzle, Box Dog) and offers technical consulting services for partners \u2014 past contract AR work includes Niantic.' },
    { abbr:'Waxheart',     name:'Waxheart',     when:'2024 \u2014 Current', role:'DevOps / Producer',         cc:'#8B6DAF', body:'Built Jenkins CI/CD, Discord bot, QA department from scratch. Sprint planning and release management.' }
  ],

  socials:[
    { svc:'LinkedIn',  handle:'andrewstevenchau', url:'https://www.linkedin.com/in/andrewstevenchau/' },
    { svc:'YouTube',   handle:'@raggedydoc',       url:'https://www.youtube.com/@raggedydoc' },
    { svc:'Twitch',    handle:'raggedydoc',        url:'https://www.twitch.tv/raggedydoc' },
    { svc:'Instagram', handle:'@raggedydoc',       url:'https://www.instagram.com/raggedydoc/' },
    { svc:'TikTok',    handle:'@raggedydoc',       url:'https://www.tiktok.com/@raggedydoc' },
    { svc:'Bluesky',   handle:'raggedydoctv',      url:'https://bsky.app/profile/raggedydoctv.bsky.social' }
  ],
  emblemOngoing:'Always on the grind \u2014 chasing new tech, tools, and ventures to explore.',
  emblemLocation:'Southern California \u00B7 PST',

  /* Unicode icons get \uFE0E (text variation selector) so iOS Safari
     doesn't auto-convert them to colored emoji glyphs. */
  lands:[
    { ic:'{ }',             nm:'Languages',  li:'C# \u00B7 Python \u00B7 C++ \u00B7 Java',              c:'#4a90d9' },
    { ic:'\u2699\uFE0E',    nm:'Engines',    li:'Unity 3D \u00B7 Pygame',                                 c:'#50e3a4' },
    { ic:'\u2388',          nm:'Platforms',  li:'iOS \u00B7 Android \u00B7 macOS \u00B7 Windows',         c:'#4ecdc4' },
    { ic:'\u2692\uFE0E',    nm:'Tools',      li:'Git \u00B7 Jenkins \u00B7 Xcode \u00B7 Discord.js',      c:'#ff8a50' },
    { ic:'\u25C6\uFE0E',    nm:'SDKs',       li:'Firebase \u00B7 AppsFlyer \u00B7 Braze \u00B7 AR/ARCore',c:'#9b6dff' },
    { ic:'\u2605\uFE0E',    nm:'Production', li:'Agile \u00B7 Sprint \u00B7 QA \u00B7 Jira',              c:'#ff6b9d' }
  ],

  chapters: [
    { when:'2015', where:'UCI \u00B7 Computer Game Science',        title:'Engineer building games from the start',     cc:'#FFD100', body:'2nd Place at VGDC for Left 2 Die. Award for Creativity at IEEE GameSig 2016 for Spooky Spoils. Built games in Pygame and Unity. Learned to scope down, ship, and present.' },
    { when:'2016', where:'Sega Atlus \u00B7 Quality Assurance',     title:'Learned how shipped games actually ship',     cc:'#0060A8', body:'Four years of QA on Persona 5 Royal, Yakuza 0, Yakuza 5 Remastered, and Catherine: Full Body. Localization edge cases, repro steps, build cycles. The discipline everything else stands on.' },
    { when:'2018', where:'Trigger Global \u00B7 AR Developer',      title:'Shipping AR onto stadium floors',             cc:'#00C9DB', body:'Built live AR overlays for NBA, NHL, and NFL games in Unity. Deployed on-site at stadiums with Intel. Lenovo Mirage headset apps, General Mills Star Wars AR, Moviebill. Real-time AR is unforgiving.' },
    { when:'2020', where:'MobilityWare \u00B7 Software Engineer II',title:'Five years on a 30+ title catalog',           cc:'#f26835', body:'Spark Studio Yellow Team. Studio point person for privacy/compliance \u2014 GDPR, CCPA, Google Privacy Sandbox. Worked directly with the Technical Director and CTO. Learned what platform engineering looks like at scale.' },
    { when:'2023', where:'Friend Castle \u00B7 Co-Founder',          title:'Started a studio with friends',               cc:'#c13e5d', body:'Indie game dev LLC. Co-founded with a small core team. Ships originals (Schedazzle on iOS/Android, Box Dog on Steam) and offers technical consulting \u2014 including AR contract work for Niantic via Lightship.' },
    { when:'2024', where:'Waxheart \u00B7 DevOps / Producer',        title:'Built the build pipeline',                    cc:'#8B6DAF', body:'Stood up Jenkins CI/CD from scratch for Unity + Steamworks. Wrote a Discord bot for build notifications and error reporting. Set up a QA department. Now run sprint planning and release management.' },
    { when:'2025', where:'Blizzard \u00B7 Sr. Software Engineer',    title:'On the Hearthstone Client Team',              cc:'#148EFF', body:'Joined the Hearthstone Client Team at Blizzard. Managing the SDKs that the live game runs on \u2014 Firebase, AppsFlyer, Braze, China-specific integrations. Modernizing the macOS and iOS platform layer.' }
  ],

  workTabs: [
    {
      id:'w-blizzard', name:'Blizzard', abbr:'Blizzard', cc:'#148EFF',
      cards: [
        { kind:'emblem', abbr:'Blizzard', name:'Hearthstone', type:'Client Team', flavor:'Managing SDKs. Modernizing platform support.', back:{ title:'Blizzard Entertainment', role:'Senior Software Engineer \u00B7 2025\u2014Current', body:'Part of the Hearthstone Client Team. Managing critical SDKs \u2014 Firebase, AppsFlyer, Braze, and China-specific integrations. Modernizing macOS and iOS platform support.' }, links:[['Website','https://www.blizzard.com/']] },
        { img:'img/work-projects/Blizzard/Hearthstone_Apple.png', contain:true, name:'App Store', type:'Hearthstone', flavor:'iOS listing.', back:{ title:'Hearthstone \u2014 iOS', body:'Hearthstone on the Apple App Store. One of the most iconic digital card games, running on iOS since 2014.' }, links:[['App Store','https://apps.apple.com/us/app/hearthstone/id625257520']] },
        { img:'img/work-projects/Blizzard/Hearthstone_Google.png', contain:true, name:'Google Play', type:'Hearthstone', flavor:'Android listing.', back:{ title:'Hearthstone \u2014 Android', body:'Hearthstone on the Google Play Store.' }, links:[['Google Play','https://play.google.com/store/apps/details?id=com.blizzard.wtcg.hearthstone']] },
        { img:'img/work-projects/Blizzard/Hearthstone_Credits_Card.png', contain:true, name:'Credits Card', type:'In-Game', flavor:'Official Hearthstone credits card.', back:{ title:'Official Credits Card', body:'Andrew Steven Chau\u2019s official in-game Hearthstone credits card, awarded to team members.' }, links:[] }
      ]
    },
    {
      id:'w-mw', name:'MobilityWare', abbr:'MobilityWare', cc:'#f26835',
      cards: [
        { kind:'emblem', abbr:'MobilityWare', name:'Spark Studio', type:'Yellow Team', flavor:'30+ titles. Privacy/compliance lead.', back:{ title:'MobilityWare', role:'Software Engineer II \u00B7 2020\u20142025', body:'Spark Studio \u2014 Yellow Team. Engineering across 30+ shipped titles. Studio point person for privacy/compliance \u2014 GDPR, CCPA, Privacy Sandbox. Worked with Technical Director and CTO.' }, links:[['Website','https://www.mobilityware.com/']] },
        { img:'img/work-projects/MobilityWare/Mobilityware_Apple.png', contain:true, name:'App Store', type:'MobilityWare', flavor:'30+ titles on iOS.', back:{ title:'MobilityWare \u2014 iOS', body:'MobilityWare\u2019s full catalog on the Apple App Store, including Solitaire, Mahjong, and more.' }, links:[['App Store','https://apps.apple.com/cg/developer/mobilityware/id284117362']] },
        { img:'img/work-projects/MobilityWare/Mobilityware_Google.png', contain:true, name:'Google Play', type:'MobilityWare', flavor:'30+ titles on Android.', back:{ title:'MobilityWare \u2014 Android', body:'MobilityWare\u2019s full catalog on Google Play.' }, links:[['Google Play','https://play.google.com/store/apps/dev?id=7125885284350687141']] }
      ]
    },
    {
      id:'w-sega', name:'Sega Atlus', abbr:'Sega Atlus', cc:'#0060A8',
      cards: [
        { img:'img/work-projects/SegaAtlus/persona5Royal.jpg', name:'Persona 5: The Royal', type:'Quality Assurance', flavor:'The definitive edition of one of the highest-rated JRPGs.', back:{ title:'Persona 5: The Royal', role:'QA Tester', body:'Quality assurance on the expanded Persona 5, ensuring localization accuracy and gameplay polish across hundreds of hours of content.' }, links:[['View Game','https://persona.atlus.com/p5r/']] },
        { img:'img/work-projects/SegaAtlus/yakuza5.jpg', name:'Yakuza 5 Remastered', type:'Quality Assurance', flavor:'Five protagonists, five cities, one epic saga.', back:{ title:'Yakuza 5 Remastered', role:'QA Tester', body:'QA on the remastered western release, covering five interweaving storylines across Japan.' }, links:[['View Game','https://store.steampowered.com/app/1105510/Yakuza_5_Remastered/']] },
        { img:'img/work-projects/SegaAtlus/catherineFullBodySwitch.jpg', name:'Catherine: Full Body', type:'Quality Assurance', flavor:'Puzzle-platformer meets romantic horror on Switch.', back:{ title:'Catherine: Full Body (Switch)', role:'QA Tester', body:'QA on the Switch port, ensuring feature parity and performance.' }, links:[['View Game','https://www.catherinethegame.com/fullbody/']] },
        { img:'img/work-projects/SegaAtlus/yakuza0.jpg', name:'Yakuza 0', type:'Quality Assurance', flavor:'1988 Japan in all its neon glory.', back:{ title:'Yakuza 0', role:'QA Tester', body:'QA on the prequel entry, set in late-1980s Tokyo and Osaka.' }, links:[['View Game','https://games.sega.com/yakuza0/']] }
      ]
    },
    {
      id:'w-trigger', name:'Trigger', abbr:'Trigger', cc:'#00C9DB',
      cards: [
        { img:'img/work-projects/Trigger/starviewYardlineStat.jpg', name:'NFL AR \u2014 Starview', type:'Main Developer', flavor:'Live AR stat overlays at AT&T Stadium.', back:{ title:'NFL AR \u2014 Starview', role:'Main Developer \u00B7 Jun\u2014Oct 2019', body:'Engineered live AR stat overlays for Dallas Cowboys games in Unity 3D. Deployed on-site at NFL stadiums.' }, links:[['Details','projects/work/starview/starview.html']] },
        { img:'img/work-projects/Trigger/nhlARSplash.jpg', name:'NHL AR', type:'Main Developer', flavor:'AR hockey rink at NHL arenas with Intel.', back:{ title:'NHL AR', role:'Main Developer \u00B7 Nov 2018\u2014Jan 2019', body:'Prototype live AR hockey rink in Unity 3D. Deployed with Sharks and Golden Knights + Intel.' }, links:[['Details','projects/work/nhlAR/nhlAR.html']] },
        { img:'img/work-projects/Trigger/nbaARMain.jpg', name:'NBA AR', type:'Main Developer', flavor:'Mobile AR basketball via ARKit and ARCore.', back:{ title:'NBA AR', role:'Main Developer \u00B7 Mar 2018\u2014Sep 2019', body:'Shipped a mobile AR game and portal experience built with Unity 3D.' }, links:[['Details','projects/work/nbaAR/nbaAR.html']] },
        { img:'img/work-projects/Trigger/lenovoMirageARMain.jpg', name:'Lenovo Mirage AR', type:'Developer', flavor:'AR for the Lenovo Mirage headset.', back:{ title:'Lenovo Mirage AR', role:'Developer/Support \u00B7 Oct 2018', body:'AR applications developed for the Lenovo Mirage headset with Unity 3D.' }, links:[['Details','projects/work/lenovoMirageAR/lenovoMirageAR.html']] },
        { img:'img/work-projects/Trigger/generalmills-starwar_main_01.jpeg', name:'Star Wars AR', type:'Developer', flavor:'That Star Wars feeling in AR.', back:{ title:'General Mills \u2014 Star Wars AR', role:'Developer \u00B7 2019', body:'Several iterations of AR placement flow and post-processing effects.' }, links:[['View','https://www.triggerxr.com/work/general-mills-do-good-for-the-galaxy-ar']] },
        { img:'img/work-projects/Trigger/moviebill_feature_main_v02.jpg', name:'Moviebill', type:'Developer', flavor:'Asset management for the Moviebill app.', back:{ title:'Moviebill', role:'Developer \u00B7 2018', body:'Asset downloading/management, feature releases, bug fixes.' }, links:[['View','https://www.triggerxr.com/work/moviebill']] }
      ]
    },
    {
      id:'w-stb', name:'Super Toy Box', abbr:'Super Toy Box', cc:'#FF6B35',
      cards: [
        { img:'img/work-projects/SuperToyBox/stb-cap-subaru2.png', contain:true, name:'Subaru Wheelstand', type:'Sole Client Developer', flavor:'Show floor app with dynamic CMS by VIN.', back:{ title:'Subaru Wheelstand', role:'Sole Client Developer', body:'Client app from start to release for the show floor. Dynamic content pulled from CMS based on VIN.' }, links:[['View','https://www.offekt.com/archive/work/subaru-wheelstand.html']] },
        { img:'img/work-projects/SuperToyBox/vrFactory.PNG', contain:true, name:'VR Factory', type:'Client Developer', flavor:'CMS integration for custom VR builds.', back:{ title:'VR Factory', role:'Client Developer', body:'Unity client pulling from custom CMS to deploy builds. Flexible layouts coordinated with design and artists.' }, links:[['View','https://www.offekt.com/archive/supertoybox.html']] }
      ]
    }
  ],

  personalTabs: [
    {
      id:'pp-fc', name:'Friend Castle', abbr:'Friend Castle', cc:'#c13e5d',
      cards: [
        { img:'img/personal-projects/friendCastleRainbow.png', contain:true, name:'Friend Castle', type:'Co-Founder', flavor:'Indie game dev LLC.', back:{ title:'Friend Castle', role:'Co-Founder \u00B7 2023\u2014Present', body:'Indie game development LLC co-founded with friends. Services: design, engineering, production, publishing, and technical consulting for outside clients.' }, links:[['Website','https://friendcastle.org/home']] },
        { img:'img/personal-projects/schedazzle_promo.webp', contain:true, name:'Schedazzle', type:'Engineer/Lead', flavor:'Event scheduling for conventions.', back:{ title:'Schedazzle', role:'Engineer/Lead, Technical Producer', body:'Free event scheduling companion app. Promoters input schedules, attendees customize their itinerary on-device.' }, links:[['App Store','https://apps.apple.com/us/app/schedazzle/id6642688721'],['Google Play','https://play.google.com/store/apps/details?id=com.FriendCastle.Schedazzle']] },
        { img:'https://cdn.cloudflare.steamstatic.com/steam/apps/2991630/header.jpg', contain:true, name:'Box Dog', type:'Engineer/Lead', flavor:'Hidden object with hand-drawn levels.', back:{ title:'Box Dog', role:'Engineer/Lead, Technical Producer', body:'Guide Joget and Box Dog through vibrant worlds searching for mischievous Imps.' }, links:[['Steam','https://store.steampowered.com/app/2991630/']] },
        { kind:'emblem', abbr:'Gnome Hunt', name:'Gnome Hunt', type:'Niantic Contract', flavor:'AR game for Lightship SDK.', back:{ title:'Gnome Hunt', role:'Engineer/Lead \u00B7 Niantic', body:'AR game built as contract work for Niantic to showcase their Lightship SDK/API.' }, links:[['Video','https://www.youtube.com/watch?v=GnhbABKCzQs']] },
        { kind:'emblem', abbr:'Fairy Finder', name:'Fairy Finder', type:'Niantic Contract', flavor:'AR creature finder experience.', back:{ title:'Fairy Finder', role:'Engineer/Lead \u00B7 Niantic', body:'AR creature finder built as contract work for Niantic to showcase their Lightship SDK/API.' }, links:[['Video','https://www.youtube.com/watch?v=26JofclHeZc']] }
      ]
    },
    {
      id:'pp-wh', name:'Waxheart', abbr:'Waxheart', cc:'#8B6DAF',
      cards: [
        { img:'img/personal-projects/waxheartSplash.jpg', name:'Waxheart', type:'DevOps / Producer', flavor:'Built the entire infrastructure.', back:{ title:'Waxheart', role:'DevOps / Technical Producer \u00B7 2024\u2014Present', body:'Built Jenkins CI/CD, Discord bot, QA department from scratch. Sprint planning and release management.' }, links:[['View Game','https://waxheart.info/']] },
        { img:'img/personal-projects/waxheart%20jenkins%20pipeline.png', contain:true, name:'Jenkins Pipeline', type:'Build Infrastructure', flavor:'Full CI/CD from scratch.', back:{ title:'Jenkins Build Pipeline', body:'Complete Jenkins CI/CD pipeline for Unity builds including Steamworks integration.' }, links:[] },
        { img:'img/personal-projects/waxheart%20discord%20bot%20instructions.png', contain:true, name:'Discord Bot', type:'Build Notifications', flavor:'Triggers and coordination.', back:{ title:'Discord Bot', body:'Build notifications, triggers, and team coordination via Discord.' }, links:[] },
        { img:'img/personal-projects/waxheart%20jenkins%20discord%20bot%20error.png', contain:true, name:'Error Reporting', type:'Bot Integration', flavor:'Automated failure alerts.', back:{ title:'Error Reporting', body:'Jenkins-to-Discord error pipeline with formatted build failure reports.' }, links:[] },
        { img:'img/personal-projects/waxheart%20qa%20test%20case%20sheet.png', contain:true, name:'QA Test Cases', type:'Quality Assurance', flavor:'RC cycles and master sheets.', back:{ title:'QA Master Sheet', body:'Established RC test cycles, documentation, and the QA department from scratch.' }, links:[] }
      ]
    },
    {
      id:'pp-ai', name:'Games & Tools', abbr:'Games & Tools', cc:'#4ecdc4',
      cards: [
        { img:'tools/misery-index/og-image.png', contain:true, name:'Misery Index', type:'Dashboard', flavor:'Dev sentiment when Claude goes down.', back:{ title:'Claude Developer Misery Index', role:'Real-time Dashboard', body:'Combines status page, incidents, Reddit, Bluesky into a 0-10 misery score. Discord bot alerts on changes.' }, links:[['View','tools/misery-index/index.html']] },
        { img:'tools/snaplayout/og-image.png', contain:true, name:'SnapLayout', type:'Planning Tool', flavor:'Drag furniture with real dimensions.', back:{ title:'SnapLayout', role:'Room Layout Planner', body:'Import floorplan or draw rooms. Scale calibration, furniture library, undo/redo, PNG export.' }, links:[['Open','tools/snaplayout/index.html']] },
        { img:'games/philosophy/og-image.png', contain:true, name:'Examined', type:'Philosophy Quiz', flavor:'Which philosopher thinks like you?', back:{ title:'Examined', role:'Alignment Quiz', body:'12 dilemmas, 5 schools, 20 archetypes. Interactive compass, shareable ID cards.' }, links:[['Take Quiz','games/philosophy/index.html']] },
        { img:'games/parsed/og-image.png', contain:true, name:'Parsed', type:'Daily Code Puzzle', flavor:'Swap tokens to debug code.', back:{ title:'Parsed', role:'Daily Puzzle', body:'365 daily puzzles with themed narratives, execution animations, explanations, scoring.' }, links:[['Play','games/parsed/index.html']] },
        { img:'games/beamlab/og-image.png', contain:true, name:'Beamlab', type:'Daily Laser Puzzle', flavor:'Route lasers with mirrors.', back:{ title:'Beamlab', role:'Daily Puzzle', body:'365 puzzles across 3 tiers. Mirrors, beam splitters, gem collectibles, daily streaks.' }, links:[['Play','games/beamlab/index.html']] }
      ]
    },
    {
      id:'pp-web', name:'Website', abbr:'Website', cc:'#7ab8ff',
      cards: [
        { img:'img/personal-projects/website-eras/v1-origin.webp', contain:true, name:'Bootstrap Portfolio', type:'2016 \u2014 2025', flavor:'Class project that wouldn\u2019t die.', back:{ title:'Origin Era', role:'2016 \u2014 2025 \u00B7 Bootstrap & static HTML', body:'Started as a UCI UX/design research project in 2016. Plain HTML/CSS/JS + Bootstrap. Iterated gradually across ~9 years \u2014 carousel of work experience, tabbed project listings, social links. Always hand-written, no build system.' }, links:[['Original Research','projects/personal/portfolio.html']] },
        { img:'img/personal-projects/website-eras/v2-glass.webp', contain:true, name:'Glassmorphism', type:'Early 2026', flavor:'Dark glass. Sprites. Particles.', back:{ title:'Glass Era', role:'Early 2026 \u00B7 First full rewrite with AI', body:'Complete redesign: dark glassmorphism, animated career timeline with an LPC pixel sprite, particle effects, achievements system, self-hosted fonts, 280+ tests. First portfolio built end-to-end with Claude Code. Mobile-first responsive design.' }, links:[] },
        { img:'img/personal-projects/website-eras/v3-arcade.webp', contain:true, name:'Arcade Redesign', type:'2026 \u2014 Current', flavor:'You are here.', back:{ title:'Arcade Era', role:'2026 \u2014 Current \u00B7 You are here', body:'CRT bezel, walking character, 5 arcade cabinets. Each section themed: About is an MTG commander board, Work/Personal are decks of cards you play, Play is the games room. Unified sprite navigation, 3D deck boxes, peek-flip cards, gallery slideshows.' }, links:[] }
      ]
    },
    {
      id:'pp-col', name:'College', abbr:'College', cc:'#FFD100',
      cards: [
        { img:'img/personal-projects/spookyspoils.jpg', name:'Spooky Spoils', type:'Engineer', flavor:'Eye-tracking horror puzzle.', back:{ title:'Spooky Spoils', role:'Engineer', body:'Award for Creativity \u2014 IEEE GameSig 2016. Best Game Design \u2014 VGDC at UCI 2016.' }, links:[['Video','https://youtu.be/mqumUz5ktdY'],['Details','projects/personal/spookyspoils.html']] },
        { img:'img/personal-projects/goinghome.jpg', name:'Going Home', type:'Engineer', flavor:'Rogue-like survival at sea.', back:{ title:'Going Home', role:'Engineer \u00B7 Python/Pygame', body:'Make it home in rough seas with limited power!' }, links:[['Video','https://youtu.be/bB11x5bz4Wk'],['Details','projects/personal/goinghome.html']] },
        { img:'img/personal-projects/Left To Die.jpg', name:'Left 2 Die', type:'Engineer, Designer', flavor:'Invert the level to solve it.', back:{ title:'Left 2 Die', role:'Engineer, Designer', body:'2nd Place \u2014 VGDC at UCI 2015. Turn left and right to invert the level!' }, links:[['Video','https://youtu.be/Pw06Zx9Awik'],['Details','projects/personal/lefttodie.html']] },
        { img:'img/personal-projects/monochrome.jpg', name:'Monochrome Memories', type:'Lead Engineer', flavor:'5 stages of grief.', back:{ title:'Monochrome Memories', role:'Lead Engineer, Producer', body:'Puzzle platformer. Walk through grief with your counterpart.' }, links:[['Details','projects/personal/monochrome.html']] },
        { img:'img/personal-projects/scuminvaders.jpg', name:'Scuminvaders', type:'Lead Engineer', flavor:'Multiplayer space invaders.', back:{ title:'Scuminvaders', role:'Lead Engineer, Producer', body:'Python/Pygame TCP multiplayer. Space invaders with pizzazz!' }, links:[['Video','https://youtu.be/-R9o7FAty8o']] },
        { img:'img/personal-projects/lifeofpymenu.jpg', name:'Life of Py', type:'Lead Engineer', flavor:'Teach kids Python.', back:{ title:'Life of Py', role:'Lead Engineer, Designer, Producer', body:'Educational game teaching Python basics in a fun way.' }, links:[['Details','projects/personal/lifeofpy.html']] },
        { img:'img/personal-projects/scallywags.jpg', name:'Scallywags', type:'Designer', flavor:'Competitive pirate cards.', back:{ title:'Scallywags', role:'Designer', body:'Competitive solitaire. Stack against pirates for the title of Captain!' }, links:[['Details','projects/personal/scallywags.html']] },
        { img:'img/personal-projects/Date or Die Title.jpg', name:'Date or Die', type:'Designer', flavor:'Love or die trying!', back:{ title:'Date or Die', role:'Designer', body:'Dating simulator visual novel. Fall madly in love... or die trying!' }, links:[['Details','projects/personal/dateordie.html']] }
      ]
    }
  ],

  arcadeRow: [
    { id:'beamlab',  name:'Beamlab',      glyph:'///',         desc:'Daily laser puzzle', cc:'#9b6dff', url:'games/beamlab/index.html' },
    { id:'parsed',   name:'Parsed',       glyph:'</>',         desc:'Daily code puzzle',  cc:'#4ecdc4', url:'games/parsed/index.html' },
    { id:'examined', name:'Examined',     glyph:'?',           desc:'Philosophy quiz',    cc:'#ff6b9d', url:'games/philosophy/index.html' },
    { id:'snap',     name:'SnapLayout',   glyph:'\u25A6\uFE0E',desc:'Room planner',       cc:'#ff8a50', url:'tools/snaplayout/index.html' },
    { id:'misery',   name:'Misery Index', glyph:'!',           desc:'Outage sentiment',   cc:'#4a90d9', url:'tools/misery-index/index.html' }
  ]
};
