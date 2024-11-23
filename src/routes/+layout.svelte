<script>
    import { liveQuery } from "dexie";
    import { db, populateDatabase } from "$lib/db";
    import { onMount } from 'svelte';
  
    // Populate the database if it's empty
    onMount(() => {
      populateDatabase('/bible.json'); // Adjust path to your JSON file in the static folder
    });
  
    // Use liveQuery to observe changes in the 'books' table
    let books = liveQuery(() => db.table('books').toArray());
</script>
  
<slot />
