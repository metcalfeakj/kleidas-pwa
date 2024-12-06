<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { db } from '$lib/db';
	import { bibleState, type Verse } from '$lib/bibleState';
	import { bookMapping } from '$lib/bookMapping';
	import './style.css';

	let searchQuery = ''; // Holds the current search query
	let sidebarElement: HTMLElement | null = null; // Sidebar element reference

	// Function to handle errors
	function handleError(err: any, defaultMessage: string) {
		bibleState.update((state) => ({
			...state,
			error: (err as Error).message || defaultMessage
		}));
	}

	// Load cached state from localStorage
	function loadCachedState() {
		const cachedState = JSON.parse(localStorage.getItem('bible-viewer-state') || '{}');
		bibleState.update((state) => ({
			...state,
			selectedBook: cachedState.book || state.selectedBook,
			selectedChapter: cachedState.chapter || state.selectedChapter
		}));
	}

	// Save state to localStorage
	bibleState.subscribe((state) => {
		localStorage.setItem(
			'bible-viewer-state',
			JSON.stringify({
				book: state.selectedBook,
				chapter: state.selectedChapter
			})
		);
	});

	// Toggle sidebar visibility
	function toggleSidebar() {
		bibleState.update((state) => ({
			...state,
			isSidebarOpen: !state.isSidebarOpen
		}));
	}

	// Close sidebar if clicked outside
	function handleOutsideClick(event: MouseEvent) {
		if (sidebarElement && !sidebarElement.contains(event.target as Node)) {
			bibleState.update((state) => ({ ...state, isSidebarOpen: false }));
		}
	}

	// Fetch chapters for the selected book
	async function updateChapters() {
		bibleState.update((state) => {
			const book = state.books.find((b) => b.BookName === state.selectedBook);
			if (!book) {
				return {
					...state,
					error: `Book "${state.selectedBook}" not found.`,
					chapters: [],
					verses: []
				};
			}
			return {
				...state,
				error: null,
				chapters: Array.from({ length: book.TotalChapters }, (_, i) => i + 1),
				verses: []
			};
		});
		await fetchVerses();
	}

	// Fetch verses for the selected chapter
	async function fetchVerses() {
		bibleState.update((state) => {
			const book = state.books.find((b) => b.BookName === state.selectedBook);
			if (!book) {
				return {
					...state,
					error: `Book "${state.selectedBook}" not found.`,
					verses: []
				};
			}

			const chapter = book.Chapters.find((ch) => ch.ChapterNumber === state.selectedChapter);
			if (!chapter) {
				return {
					...state,
					error: `Chapter ${state.selectedChapter} not found in "${state.selectedBook}".`,
					verses: []
				};
			}

			return {
				...state,
				error: null,
				verses: chapter.Verses.map((verse) => ({ ...verse, copied: false }))
			};
		});
	}

	// Handle search input and update state accordingly
	function handleSearch(event: KeyboardEvent) {
		if (event.key === 'Enter') {
			const input = searchQuery.trim();
			const regex = /(\d?\s?\w+)\s*(\d+)?(?::(\d+)(?:-(\d+))?)?/i;
			const match = input.match(regex);

			if (!match) {
				bibleState.update((state) => ({
					...state,
					error: 'Invalid format. Use "Book Chapter" or "Book Chapter:Verse".'
				}));
				return;
			}

			const bookAbbr = match[1].toLowerCase().replace(/\s+/g, '');
			const bookName = bookMapping[bookAbbr] || bookAbbr;
			const chapterNumber = match[2] ? parseInt(match[2]) : 1;
			const startVerse = match[3] ? parseInt(match[3]) : null;
			const endVerse = match[4] ? parseInt(match[4]) : null;

			bibleState.update((state) => {
				const book = state.books.find((b) => b.BookName.toLowerCase() === bookName.toLowerCase());
				if (!book) {
					return { ...state, error: `Book "${bookName}" not found.` };
				}
				return {
					...state,
					selectedBook: book.BookName,
					selectedChapter: chapterNumber,
					selectedVerses: []
				};
			});

			updateChapters().then(() => {
				if (startVerse) highlightVerses(startVerse, endVerse || startVerse);
			});

			searchQuery = '';
		}
	}

	// Highlight selected verses
	function highlightVerses(startVerse: number, endVerse?: number) {
		bibleState.update((state) => {
			let scrolled = false;
			state.verses = state.verses.map((verse) => {
				const isSelected =
					verse.VerseNumber >= startVerse && (!endVerse || verse.VerseNumber <= endVerse);
				if (isSelected && !scrolled) {
					scrolled = true;
					verse.domElement?.scrollIntoView({ behavior: 'smooth', block: 'center' });
				}
				return { ...verse, selected: isSelected };
			});
			state.selectedVerses = state.verses.filter((v) => v.selected).map((v) => v.Text);
			return state;
		});
	}

	// Clear selected verses
	function clearSelectedVerses() {
		bibleState.update((state) => {
			state.verses = state.verses.map((v) => ({ ...v, selected: false }));
			state.selectedVerses = [];
			return state;
		});
	}

	// Copy selected verses to clipboard
	async function copySelectedVerses() {
		const selectedText = formatSelectedVerses();
		try {
			await navigator.clipboard.writeText(selectedText);
			alert('Verses copied to clipboard.');
			clearSelectedVerses();
		} catch (err) {
			alert('Failed to copy verses: ' + err);
		}
	}

	// Format selected verses for display
	function formatSelectedVerses(): string {
		let selected: string[] = [];
		bibleState.update((state) => {
			selected = state.selectedVerses;
			return state;
		});
		if (!selected.length) return '';
		return selected.join('\n');
	}

	// Handle verse selection
	function handleVerseSelection(verse: Verse) {
		bibleState.update((state) => {
			state.verses = state.verses.map((v) =>
				v.VerseNumber === verse.VerseNumber ? { ...v, selected: !v.selected } : v
			);
			state.selectedVerses = state.verses.filter((v) => v.selected).map((v) => v.Text);
			return state;
		});
	}

	onMount(async () => {
		loadCachedState();
		try {
			const books = await db.table('books').toArray();
			bibleState.update((state) => ({ ...state, books }));
			await updateChapters();
			document.addEventListener('click', handleOutsideClick);
		} catch (err) {
			handleError(err, 'Failed to load books.');
		}
	});

	onDestroy(() => {
		document.removeEventListener('click', handleOutsideClick);
	});

	function previousChapter() {
		bibleState.update((state) => {
			const currentBookIndex = state.books.findIndex((b) => b.BookName === state.selectedBook);

			if (state.selectedChapter > 1) {
				// Move to the previous chapter in the same book
				return { ...state, selectedChapter: state.selectedChapter - 1, selectedVerses: [] };
			} else if (currentBookIndex > 0) {
				// Move to the last chapter of the previous book
				const previousBook = state.books[currentBookIndex - 1];
				return {
					...state,
					selectedBook: previousBook.BookName,
					selectedChapter: previousBook.TotalChapters,
					selectedVerses: []
				};
			} else {
				// Already at the first chapter of the first book, no further navigation
				return state;
			}
		});

		// Fetch the new chapter's verses
		updateChapters();
	}

	function nextChapter() {
		bibleState.update((state) => {
			const currentBookIndex = state.books.findIndex((b) => b.BookName === state.selectedBook);

			const currentBook = state.books[currentBookIndex];
			if (state.selectedChapter < currentBook.TotalChapters) {
				// Move to the next chapter in the same book
				return { ...state, selectedChapter: state.selectedChapter + 1, selectedVerses: [] };
			} else if (currentBookIndex < state.books.length - 1) {
				// Move to the first chapter of the next book
				const nextBook = state.books[currentBookIndex + 1];
				return {
					...state,
					selectedBook: nextBook.BookName,
					selectedChapter: 1,
					selectedVerses: []
				};
			} else {
				// Already at the last chapter of the last book, no further navigation
				return state;
			}
		});

		// Fetch the new chapter's verses
		updateChapters();
	}
</script>

<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<main class="bible-app">
	<!-- Toolbar Section -->
	<div class="toolbar">
		<div class="toolbar-left">
		</div>
		<div class="toolbar-center">
			<input
				type="text"
				class="toolbar-search"
				placeholder="{$bibleState.selectedBook} {$bibleState.selectedChapter}"
				bind:value={searchQuery}
				on:keydown={(event) => handleSearch(event)}
			/>
		</div>
		<div class="toolbar-right">
			<button
				class="toolbar-btn copy-btn"
				disabled={$bibleState.selectedVerses.length === 0}
				on:click={copySelectedVerses}>📋</button
			>
		</div>
	</div>

	<!-- App Layout -->
	<div class="app-layout">
		<!-- Sidebar for Book and Chapter Navigation -->
		<div
			bind:this={sidebarElement}
			class={`sidebar ${$bibleState.isSidebarOpen ? 'open' : ''}`}
			on:click|stopPropagation
		>
			<div class="sidebar-content">
				<!-- Old Testament Section -->
				<div class="old-testament-section">
					<h3 class="sidebar-heading">OT</h3>
					<div class="book-list">
						{#each $bibleState.books.slice(0, 39) as book}
							<button
								class="book-item {$bibleState.selectedBook === book.BookName ? 'selected' : ''}"
								on:click={() => {
									bibleState.update((state) => {
										state.selectedBook = book.BookName;
										state.selectedChapter = 1;
										state.selectedVerses = [];
										return state;
									});
									updateChapters();
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
						{#each $bibleState.books.slice(39) as book}
							<button
								class="book-item {$bibleState.selectedBook === book.BookName ? 'selected' : ''}"
								on:click={() => {
									bibleState.update((state) => {
										state.selectedBook = book.BookName;
										state.selectedChapter = 1;
										state.selectedVerses = [];
										return state;
									});
									updateChapters();
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
						{#each $bibleState.chapters as chapter}
							<button
								class="chapter-item {$bibleState.selectedChapter === chapter ? 'selected' : ''}"
								on:click={() => {
									bibleState.update((state) => ({
										...state,
										selectedChapter: chapter,
										selectedVerses: []
									}));
									fetchVerses();
									bibleState.update((state) => ({
										...state,
										isSidebarOpen: false
									}));
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
				<h2 on:click|stopPropagation={toggleSidebar}>📜 {$bibleState.selectedBook} {$bibleState.selectedChapter}</h2>
				<button class="nav-btn" class:hidden={$bibleState.isSidebarOpen} on:click={previousChapter}>⬅</button>
				<button class="nav-btn" class:hidden={$bibleState.isSidebarOpen} on:click={nextChapter}>➡</button>
			</header>
			<article class="verse-list">
				<div class="verse-container">
					{#each $bibleState.verses as verse (verse.VerseNumber)}
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
</style>
