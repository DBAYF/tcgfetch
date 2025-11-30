#!/usr/bin/env node

import { MTGDownloader } from './downloaders/mtg';
import { PokemonDownloader } from './downloaders/pokemon';
import { YuGiOhDownloader } from './downloaders/yugioh';
import { FABDownloader } from './downloaders/fab';
import { DataExporter } from './utils/exporter';
import { DataValidator } from './utils/validator';
import { Logger } from './utils/logger';

const logger = new Logger();

interface DownloadOptions {
  games?: string[];
  apiOnly?: boolean;
  skipImages?: boolean;
  validate?: boolean;
  export?: boolean;
}

async function downloadAPIs(options: DownloadOptions = {}) {
  const { skipImages = false } = options;

  logger.info('='.repeat(60));
  logger.info('Starting API-Based Game Downloads (Phase 1)');
  logger.info('='.repeat(60));

  const results: Record<string, { success: boolean; error?: string }> = {};

  // 1. Yu-Gi-Oh! (Fastest - single API call)
  if (!options.games || options.games.includes('yugioh')) {
    logger.info('\n[1/4] Downloading Yu-Gi-Oh! Trading Card Game...');
    try {
      const yugioh = new YuGiOhDownloader();
      await yugioh.download(!skipImages);
      results['yugioh'] = { success: true };
    } catch (error) {
      logger.error('Yu-Gi-Oh! download failed', error as Error);
      results['yugioh'] = { success: false, error: (error as Error).message };
    }
  }

  // 2. Magic: The Gathering (Bulk download)
  if (!options.games || options.games.includes('mtg')) {
    logger.info('\n[2/4] Downloading Magic: The Gathering...');
    try {
      const mtg = new MTGDownloader();
      await mtg.download(!skipImages);
      results['mtg'] = { success: true };
    } catch (error) {
      logger.error('MTG download failed', error as Error);
      results['mtg'] = { success: false, error: (error as Error).message };
    }
  }

  // 3. Pokémon TCG
  if (!options.games || options.games.includes('pokemon')) {
    logger.info('\n[3/4] Downloading Pokémon Trading Card Game...');
    try {
      const pokemon = new PokemonDownloader(process.env.POKEMON_TCG_API_KEY);
      await pokemon.download(!skipImages);
      results['pokemon'] = { success: true };
    } catch (error) {
      logger.error('Pokémon TCG download failed', error as Error);
      results['pokemon'] = { success: false, error: (error as Error).message };
    }
  }

  // 4. Flesh and Blood
  if (!options.games || options.games.includes('fab')) {
    logger.info('\n[4/4] Downloading Flesh and Blood...');
    try {
      const fab = new FABDownloader();
      await fab.download(!skipImages);
      results['fab'] = { success: true };
    } catch (error) {
      logger.error('Flesh and Blood download failed', error as Error);
      results['fab'] = { success: false, error: (error as Error).message };
    }
  }

  return results;
}

async function downloadScrapers() {
  logger.info('\n' + '='.repeat(60));
  logger.info('Phase 2: Web Scraping (Manual Intervention Required)');
  logger.info('='.repeat(60));

  logger.warn(`
The following games do not have public APIs and require web scraping:

  • One Piece Card Game
  • Gundam Card Game
  • Disney Lorcana
  • Digimon Card Game
  • Star Wars: Unlimited
  • Dragon Ball Super Card Game

Web scrapers for these games can be developed, but may require:
  1. Puppeteer/Playwright for JavaScript rendering
  2. Manual CAPTCHA solving
  3. Compliance with website terms of service
  4. Potential rate limiting or IP blocking

Recommendations:
  - Check if community-maintained JSON dumps exist
  - Contact publishers for official data access
  - Use manual data collection for smaller sets
  - Develop custom scrapers with appropriate delays

For now, Phase 1 (API-based games) provides ~55,000+ cards.
  `);

  return {};
}

async function main() {
  const args = process.argv.slice(2);
  
  const options: DownloadOptions = {
    apiOnly: args.includes('--api-only'),
    skipImages: args.includes('--skip-images'),
    validate: args.includes('--validate'),
    export: args.includes('--export')
  };

  // Parse specific games
  const gamesArg = args.find(arg => arg.startsWith('--games='));
  if (gamesArg) {
    options.games = gamesArg.split('=')[1].split(',');
  }

  const startTime = Date.now();

  try {
    logger.info(`
╔════════════════════════════════════════════════════════════╗
║          TCG Data Collector - Master Script                ║
║          Collecting data for top 10 trading card games     ║
╚════════════════════════════════════════════════════════════╝
    `);

    // Phase 1: API-based downloads
    const apiResults = await downloadAPIs(options);

    // Phase 2: Web scraping notice
    if (!options.apiOnly) {
      await downloadScrapers();
    }

    // Validation
    if (options.validate) {
      logger.info('\n' + '='.repeat(60));
      logger.info('Running Data Validation...');
      logger.info('='.repeat(60));
      const validator = new DataValidator();
      await validator.validateAllGames();
    }

    // Export
    if (options.export) {
      logger.info('\n' + '='.repeat(60));
      logger.info('Exporting Data...');
      logger.info('='.repeat(60));
      const exporter = new DataExporter();
      await exporter.exportAll();
    }

    // Summary
    const duration = (Date.now() - startTime) / 1000;
    const successful = Object.values(apiResults).filter(r => r.success).length;
    const failed = Object.values(apiResults).filter(r => !r.success).length;

    logger.info('\n' + '='.repeat(60));
    logger.success('DOWNLOAD COMPLETE!');
    logger.info('='.repeat(60));
    logger.info(`
Summary:
  ✓ Successful: ${successful} games
  ✗ Failed: ${failed} games
  ⏱  Total Time: ${duration.toFixed(2)}s (${(duration / 60).toFixed(2)} minutes)

Next Steps:
  1. Run validation: npm run validate
  2. Export data: npm run export
  3. Check logs folder for detailed logs
  4. Review tcg-data folder for all downloaded data

For web scraping games, refer to TCG_DATA_COLLECTION_PLAN.md
    `);

  } catch (error) {
    logger.error('Fatal error in main process', error as Error);
    process.exit(1);
  }
}

// CLI execution
if (require.main === module) {
  main()
    .then(() => {
      logger.info('Process completed successfully');
      logger.close();
      process.exit(0);
    })
    .catch(error => {
      logger.error('Process failed', error);
      logger.close();
      process.exit(1);
    });
}

export { downloadAPIs, downloadScrapers, main };

