/**
 * Type declarations for reveal.js
 */
declare module 'reveal.js' {
    interface RevealOptions {
        hash?: boolean;
        slideNumber?: boolean | 'c' | 'c/t' | boolean;
        transition?: string;
        backgroundTransition?: string;
        keyboard?: boolean;
        [key: string]: unknown;
    }

    class Reveal {
        constructor(element: Element | string, options?: RevealOptions);
        initialize(): Promise<void>;
        sync(): void;
        layout(): void;
        destroy(): void;
        slide(slideIndexH: number, slideIndexV?: number, slideIndexF?: number, silent?: boolean): void;
        next(): void;
        prev(): void;
        nextFragment(): boolean;
        prevFragment(): boolean;
        getIndices(): { h: number; v: number; f?: number };
        getSlide(slideIndex: number): HTMLElement | undefined;
        getCurrentSlide(): HTMLElement;
        getConfig(): RevealOptions;
    }

    export default Reveal;
}

declare module 'reveal.js/plugin/markdown/markdown.esm.js' {
    interface RevealPlugin {
        id: string;
        init(deck: import('reveal.js').default): void | Promise<void>;
    }
    const RevealMarkdown: RevealPlugin;
    export default RevealMarkdown;
}

declare module 'reveal.js/plugin/highlight/highlight.esm.js' {
    interface RevealPlugin {
        id: string;
        init(deck: import('reveal.js').default): void | Promise<void>;
    }
    const RevealHighlight: RevealPlugin;
    export default RevealHighlight;
}

declare module 'reveal.js/plugin/notes/notes.esm.js' {
    interface RevealPlugin {
        id: string;
        init(deck: import('reveal.js').default): void | Promise<void>;
    }
    const RevealNotes: RevealPlugin;
    export default RevealNotes;
}

declare module 'reveal.js/dist/theme/beige.css';
declare module 'reveal.js/dist/theme/black-contrast.css';
declare module 'reveal.js/dist/theme/black.css';
declare module 'reveal.js/dist/theme/blood.css';
declare module 'reveal.js/dist/theme/dracula.css';
declare module 'reveal.js/dist/theme/league.css';
declare module 'reveal.js/dist/theme/moon.css';
declare module 'reveal.js/dist/theme/night.css';
declare module 'reveal.js/dist/theme/serif.css';
declare module 'reveal.js/dist/theme/simple.css';
declare module 'reveal.js/dist/theme/sky.css';
declare module 'reveal.js/dist/theme/solarized.css';
declare module 'reveal.js/dist/theme/white-contrast.css';
declare module 'reveal.js/dist/theme/white.css';
declare module 'reveal.js/dist/theme/white_contrast_compact_verbatim_headers.css';
