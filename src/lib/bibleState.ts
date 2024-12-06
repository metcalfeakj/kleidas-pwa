// biblestate.ts
import { writable, type Writable } from 'svelte/store';
import type { Book, Verse as DBVerse } from '$lib/db'; // Import types from db.ts

// Extend the Verse type from db.ts
export interface Verse extends DBVerse {
	copied: boolean;
	domElement?: HTMLElement;
	selected?: boolean;
}

// Define BibleState using the imported `Book` type and extended `Verse` type
export type BibleState = {
	books: Book[];
	selectedBook: string; // The name of the selected book
	selectedChapter: number;
	chapters: number[]; // Array of chapter numbers for the selected book
	verses: Verse[]; // Array of verses for the selected chapter
	selectedVerses: string[]; // Array of selected verse texts
	error: string | null;
	isSidebarOpen: boolean;
};

// Create the writable store with the initial state
export const bibleState: Writable<BibleState> = writable({
	books: [],
	selectedBook: 'John',
	selectedChapter: 1,
	chapters: [],
	verses: [],
	selectedVerses: [],
	error: null,
	isSidebarOpen: false
});