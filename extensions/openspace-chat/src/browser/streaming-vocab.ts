/**
 * Streaming activity vocabulary.
 *
 * Each key is a category that maps to a pool of phrases shown in the
 * TurnGroup activity bar while the agent is working.
 *
 * ── HOW TO EDIT ──────────────────────────────────────────────────────────────
 * Replace the phrase arrays below with your curated vocabulary.
 * Rules:
 *   - Present participle form: "Pondering", "Digging through files", etc.
 *   - Each entry can be one word or a short phrase (2–5 words max)
 *   - At least 3 entries per category (more = less repetition)
 *   - The runtime picks a random phrase when a category starts, then rotates
 *     through the pool every PHRASE_ROTATION_MS milliseconds.
 *
 * Chaos tier: ~1% of picks will randomly draw from CHAOS_VOCAB instead of
 * the active category pool. Raise CHAOS_PROBABILITY to taste.
 * ─────────────────────────────────────────────────────────────────────────────
 */

/** How long (ms) each phrase is shown before rotating to the next. */
export const PHRASE_ROTATION_MS = 3500;

/**
 * Probability (0–1) that any phrase pick draws from the chaos pool instead
 * of the active category. 0.01 = 1%.
 */
export const CHAOS_PROBABILITY = 0.01;

/** All recognised streaming activity categories. */
export type StreamingCategory =
    | 'thinking'
    | 'reasoning'
    | 'bash'
    | 'read'
    | 'search'
    | 'edit'
    | 'webfetch'
    | 'task'
    | 'todo'
    | 'idle'
    | 'mcp';

/**
 * Vocabulary map — category → phrase pool.
 */
export const STREAMING_VOCAB: Record<StreamingCategory, string[]> = {
    thinking: [
        'Pondering',
        'Musing',
        'Contemplating',
        'Cogitating',
        'Speculating',
        'Reflecting',
        'Imagining',
        'Ruminating',
        'Meditating',
        'Visualizing',
        'Conceptualizing',
        'Wondering',
        'Daydreaming',
        'Brainstorming',
        'Envisioning',
        'Ideating',
        'Intuiting',
        'Recollecting',
        'Synthesizing',
        'Abstracting',
        'Perpending',
    ],

    reasoning: [
        'Analyzing',
        'Inferring',
        'Deducing',
        'Calculating',
        'Validating',
        'Reconciling',
        'Comparing',
        'Verifying',
        'Structuring',
        'Formalizing',
        'Modeling',
        'Optimizing',
        'Resolving',
        'Refining',
        'Bounding',
        'Projecting',
        'Interpreting',
        'Triangulating',
        'Rationalizing',
        'Evaluating',
        'Elucubrating',
    ],

    bash: [
        'Executing',
        'Launching',
        'Invoking',
        'Compiling',
        'Installing',
        'Bootstrapping',
        'Deploying',
        'Streaming',
        'Pipelining',
        'Unpacking',
        'Mounting',
        'Linking',
        'Building',
        'Cleaning',
        'Synchronizing',
        'Triggering',
        'Cranking',
        'Activating',
        'Engaging',
        'Initializing',
        'Bethumping',
    ],

    read: [
        'Reading',
        'Scanning',
        'Parsing',
        'Reviewing',
        'Examining',
        'Absorbing',
        'Browsing',
        'Surveying',
        'Studying',
        'Decoding',
        'Extracting',
        'Following',
        'Sampling',
        'Tracing',
        'Noticing',
        'Scrutinizing',
        'Perusing',
        'Ingesting',
        'Observing',
        'Inspecting',
        'Conning',
    ],

    search: [
        'Searching',
        'Locating',
        'Matching',
        'Querying',
        'Filtering',
        'Enumerating',
        'Discovering',
        'Indexing',
        'Detecting',
        'Spotting',
        'Surfacing',
        'Pinpointing',
        'Identifying',
        'Traversing',
        'Cataloging',
        'Tracking',
        'Seeking',
        'Scouring',
        'Mapping',
        'Grepping',
        'Ferreting',
    ],

    edit: [
        'Writing',
        'Editing',
        'Drafting',
        'Composing',
        'Creating',
        'Refactoring',
        'Revising',
        'Updating',
        'Modifying',
        'Adjusting',
        'Improving',
        'Enhancing',
        'Rewriting',
        'Correcting',
        'Formatting',
        'Extending',
        'Transforming',
        'Rebuilding',
        'Repairing',
        'Polishing',
        'Emending',
    ],

    webfetch: [
        'Fetching',
        'Crawling',
        'Gathering',
        'Collecting',
        'Visiting',
        'Consulting',
        'Requesting',
        'Retrieving',
        'Navigating',
        'Pulling',
        'Loading',
        'Contacting',
        'Accessing',
        'Opening',
        'Downloading',
        'Polling',
        'Pinging',
        'Posting',
        'Rendering',
        'Negotiating',
        'Scrutating',
    ],

    task: [
        'Delegating',
        'Assigning',
        'Managing',
        'Directing',
        'Orchestrating',
        'Recruiting',
        'Enlisting',
        'Commanding',
        'Mobilizing',
        'Supervising',
        'Guiding',
        'Initiating',
        'Spawning',
        'Issuing',
        'Passing',
        'Summoning',
        'Assembling',
        'Offloading',
        'Coordinating',
        'Routing',
        'Deputizing',
    ],

    todo: [
        'Planning',
        'Scheduling',
        'Organizing',
        'Prioritizing',
        'Sequencing',
        'Arranging',
        'Designing',
        'Forecasting',
        'Budgeting',
        'Estimating',
        'Strategizing',
        'Aligning',
        'Plotting',
        'Charting',
        'Outlining',
        'Anticipating',
        'Staging',
        'Queuing',
        'Roadmapping',
        'Scoping',
        'Contriving',
    ],

    idle: [
        'Don\'t panic',
        'Being one with the universe',
        'Practicing being',
        'Achieving inner peace',
        'Holding the door',
        'Resting and vesting',
        'Learning to love myself',
        'Contemplating the void',
        'Waiting for the next episode',
        'Keeping calm and carrying on',
        'Just vibing',
        'Loading\u2026',
        'Staring into the abyss',
        'Sojourning',
    ],

    mcp: [
        'Experimenting',
        'Probing',
        'Testing',
        'Exploring',
        'Investigating',
        'Learning',
        'Interacting',
        'Assessing',
        'Attempting',
        'Trying',
        'Improvising',
        'Handling',
        'Integrating',
        'Calibrating',
        'Diagnosing',
        'Assimilating',
        'Sensing',
        'Iterating',
        'Prototyping',
        'Tinkering',
        'Divining',
    ],
};

/**
 * Chaos tier — replaces the active phrase with ~1% probability.
 * Multi-word entries use non-breaking hyphens to prevent line wrapping.
 */
export const CHAOS_VOCAB: string[] = [
    'Befuddling',
    'Fooming',
    'Hyperventilating',
    'Recompiling destiny',
    'Phase\u2011shifting',
    'Quantum\u2011tunneling',
    'Yak\u2011shaving',
    'Rubber\u2011ducking',
    'Bit\u2011twiddling',
    'Fluxing',
    'Transmogrifying',
    'Time\u2011dilating',
    'Faber\u2011blasting',
    'Reality\u2011patching',
    'Cache\u2011summoning',
    'Semaphore\u2011dancing',
    'Thread\u2011weaving',
    'Packet\u2011whispering',
    'Entropy\u2011balancing',
    'Schr\u00f6dinger\u2011debugging',
    'Kernel\u2011tickling',
    'Heap\u2011massaging',
    'Stack\u2011conjuring',
    'Monad\u2011wrangling',
    'Byte\u2011herding',
    'Signal\u2011juggling',
    'Cosmic\u2011garbage\u2011collecting',
    'Timeline\u2011rebasing',
    'Causality\u2011merging',
    'Probability\u2011nudging',
];

/**
 * Pick a phrase for the given category.
 *
 * With CHAOS_PROBABILITY chance the pick comes from CHAOS_VOCAB instead of
 * the category pool. Otherwise a random entry is chosen from the pool
 * (index is used as a seed so the phrase stays stable across re-renders
 * within the same rotation tick).
 */
export function pickPhrase(category: StreamingCategory, index: number): string {
    if (Math.random() < CHAOS_PROBABILITY) {
        return CHAOS_VOCAB[Math.floor(Math.random() * CHAOS_VOCAB.length)];
    }
    const pool = STREAMING_VOCAB[category];
    return pool[index % pool.length];
}

/**
 * Map a raw status string (emitted by session-service) to a StreamingCategory.
 */
export function statusToCategory(status: string): StreamingCategory {
    switch (status) {
        case 'thinking':   return 'thinking';
        case 'reasoning':  return 'reasoning';
        case 'bash':       return 'bash';
        case 'read':       return 'read';
        case 'search':     return 'search';
        case 'edit':       return 'edit';
        case 'webfetch':   return 'webfetch';
        case 'task':       return 'task';
        case 'todo':       return 'todo';
        case 'idle':       return 'idle';
        case 'mcp':        return 'mcp';
        default:           return 'thinking';
    }
}
