import * as fs from 'fs';
import * as path from 'path';
import { Card, GAMES } from '../types';
import { FileManager } from './fileManager';
import { Logger } from './logger';

export class DataValidator {
  private logger: Logger;

  constructor() {
    this.logger = new Logger();
  }

  async validateGame(gameId: string): Promise<{
    valid: boolean;
    totalCards: number;
    validCards: number;
    missingImages: string[];
    invalidCards: string[];
    errors: string[];
  }> {
    const result = {
      valid: true,
      totalCards: 0,
      validCards: 0,
      missingImages: [] as string[],
      invalidCards: [] as string[],
      errors: [] as string[]
    };

    this.logger.info(`Validating data for ${gameId}...`);

    // Load card data
    const cardsPath = FileManager.getCardDataPath(gameId);
    const cards = await FileManager.loadJSON<Card[]>(cardsPath);

    if (!cards) {
      result.errors.push(`No card data found at ${cardsPath}`);
      result.valid = false;
      return result;
    }

    result.totalCards = cards.length;

    // Validate each card
    for (const card of cards) {
      let cardValid = true;

      // Check required fields
      if (!card.id || !card.name || !card.game) {
        result.invalidCards.push(card.id || 'unknown');
        cardValid = false;
      }

      // Check if image exists
      if (card.imageUrl) {
        const imagePath = FileManager.getCardImagePath(gameId, card.id);
        if (!fs.existsSync(imagePath)) {
          result.missingImages.push(card.id);
          cardValid = false;
        }
      }

      if (cardValid) {
        result.validCards++;
      }
    }

    result.valid = result.validCards === result.totalCards;

    this.logger.info(`Validation complete: ${result.validCards}/${result.totalCards} valid cards`);
    if (result.missingImages.length > 0) {
      this.logger.warn(`Missing ${result.missingImages.length} images`);
    }

    return result;
  }

  async validateAllGames(): Promise<Record<string, any>> {
    const results: Record<string, any> = {};

    for (const gameId of Object.keys(GAMES)) {
      const result = await this.validateGame(gameId);
      results[gameId] = result;
    }

    // Save validation report
    const reportPath = path.join('tcg-data', 'validation-report.json');
    await FileManager.saveJSON(reportPath, {
      timestamp: new Date().toISOString(),
      results
    });

    this.logger.success(`Validation report saved to ${reportPath}`);
    return results;
  }
}

// CLI execution
if (require.main === module) {
  const validator = new DataValidator();
  validator.validateAllGames()
    .then(() => process.exit(0))
    .catch(error => {
      console.error('Validation failed:', error);
      process.exit(1);
    });
}

