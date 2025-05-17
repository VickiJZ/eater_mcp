// testSearch.ts

import { handleEaterSearch } from '../index.js'; // Adjust the import path if necessary

async function testHandleEaterSearch() {
  const testParams = {
    city: "new-york-ny",
    seat_number: 4,
    date: "2025-05-21",
    time: "1900",
    cuisine: "American",
    query_keywords: ["lower east side", "east village"],
  };

  try {
    const response = await handleEaterSearch(testParams);
    console.log("Response:", response);
  } catch (error) {
    console.error("Error:", error);
  }
}

testHandleEaterSearch();