<script lang="ts">
	import { bookMapping } from '$lib/bookMapping';
	import { db } from '$lib/db';

	let searchQuery = ''; // Holds the user's input (e.g., "John 1:1-5")
	let results: string | any[] = []; // Holds the search results (array of verse objects)
	let error: string | null = null; // Holds error messages, if any

	// Search function
    async function searchVerse() {
	error = null; // Reset errors
	results = []; // Reset results

	try {
		// Parse the search query (e.g., "John 1" or "John 1:1-5")
		const regex = /(\d?\s?\w+)\s*(\d+)?(?::(\d+)(?:-(\d+))?)?/i;
		const match = searchQuery.match(regex);

		if (!match) {
			throw new Error(
				'Invalid format. Please use "Book Chapter", "Book Chapter:Verse", or "Book Chapter:Verse-Range" (e.g., "John 1", "John 1:1", "John 1:1-5").'
			);
		}

		const bookAbbr = match[1].toLowerCase().replace(/\s+/g, '');
		const bookName = bookMapping[bookAbbr] || bookAbbr;
		const chapterNumber = match[2] ? parseInt(match[2]) : null;
		const startVerseNumber = match[3] ? parseInt(match[3]) : null;
		const endVerseNumber = match[4] ? parseInt(match[4]) : null;

		if (!chapterNumber) {
			throw new Error('Please specify at least a chapter (e.g., "John 1").');
		}

		// Fetch the book
		const book = await db.table('books').where({ BookName: bookName }).first();
		if (!book) throw new Error(`Book "${bookName}" not found.`);

		// Fetch the chapter
		const chapter = book.Chapters.find(
			(ch: { ChapterNumber: number }) => ch.ChapterNumber === chapterNumber
		);
		if (!chapter) throw new Error(`Chapter ${chapterNumber} not found in "${bookName}".`);

		// Determine the range of verses to fetch
		const rangeStart = startVerseNumber || 1; // Default to first verse if no specific start verse
		const rangeEnd = startVerseNumber
			? endVerseNumber || (searchQuery.includes('-') ? chapter.Verses[chapter.Verses.length - 1].VerseNumber : rangeStart) // Last verse if hyphen
			: chapter.Verses[chapter.Verses.length - 1].VerseNumber; // Entire chapter if no verse specified

		// Validate the range
		if (rangeStart > rangeEnd) {
			throw new Error(
				`Invalid range: Start verse (${rangeStart}) cannot be greater than end verse (${rangeEnd}).`
			);
		}

		// Fetch the verses within the range
		const versesInRange = chapter.Verses.filter(
			(v: { VerseNumber: number }) => v.VerseNumber >= rangeStart && v.VerseNumber <= rangeEnd
		);

		if (versesInRange.length === 0) {
			throw new Error(
				`No verses found in the specified range (${rangeStart}-${rangeEnd}) of "${bookName} ${chapterNumber}".`
			);
		}

		// Assign results
		results = versesInRange.map((v: { VerseNumber: number; Text: string }) => ({
			BookName: book.BookName,
			ChapterNumber: chapter.ChapterNumber,
			VerseNumber: v.VerseNumber,
			Text: v.Text
		}));
	} catch (err) {
		error = (err as Error).message || 'An error occurred during the search.';
	}
}

</script>

<main>
	<h1>Bible Search</h1>
	<form on:submit|preventDefault={searchVerse}>
		<label for="search">Enter a verse reference:</label>
		<input id="search" type="text" bind:value={searchQuery} placeholder="e.g., John 1:1-5" />
		<button type="submit">Search</button>
	</form>

	{#if error}
		<p class="error">{error}</p>
	{:else if results.length > 0}
		<article>
			<h2>
				{results[0].BookName}
				{results[0].ChapterNumber}:{results[0].VerseNumber}
				{#if results.length > 1}
					- {results[results.length - 1].VerseNumber}{/if}
			</h2>
			<ul>
				{#each results as result}
					<li>
						<strong>{result.VerseNumber}</strong>: {result.Text}
					</li>
				{/each}
			</ul>
		</article>
	{/if}
</main>

<style>
	main {
		font-family: Arial, sans-serif;
		max-width: 600px;
		margin: 0 auto;
		text-align: center;
		padding: 20px;
	}

	form {
		margin-bottom: 20px;
	}

	input {
		padding: 8px;
		font-size: 1em;
		margin-right: 10px;
		width: 70%;
	}

	button {
		padding: 8px 16px;
		font-size: 1em;
		cursor: pointer;
	}

	.error {
		color: red;
		font-weight: bold;
	}

	article {
		font-size: 1.2em;
		background: #f9f9f9;
		padding: 20px;
		border-radius: 8px;
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
	}

	ul {
		text-align: left;
		list-style: none;
		padding: 0;
	}

	li {
		margin: 5px 0;
	}
</style>
