import axios from 'axios';
import { Card } from '../types';
import { FileManager } from '../utils/fileManager';
import { RateLimiter } from '../utils/rateLimiter';
import { Logger } from '../utils/logger';
import cliProgress from 'cli-progress';

interface YuGiOhCard {
  id: number;
  name: string;
  type: string;
  desc: string;
  atk?: number;
  def?: number;
  level?: number;
  race: string;
  attribute?: string;
  archetype?: string;
  card_sets?: Array<{
    set_name: string;
    set_code: string;
    set_rarity: string;
    set_rarity_code: string;
    set_price: string;
  }>;
  card_images: Array<{
    id: number;
    image_url: string;
    image_url_small: string;
    image_url_cropped: string;
  }>;
  card_prices?: Array<{
    cardmarket_price?: string;
    tcgplayer_price?: string;
    ebay_price?: string;
  }>;
}

export class YuGiOhDownloader {
  private logger: Logger;
  private rateLimiter: RateLimiter;
  private gameId = 'yugioh-tcg';
  private apiUrl = 'https://db.ygoprodeck.com/api/v7/cardinfo.php';

  constructor() {
    this.logger = new Logger();
    this.rateLimiter = new RateLimiter(20); // 20 requests per second
  }

  private convertCard(yugiohCard: YuGiOhCard): Card {
    const primarySet = yugiohCard.card_sets?.[0];
    const primaryImage = yugiohCard.card_images[0];
    const prices = yugiohCard.card_prices?.[0];

    let type = yugiohCard.type;
    if (yugiohCard.race) {
      type += ` / ${yugiohCard.race}`;
    }

    return {
      id: yugiohCard.id.toString(),
      name: yugiohCard.name,
      game: 'Yu-Gi-Oh!',
      set: primarySet?.set_name || 'Unknown',
      setCode: primarySet?.set_code,
      rarity: primarySet?.set_rarity || 'Unknown',
      type: type,
      subtype: yugiohCard.race,
      description: yugiohCard.desc,
      imageUrl: primaryImage.image_url,
      imageUrlSmall: primaryImage.image_url_small,
      imageUrlLarge: primaryImage.image_url,
      attributes: {
        atk: yugiohCard.atk,
        def: yugiohCard.def,
        level: yugiohCard.level,
        attribute: yugiohCard.attribute,
        archetype: yugiohCard.archetype,
        allSets: yugiohCard.card_sets
      },
      prices: {
        usd: prices?.tcgplayer_price,
        eur: prices?.cardmarket_price
      },
      cardNumber: primarySet?.set_code
    };
  }

  async downloadAllCards(): Promise<Card[]> {
    this.logger.info('Fetching Yu-Gi-Oh! cards from YGOPRODECK...');

    try {
      // Single API call gets ALL cards!
      this.logger.info('Downloading all Yu-Gi-Oh! cards in one request...');
      
      const response = await axios.get(this.apiUrl, {
        timeout: 120000, // 2 minutes timeout
        headers: {
          'User-Agent': 'TCG-Data-Collector/1.0'
        }
      });

      const yugiohCards: YuGiOhCard[] = response.data.data;
      this.logger.success(`Downloaded ${yugiohCards.length} Yu-Gi-Oh! cards`);

      // Save raw data
      const rawPath = FileManager.getRawDataPath(this.gameId, 'ygoprodeck-all.json');
      await FileManager.saveJSON(rawPath, yugiohCards);
      this.logger.info(`Raw data saved to ${rawPath}`);

      // Convert to our format
      const cards = yugiohCards.map(card => this.convertCard(card));

      // Save converted cards
      const cardsPath = FileManager.getCardDataPath(this.gameId);
      await FileManager.saveJSON(cardsPath, cards);
      this.logger.success(`Saved ${cards.length} cards to ${cardsPath}`);

      return cards;
    } catch (error) {
      this.logger.error('Failed to download Yu-Gi-Oh! cards', error as Error);
      throw error;
    }
  }

  async downloadImages(
    cards: Card[],
    sizes: ('small' | 'normal')[] = ['normal']
  ): Promise<void> {
    this.logger.info(`Downloading images for ${cards.length} cards...`);

    const progressBar = new cliProgress.SingleBar({
      format: 'Yu-Gi-Oh Images [{bar}] {percentage}% | {value}/{total} | ETA: {eta}s',
      barCompleteChar: '\u2588',
      barIncompleteChar: '\u2591',
    });

    progressBar.start(cards.length * sizes.length, 0);

    let downloaded = 0;
    let errors = 0;

    for (const size of sizes) {
      for (const card of cards) {
        try {
          const imageUrl = size === 'small' ? card.imageUrlSmall : card.imageUrl;
          
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
    
    this.logger.info('Starting Yu-Gi-Oh! download...');

    try {
      // Download all card data in one request
      const cards = await this.downloadAllCards();

      // Download images if requested
      if (downloadImages && cards.length > 0) {
        await this.downloadImages(cards, ['normal']);
      }

      const duration = (Date.now() - startTime) / 1000;
      this.logger.success(
        `Yu-Gi-Oh! download complete! ${cards.length} cards in ${duration.toFixed(2)}s`
      );

      // Save stats
      await FileManager.saveJSON(
        FileManager.getRawDataPath(this.gameId, 'download-stats.json'),
        {
          game: 'Yu-Gi-Oh!',
          totalCards: cards.length,
          timestamp: new Date().toISOString(),
          duration
        }
      );
    } catch (error) {
      this.logger.error('Yu-Gi-Oh! download failed', error as Error);
      throw error;
    }
  }
}

// CLI execution
if (require.main === module) {
  const downloader = new YuGiOhDownloader();
  downloader.download(true)
    .then(() => process.exit(0))
    .catch(error => {
      console.error('Download failed:', error);
      process.exit(1);
    });
}

