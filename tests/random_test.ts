// testSearch.ts

import { handleEaterSearch } from '../index.js'; // Adjust the import path if necessary

async function testHandleEaterSearch() {
  const testParams = {
    keywords: ["burger"],
  };

  try {
    const response = await handleEaterSearch(testParams);
    console.log("Response:", response);
  } catch (error) {
    console.error("Error:", error);
  }
}

testHandleEaterSearch();
