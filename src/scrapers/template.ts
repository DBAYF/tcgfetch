import axios from 'axios';
import * as cheerio from 'cheerio';
import { Card } from '../types';
import { FileManager } from '../utils/fileManager';
import { RateLimiter } from '../utils/rateLimiter';
import { Logger } from '../utils/logger';

/**
 * Template Web Scraper for TCGs without APIs
 * 
 * Usage: Copy this template and customize for specific games
 * 
 * Required steps:
 * 1. Identify the card list URL
 * 2. Determine pagination structure
 * 3. Find card detail selectors (CSS/XPath)
 * 4. Extract image URLs
 * 5. Map to Card interface
 * 
 * For JavaScript-heavy sites, use Puppeteer:
 * - npm install puppeteer
 * - Use headless browser to render pages
 */

export class TemplateScraper {
  private logger: Logger;
  private rateLimiter: RateLimiter;
  private gameId: string;
  private baseUrl: string;

  constructor(gameId: string, baseUrl: string) {
    this.logger = new Logger();
    this.gameId = gameId;
    this.baseUrl = baseUrl;
    this.rateLimiter = new RateLimiter(2); // Conservative: 2 requests per second
  }

  async fetchPage(url: string): Promise<string> {
    return this.rateLimiter.execute(async () => {
      try {
        const response = await axios.get(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5'
          },
          timeout: 30000
        });
        return response.data;
      } catch (error) {
        this.logger.error(`Failed to fetch ${url}`, error as Error);
        throw error;
      }
    });
  }

  parseCardList(html: string): Array<{ url: string; name: string }> {
    const $ = cheerio.load(html);
    const cards: Array<{ url: string; name: string }> = [];

    // CUSTOMIZE: Update selector based on target website
    $('.card-item').each((_, element) => {
      const $el = $(element);
      const name = $el.find('.card-name').text().trim();
      const url = $el.find('a').attr('href');
      
      if (name && url) {
        cards.push({
          name,
          url: url.startsWith('http') ? url : `${this.baseUrl}${url}`
        });
      }
    });

    return cards;
  }

  parseCardDetail(html: string, cardUrl: string): Card | null {
    const $ = cheerio.load(html);

    try {
      // CUSTOMIZE: Update selectors based on target website
      const name = $('.card-name').text().trim();
      const set = $('.card-set').text().trim();
      const rarity = $('.card-rarity').text().trim();
      const type = $('.card-type').text().trim();
      const description = $('.card-text').text().trim();
      const imageUrl = $('.card-image img').attr('src') || '';

      return {
        id: cardUrl.split('/').pop() || name.toLowerCase().replace(/\s+/g, '-'),
        name,
        game: this.gameId,
        set,
        rarity,
        type,
        description,
        imageUrl: imageUrl.startsWith('http') ? imageUrl : `${this.baseUrl}${imageUrl}`,
        attributes: {}
      };
    } catch (error) {
      this.logger.error(`Failed to parse card at ${cardUrl}`, error as Error);
      return null;
    }
  }

  async scrapeAllCards(): Promise<Card[]> {
    this.logger.info(`Starting scraping for ${this.gameId}...`);

    const allCards: Card[] = [];

    try {
      // Step 1: Get card list (may need to handle pagination)
      const listUrl = `${this.baseUrl}/cards`; // CUSTOMIZE
      const listHtml = await this.fetchPage(listUrl);
      const cardLinks = this.parseCardList(listHtml);

      this.logger.info(`Found ${cardLinks.length} cards to scrape`);

      // Step 2: Scrape each card
      for (const link of cardLinks) {
        const cardHtml = await this.fetchPage(link.url);
        const card = this.parseCardDetail(cardHtml, link.url);
        
        if (card) {
          allCards.push(card);
          this.logger.info(`Scraped: ${card.name}`);
        }

        // Be respectful - add delay
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      // Save cards
      const cardsPath = FileManager.getCardDataPath(this.gameId);
      await FileManager.saveJSON(cardsPath, allCards);
      this.logger.success(`Saved ${allCards.length} cards to ${cardsPath}`);

      return allCards;
    } catch (error) {
      this.logger.error('Scraping failed', error as Error);
      throw error;
    }
  }
}

/**
 * Example: Scraping with Puppeteer (for JavaScript-heavy sites)
 * 
 * import puppeteer from 'puppeteer';
 * 
 * async function scrapeWithPuppeteer(url: string) {
 *   const browser = await puppeteer.launch({ headless: true });
 *   const page = await browser.newPage();
 *   
 *   await page.goto(url, { waitUntil: 'networkidle2' });
 *   
 *   const cards = await page.evaluate(() => {
 *     return Array.from(document.querySelectorAll('.card-item')).map(el => ({
 *       name: el.querySelector('.card-name')?.textContent,
 *       imageUrl: el.querySelector('img')?.src
 *     }));
 *   });
 *   
 *   await browser.close();
 *   return cards;
 * }
 */

