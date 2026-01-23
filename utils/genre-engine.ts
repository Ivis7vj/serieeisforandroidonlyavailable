
export const TMDB_GENRES: Record<string, number> = {
    'Drama': 18,
    'Thriller': 10768, // War & Politics often overlaps, but 10768 is "Action & Adventure". TMDB "Thriller" for TV is actually not a primary ID usually, it's often 80 (Crime) or 9648 (Mystery). 
    'Crime': 80,
    'Mystery': 9648,
    'Horror': 10765, // Sci-Fi & Fantasy often covers horror for TV. There's no pure "Horror" TV genre ID in TMDB.
    'Romance': 10749,
    'Comedy': 35,
    'Action & Adventure': 10759,
    'Sci-Fi & Fantasy': 10765,
    'Animation': 16,
    'Family': 10751,
    'Documentary': 99,
    'War & Politics': 10768,
    'Western': 37,
    'Reality': 10764,
    'Soap': 10766,
    'Talk Show': 10767,
    'News': 10763
};

export const NANO_GENRES: Record<string, string[]> = {
    // 🧠 MIND & STORY TYPE
    'Psychological': ['psychological', 'mind', 'mental', 'perspective', 'obsessive', 'instability'],
    'Mind-Bending': ['mind-bending', 'twisted', 'reality', 'perception', 'confusing', 'illusion'],
    'Non-Linear': ['non-linear', 'timeline', 'flashback', 'structure', 'fragmented'],
    'Unreliable Narrator': ['unreliable', 'narrator', 'truth', 'perception', 'deception'],
    'Time Loop': ['time loop', 'repeat', 'loop', 'reset', 'cycle'],
    'Parallel Timeline': ['parallel', 'timeline', 'alternate', 'universe', 'dimension'],
    'Memory Loss': ['memory', 'amnesia', 'forget', 'recall', 'recollection'],
    'Split Personality': ['personality', 'identity', 'split', 'dual', 'alter'],
    'Dream Logic': ['dream', 'surreal', 'logic', 'fantasy', 'abstract'],

    // 😈 DARK / MATURE
    'Mature Themes': ['mature', 'theme', 'adult', 'heavy', 'serious', 'complexity'],
    'Explicit Language': ['language', 'profanity', 'curse', 'swearing', 'slang'],
    'Violence Heavy': ['violence', 'brutal', 'blood', 'gore', 'action', 'killing'],
    'Sexual Themes': ['sexual', 'romance', 'intimacy', 'attraction', 'passion', 'relationship'],
    'Power Dynamics': ['power', 'control', 'influence', 'hierarchy', 'struggle'],
    'Obsession': ['obsession', 'stalk', 'unhealthy', 'fixation', 'addicted'],
    'Addiction': ['addiction', 'drugs', 'alcohol', 'substance', 'dependency'],
    'Toxic Relationships': ['toxic', 'abusive', 'relationship', 'manipulation', 'unhealthy'],
    'Crime Brutality': ['brutal', 'crime', 'murder', 'assault', 'violent'],
    'Moral Ambiguity': ['moral', 'ambiguity', 'choices', 'gray', 'dilemma', 'ethics'],

    // 😱 HORROR SUB-TYPES
    'Psychological Horror': ['psychological', 'horror', 'fear', 'dread', 'unsettling'],
    'Supernatural Horror': ['supernatural', 'ghost', 'demon', 'spirit', 'entity'],
    'Body Horror': ['body', 'transformation', 'physical', 'mutation', 'grotesque'],
    'Occult': ['occult', 'ritual', 'cult', 'magic', 'darkness'],
    'Possession': ['possession', 'demon', 'spirit', 'control', 'exorcism'],
    'Folk Horror': ['folk', 'rural', 'tradition', 'pagan', 'legend'],
    'Survival Horror': ['survival', 'trapped', 'escape', 'alive', 'danger'],
    'Slasher': ['slasher', 'serial killer', 'killer', 'stalker', 'victim'],
    'Cosmic Horror': ['cosmic', 'lovecraft', 'elder', 'insanity', 'universe'],

    // 💔 EMOTIONAL / ROMANCE
    'Slow Burn Romance': ['slow burn', 'gradual', 'pacing', 'tension', 'romance'],
    'Tragic Love': ['tragic', 'heartbreak', 'loss', 'sad', 'unhappy'],
    'Forbidden Love': ['forbidden', 'secret', 'taboo', 'love', 'hidden'],
    'Love Triangle': ['triangle', 'love', 'choice', 'rivalry', 'romance'],
    'Emotional Trauma': ['trauma', 'emotional', 'pain', 'scar', 'healing'],
    'Healing Journey': ['healing', 'journey', 'recovery', 'growth', 'peace'],
    'Second Chances': ['second chance', 'regret', 'opportunity', 'redemption', 'return'],

    // 🚓 CRIME / INVESTIGATION
    'Serial Killer': ['serial killer', 'killer', 'murderer', 'psychopath', 'pattern'],
    'Whodunit': ['whodunit', 'mystery', 'detective', 'clue', 'solve'],
    'True Crime': ['true crime', 'real', 'factual', 'case', 'documentary'],
    'Courtroom Drama': ['court', 'law', 'lawyer', 'trial', 'legal', 'justice'],
    'Gang Wars': ['gang', 'war', 'rivalry', 'territory', 'mob', 'crime'],
    'Mafia': ['mafia', 'mob', 'organized crime', 'family', 'syndicate'],
    'Drug Cartels': ['cartel', 'drug', 'smuggling', 'narco', 'trafficking'],
    'Undercover Ops': ['undercover', 'agent', 'spy', 'infiltration', 'mission'],

    // 🧪 SCI-FI / FANTASY
    'Time Travel': ['time travel', 'future', 'past', 'time machine', 'history'],
    'AI & Consciousness': ['ai', 'robot', 'consciousness', 'intelligence', 'android'],
    'Dystopian': ['dystopian', 'future', 'society', 'control', 'oppression'],
    'Post-Apocalyptic': ['post-apocalyptic', 'survival', 'aftermath', 'world', 'ruin'],
    'Cyberpunk': ['cyberpunk', 'technology', 'neon', 'high-tech', 'low-life'],
    'Space Opera': ['space', 'galaxy', 'planet', 'empire', 'star'],
    'Multiverse': ['multiverse', 'parallel', 'universe', 'dimension', 'reality'],
    'Alien Contact': ['alien', 'extraterrestrial', 'contact', 'encounter', 'ufo'],

    // 🏰 HISTORICAL / POLITICAL
    'Royal Politics': ['royal', 'king', 'queen', 'court', 'monarchy', 'power'],
    'Empire Rise/Fall': ['empire', 'conquest', 'fall', 'rise', 'history'],
    'War Strategy': ['war', 'strategy', 'battle', 'military', 'command'],
    'Colonial Era': ['colonial', 'empire', 'history', 'settlement', 'exploration'],
    'Revolution': ['revolution', 'rebel', 'uprising', 'freedom', 'resistance'],
    'Biographical': ['biography', 'life', 'true story', 'real person', 'historical'],
    'Historical Romance': ['historical', 'period', 'romance', 'love', 'costume'],

    // 🌍 REGIONAL / CULTURAL
    'Tamil Originals': ['tamil', 'chennai', 'india', 'culture'],
    'Indian Political Drama': ['india', 'politics', 'delhi', 'government', 'scandal'],
    'Korean Dark Drama': ['korea', 'dark', 'revenge', 'gritty', 'thriller'],
    'Nordic Noir': ['nordic', 'scandinavia', 'noir', 'crime', 'cold', 'gloomy'],
    'British Crime': ['british', 'uk', 'london', 'crime', 'detective'],
    'European Art Drama': ['european', 'europe', 'art', 'cinema', 'drama'],
    'Japanese Psychological': ['japan', 'psychological', 'anime', 'manga', 'spirit'],
    'Middle-East Conflict Drama': ['middle east', 'conflict', 'war', 'politics', 'history'],

    // 👁️‍🗨️ MOOD-BASED
    'Dark': ['dark', 'grim', 'noir', 'somber', 'shadow'],
    'Gritty': ['gritty', 'raw', 'realistic', 'unfiltered', 'tough'],
    'Emotional': ['emotional', 'heartfelt', 'moving', 'touching', 'tearjerker'],
    'Comfort Watch': ['comfort', 'lighthearted', 'feel-good', 'easy', 'happy'],
    'Intense': ['intense', 'thrilling', 'powerful', 'gripping', 'edge'],
    'Disturbing': ['disturbing', 'shocking', 'unsettling', 'uncomfortable'],
    'Uplifting': ['uplifting', 'inspiring', 'positive', 'hopeful', 'motivating'],
    'Suspenseful': ['suspense', 'tension', 'mystery', 'anticipation', 'mystery'],
    'Binge-Heavy': ['binge', 'hooks', 'cliffhanger', 'addictive', 'fast-paced']
};

export const SECONDARY_GENRES: Record<string, string[]> = {
    'Romantic Thriller': ['Romance', 'Thriller'],
    'Crime Drama': ['Crime', 'Drama'],
    'Psychological Horror': ['Psychological', 'Horror'],
    'Political Thriller': ['War & Politics', 'Thriller'],
    'Sci-Fi Drama': ['Sci-Fi & Fantasy', 'Drama'],
    'Dark Comedy': ['Dark', 'Comedy'],
    'Supernatural Mystery': ['Supernatural', 'Mystery'],
    'Action Crime': ['Action & Adventure', 'Crime'],
    'Historical Drama': ['Drama', 'Biographical', 'History']
};

export function getSeriesRelevanceScore(item: any, query: string, moodName?: string, genreId?: number): number {
    let score = 0;
    const overview = (item.overview || "").toLowerCase();
    const title = (item.name || "").toLowerCase();
    const gids = item.genre_ids || [];

    // 1️⃣ PRIMARY MATCH (+10)
    if (genreId && gids.includes(genreId)) score += 10;
    if (moodName && TMDB_GENRES[moodName] && gids.includes(TMDB_GENRES[moodName])) score += 10;

    // 2️⃣ SECONDARY MATCH (+6)
    for (const [sName, primaryList] of Object.entries(SECONDARY_GENRES)) {
        if (query.toLowerCase().includes(sName.toLowerCase())) {
            const hasAll = primaryList.every(p => {
                const pId = TMDB_GENRES[p];
                return pId && gids.includes(pId);
            });
            if (hasAll) score += 6;
        }
    }

    // 3️⃣ NANO-GENRE MATCH (+4)
    for (const [nano, keywords] of Object.entries(NANO_GENRES)) {
        if (query.toLowerCase().includes(nano.toLowerCase()) || (moodName && moodName.toLowerCase() === nano.toLowerCase())) {
            const hasKeyword = keywords.some(k => overview.includes(k) || title.includes(k));
            if (hasKeyword) score += 4;
        }
    }

    // 4️⃣ MOOD MATCH (+3)
    const moods = ['Dark', 'Gritty', 'Emotional', 'Comfort Watch', 'Intense', 'Disturbing', 'Uplifting', 'Suspenseful', 'Binge-Heavy'];
    for (const mood of moods) {
        if (overview.includes(mood.toLowerCase())) score += 3;
    }

    // 5️⃣ TRENDING BOOST (+2)
    if (item.popularity > 100) score += 2;

    return score;
}

export function getContentFlags(item: any) {
    const overview = (item.overview || "").toLowerCase();
    const isMature = item.content_ratings?.results?.some((r: any) => ['TV-MA', '18', 'A', 'R'].includes(r.rating)) || item.adult;

    return {
        isMature,
        hasViolence: overview.includes('violence') || overview.includes('brutal') || overview.includes('killer'),
        hasSexualThemes: overview.includes('sexual') || overview.includes('passion') || overview.includes('affair'),
        hasStrongLanguage: overview.includes('language') || overview.includes('profanity'),
        isAdultRated: isMature
    };
}
