import axios from 'axios';
import { Card } from '../types';
import { FileManager } from '../utils/fileManager';
import { RateLimiter } from '../utils/rateLimiter';
import { Logger } from '../utils/logger';
import cliProgress from 'cli-progress';

interface ScryfallCard {
  id: string;
  name: string;
  set: string;
  set_name: string;
  rarity: string;
  type_line: string;
  oracle_text?: string;
  image_uris?: {
    small: string;
    normal: string;
    large: string;
    png: string;
  };
  card_faces?: Array<{
    image_uris?: {
      small: string;
      normal: string;
      large: string;
    };
  }>;
  prices?: {
    usd?: string;
    eur?: string;
  };
  released_at?: string;
  artist?: string;
  collector_number?: string;
}

export class MTGDownloader {
  private logger: Logger;
  private rateLimiter: RateLimiter;
  private gameId = 'magic-the-gathering';

  constructor() {
    this.logger = new Logger();
    this.rateLimiter = new RateLimiter(10); // 10 requests per second
  }

  private convertCard(scryfallCard: ScryfallCard): Card {
    // Handle double-faced cards
    const imageUris = scryfallCard.image_uris || 
                     scryfallCard.card_faces?.[0]?.image_uris;

    return {
      id: scryfallCard.id,
      name: scryfallCard.name,
      game: 'Magic: The Gathering',
      set: scryfallCard.set_name,
      setCode: scryfallCard.set,
      rarity: scryfallCard.rarity,
      type: scryfallCard.type_line,
      description: scryfallCard.oracle_text || '',
      imageUrl: imageUris?.normal || '',
      imageUrlSmall: imageUris?.small,
      imageUrlLarge: imageUris?.large,
      attributes: {
        multiverseId: scryfallCard.id,
        setCode: scryfallCard.set
      },
      prices: scryfallCard.prices,
      releaseDate: scryfallCard.released_at,
      artist: scryfallCard.artist,
      cardNumber: scryfallCard.collector_number
    };
  }

  async downloadBulkData(): Promise<Card[]> {
    this.logger.info('Fetching bulk data information from Scryfall...');

    try {
      // Get bulk data info
      const bulkDataResponse = await axios.get('https://api.scryfall.com/bulk-data');
      const bulkDataList = bulkDataResponse.data.data;

      // Find the default cards bulk data
      const defaultCards = bulkDataList.find((item: any) => 
        item.type === 'default_cards'
      );

      if (!defaultCards) {
        throw new Error('Default cards bulk data not found');
      }

      this.logger.info(`Downloading bulk data file (${defaultCards.size} bytes)...`);
      this.logger.info(`Download URL: ${defaultCards.download_uri}`);

      // Download the bulk data file
      const bulkResponse = await axios.get(defaultCards.download_uri, {
        timeout: 300000, // 5 minutes timeout
        headers: {
          'User-Agent': 'TCG-Data-Collector/1.0'
        }
      });

      const scryfallCards: ScryfallCard[] = bulkResponse.data;
      this.logger.success(`Downloaded ${scryfallCards.length} cards from Scryfall`);

      // Save raw data
      const rawPath = FileManager.getRawDataPath(this.gameId, 'scryfall-bulk.json');
      await FileManager.saveJSON(rawPath, scryfallCards);
      this.logger.info(`Raw data saved to ${rawPath}`);

      // Convert to our format
      const cards = scryfallCards
        .filter(card => card.image_uris || card.card_faces?.[0]?.image_uris)
        .map(card => this.convertCard(card));

      // Save converted cards
      const cardsPath = FileManager.getCardDataPath(this.gameId);
      await FileManager.saveJSON(cardsPath, cards);
      this.logger.success(`Saved ${cards.length} cards to ${cardsPath}`);

      return cards;
    } catch (error) {
      this.logger.error('Failed to download bulk data', error as Error);
      throw error;
    }
  }

  async downloadImages(
    cards: Card[],
    sizes: ('small' | 'normal' | 'large')[] = ['normal']
  ): Promise<void> {
    this.logger.info(`Downloading images for ${cards.length} cards...`);

    const progressBar = new cliProgress.SingleBar({
      format: 'MTG Images [{bar}] {percentage}% | {value}/{total} | ETA: {eta}s',
      barCompleteChar: '\u2588',
      barIncompleteChar: '\u2591',
    });

    progressBar.start(cards.length * sizes.length, 0);

    let downloaded = 0;
    let errors = 0;

    for (const size of sizes) {
      for (const card of cards) {
        try {
          let imageUrl = card.imageUrl;
          
          if (size === 'small' && card.imageUrlSmall) {
            imageUrl = card.imageUrlSmall;
          } else if (size === 'large' && card.imageUrlLarge) {
            imageUrl = card.imageUrlLarge;
          }

          if (!imageUrl) {
            progressBar.increment();
            continue;
          }

          const imagePath = FileManager.getCardImagePath(this.gameId, card.id, size);

          await this.rateLimiter.execute(async () => {
            const success = await FileManager.downloadImage(imageUrl, imagePath);
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
    }

    progressBar.stop();
    this.logger.success(`Downloaded ${downloaded} images, ${errors} errors`);
  }

  async download(downloadImages: boolean = true): Promise<void> {
    const startTime = Date.now();
    
    this.logger.info('Starting Magic: The Gathering download...');

    try {
      // Download bulk data
      const cards = await this.downloadBulkData();

      // Download images if requested
      if (downloadImages && cards.length > 0) {
        await this.downloadImages(cards, ['normal']);
      }

      const duration = (Date.now() - startTime) / 1000;
      this.logger.success(
        `MTG download complete! ${cards.length} cards in ${duration.toFixed(2)}s`
      );

      // Save stats
      await FileManager.saveJSON(
        FileManager.getRawDataPath(this.gameId, 'download-stats.json'),
        {
          game: 'Magic: The Gathering',
          totalCards: cards.length,
          timestamp: new Date().toISOString(),
          duration
        }
      );
    } catch (error) {
      this.logger.error('MTG download failed', error as Error);
      throw error;
    }
  }
}

// CLI execution
if (require.main === module) {
  const downloader = new MTGDownloader();
  downloader.download(true)
    .then(() => process.exit(0))
    .catch(error => {
      console.error('Download failed:', error);
      process.exit(1);
    });
}

