import { writable } from 'svelte/store';

export const selectedBook = writable<string>('Genesis');
export const selectedChapter = writable<number>(1);
export const selectedVerses = writable<number[]>([]);
export const error = writable<string | null>(null);

// Function to load cached state
export function loadCachedState() {
    const cachedState = localStorage.getItem('bible-viewer-state');
    if (cachedState) {
        try {
            const { book, chapter, verses } = JSON.parse(cachedState);
            selectedBook.set(book || 'Genesis');
            selectedChapter.set(chapter || 1);
            selectedVerses.set(verses || []);
        } catch {
            console.warn('Failed to parse cached state.');
        }
    }
}

// Function to save current state to cache
export function saveCachedState() {
    // Subscribe to changes in state and persist them
    selectedBook.subscribe((book) => {
        selectedChapter.subscribe((chapter) => {
            selectedVerses.subscribe((verses) => {
                const state = JSON.stringify({ book, chapter, verses });
                localStorage.setItem('bible-viewer-state', state);
            });
        });
    });
}

// Initialize the store with cached data by default
loadCachedState();
