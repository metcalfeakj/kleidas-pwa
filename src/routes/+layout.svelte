<script lang="ts">
	import { reloadDatabaseWithHashing } from '$lib/db';
	import { onMount } from 'svelte';
  
	let dbReady = false;

	// Wait for database population
	async function initializeDatabase() {
		await reloadDatabaseWithHashing('/bible.json');
		dbReady = true; // Set the flag once the database is ready
	}

	onMount(() => {
		initializeDatabase();
	});
</script>

{#if dbReady}
	<slot />
{:else}
<div class="loading-container">
  <div class="spinner"></div>
  <p class="loading-text">But they that wait upon the LORD shall renew their strength;</p>
  <p class="loading-text">they shall mount up with wings as eagles;</p>
  <p class="loading-text">they shall run, and not be weary;</p>
  <p class="loading-text">and they shall walk, and not faint. - Isaiah 40:31 (KJV)</p>
</div>
{/if}
<style>
  .loading-container {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  height: 100vh;
  background-color: #f5f5f5;
  color: #333;
  text-align: center;
  font-family: 'Arial', sans-serif;
}

.spinner {
  border: 4px solid #f3f3f3;
  border-top: 4px solid #3498db;
  border-radius: 50%;
  width: 50px;
  height: 50px;
  animation: spin 1s linear infinite;
  margin-bottom: 20px;
}

@keyframes spin {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}

.loading-text {
  margin: 5px 0;
  font-size: 16px;
  color: #555;
}


</style>