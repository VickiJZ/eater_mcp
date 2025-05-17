import * as cheerio from 'cheerio';

/**
 * Defines the mapping from a desired key to a CSS class name.
 * Example: { time: 'ReservationButton__time' }
 * This means the content for the 'time' key will be extracted
 * from the first HTML element with the class 'ReservationButton__time'.
 */
export interface TagMapping {
  [key: string]: string;
}

/**
 * Defines the structure of the data extracted by the parser.
 * Keys correspond to those in TagMapping, and values are arrays of
 * extracted text content. An empty array indicates no elements were found for that key.
 */
export interface ParsedOutput {
  [key: string]: string[];
}

/**
 * Extracts data from HTML content based on a provided class mapping.
 */
export class HtmlDataExtractor {
  private mapping: TagMapping;

  /**
   * Creates an instance of HtmlDataExtractor.
   * @param mapping - An object where keys are desired output keys and
   *                  values are the CSS class names to search for.
   */
  constructor(mapping: TagMapping) {
    this.mapping = mapping;
  }

  /**
   * Parses the provided HTML string and extracts data according to the mapping.
   * For each key in the mapping, it finds all elements with the corresponding class
   * and extracts their text content into an array.
   *
   * @param html - The HTML string to parse.
   * @returns An object where keys are from the mapping and values are arrays of
   *          extracted text content (trimmed). An empty array is returned for a key
   *          if no elements with the specified class are found.
   */
  public extract(html: string): ParsedOutput {
    const $ = cheerio.load(html);
    const extractedData: ParsedOutput = {};

    for (const key in this.mapping) {
      if (Object.prototype.hasOwnProperty.call(this.mapping, key)) {
        const className = this.mapping[key];
        const selector = `.${className}`;
        extractedData[key] = $(selector).map((_i, el) => $(el).text().trim()).get();
      }
    }
    return extractedData;
  }

  /**
   * Parses the provided HTML string, finds multiple items based on itemSelector,
   * and extracts data from each item according to the class mapping.
   * Each extracted field per item will be an array of strings.
   *
   * @param html - The HTML string to parse.
   * @param itemSelector - The CSS selector to identify each individual item block.
   * @returns An array of objects, where each object contains data extracted
   *          from one item, or an empty array if no items are found or if HTML is empty.
   */
  public extractMultiple(html: string, itemSelector: string): ParsedOutput[] {
    if (!html || !itemSelector) {
      return [];
    }
    const $ = cheerio.load(html);
    const results: ParsedOutput[] = [];

    $(itemSelector).each((_index, itemElement) => {
      const itemHtml = $(itemElement).html(); // Get inner HTML of the item block
      if (itemHtml) {
        const itemCheerioInstance = cheerio.load(itemHtml); // Load only the item's HTML
        const extractedItemData: ParsedOutput = {};
        let hasAnyData = false;

        for (const key in this.mapping) {
          if (Object.prototype.hasOwnProperty.call(this.mapping, key)) {
            const className = this.mapping[key];
            const selector = `.${className}`;
            // Find elements only within the current item context
            const values = itemCheerioInstance(selector).map((_i, el) => itemCheerioInstance(el).text().trim()).get();
            extractedItemData[key] = values;
            if (values.length > 0) {
              hasAnyData = true;
            }
          }
        }
        // Add to results if at least one mapped field yielded some values
        if (hasAnyData) {
           results.push(extractedItemData);
        }
      }
    });
    return results;
  }
}

// Example of how to use the HtmlDataExtractor:
/*
// 1. Define the mapping based on your HTML structure
const VENDOR_SPECIFIC_MAPPING: TagMapping = {
  time: 'ReservationButton__time',
  restaurant_name: 'SearchResult__venue-name'
  // Add other mappings as needed, e.g.:
  // phoneNumber: 'VenueDetails-phone',
  // address: 'VenueDetails-addressStreet'
};

// 2. Create an instance of the parser with the mapping
const htmlExtractor = new HtmlDataExtractor(VENDOR_SPECIFIC_MAPPING);

// 3. Provide the HTML content you want to parse
// (This would typically be fetched from a website)
const sampleHtml = `
  <html>
    <body>
      <div class="some-container">
        <span class="ReservationButton__time"> 07:00 PM </span>
      </div>
      <div class="another-container">
        <h1 class="SearchResult__venue-name"> Example Restaurant & Bar </h1>
        <p class="non-relevant-class">Some other text</p>
      </div>
      <div class="ReservationButton__time"> 08:00 PM </div> <!-- Will be ignored by .first() -->
    </body>
  </html>
`;

// 4. Extract the data
const parsedData = htmlExtractor.extract(sampleHtml);

// 5. Log or use the parsed data
console.log(parsedData);
// Expected output for the sampleHtml and VENDOR_SPECIFIC_MAPPING:
// {
//   time: ['07:00 PM'],
//   restaurant_name: ['Example Restaurant & Bar']
// }

// Example with missing element:
const htmlWithMissingElement = `
  <html>
    <body>
      <h1 class="SearchResult__venue-name"> Only Restaurant </h1>
    </body>
  </html>
`;
const parsedDataMissing = htmlExtractor.extract(htmlWithMissingElement);
console.log(parsedDataMissing);
// Expected output:
// {
//   time: [],
//   restaurant_name: ['Only Restaurant']
// }
*/ 