<script lang="ts">
	import { onMount } from 'svelte';
	import { db } from '$lib/db';
	import { bookMapping } from '$lib/bookMapping';

	let books: any[] = [];
	let oldTestament: any[] = [];
	let newTestament: any[] = [];
	let selectedBook = 'John';
	let selectedChapter = 1;
	let chapters: any[] = [];
	let verses: string | any[] = [];
	let error: string | null = null;

	const oldTestamentAbbreviations = [
		'gen',
		'exo',
		'lev',
		'num',
		'deut',
		'josh',
		'judg',
		'ruth',
		'1sam',
		'2sam',
		'1kgs',
		'2kgs',
		'1chr',
		'2chr',
		'ezra',
		'neh',
		'esth',
		'job',
		'ps',
		'prov',
		'eccl',
		'song',
		'isa',
		'jer',
		'lam',
		'ezek',
		'dan',
		'hos',
		'joel',
		'amos',
		'obad',
		'jonah',
		'mic',
		'nah',
		'hab',
		'zeph',
		'hag',
		'zech',
		'mal'
	];

	const newTestamentAbbreviations = [
		'matt',
		'mark',
		'luke',
		'john',
		'acts',
		'rom',
		'1cor',
		'2cor',
		'gal',
		'eph',
		'phil',
		'col',
		'1thess',
		'2thess',
		'1tim',
		'2tim',
		'titus',
		'philem',
		'heb',
		'james',
		'1pet',
		'2pet',
		'1john',
		'2john',
		'3john',
		'jude',
		'rev'
	];

	// Helper functions
	function getAbbreviation(bookName: string): string {
		const entry = Object.entries(bookMapping).find(([abbr, fullName]) => fullName === bookName);
		return entry ? entry[0].toUpperCase() : bookName;
	}

	function filterBooksByTestament(testamentAbbreviations: string[]): any[] {
		return books.filter((book) =>
			testamentAbbreviations.some(
				(abbr) => bookMapping[abbr]?.toLowerCase() === book.BookName.toLowerCase()
			)
		);
	}

	function addAbbreviations(books: any[]): any[] {
		return books.map((book) => ({
			...book,
			abbreviation: getAbbreviation(book.BookName)
		}));
	}

	function handleError(err: any, defaultMessage: string) {
		error = (err as Error).message || defaultMessage;
	}

	function loadCachedState() {
		const cachedState = localStorage.getItem('bible-viewer-state');
		if (cachedState) {
			const { book, chapter } = JSON.parse(cachedState);
			selectedBook = book || selectedBook;
			selectedChapter = chapter || selectedChapter;
		}
	}

	function saveCachedState() {
		localStorage.setItem(
			'bible-viewer-state',
			JSON.stringify({ book: selectedBook, chapter: selectedChapter })
		);
	}

	onMount(async () => {
		try {
			loadCachedState();
			books = await db.table('books').toArray();
			oldTestament = addAbbreviations(filterBooksByTestament(oldTestamentAbbreviations));
			newTestament = addAbbreviations(filterBooksByTestament(newTestamentAbbreviations));
			updateChapters();
		} catch (err) {
			handleError(err, 'Failed to load books. Please try again later.');
		}
	});

	async function updateChapters() {
		error = null;
		verses = []; // Clear verses when changing book

		const book = books.find((b) => b.BookName === selectedBook);
		if (!book) {
			error = `Book "${selectedBook}" not found.`;
			return;
		}

		chapters = Array.from({ length: book.TotalChapters }, (_, i) => i + 1);
		selectedChapter = 1; // Reset to Chapter 1
		await fetchVerses(); // Automatically load the first chapter
	}

	async function fetchVerses() {
		error = null;
		verses = [];
		try {
			const book = books.find((b) => b.BookName === selectedBook);
			if (!book) throw new Error(`Book "${selectedBook}" not found.`);
			const chapter = book.Chapters.find(
				(ch: { ChapterNumber: number }) => ch.ChapterNumber === selectedChapter
			);
			if (!chapter) throw new Error(`Chapter ${selectedChapter} not found in "${selectedBook}".`);
			verses = chapter.Verses;
			saveCachedState();
		} catch (err) {
			handleError(err, 'Failed to load verses.');
		}
	}

	let isSidebarOpen = false; // Tracks if the sidebar is open (mobile view)

	// Toggle sidebar visibility
	function toggleSidebar() {
		isSidebarOpen = !isSidebarOpen;
	}

	/**
	 * Function to copy a verse to clipboard and provide feedback
	 * @param {object} verse - The verse object to copy
	 */
	function copyToClipboard(verse: { VerseNumber: any; Text: any; copied: boolean; }) {
		const text = `${verse.VerseNumber}: ${verse.Text}`;
		navigator.clipboard
			.writeText(text)
			.then(() => {
				// Update the verse's copied property
				verse.copied = true;

				// Trigger Svelte reactivity by replacing the verse in the array
				verses = verses.map((v: { VerseNumber: any; }) =>
					v.VerseNumber === verse.VerseNumber ? { ...v, copied: true } : v
				);

				// Reset after 2 seconds
				setTimeout(() => {
					verses = verses.map((v: { VerseNumber: any; }) =>
						v.VerseNumber === verse.VerseNumber ? { ...v, copied: false } : v
					);
				}, 2000);
			})
			.catch((err) => {
				console.error('Failed to copy text:', err);
			});
	}
</script>

<main class="bible-app">
	<!-- Mobile Navigation Toggle -->
	<button class="navigation-toggle" on:click={toggleSidebar}>
		{isSidebarOpen ? 'Close Navigation' : 'Open Navigation'}
	</button>

	<div class="app-layout">
		<!-- Sidebar for Navigation -->
		<aside class={`bible-navigation ${isSidebarOpen ? 'open' : ''}`}>
			<div class="bible-navigation-lists">
				<!-- Old Testament List -->
				<div class="old-testament-list">
					<h3>OT</h3>
					<ul>
						{#each oldTestament as book (book.BookName)}
							<!-- svelte-ignore a11y-click-events-have-key-events -->
							<!-- svelte-ignore a11y-no-noninteractive-element-interactions -->
							<li
								class="bible-list-item {selectedBook === book.BookName ? 'selected' : ''}"
								on:click={() => {
									selectedBook = book.BookName;
									updateChapters();
									isSidebarOpen = false; /* Close sidebar after selecting */
								}}
							>
								{getAbbreviation(book.BookName)}
							</li>
						{/each}
					</ul>
				</div>

				<!-- New Testament List -->
				<div class="new-testament-list">
					<h3>NT</h3>
					<ul>
						{#each newTestament as book (book.BookName)}
							<!-- svelte-ignore a11y-click-events-have-key-events -->
							<!-- svelte-ignore a11y-no-noninteractive-element-interactions -->
							<li
								class="bible-list-item {selectedBook === book.BookName ? 'selected' : ''}"
								on:click={() => {
									selectedBook = book.BookName;
									updateChapters();
									isSidebarOpen = false; /* Close sidebar after selecting */
								}}
							>
								{getAbbreviation(book.BookName)}
							</li>
						{/each}
					</ul>
				</div>

				<!-- Chapters List -->
				<div class="chapter-navigation">
					<h3>Chapters</h3>
					<ul>
						{#each chapters as chapter}
							<!-- svelte-ignore a11y-click-events-have-key-events -->
							<!-- svelte-ignore a11y-no-noninteractive-element-interactions -->
							<li
								class="bible-list-item {selectedChapter === chapter ? 'selected' : ''}"
								on:click={() => {
									selectedChapter = chapter;
									fetchVerses();
									isSidebarOpen = false; /* Close sidebar after selecting */
								}}
							>
								{chapter}
							</li>
						{/each}
					</ul>
				</div>
			</div>
		</aside>

		<!-- Main Bible Content Area -->
		<section class="bible-content">
			<header>
				<h2>{selectedBook} {selectedChapter}</h2>
			</header>
			<article class="verse-display">
				<ul>
					{#each verses as verse (verse.VerseNumber)}
						<!-- svelte-ignore a11y-click-events-have-key-events -->
						<!-- svelte-ignore a11y-no-noninteractive-element-interactions -->
						<li
							class={verse.copied ? 'copied' : ''}
							on:click={() => copyToClipboard(verse)}
							title="Click to copy this verse"
						>
							<span class="copy-status">{verse.copied ? 'Copied!' : ''}</span>
							<strong>{verse.VerseNumber}</strong>: {verse.Text}
						</li>
					{/each}
				</ul>
			</article>
		</section>
	</div>
</main>

<style>

	/* Global Styling */
	.bible-app {
		font-family: Arial, sans-serif;
		display: flex;
		flex-direction: column;
		max-width: 1200px;
		margin: 0 auto;
		height: 100%; /* Confine app to the viewport */
	}

	/* Sidebar for Navigation */
	.bible-navigation {
		position: fixed;
		top: 0;
		left: 0;
		height: 100vh; /* Full height of the viewport */
		width: 300px;
		background: #f9f9f9;
		padding: 10px;
		box-shadow: 2px 0 4px rgba(0, 0, 0, 0.1);
		z-index: 1000;
		display: flex;
		flex-direction: column;
		gap: 10px;
		transition: transform 0.3s ease-in-out; /* Smooth transition for mobile toggle */
	}

	/* Main Layout */
	.app-layout {
		display: flex;
		flex-direction: row;
		gap: 20px;
		height: 100%; /* Full height of the viewport */
		box-sizing: border-box;
		margin-left: 300px; /* Reserve space for sidebar */
		overflow: hidden; /* Prevent unwanted scrolling in the layout */
	}

	/* Bible Navigation Lists */
	.bible-navigation-lists {
		display: flex;
		flex-direction: row;
		gap: 10px;
		height: calc(100vh - 20px);
		overflow: hidden;
	}

	.old-testament-list,
	.new-testament-list,
	.chapter-navigation {
		flex: 1;
		display: flex;
		flex-direction: column;
		height: 100%;
		overflow: hidden;
	}

	.old-testament-list h3,
	.new-testament-list h3,
	.chapter-navigation h3 {
		margin: 0;
		padding: 10px 0;
		background: #f9f9f9;
		z-index: 1;
		border-bottom: 1px solid #ddd;
		flex-shrink: 0;
	}

	/* Scrollable List Content */
	.old-testament-list ul,
	.new-testament-list ul,
	.chapter-navigation ul {
		flex-grow: 1;
		overflow-y: auto; /* Allow internal scrolling */
		margin: 0;
		padding: 0;
		list-style: none;
	}

	/* List Items */
	.bible-list-item {
		margin: 5px 0;
		padding: 10px;
		cursor: pointer;
		border-radius: 4px;
		transition: background-color 0.2s;
	}

	.bible-list-item:hover {
		background: #e0e0e0;
	}

	.bible-list-item.selected {
		background: #007bff;
		color: white;
	}

	/* Main Bible Content */
	.bible-content {
		flex-grow: 1; /* Take up remaining space */
		display: flex;
		flex-direction: column; /* Stack header and verses */
		padding: 20px;
		background: white;
		border-radius: 8px;
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
		overflow-y: auto; /* Allow internal scrolling for content */
		height: 100%; /* Match the height of the container */
		box-sizing: border-box; /* Include padding in height calculation */
	}

	/* Verse Display */
	.verse-display {
		font-size: 1.2em;
		line-height: 1.6;
		max-width: 100%;
		overflow-y: auto;
		list-style: none; /* Remove bullet points */
		padding: 0; /* Remove default padding */
		margin: 0; /* Remove default margin */
	}

	.verse-display li {
		padding: 10px;
		list-style: none;
		transition:
			background-color 0.3s ease-in-out,
			color 0.3s ease-in-out;
		border-radius: 5px; /* Rounded corners for better look */
		cursor: pointer; /* Indicates interactivity */
		position: relative; /* Enable positioning for the "Copied!" message */
	}

	.verse-display li .copy-status {
		position: absolute;
		top: -20px; /* Position above the verse */
		left: 0;
		font-size: 0.9em;
		color: #155724;
		font-weight: bold;
		opacity: 0;
		transition: opacity 0.3s ease-in-out;
	}

	.verse-display li.copied .copy-status {
		opacity: 1; /* Make visible when copied */
	}

	.verse-display li.copied {
		background-color: #d4edda; /* Light green background */
		color: #155724; /* Dark green text */
	}

	/* Navigation Toggle */
	.navigation-toggle {
		display: none;
		background: #007bff;
		color: white;
		border: none;
		padding: 10px 20px;
		cursor: pointer;
		font-size: 1em;
		border-radius: 5px;
		margin: 10px;
	}

	.navigation-toggle:hover {
		background: #0056b3;
	}

	/* Responsive Adjustments */
	@media (max-width: 768px) {
		.app-layout {
			margin-left: 0; /* Remove the reserved space for the sidebar */
		}

		.bible-navigation {
			position: absolute;
			transform: translateX(-100%); /* Hidden by default */
		}

		.bible-navigation.open {
			transform: translateX(0); /* Slide into view when toggled */
		}

		.navigation-toggle {
			display: block; /* Show toggle button */
		}

		.bible-navigation-lists {
			flex-direction: row;
		}

		.bible-content {
			margin-top: 20px;
		}
	}

	@media (max-width: 480px) {
		.bible-navigation {
			width: 250px; /* Smaller sidebar */
		}

		.bible-content {
			padding: 15px;
		}

		h2 {
			font-size: 1.3em;
		}

		.verse-display {
			font-size: 1em;
		}
	}
</style>
