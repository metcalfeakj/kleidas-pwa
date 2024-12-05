import Dexie from 'dexie';
import SHA256 from 'crypto-js/sha256';

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
	BookAbbr: string;
	TotalChapters: number; // Total number of chapters in the book
	Chapters: Chapter[]; // Array of chapters in the book
}

const db = new Dexie('BibleDatabase');

db.version(1).stores({
	books: '++id, BookName', // Table for books
	metadata: 'key' // Table for metadata (e.g., hash storage)
});

// Function to generate a hash of a dataset
async function generateHash(data: unknown): Promise<string> {
	const hash = SHA256(JSON.stringify(data)).toString();
	return hash;
}

// Function to reload the database if there is a mismatch
async function reloadDatabaseWithHashing(jsonUrl: string) {
  try {
    // Fetch JSON data
    const response = await fetch(jsonUrl);
    const jsonData: Book[] = await response.json();

    // Generate hash for JSON data
    const jsonHash = await generateHash(jsonData);

    // Retrieve cached data from IndexedDB
    const cachedData: Book[] = await db.table('books').toArray();

    // Generate hash for cached data
    const cachedHash = await generateHash(cachedData);

    // Compare hashes
    if (jsonHash !== cachedHash) {
      console.log('Data mismatch detected. Reloading database...');

      // Clear the old data
      await db.table('books').clear();

      // Populate the database with new JSON data
      await db.table('books').bulkAdd(jsonData);
      console.log('Database updated successfully!');
    } else {
      console.log('Cached data matches JSON. No action needed.');
    }
  } catch (error) {
    console.error('Error reloading Bible data:', error);
    throw error;
  }
}

export type { Book, Chapter, Verse };
export { db, reloadDatabaseWithHashing };
