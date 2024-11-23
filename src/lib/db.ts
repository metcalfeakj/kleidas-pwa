import Dexie from 'dexie';

interface Verse {
  VerseNumber: number;
  Text: string;
}

interface Chapter {
  ChapterNumber: number;
  Verses: Verse[];
}

interface Book {
  id?: number; // Optional primary key for Dexie
  BookID: number; // Unique identifier for the book
  BookName: string; // Name of the book (e.g., "Genesis", "John")
  TotalChapters: number; // Total number of chapters in the book
  Chapters: Chapter[]; // Array of chapters in the book
}

const db = new Dexie('BibleDatabase');

db.version(1).stores({
  books: '++id, BookName', // Primary key: id, Indexed field: BookName
});

// Function to populate the database
async function populateDatabase(jsonUrl: string) {
  try {
    const count = await db.table('books').count();
    if (count > 0) {
      console.log('Bible data already exists in IndexedDB.');
      return;
    }

    const response = await fetch(jsonUrl);
    const bibleData = await response.json();

    await db.table('books').bulkAdd(bibleData);
    console.log('Bible loaded into IndexedDB successfully!');
  } catch (error) {
    console.error('Error loading Bible data into IndexedDB:', error);
    throw error; // Ensure any error propagates
  }
}

export type { Book, Chapter, Verse };
export { db, populateDatabase };
