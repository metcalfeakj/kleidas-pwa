<script lang="ts">
  import { populateDatabase } from '$lib/db';
  import { onMount } from 'svelte';

  let dbReady = false;

  // Wait for database population
  async function initializeDatabase() {
    await populateDatabase('/bible.json');
    dbReady = true; // Set the flag once the database is ready
  }

  onMount(() => {
    initializeDatabase();
  });
</script>

{#if dbReady}
  <slot />
{:else}
  <p>Loading Bible data...</p>
{/if}