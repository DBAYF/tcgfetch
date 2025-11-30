import axios from 'axios';
import { Card } from '../types';
import { FileManager } from '../utils/fileManager';
import { RateLimiter } from '../utils/rateLimiter';
import { Logger } from '../utils/logger';
import cliProgress from 'cli-progress';

interface FABCard {
  identifier: string;
  name: string;
  pitch?: number;
  cost?: number;
  power?: number;
  defense?: number;
  health?: number;
  intelligence?: number;
  types: string[];
  card_keywords: string[];
  abilities_and_effects: string[];
  ability_and_effect_keywords: string[];
  granted_keywords: string[];
  text: string;
  image_url: string;
  printings: Array<{
    unique_id: string;
    id: string;
    set_id: string;
    edition: string;
    foiling: string;
    rarity: string;
    artist: string;
    image_url: string;
  }>;
}

export class FABDownloader {
  private logger: Logger;
  private rateLimiter: RateLimiter;
  private gameId = 'flesh-and-blood';
  private apiUrl = 'https://api.fabdb.net/cards';

  constructor() {
    this.logger = new Logger();
    this.rateLimiter = new RateLimiter(10); // Conservative: 10 requests per second
  }

  private convertCard(fabCard: FABCard): Card {
    const primaryPrinting = fabCard.printings[0];
    
    let description = fabCard.text;
    if (fabCard.abilities_and_effects.length > 0) {
      description += '\n\n' + fabCard.abilities_and_effects.join('\n');
    }

    let attributes: Record<string, any> = {
      pitch: fabCard.pitch,
      cost: fabCard.cost,
      power: fabCard.power,
      defense: fabCard.defense,
      health: fabCard.health,
      intelligence: fabCard.intelligence,
      keywords: fabCard.card_keywords,
      abilityKeywords: fabCard.ability_and_effect_keywords
    };

    return {
      id: fabCard.identifier,
      name: fabCard.name,
      game: 'Flesh and Blood',
      set: primaryPrinting?.set_id || 'Unknown',
      rarity: primaryPrinting?.rarity || 'Unknown',
      type: fabCard.types.join(', '),
      description: description.trim(),
      imageUrl: primaryPrinting?.image_url || fabCard.image_url,
      imageUrlLarge: primaryPrinting?.image_url || fabCard.image_url,
      attributes,
      artist: primaryPrinting?.artist,
      cardNumber: primaryPrinting?.id
    };
  }

  async downloadAllCards(): Promise<Card[]> {
    this.logger.info('Fetching Flesh and Blood cards from FABDB...');

    const allCards: Card[] = [];
    let page = 1;
    const pageSize = 100;

    const progressBar = new cliProgress.SingleBar({
      format: 'FAB Cards [{bar}] Page {value} | Cards: ' + allCards.length,
      barCompleteChar: '\u2588',
      barIncompleteChar: '\u2591',
    });

    progressBar.start(100, 0); // We don't know total pages upfront

    try {
      while (true) {
        const response = await this.rateLimiter.execute(() =>
          axios.get(this.apiUrl, {
            params: {
              page,
              per_page: pageSize
            },
            headers: {
              'User-Agent': 'TCG-Data-Collector/1.0'
            }
          })
        );

        const fabCards: FABCard[] = response.data.data;

        if (!fabCards || fabCards.length === 0) {
          break;
        }

        const cards = fabCards.map(card => this.convertCard(card));
        allCards.push(...cards);

        progressBar.update(page);
        page++;

        // If we got less than pageSize, we're on the last page
        if (fabCards.length < pageSize) {
          break;
        }
      }

      progressBar.stop();
      this.logger.success(`Downloaded ${allCards.length} Flesh and Blood cards`);

      // Save raw data
      const cardsPath = FileManager.getCardDataPath(this.gameId);
      await FileManager.saveJSON(cardsPath, allCards);
      this.logger.info(`Saved cards to ${cardsPath}`);

      return allCards;
    } catch (error) {
      progressBar.stop();
      this.logger.error('Failed to download Flesh and Blood cards', error as Error);
      throw error;
    }
  }

  async downloadImages(cards: Card[]): Promise<void> {
    this.logger.info(`Downloading images for ${cards.length} cards...`);

    const progressBar = new cliProgress.SingleBar({
      format: 'FAB Images [{bar}] {percentage}% | {value}/{total} | ETA: {eta}s',
      barCompleteChar: '\u2588',
      barIncompleteChar: '\u2591',
    });

    progressBar.start(cards.length, 0);

    let downloaded = 0;
    let errors = 0;

    for (const card of cards) {
      try {
        if (!card.imageUrl) {
          progressBar.increment();
          continue;
        }

        const imagePath = FileManager.getCardImagePath(this.gameId, card.id, 'normal');

        await this.rateLimiter.execute(async () => {
          const success = await FileManager.downloadImage(card.imageUrl, imagePath);
          if (success) {
            downloaded++;
          } else {
            errors++;
          }
        });

        progressBar.increment();
      } catch (error) {
        errors++;
        progressBar.increment();
      }
    }

    progressBar.stop();
    this.logger.success(`Downloaded ${downloaded} images, ${errors} errors`);
  }

  async download(downloadImages: boolean = true): Promise<void> {
    const startTime = Date.now();
    
    this.logger.info('Starting Flesh and Blood download...');

    try {
      // Download card data
      const cards = await this.downloadAllCards();

      // Download images if requested
      if (downloadImages && cards.length > 0) {
        await this.downloadImages(cards);
      }

      const duration = (Date.now() - startTime) / 1000;
      this.logger.success(
        `Flesh and Blood download complete! ${cards.length} cards in ${duration.toFixed(2)}s`
      );

      // Save stats
      await FileManager.saveJSON(
        FileManager.getRawDataPath(this.gameId, 'download-stats.json'),
        {
          game: 'Flesh and Blood',
          totalCards: cards.length,
          timestamp: new Date().toISOString(),
          duration
        }
      );
    } catch (error) {
      this.logger.error('Flesh and Blood download failed', error as Error);
      throw error;
    }
  }
}

// CLI execution
if (require.main === module) {
  const downloader = new FABDownloader();
  downloader.download(true)
    .then(() => process.exit(0))
    .catch(error => {
      console.error('Download failed:', error);
      process.exit(1);
    });
}

