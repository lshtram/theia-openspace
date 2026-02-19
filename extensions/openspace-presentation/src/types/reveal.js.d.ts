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
