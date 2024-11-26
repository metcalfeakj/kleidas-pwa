<script lang="ts">
	import { onMount } from 'svelte';
	import { db } from '$lib/db';
	import {
		bookMapping,
		oldTestamentAbbreviations,
		newTestamentAbbreviations
	} from '$lib/bookMapping';
	import { writable } from 'svelte/store';
	

// Reactive store to track selected verses
let selectedVerses = writable<string[]>([]);
	let books: any[] = [];
	let oldTestament: any[] = [];
	let newTestament: any[] = [];
	let selectedBook = 'John';
	let selectedChapter = 1;
	let chapters: any[] = [];
	let verses: any[] = [];
	let error: string | null = null;

	// Helper functions
	function getAbbreviation(bookName: string): string {
		const entry = Object.entries(bookMapping).find(([fullName]) => fullName === bookName);
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
			oldTestament = addAbbreviations(filterBooksByTestament(oldTestamentAbbreviations));
			newTestament = addAbbreviations(filterBooksByTestament(newTestamentAbbreviations));

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
			error = 'Invalid format. Please use "Book Chapter", "Book Chapter:Verse", or "Book Chapter:Verse-Range" (e.g., "John 1", "John 1:1", "John 1:1-5").';
			return;
		}

		const bookAbbr = match[1].toLowerCase().replace(/\s+/g, '');
		const bookName = bookMapping[bookAbbr] || bookAbbr;
		const chapterNumber = match[2] ? parseInt(match[2]) : null;
		const startVerseNumber = match[3] ? parseInt(match[3]) : null;
		const endVerseNumber = match[4] ? parseInt(match[4]) : null;

		// Find the book from the loaded books list
		const book = books.find((b) => b.BookName.toLowerCase() === bookName.toLowerCase());

		if (!book) {
			error = `Book "${bookName}" not found.`;
			return;
		}

		// Update selected book and chapter
		selectedBook = book.BookName;
		selectedChapter = chapterNumber || 1;

		// Update chapters and fetch verses
		updateChapters().then(() => {
			// Highlight the specified verses if applicable
			if (startVerseNumber) {
				highlightVerses(startVerseNumber, endVerseNumber || startVerseNumber);
			}
		});

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
			verse.VerseNumber >= startVerse &&
			(!endVerse || verse.VerseNumber <= endVerse);

		if (isSelected) {
			selected.push(verse.Text);
		}

		// Scroll to the first highlighted verse
		if (isSelected && !scrolled) {
			scrolled = true;
			verse.domElement?.scrollIntoView({
				behavior: 'smooth',
				block: 'center',
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
	try {
		await navigator.clipboard.writeText(selectedText);
		alert('Selected verses copied to clipboard!');
				// Clear the selection after copying
				clearSelectedVerses();
	} catch (err) {
		alert('Failed to copy verses to clipboard.');
	}
}

// Format the selected verses with book, chapter, and verse range
function formatSelectedVerses(): string {
	// Get the selected verses from the reactive store
	const selected = $selectedVerses;

	if (selected.length === 0) return ''; // No selected verses

	// Get the range of selected verses
	const verseNumbers = verses
		.filter((v) => v.selected)
		.map((v) => v.VerseNumber);

	const startVerse = Math.min(...verseNumbers);
	const endVerse = Math.max(...verseNumbers);

	// Format the text
	const reference =
		startVerse === endVerse
			? `${selectedBook} ${selectedChapter}:${startVerse}` // Single verse
			: `${selectedBook} ${selectedChapter}:${startVerse}-${endVerse}`; // Verse range

	const verseText = selected.map((text, index) => `${verseNumbers[index]}: ${text}`).join('\n');

	return `${reference}\n\n${verseText}`;
}

function handleVerseSelection(verse: any) {
	// Toggle the selected state of the clicked verse
	verses = verses.map((v) =>
		v.VerseNumber === verse.VerseNumber
			? { ...v, selected: !v.selected } // Toggle selected state for the clicked verse
			: v // Leave others unchanged
	);

		// Update the selected verses
		const selected = verses.filter((v) => v.selected).map((v) => v.Text);
	selectedVerses.set(selected);
}


</script>

<main class="bible-app">
		<!-- Toolbar Section -->
		<div class="toolbar">
			<div class="toolbar-left">
				<div class="mobile-navigation-toggle">
					<button class="toolbar-btn" on:click|stopPropagation={toggleSidebar}>
						📜 Books
					</button>
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
		<aside
			bind:this={sidebarElement}
			class={`sidebar ${isSidebarOpen ? 'open' : ''}`}
			on:click|stopPropagation
		>
			<div class="sidebar-content">
				<!-- Old Testament Section -->
				<div class="old-testament-section">
					<h3 class="sidebar-heading">OT</h3>
					<div class="book-list">
						{#each oldTestament as book}
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
								{getAbbreviation(book.BookName)}
							</button>
						{/each}
					</div>
				</div>

				<!-- New Testament Section -->
				<div class="new-testament-section">
					<h3 class="sidebar-heading">NT</h3>
					<div class="book-list">
						{#each newTestament as book}
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
								{getAbbreviation(book.BookName)}
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
		</aside>

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
/* Global Styling */
.bible-app {
	font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
	display: flex;
	flex-direction: column;
	max-width: 1200px;
	margin: 0 auto;
	height: 100%; /* Confine app to the viewport */
}

.sidebar {
	position: fixed;
	top: 0;
	left: 0;
	height: 100vh;
	width: 500px;
	background: #f9f9f9;
	box-shadow: 2px 0 4px rgba(0, 0, 0, 0.1);
	z-index: 1000;
	transform: none; /* Make it visible by default */
	transition: transform 0.3s ease-in-out;
}

.sidebar.open {
	transform: translateX(0); /* Slide in when open */
}

/* Main Layout */
.app-layout {
	display: flex;
	flex-direction: row;
	gap: 20px;
	height: 100%; /* Full height of the viewport */
	box-sizing: border-box;
	margin-left: 500px; /* Reserve space for sidebar */
	overflow: hidden; /* Prevent unwanted scrolling in the layout */
}

/* Sidebar Content */
.sidebar-content {
	display: flex;
	flex-direction: row;
	gap: 10px;
	height: calc(100vh - 20px);
	overflow: hidden;
}

.old-testament-section,
.new-testament-section,
.chapter-section {
	flex: 1;
	display: flex;
	flex-direction: column;
	height: 100%;
	overflow: hidden;
}

.sidebar-heading {
	margin: 0;
	padding: 10px 0;
	background: #f9f9f9;
	border-bottom: 1px solid #ddd;
	flex-shrink: 0;
	text-align: center; /* Center the text */
	word-break: break-word; /* Break long words if needed */
	white-space: nowrap; /* Prevent wrapping */
	overflow: hidden; /* Hide overflow content */
	text-overflow: ellipsis; /* Add "..." for truncated text */
	width: 100%; /* Ensure it fits the container */
	box-sizing: border-box; /* Include padding in the width calculation */
}

/* Scrollable Lists */
.book-list,
.chapter-list {
	flex-grow: 1;
	overflow-y: auto; /* Allow internal scrolling */
	margin: 0;
	padding: 0;
	list-style: none;
}

/* Sidebar List Items */
.book-item,
.chapter-item {
	background: none;
	border: none;
	margin: 5px 0;
	padding: 10px;
	cursor: pointer;
	border-radius: 4px;
	text-align: left; /* Ensure text aligns properly */
	width: 100%; /* Ensure button spans the container */
	font-family: 'Roboto', Arial, sans-serif; /* Modern, clean font */
	font-size: 1rem; /* Standard readable font size */
	font-weight: 500; /* Medium weight for better emphasis */
	color: #333; /* Neutral dark color for good contrast */
	letter-spacing: 0.5px; /* Slight spacing for better readability */
	transition: background-color 0.2s, color 0.2s;
}

.book-item:hover,
.chapter-item:hover {
	background: #f0f0f0; /* Light hover effect */
	color: #007bff; /* Blue text on hover for interactivity */
}

.book-item.selected,
.chapter-item.selected {
	background: #007bff; /* Highlight selected button */
	color: white; /* White text for contrast */
	font-weight: 600; /* Slightly bolder font for emphasis */
}

/* Main Bible Display */
.bible-display {
	flex-grow: 1; /* Take up remaining space */
	display: flex;
	flex-direction: column; /* Stack header and verses */
	padding: 20px;
	background: white;
	border-radius: 8px;
	box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
	height: 100%; /* Match the height of the container */
	box-sizing: border-box; /* Include padding in height calculation */
}

/* Display Header */
.display-header h2 {
	margin: 0;
	font-size: 1.5em;
	color: #333;
}

/* Verse List */
.verse-list {
	font-size: 1.2em;
	line-height: 1.6;
	max-width: 100%;
	padding: 0; /* Remove default padding */
	margin: 0; /* Remove default margin */
}

.verse-container {
	display: flex;
	flex-direction: column;
	gap: 10px; /* Space between verses */
}

/* Verse Item Styling */
.verse-item {
	all: unset; /* Reset button styling */
	display: block; /* Make it behave like a block element */
	width: 100%; /* Match the full width */
	padding: 10px;
	cursor: pointer;
	border-radius: 12px; /* More rounded corners for iOS-like feel */
	transition: background-color 0.3s ease-in-out, color 0.3s ease-in-out, box-shadow 0.3s ease-in-out;
	font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; /* iOS font stack */
}

.verse-item:hover {
	background-color: #f2f2f7; /* Subtle hover effect with iOS-like light gray */
}

.verse-item.selected {
	background-color: #007aff; /* iOS blue for selected state */
	color: white; /* White text for contrast */
	font-weight: 600; /* Slightly bolder font for emphasis */
	box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); /* Subtle shadow for elevation */
	border: 1px solid #007aff; /* Optional: Add a border for definition */
}

.verse-item.selected:hover {
	background-color: #005bb5; /* Darker blue on hover for selected items */
}

/* Add subtle transitions for smooth interactions */
.verse-item,
.verse-item.selected {
	transition: all 0.3s ease-in-out;
}

.toolbar {
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: 10px;
	gap: 10px; /* Add space between elements */
	flex-wrap: wrap; /* Allow wrapping on smaller screens */
}

.toolbar-left,
.toolbar-center,
.toolbar-right {
	flex: 1; /* Allow sections to grow/shrink */
	display: flex;
	align-items: center;
	gap: 10px;
}

.toolbar-center {
	justify-content: center; /* Center align content */
}

.toolbar-right {
	justify-content: flex-end; /* Right align content */
}

.toolbar-search {
	flex: 1; /* Allow the search bar to take up remaining space */
	min-width: 150px; /* Prevent it from shrinking too small */
	max-width: 400px; /* Limit its maximum size */
	box-sizing: border-box; /* Include padding in width */
}


.toolbar-btn {
	background: white;
	color: #007aff;
	border: none;
	padding: 10px 15px;
	border-radius: 5px;
	cursor: pointer;
	font-size: 1rem;
	transition: background-color 0.3s, color 0.3s;
}

.sidebar-toggle-btn {
	background: #f8f9fa;
	color: #333;
	font-weight: bold;
	padding: 10px 15px;
	border: none;
	border-radius: 4px;
	cursor: pointer;
	transition: background-color 0.3s, color 0.3s;
}

.sidebar-toggle-btn:hover {
	background: #d9d9d9;
	color: #000;
}

.toolbar-search {
	border: none;
	padding: 10px;
	border-radius: 5px;
	font-size: 1rem;
	width: 400px;
}

.toolbar-actions {
	display: flex;
	gap: 10px; /* Space between action buttons */
}

/* Adjust main layout for fixed toolbar */
.bible-app {
	padding-top: 60px; /* Push content below the toolbar */
}

/* Ensure sidebar and content remain below the toolbar */
.sidebar {
	margin-top: 60px; /* Align with the toolbar */
}

.bible-display {
	margin-top: 60px; /* Align with the toolbar */
}

/* Sidebar Toggle Button */
.sidebar-toggle-btn {
	display: none;
	background: #007aff; /* iOS blue color */
	color: white;
	border: none;
	padding: 10px 20px;
	cursor: pointer;
	font-size: 1em;
	border-radius: 12px; /* More rounded corners */
	margin: 10px;
	box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); /* Subtle shadow */
	transition: background 0.3s, box-shadow 0.3s; /* Smooth transitions */
	font-family: inherit; /* Use the global font */
}

.sidebar-toggle-btn:hover {
	background: #005bb5; /* Slightly darker blue */
	box-shadow: 0 6px 8px rgba(0, 0, 0, 0.15); /* Slightly larger shadow */
}

/* Responsive Adjustments */
@media (max-width: 768px) {
	.app-layout {
		margin-left: 0; /* Remove the reserved space for the sidebar */
	}

	.sidebar {
		position: fixed;
		transform: translateX(-100%); /* Hidden by default */
		transition: transform 0.3s; /* Smooth transition for sliding */
	}

	.sidebar.open {
		transform: translateX(0); /* Slide into view when toggled */
	}

	.sidebar-toggle-btn {
		display: block; /* Show toggle button */
		position: fixed; /* Fix to the top of the page */
		top: 10px; /* Adjust as needed */
		right: 10px; /* Adjust as needed */
		z-index: 1000; /* Ensure it stays on top */
	}
}

@media (max-width: 480px) {
	.sidebar {
		width: 250px; /* Smaller sidebar */
	}

	.bible-display {
		padding: 15px;
	}

	.display-header h2 {
		font-size: 1.3em;
	}

	.verse-list {
		font-size: 1em;
	}
}



/* Toolbar Styling */
.toolbar {
	position: fixed;
	top: 0;
	left: 0;
	width: 100%;
	height: 60px;
	background-color: #007aff;
	color: white;
	display: flex;
	align-items: center; /* Vertically center items */
	justify-content: space-between; /* Space between left and right content */
	padding: 0 20px;
	box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
	z-index: 1100; /* Ensure it stays above other elements */
	box-sizing: border-box;
}

/* Left-aligned section */
.toolbar-left {
	display: flex;
	align-items: center;
}

/* Center section (optional for additional content) */
.toolbar-center {
	display: flex;
	align-items: center;
	justify-content: center;
	flex: 1; /* Takes up remaining space */
}

/* Right-aligned section */
.toolbar-right {
	display: flex;
	align-items: center;
	gap: 10px; /* Add space between elements, if any */
}

/* Mobile Navigation Toggle */
.mobile-navigation-toggle {
	display: none; /* Hidden by default */
}

/* Show in mobile view */
@media (max-width: 768px) {
	.mobile-navigation-toggle {
		display: block; /* Show the toggle button in mobile view */
	}
}

.copy-btn {
	background: #f8f9fa; /* Light gray background */
	color: #007aff; /* iOS blue color */
	border: none;
	padding: 10px 15px;
	border-radius: 5px; /* Rounded corners */
	cursor: pointer;
	font-size: 1rem;
	transition: background-color 0.3s ease-in-out, color 0.3s ease-in-out;
}
.copy-btn:disabled {
	background: #e0e0e0; /* Gray background for disabled state */
	color: #a0a0a0; /* Muted text color for disabled state */
	cursor: not-allowed;
}

.copy-btn:hover:enabled {
	background-color: #007aff; /* Darker blue on hover */
	color: white; /* White text on hover */
}



@media (max-width: 768px) {
	.toolbar {
		align-items: stretch; /* Make elements span full width */
	}

	.toolbar-left,
	.toolbar-center,
	.toolbar-right {
		flex: none; /* Disable flex-grow/shrink */
		width: 100%; /* Make each section take full width */
		justify-content: center; /* Center align content */
	}

	.toolbar-search {
		width: 100%; /* Full width on mobile */
		max-width: none; /* Remove maximum width limit */
	}
}

/* Toolbar */
.toolbar {
	position: fixed;
	top: 0;
	left: 0;
	width: 100%;
	height: 60px;
	background-color: #007aff;
	color: white;
	display: flex;
	align-items: center; /* Align items vertically */
	justify-content: space-between; /* Distribute items with space between */
	padding: 10px;
	box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
	z-index: 1100;
	box-sizing: border-box;
	gap: 10px; /* Add spacing between elements */
}

/* Toolbar Sections */
.toolbar-left,
.toolbar-center,
.toolbar-right {
	display: flex;
	align-items: center;
	gap: 10px; /* Space between items in each section */
	flex: 1; /* Allow sections to grow/shrink equally */
}

/* Search Bar */
.toolbar-search {
	flex: 1; /* Make the search bar take up available space */
	min-width: 80px; /* Prevent it from shrinking too small */
	max-width: 400px; /* Set a reasonable max width */
	box-sizing: border-box;
}

/* Buttons */
.toolbar-btn,
.copy-btn {
	flex: 0 0 auto; /* Prevent buttons from growing or shrinking */
	background: white;
	color: #007aff;
	border: none;
	padding: 10px 15px;
	border-radius: 5px;
	cursor: pointer;
	font-size: 1rem;
	transition: background-color 0.3s, color 0.3s;
}

.toolbar-btn:hover,
.copy-btn:hover {
	background-color: #005bb5;
	color: white;
}

/* Responsive Adjustments */
@media (max-width: 768px) {
	.toolbar-search {
		flex: 1; /* Allow the search bar to resize dynamically */
		width: 100%; /* Ensure it uses available space */
	}

	.toolbar-btn,
	.copy-btn {
		font-size: 0.9rem; /* Adjust font size for smaller screens */
		padding: 8px 10px; /* Adjust padding */
	}
}

@media (max-width: 480px) {
	.toolbar {
		gap: 5px; /* Reduce spacing for very small screens */
	}

	.toolbar-search {
		font-size: 0.9rem;
	}

	.toolbar-btn,
	.copy-btn {
		padding: 6px 8px; /* Adjust padding for very small screens */
	}
}
</style>
