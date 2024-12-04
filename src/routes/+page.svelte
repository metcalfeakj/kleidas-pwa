<script lang="ts">
	import { onMount } from 'svelte';
	import { db, type Book } from '$lib/db';
	import { bookMapping } from '$lib/bookMapping';
	import { writable } from 'svelte/store';

	// Reactive store to track selected verses
	let selectedVerses = writable<string[]>([]);
	let books: Book[] = [];
	let selectedBook = 'John';
	let selectedChapter = 1;
	let chapters: any[] = [];
	let verses: any[] = [];
	let error: string | null = null;

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
	let isSidebarOpen = false; // Tracks if the sidebar is open (mobile view)
	let sidebarElement: HTMLElement | null = null; // Sidebar element reference

	// Toggle sidebar visibility
	function toggleSidebar() {
		isSidebarOpen = !isSidebarOpen;
	}
	function handleOutsideClick(event: MouseEvent) {
		const sidebarElement = document.querySelector('.bible-navigation');
		if (sidebarElement && !sidebarElement.contains(event.target as Node)) {
			isSidebarOpen = false; // Close the sidebar
		}
	}

	onMount(async () => {
		try {
			loadCachedState(); // Load cached state if any
			books = await db.table('books').toArray();

			// Ensure chapters are updated for the selected book
			await updateChapters();

			// Add event listener for outside clicks to close the sidebar
			document.addEventListener('click', handleOutsideClick);
		} catch (err) {
			handleError(err, 'Failed to load books. Please try again later.');
		}
	});
	async function updateChapters() {
		error = null;
		verses = []; // Clear verses when changing book or chapter

		// Clear any selected verses
		clearSelectedVerses();

		const book = books.find((b) => b.BookName === selectedBook);
		if (!book) {
			error = `Book "${selectedBook}" not found.`;
			return;
		}

		chapters = Array.from({ length: book.TotalChapters }, (_, i) => i + 1);

		// Do not reset chapter if it's already set
		if (!chapters.includes(selectedChapter)) {
			selectedChapter = 1; // Reset to Chapter 1 only if current chapter is invalid
		}

		await fetchVerses(); // Automatically load the chapter
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
			verses = chapter.Verses.map((verse: any) => ({ ...verse, copied: false }));
			saveCachedState();
		} catch (err) {
			handleError(err, 'Failed to load verses.');
		}
	}

	// Handle search input
	let searchQuery = ''; // Holds the current input from the search bar

	function handleSearch(event: KeyboardEvent) {
		if (event.key === 'Enter') {
			const input = searchQuery.trim();

			// Parse the search query (e.g., "John 1", "John 1:1", "John 1:1-5")
			const regex = /(\d?\s?\w+)\s*(\d+)?(?::(\d+)(?:-(\d+))?)?/i;
			const match = input.match(regex);

			if (!match) {
				error =
					'Invalid format. Please use "Book Chapter", "Book Chapter:Verse", or "Book Chapter:Verse-Range" (e.g., "John 1", "John 1:1", "John 1:1-5").';
				return;
			}

			// Process search query
			const bookAbbr = match[1].toLowerCase().replace(/\s+/g, '');
			const bookName = bookMapping[bookAbbr] || bookAbbr;
			const chapterNumber = match[2] ? parseInt(match[2]) : null;
			const startVerseNumber = match[3] ? parseInt(match[3]) : null;
			const endVerseNumber = match[4] ? parseInt(match[4]) : null;

			const book = books.find((b) => b.BookName.toLowerCase() === bookName.toLowerCase());

			if (!book) {
				error = `Book "${bookName}" not found.`;
				return;
			}

			selectedBook = book.BookName;
			selectedChapter = chapterNumber || 1;

			updateChapters().then(() => {
				if (startVerseNumber) {
					highlightVerses(startVerseNumber, endVerseNumber || startVerseNumber);
				}
			});

			// Blur the search input to close the keyboard
			(event.target as HTMLInputElement)?.blur();

			// Clear the search bar after successful navigation
			searchQuery = '';
		}
	}

	// Track the selected verses in the `highlightVerses` function
	function highlightVerses(startVerse: number, endVerse?: number) {
		selectedVerses.set([]); // Reset the selected verses

		let scrolled = false;
		const selected: any[] = [];

		verses = verses.map((verse) => {
			const isSelected =
				verse.VerseNumber >= startVerse && (!endVerse || verse.VerseNumber <= endVerse);

			if (isSelected) {
				selected.push(verse.Text);
			}

			// Scroll to the first highlighted verse
			if (isSelected && !scrolled) {
				scrolled = true;
				verse.domElement?.scrollIntoView({
					behavior: 'smooth',
					block: 'center',
					inline: 'nearest'
				});
			}

			return { ...verse, selected: isSelected };
		});

		// Update the reactive store with selected verses
		selectedVerses.set(selected);
	}

	function clearSelectedVerses() {
		// Deselect all verses
		verses = verses.map((v) => ({ ...v, selected: false }));

		// Clear the reactive store
		selectedVerses.set([]);
	}
	async function copySelectedVerses() {
		const selectedText = formatSelectedVerses();
		console.log(selectedText);
		try {
			await navigator.clipboard.writeText(selectedText);
			alert('Selected verses copied to clipboard!');
			// Clear the selection after copying
			clearSelectedVerses();
		} catch (err) {
			alert('Failed to copy verses to clipboard:' + err);
		}
	}

	function handleVerseSelection(verse: any) {
		// Toggle the selected state of the clicked verse
		verses = verses.map(
			(v) =>
				v.VerseNumber === verse.VerseNumber
					? { ...v, selected: !v.selected } // Toggle selected state for the clicked verse
					: v // Leave others unchanged
		);

		// Update the selected verses
		const selected = verses.filter((v) => v.selected).map((v) => v.Text);
		selectedVerses.set(selected);
	}

	// Format the selected verses with book, chapter, and verse range
	function formatSelectedVerses(): string {
		// Subscribe to the store and get the current value
		let selected: string[] = [];
		selectedVerses.subscribe((value) => (selected = value))();

		if (selected.length === 0) return ''; // No selected verses

		// Get the selected verse numbers and their text
		const selectedVerseDetails = verses
			.filter((v) => v.selected)
			.map((v) => ({ number: v.VerseNumber, text: v.Text }))
			.sort((a, b) => a.number - b.number); // Ensure they're sorted

		// Group verse numbers into ranges
		const ranges: string[] = [];
		let rangeStart = selectedVerseDetails[0].number;
		let previous = selectedVerseDetails[0].number;

		for (let i = 1; i <= selectedVerseDetails.length; i++) {
			const current = selectedVerseDetails[i]?.number;

			if (current !== previous + 1) {
				// End of a range
				if (rangeStart === previous) {
					ranges.push(`${rangeStart}`);
				} else {
					ranges.push(`${rangeStart}-${previous}`);
				}
				rangeStart = current;
			}

			previous = current;
		}

		// Create the reference header
		const reference = `${selectedBook} ${selectedChapter}:${ranges.join(', ')}`;

		// Create the detailed verse text
		const verseText = selectedVerseDetails.map((v) => `${v.number}: ${v.text}`).join('\n');

		// Combine the header and the verse text
		return `${reference}\n\n${verseText}`;
	}
</script>

<meta
	name="viewport"
	content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no"
/>
<main class="bible-app">
	<!-- Toolbar Section -->
	<div class="toolbar">
		<div class="toolbar-left">
			<div class="mobile-navigation-toggle">
				<button class="toolbar-btn" on:click|stopPropagation={toggleSidebar}> 📜 Books </button>
			</div>
		</div>
		<div class="toolbar-center">
			<input
				type="text"
				class="toolbar-search"
				placeholder="{selectedBook} {selectedChapter}"
				bind:value={searchQuery}
				on:keydown={(event) => handleSearch(event)}
			/>
		</div>
		<div class="toolbar-right">
			<button
				class="toolbar-btn copy-btn"
				disabled={$selectedVerses.length === 0}
				on:click={copySelectedVerses}
			>
				📋 Copy
			</button>
		</div>
	</div>

	<!-- Toggle for Mobile Navigation -->

	<div class="app-layout">
		<!-- Sidebar for Book and Chapter Navigation -->
		<div
			bind:this={sidebarElement}
			class={`sidebar ${isSidebarOpen ? 'open' : ''}`}
			on:click|stopPropagation
		>
			<div class="sidebar-content">
				<!-- Old Testament Section -->
				<div class="old-testament-section">
					<h3 class="sidebar-heading">OT</h3>
					<div class="book-list">
						{#each books.slice(0, 39) as book}
							<button
								class="book-item {selectedBook === book.BookName ? 'selected' : ''}"
								on:click={() => {
									// Select the book, reset to the first chapter, and clear selections
									selectedBook = book.BookName;
									selectedChapter = 1; // Reset to the first chapter
									clearSelectedVerses(); // Clear any previous selections
									updateChapters(); // Load the new book's chapters
								}}
							>
								{book.BookAbbr}
							</button>
						{/each}
					</div>
				</div>

				<!-- New Testament Section -->
				<div class="new-testament-section">
					<h3 class="sidebar-heading">NT</h3>
					<div class="book-list">
						{#each books.slice(39, 66) as book}
							<button
								class="book-item {selectedBook === book.BookName ? 'selected' : ''}"
								on:click={() => {
									// Select the book, reset to the first chapter, and clear selections
									selectedBook = book.BookName;
									selectedChapter = 1; // Reset to the first chapter
									clearSelectedVerses(); // Clear any previous selections
									updateChapters(); // Load the new book's chapters
								}}
							>
								{book.BookAbbr}
							</button>
						{/each}
					</div>
				</div>

				<!-- Chapter Navigation Section -->
				<div class="chapter-section">
					<h3 class="sidebar-heading">Chapters</h3>
					<div class="chapter-list">
						{#each chapters as chapter}
							<button
								class="chapter-item {selectedChapter === chapter ? 'selected' : ''}"
								on:click={() => {
									// Clear selected verses and update the chapter
									selectedChapter = chapter;
									clearSelectedVerses(); // Clear previous selections
									fetchVerses(); // Load the new chapter
									isSidebarOpen = false; /* Close sidebar after selection */
								}}
							>
								{chapter}
							</button>
						{/each}
					</div>
				</div>
			</div>
		</div>

		<!-- Main Bible Display Area -->
		<section class="bible-display">
			<header class="display-header">
				<h2>{selectedBook} {selectedChapter}</h2>
			</header>
			<article class="verse-list">
				<div class="verse-container">
					{#each verses as verse (verse.VerseNumber)}
						<button
							class="verse-item {verse.selected ? 'selected' : ''}"
							bind:this={verse.domElement}
							on:click={() => handleVerseSelection(verse)}
						>
							<strong>{verse.VerseNumber}</strong>: {verse.Text}
						</button>
					{/each}
				</div>
			</article>
		</section>
	</div>
</main>

<style>
	.bible-app,
	.sidebar {
		max-height: calc(100vh - 60px);
	}

	.app-layout,
	.bible-app,
	.sidebar-content {
		height: 100%;
		display: flex;
	}

	.app-layout {
		width: 100%;
		overflow: hidden;
		padding-bottom: 0;
	}

	.sidebar,
	.toolbar {
		position: relative;
		left: 0;
	}

	.toolbar {
		position: fixed;
		left: 0;
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.bible-app {
		font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial,
			sans-serif;
		flex-direction: column;
		margin: 0 auto;
		padding: 20px;
		padding-left: 0px;
		overflow-y: auto;
	}

	.sidebar {
		flex: 0 0 auto;
		background: #f9f9f9;
		overflow-y: auto;
	}

	.sidebar.open {
		transform: translateX(0);
	}

	.sidebar-content {
		flex-direction: row;
		gap: 10px;
	}

	.chapter-section,
	.new-testament-section,
	.old-testament-section {
		flex: 1;
		display: flex;
		flex-direction: column;
		padding: 5px;
	}

	.sidebar-heading {
		margin: 0;
		padding: 10px 0;
		background: #f9f9f9;
		border-bottom: 1px solid #ddd;
		flex-shrink: 0;
		text-align: center;
		word-break: break-word;
		white-space: nowrap;
		text-overflow: ellipsis;
		width: 100%;
	}

	.book-list,
	.chapter-list {
		overflow-y: auto;
		flex-grow: 1;
	}

	.book-item,
	.chapter-item {
		display: block;
		background: 0 0;
		border: none;
		margin: 5px 0;
		padding: 10px;
		cursor: pointer;
		border-radius: 4px;
		text-align: left;
		width: auto;
		white-space: nowrap;
		font-family: Roboto, Arial, sans-serif;
		font-size: 1rem;
		font-weight: 500;
		color: #333;
		letter-spacing: 0.5px;
		transition:
			background-color 0.2s,
			color 0.2s;
	}

	.book-item:hover,
	.chapter-item:hover {
		background: #f0f0f0;
		color: #007bff;
	}

	.book-item.selected,
	.chapter-item.selected {
		background: #007bff;
		color: #fff;
		font-weight: 600;
	}

	.bible-display {
		flex: 1 1 auto;
		min-width: 0;
		overflow-y: auto;
		padding-left: 20px;
		padding-right: 200px;
	}

	.display-header h2 {
		margin: 0;
		font-size: 1.5em;
		color: #333;
	}

	.verse-list {
		font-size: 1.2em;
		line-height: 1.6;
		max-width: 100%;
		padding: 0;
		margin: 0;
	}

	.verse-container {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}

	.verse-item {
		all: unset;
		display: block;
		width: 100%;
		padding: 10px;
		cursor: pointer;
		border-radius: 12px;
		font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial,
			sans-serif;
	}

	.verse-item:hover {
		background-color: #f2f2f7;
	}

	.copy-btn:hover:enabled,
	.verse-item.selected {
		background-color: #007aff;
		color: #fff;
	}

	.verse-item.selected:hover {
		background-color: #005bb5;
	}

	.verse-item,
	.verse-item.selected {
		transition: 0.3s ease-in-out;
	}

	.toolbar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		flex-wrap: wrap;
	}

	.toolbar-center,
	.toolbar-left,
	.toolbar-right {
		flex: 1;
		display: flex;
		align-items: center;
	}

	.toolbar-center {
		justify-content: center;
	}

	.toolbar-right {
		justify-content: flex-end;
	}

	.toolbar-search {
		flex: 1;
		border: none;
		padding: 10px;
		border-radius: 5px;
		font-size: 16px;
		width: 400px;
	}

	.toolbar,
	.toolbar-left,
	.toolbar-right {
		align-items: center;
		display: flex;
	}

	.sidebar-toggle-btn:hover {
		color: #000;
		background: #005bb5;
		box-shadow: 0 6px 8px rgba(0, 0, 0, 0.15);
	}

	.toolbar-actions {
		display: flex;
		gap: 10px;
	}

	.bible-display,
	.sidebar {
		margin-top: 60px;
	}

	.sidebar-toggle-btn {
		font-weight: 700;
		display: none;
		background: #007aff;
		color: #fff;
		border: none;
		padding: 10px 20px;
		cursor: pointer;
		font-size: 1em;
		border-radius: 12px;
		margin: 10px;
		box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
		transition:
			background 0.3s,
			box-shadow 0.3s;
		font-family: inherit;
	}

	.toolbar {
		justify-content: space-between;
	}

	.toolbar-center {
		display: flex;
		align-items: center;
		justify-content: center;
		flex: 1;
	}

	.mobile-navigation-toggle {
		display: none;
	}

	.copy-btn:disabled {
		background: #e0e0e0;
		color: #a0a0a0;
		cursor: not-allowed;
	}

	@media (max-width: 768px) {
		.app-layout {
			margin-left: 0;
		}

		.sidebar {
			position: fixed;
			transform: translateX(-100%);
			transition: transform 0.3s;
		}

		.sidebar.open {
			transform: translateX(0);
			position: relative;
		}

		.sidebar-toggle-btn {
			display: block;
			position: fixed;
			top: 10px;
			right: 10px;
			z-index: 1000;
		}

		.mobile-navigation-toggle {
			display: block;
		}

		.toolbar {
			align-items: stretch;
		}

		.toolbar-center,
		.toolbar-left,
		.toolbar-right {
			flex: none;
			width: 100%;
			justify-content: center;
		}

		.toolbar-search {
			width: 100%;
			max-width: none;
		}
	}

	.toolbar {
		top: 0;
		width: 100%;
		height: 60px;
		background-color: #007aff;
		color: #fff;
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 10px;
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
		z-index: 1100;
		gap: 10px;
	}

	.toolbar-center,
	.toolbar-left,
	.toolbar-right {
		display: flex;
		align-items: center;
		gap: 10px;
		flex: 1;
		padding-right: 40px;
	}

	.toolbar-search {
		flex: 1;
		min-width: 80px;
		max-width: 400px;
	}

	.copy-btn,
	.toolbar-btn {
		flex: 0 0 auto;
		background: #fff;
		color: #007aff;
		border: none;
		padding: 10px 15px;
		border-radius: 5px;
		cursor: pointer;
		font-size: 1rem;
		transition:
			background-color 0.3s,
			color 0.3s;
	}

	.copy-btn:hover,
	.toolbar-btn:hover {
		background-color: #005bb5;
		color: #fff;
	}

	@media (max-width: 768px) {
		.toolbar-search {
			flex: 1;
			width: 100%;
		}

		.copy-btn,
		.toolbar-btn {
			font-size: 0.9rem;
			padding: 8px 10px;
		}

		.bible-display {
			padding: 20px;
		}
	}

	.verse-container,
	.verse-item {
		touch-action: manipulation;
		user-select: none;
	}
</style>
