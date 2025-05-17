// src/eaterCrawler.ts
import puppeteer, { Page, TimeoutError } from 'puppeteer';
import { CUISINE_HINTS, EATER_NY_URL } from './constants.js';
export type Source = 'map' | 'article' | 'unknown';

export interface Venue {
  name: string;
  cuisine: string;
  source: Source;
  venueType: VenueType;
}
export type VenueType = 'bar' | 'restaurant' | 'unknown';

/* ------------------------------------------------------------------ */
/*   helpers                                                          */
/* ------------------------------------------------------------------ */

const toTitle = (s: string) => s[0].toUpperCase() + s.slice(1);

const guessCuisine = (text: string): string => {
  const hit = CUISINE_HINTS.find(c => text.toLowerCase().includes(c));
  return hit ? toTitle(hit) : "unknown";
};

const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

/* ------------------------------------------------------------------ */
/*   DOM utils (executed in browser context)                           */
/* ------------------------------------------------------------------ */
const $$txt = (sel: string, root: ParentNode = document) =>
  Array.from(root.querySelectorAll<HTMLElement>(sel)).map(el => el.textContent?.trim() ?? '');


/* ------------------------------------------------------------------ */
/*   link gatherer                                                    */
/* ------------------------------------------------------------------ */
const gatherArticleLinks = async (
  page: Page,
  keywords: string[],
  limit = 40
): Promise<string[]> => {
  const links = new Set<string>();
  let iterations = 0;
  console.log('Gathering article links...');
  console.log('Keywords:', keywords);

  while (links.size < limit && iterations < 10) {
    console.log(`Iteration: ${iterations}, Current URL: ${page.url()}`);
    console.log(`Links collected so far: ${links.size}`);

    // Count links before clicking "More Stories"
    const initialLinkCount = await page.evaluate(() => document.querySelectorAll('h2.c-entry-box--compact__title a').length);
    console.log(`Initial article links on page: ${initialLinkCount}`);

    const fresh: string[] = await page.$$eval(
      'h2.c-entry-box--compact__title a',
      (as: HTMLAnchorElement[], keys: string[]) =>
        (as as HTMLAnchorElement[])
          .filter(a =>
            keys.some((k: string) => a.textContent?.toLowerCase().includes(k))
          )
          .map(a => a.href),
      keywords
    );
    console.log('Fresh links found in this iteration:', fresh);
    fresh.forEach((href: string) => links.add(href));

    const clicked = await page.evaluate(() => {
      const btn = [...document.querySelectorAll<HTMLElement>('button, a')].find(
        el => /more stories/i.test(el.textContent ?? '')
      );
      if (!btn) {
        console.log('No "more stories" button found in DOM evaluation.');
        return false;
      }
      // Log button details
      console.log('Found "more stories" button. Text:', btn.textContent?.trim());
      console.log('Button outerHTML:', btn.outerHTML);
      if (btn instanceof HTMLAnchorElement) {
        console.log('Button href:', btn.href);
      }
      (btn as HTMLElement).click();
      return true;
    });

    if (!clicked) {
      console.log('"More stories" button not clicked or not found, breaking loop.');
      break;
    }
    console.log('"More stories" button clicked. Waiting for new content to load...');
    // Wait for new article links to appear
    try {
      await page.waitForFunction(
        (expectedMinCount) => {
          const currentCount = document.querySelectorAll('h2.c-entry-box--compact__title a').length;
          // console.log(`Current link count in waitForFunction: ${currentCount}, expecting more than: ${expectedMinCount}`); // Browser-side log for debugging
          return currentCount > expectedMinCount;
        },
        { timeout: 15000 }, // Wait for up to 15 seconds
        initialLinkCount
      );
      console.log('New content likely loaded (more article links found).');
    } catch (e: any) {
      console.warn(`Timeout or error waiting for new article links after clicking "More Stories" (iteration ${iterations}): ${e.message}`);
      console.log('Proceeding, but link gathering might be incomplete for this iteration.');
    }
    iterations += 1;
  }
  console.log(`Finished gathering links. Total found: ${links.size}`);
  return [...links].slice(0, limit);
}


/* ------------------------------------------------------------------ */
/*  heuristics to label bar vs restaurant                             */
/* ------------------------------------------------------------------ */
const BAR_KEYS   = [' bar', ' pub', ' tavern', ' saloon', ' taproom', ' dive'];
const REST_KEYS  = [' restaurant', ' steakhouse', ' bistro', ' cafe', ' diner',
                    ' trattoria', ' ristorante', ' kitchen'];

const BAR_CTX    = ['cocktail', 'cheap drinks', 'happy hour', 'jukebox', 'pint'];
const REST_CTX   = ['chef', 'menu', 'dining room', 'tasting', 'course', 'dish'];

/** decide venue type from name + description */
const classify = (name: string, desc: string, articleTitle = ''): VenueType => {
  const text = ` ${name.toLowerCase()} ${desc.toLowerCase()} ${articleTitle.toLowerCase()} `;

  const barHit  = BAR_KEYS.some(k  => text.includes(k)) || BAR_CTX.some(k  => desc.toLowerCase().includes(k));
  const restHit = REST_KEYS.some(k => text.includes(k)) || REST_CTX.some(k => desc.toLowerCase().includes(k));

  if (barHit && !restHit)      return 'bar';
  if (restHit && !barHit)      return 'restaurant';
  if (barHit && restHit)       return name.toLowerCase().includes('bar') ? 'bar' : 'restaurant';
  return 'unknown';
};

/* ------------------------------------------------------------------ */
/*  map-style parser (works for /maps/* best burgers, dive bars, etc.) */
/* ------------------------------------------------------------------ */
export const parseMap = async (page: Page): Promise<Venue[]> => {
    const articleTitle = await page.title();
  
    const rows = await page.$$eval(
      'section.c-mapstack__card',
      (cards) =>
        (cards as HTMLElement[]).map(card => {
          // 1. heading (h1-h4) anywhere inside card
          const head = card.querySelector<HTMLElement>('h1,h2,h3,h4');
          if (!head) return null;                     // skip malformed card
  
          let name = head.innerText
            .replace(/Copy Link/i, '')
            .replace(/^#\s*\d*\s*/, '')                   // drop " # 14 "
            .trim();

          if (!name ||
            /^(more in maps|related maps?|related|map points)/i.test(name))
            return null;
          // 2. collect <p> text, excluding obvious address/meta
          const descParts: string[] = [];
          card.querySelectorAll('p').forEach(p => {
            const txt = p.innerText.trim();
            const isAddress =
                p.classList.contains('c-mapstack__address') ||
                /^\d{2,4}\s+\w+/.test(txt);                // starts with street #
  
            if (!isAddress && txt && txt !== 'Copy Link') descParts.push(txt);
          });
  
          return { name, description: descParts.join(' ') }; 
        }).filter(Boolean) as Array<{name: string, description: string}> 
    );
  
    return rows.map(r => ({
      name: r!.name,
      cuisine: guessCuisine(r!.description), // Guess cuisine here in Node.js context
      source: 'map' as const,
      venueType: classify(r!.name, r!.description, articleTitle)
    }));
  };

/* ------------------------------------------------------------------ */
/*  generic article parser (for narrative listicles)                  */
/* ------------------------------------------------------------------ */
export const parseArticle = async (page: Page): Promise<Venue[]> => {
  const title = await page.title();

  const raw = await page.$$eval(
    'div.c-entry-content > h2',
    (heads) => heads.map(h2 => {
      // venue name rules: anchor text > after " at " > full heading
      const anchor = h2.querySelector('a');
      let venue = anchor ? anchor.textContent!.trim()
               : h2.textContent!.includes(' at ')
                     ? h2.textContent!.split(' at ').pop()!.trim()
                     : h2.textContent!.trim();

      // skip address line if present
      let node = h2.nextElementSibling;
      const addrRx = /^\d+\s.+\b(?:St|Street|Ave|Avenue|Road|Rd|Blvd|Boulevard|NYC?)\b/i;
      if (node && node.tagName === 'P' && addrRx.test(node.textContent || '')) {
        node = node.nextElementSibling;
      }

      const parts: string[] = [];
      while (node && node.tagName !== 'H2') {
        if (node.tagName === 'P') parts.push(node.textContent!.trim());
        node = node.nextElementSibling;
      }
      return { name: venue, description: parts.join(' ') }; // Removed cuisine guessing from here
    })
  );

  return raw.map(r => ({
    name: r.name,
    cuisine: guessCuisine(r.description), // Guess cuisine here in Node.js context
    source: 'article' as const,
    venueType: classify(r.name, r.description, title)
  }));
};

/* ------------------------------------------------------------------ */
/*  router – call this instead of parseHeatmap/parseGeneric           */
/* ------------------------------------------------------------------ */
export const crawlArticle = async (page: Page, href: string): Promise<Venue[]> => {
  await page.goto(href, { waitUntil: 'networkidle2', timeout: 60000 });

  // DOM sniff: mapstack cards present?
  const isMap = await page.$('section.c-mapstack__card') !== null;

  const venues = isMap ? await parseMap(page) : await parseArticle(page);

  return venues;
};
/* ------------------------------------------------------------------ */
/*   crawl driver (concurrency-limited)                               */
/* ------------------------------------------------------------------ */
const CONCURRENCY = 4;

const boundedMap = async <T, R>(
  arr: T[],
  limit: number,
  fn: (x: T, idx: number) => Promise<R>
): Promise<R[]> => {
  const ret: R[] = [];
  let idx = 0;

  const worker = async () => {
    while (idx < arr.length) {
      const cur = idx++;
      ret[cur] = await fn(arr[cur], cur);
    }
  }
  await Promise.all(Array.from({ length: limit }, worker));
  return ret;
}

/* ------------------------------------------------------------------ */
/*   main                                                             */
/* ------------------------------------------------------------------ */

export async function runCrawler(keywords: string[]): Promise<Venue[]> {
  if (keywords.length === 0) {
    console.error('Error: At least one keyword must be provided.');
    return []; // Or throw an error
  }

  const lowerCaseKeywords = keywords.map(k => k.toLowerCase());

  const browser = await puppeteer.launch({
    headless: true,
    defaultViewport: { width: 1280, height: 1800 }
  });
  const seed = await browser.newPage();

  try {
    console.log('Attempting to load seed page...');
    await seed.goto(EATER_NY_URL, { waitUntil: 'networkidle2', timeout: 60000 });
    console.log('Seed page loaded successfully.');
  } catch (error) {
    if (error instanceof TimeoutError) {
      console.error('TimeoutError loading seed page:', error.message);
    } else {
      console.error('Error loading seed page:', error);
    }
    console.error('Exiting crawler function due to error loading seed page.');
    await browser.close();
    return []; // Or throw the error
  }

  const articleLinks = await gatherArticleLinks(seed, lowerCaseKeywords);
  console.log(`📰  matched ${articleLinks.length} articles`);

  // crawlArticle now returns VenueWithDescription internally because parsers add description
  const venues: Venue[] = (
    await boundedMap(articleLinks, CONCURRENCY, async (href, i) => {
      const p = await browser.newPage();
      try {
        console.log(`  Attempting to crawl (${i + 1}/${articleLinks.length}): ${href}`);
        // Ensure crawlArticle's internal logic aligns with returning VenueWithDescription
        const res = await crawlArticle(p, href) as Venue[]; 
        console.log(`  ✅ Successfully crawled (${i + 1}/${articleLinks.length}) ${href}  →  ${res.length} venues`);
        return res;
      } catch (err: any) {
        console.warn(`⚠️  Error crawling ${href}:`, err.message);
        return []; 
      } finally {
        await p.close();
      }
    })
  ).flat();

  // Filter out obviously incorrect results
  const JUNK_KEYWORDS = [
    "newsletter", "sign up", "subscribe", "log in", "terms of", "privacy notice",
    "cookie policy", "about eater", "contact us", "community guidelines", "vox media",
    "follow eater", "site search", "more from", "most read", "the latest", "archive",
    "comment", "advertise", "jobs @", "press room", "masthead", "ethics", "licensing",
    "platform status", "methodology", "faq", "skip to main content", "log in or sign up",
    "site map", "accessibility", "cookie settings", "send us a tip", "eater.com", "eater ny"
  ];

  const filteredVenues: Venue[] = venues.filter(v => {
    const nameLower = v.name.toLowerCase();

    if (v.name.trim().length < 3 || v.name.trim().length > 30) { 
      return false;
    }

    for (const keyword of JUNK_KEYWORDS) {
      if (nameLower.includes(keyword)) { 
        return false;
      }
    }
    return true;
  });

  // De-duplicate by name and ensure final objects match Venue interface (no description)
  const unique = new Map<string, Venue>();
  filteredVenues.forEach(v => {
    const venueWithoutDescription: Venue = {
        name: v.name,
        cuisine: v.cuisine, 
        source: v.source,
        venueType: v.venueType 
    };
    unique.set(v.name, venueWithoutDescription);
  });

  await browser.close();
  return [...unique.values()];
}
