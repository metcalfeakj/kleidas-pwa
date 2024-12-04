import { writable } from 'svelte/store';

// Reactive state for the selected book and chapter
export const selectedBook = writable('John'); // Default book
export const selectedChapter = writable(1);   // Default chapter

// Other shared states
export const books = writable([]); // Holds the list of books
export const searchQuery = writable(''); // For the search bar
export const selectedVerses = writable<string[]>([]); // Holds the selected verses
export const isSidebarOpen = writable(false); // Tracks sidebar state