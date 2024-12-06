import { writable, type Writable } from 'svelte/store';
import type { Book } from '$lib/db';

export type Verse = {
	VerseNumber: number;
	Text: string;
	copied: boolean;
	domElement?: HTMLElement;
	selected?: boolean;
};

export type BibleState = {
	books: Book[];
	selectedBook: string;
	selectedChapter: number;
	chapters: number[]; // Array of chapter numbers
	verses: Verse[]; // Array of verses
	selectedVerses: string[]; // Array of selected verse texts
	error: string | null;
	isSidebarOpen: boolean;
};

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
