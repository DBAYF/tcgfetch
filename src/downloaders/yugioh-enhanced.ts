import axios from 'axios';
import { Card } from '../types';
import { EnhancedFileManager } from '../utils/enhancedFileManager';
import { EnhancedRateLimiter } from '../utils/enhancedRateLimiter';
import { DownloadDatabase } from '../utils/database';
import { DownloadMonitor, ProgressReporter } from '../utils/monitor';
import { Logger } from '../utils/logger';

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
  }>;
}

/**
 * Production-grade Yu-Gi-Oh! downloader with:
 * - Incremental updates (only new/changed cards)
 * - Automatic resume on failure
 * - Parallel image downloads with concurrency control
 * - Image validation and integrity checks
 * - Deduplication
 * - Performance monitoring
 * - Health checks
 */
export class YuGiOhEnhancedDownloader {
  private logger: Logger;
  private rateLimiter: EnhancedRateLimiter;
  private db: DownloadDatabase;
  private fileManager: EnhancedFileManager;
  private monitor: DownloadMonitor;
  private reporter: ProgressReporter;
  private gameId = 'yugioh-tcg';
  private apiUrl = 'https://db.ygoprodeck.com/api/v7/cardinfo.php';

  constructor() {
    this.logger = new Logger();
    this.db = new DownloadDatabase();
    this.fileManager = new EnhancedFileManager(this.db);
    this.monitor = new DownloadMonitor(this.db);
    this.reporter = new ProgressReporter(2000); // Update every 2 seconds
    
    this.rateLimiter = new EnhancedRateLimiter(20, {
      adaptiveEnabled: true,
      failureThreshold: 10,
      successThreshold: 3,
      targetResponseTime: 2000
    });
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

  /**
   * Download all cards with incremental update support
   */
  async downloadAllCards(): Promise<Card[]> {
    this.logger.info('Fetching Yu-Gi-Oh! cards from YGOPRODECK...');
    this.monitor.checkpoint('api_start');

    try {
      // Check cache first
      const cacheKey = 'yugioh_all_cards';
      let yugiohCards: YuGiOhCard[];
      
      const cachedResponse = this.db.getCachedResponse(cacheKey);
      
      if (cachedResponse) {
        this.logger.info('Using cached API response');
        this.monitor.recordCache(true);
        yugiohCards = JSON.parse(cachedResponse);
      } else {
        this.logger.info('Downloading fresh data from API...');
        this.monitor.recordCache(false);
        
        const response = await this.rateLimiter.execute(() =>
          axios.get(this.apiUrl, {
            timeout: 120000,
            headers: {
              'User-Agent': 'TCGFetch/2.0 Professional'
            }
          })
        );

        yugiohCards = response.data.data;
        
        // Cache for 1 hour
        this.db.cacheResponse(
          cacheKey,
          this.gameId,
          JSON.stringify(yugiohCards),
          3600
        );
      }

      this.monitor.checkpoint('api_complete');
      const apiTime = this.monitor.timeSinceCheckpoint('api_start');
      this.logger.success(`Downloaded ${yugiohCards.length} Yu-Gi-Oh! cards in ${(apiTime / 1000).toFixed(2)}s`);
      this.monitor.recordMetric('api_response_time', apiTime);

      // Save raw data
      const rawPath = this.fileManager.getRawDataPath(this.gameId, 'ygoprodeck-all.json');
      await this.fileManager.saveJSON(rawPath, yugiohCards);

      // Convert and process cards (incremental - only new/changed)
      this.monitor.checkpoint('processing_start');
      const cards: Card[] = [];
      let newCards = 0;
      let updatedCards = 0;
      let skippedCards = 0;

      for (const yugiohCard of yugiohCards) {
        const card = this.convertCard(yugiohCard);
        cards.push(card);

        // Save to database (with deduplication)
        const result = await this.fileManager.saveCard(card, this.gameId);
        
        if (result.saved) {
          if (result.updated) {
            updatedCards++;
            this.logger.info(`Updated: ${card.name}`);
          } else {
            newCards++;
          }
          this.monitor.recordCard(true);
        } else {
          skippedCards++;
          this.monitor.recordCard(false);
        }

        this.reporter.update(this.monitor);
      }

      this.monitor.checkpoint('processing_complete');
      const processingTime = this.monitor.timeSinceCheckpoint('processing_start');

      this.logger.success(
        `Processed ${cards.length} cards: ${newCards} new, ${updatedCards} updated, ${skippedCards} unchanged`
      );
      this.logger.info(`Processing time: ${(processingTime / 1000).toFixed(2)}s`);

      // Save all cards to JSON
      const cardsPath = this.fileManager.getCardDataPath(this.gameId);
      await this.fileManager.saveJSON(cardsPath, cards);

      return cards;
    } catch (error) {
      this.monitor.recordError('api_error', (error as Error).message, { api: this.apiUrl });
      this.logger.error('Failed to download Yu-Gi-Oh! cards', error as Error);
      throw error;
    }
  }

  /**
   * Download images with parallel processing and validation
   */
  async downloadImages(
    cards: Card[],
    sizes: ('small' | 'normal')[] = ['normal'],
    concurrency: number = 20
  ): Promise<void> {
    this.logger.info(`Downloading images for ${cards.length} cards (concurrency: ${concurrency})...`);
    this.monitor.checkpoint('images_start');

    let totalDownloaded = 0;
    let totalSkipped = 0;
    let totalFailed = 0;

    for (const size of sizes) {
      this.logger.info(`Downloading ${size} images...`);
      
      // Prepare download tasks
      const tasks = cards.map(card => ({
        url: size === 'small' ? (card.imageUrlSmall || card.imageUrl) : card.imageUrl,
        cardId: card.id,
        gameId: this.gameId,
        size
      })).filter(task => task.url);

      // Download in batches with proper concurrency
      const batchSize = concurrency * 10;
      for (let i = 0; i < tasks.length; i += batchSize) {
        const batch = tasks.slice(i, i + batchSize);
        
        const stats = await this.fileManager.downloadImagesBatch(batch, concurrency);
        
        totalDownloaded += stats.successful;
        totalSkipped += stats.skipped;
        totalFailed += stats.failed;

        // Update metrics
        for (let j = 0; j < stats.successful; j++) {
          this.monitor.recordImage(100000); // Estimate 100KB per image
        }

        this.logger.info(
          `Batch ${Math.floor(i / batchSize) + 1}: ` +
          `${stats.successful} downloaded, ${stats.skipped} skipped, ${stats.failed} failed`
        );

        this.reporter.update(this.monitor);

        // Save progress snapshot
        await this.monitor.saveProgressSnapshot(this.gameId, {
          totalCards: cards.length,
          imagesDownloaded: totalDownloaded + totalSkipped,
          currentBatch: i + batchSize
        });
      }
    }

    this.monitor.checkpoint('images_complete');
    const imageTime = this.monitor.timeSinceCheckpoint('images_start');

    this.logger.success(
      `Images complete: ${totalDownloaded} downloaded, ${totalSkipped} skipped, ${totalFailed} failed in ${(imageTime / 1000).toFixed(2)}s`
    );
    this.monitor.recordMetric('image_download_time', imageTime);
  }

  /**
   * Verify data integrity
   */
  async verify(): Promise<void> {
    this.logger.info('Verifying data integrity...');
    
    const imageStats = await this.fileManager.verifyGameImages(this.gameId);
    
    this.logger.info(`Image verification: ${imageStats.valid}/${imageStats.total} valid`);
    
    if (imageStats.invalid > 0) {
      this.logger.warn(`Found ${imageStats.invalid} invalid images`);
    }
    
    if (imageStats.missing > 0) {
      this.logger.warn(`Found ${imageStats.missing} missing images`);
    }
  }

  /**
   * Main download with full production features
   */
  async download(downloadImages: boolean = true, concurrency: number = 20): Promise<void> {
    const startTime = Date.now();
    const sessionId = this.monitor.startSession(this.gameId, {
      downloadImages,
      concurrency,
      version: '2.0'
    });

    this.logger.info('═'.repeat(70));
    this.logger.info('Yu-Gi-Oh! PRODUCTION DOWNLOADER v2.0');
    this.logger.info('═'.repeat(70));
    this.logger.info(`Session ID: ${sessionId}`);
    this.logger.info(`Download Images: ${downloadImages}`);
    this.logger.info(`Concurrency: ${concurrency}`);
    this.logger.info('═'.repeat(70));

    try {
      // Check for previous incomplete session
      const snapshot = await this.monitor.loadProgressSnapshot(this.gameId);
      if (snapshot) {
        this.logger.info(`Found previous session snapshot (${new Date(snapshot.timestamp).toLocaleString()})`);
        this.logger.info('Resuming from checkpoint...');
      }

      // Download card data
      const cards = await this.downloadAllCards();

      // Download images if requested
      if (downloadImages && cards.length > 0) {
        await this.downloadImages(cards, ['normal'], concurrency);
      }

      // Verify integrity
      if (downloadImages) {
        await this.verify();
      }

      // Complete session
      const duration = (Date.now() - startTime) / 1000;
      this.monitor.completeSession('completed');

      // Final report
      this.reporter.final(this.monitor);

      this.logger.success('═'.repeat(70));
      this.logger.success(`Yu-Gi-Oh! download COMPLETE!`);
      this.logger.success(`${cards.length} cards in ${duration.toFixed(2)}s`);
      this.logger.success('═'.repeat(70));

      // Save stats
      const stats = this.monitor.getStats();
      await this.fileManager.saveJSON(
        this.fileManager.getRawDataPath(this.gameId, 'download-stats.json'),
        {
          ...stats,
          game: 'Yu-Gi-Oh!',
          totalCards: cards.length,
          timestamp: new Date().toISOString(),
          duration,
          rateLimiterMetrics: this.rateLimiter.getMetrics()
        }
      );

      // Disk usage
      const diskUsage = this.fileManager.getDiskUsage(this.gameId);
      this.logger.info(`Disk usage: ${diskUsage.formatted} (${diskUsage.files} files)`);

    } catch (error) {
      this.monitor.recordError('fatal_error', (error as Error).message);
      this.monitor.completeSession('failed');
      this.logger.error('Yu-Gi-Oh! download FAILED', error as Error);
      throw error;
    } finally {
      // Cleanup
      this.fileManager.cleanupTemp();
      
      // Show health report
      const health = this.monitor.getHealthReport();
      if (!health.healthy) {
        this.logger.warn('Health check failed:');
        health.issues.forEach(issue => this.logger.warn(`  • ${issue}`));
      }
      
      // Close database
      this.db.close();
    }
  }
}

// CLI execution
if (require.main === module) {
  const downloader = new YuGiOhEnhancedDownloader();
  const concurrency = parseInt(process.env.CONCURRENCY || '20');
  
  downloader.download(true, concurrency)
    .then(() => process.exit(0))
    .catch(error => {
      console.error('Download failed:', error);
      process.exit(1);
    });
}

