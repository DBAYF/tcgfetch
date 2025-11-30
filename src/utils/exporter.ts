import * as fs from 'fs';
import * as path from 'path';
import { Card, GAMES } from '../types';
import { FileManager } from './fileManager';
import { Logger } from './logger';

interface DatabaseExport {
  version: string;
  exportDate: string;
  totalCards: number;
  games: Array<{
    id: string;
    name: string;
    cardCount: number;
  }>;
  cards: Card[];
}

interface SQLExport {
  games: string;
  cards: string;
  indexes: string;
}

export class DataExporter {
  private logger: Logger;

  constructor() {
    this.logger = new Logger();
  }

  async loadAllCards(): Promise<Card[]> {
    const allCards: Card[] = [];

    for (const gameId of Object.keys(GAMES)) {
      try {
        const cardsPath = FileManager.getCardDataPath(gameId);
        const cards = await FileManager.loadJSON<Card[]>(cardsPath);
        
        if (cards) {
          this.logger.info(`Loaded ${cards.length} cards from ${gameId}`);
          allCards.push(...cards);
        } else {
          this.logger.warn(`No cards found for ${gameId}`);
        }
      } catch (error) {
        this.logger.error(`Failed to load cards for ${gameId}`, error as Error);
      }
    }

    return allCards;
  }

  async exportToJSON(): Promise<string> {
    this.logger.info('Exporting all data to JSON...');

    const cards = await this.loadAllCards();

    const gameStats = Object.entries(GAMES).map(([id, game]) => ({
      id: game.id,
      name: game.name,
      cardCount: cards.filter(c => c.game === game.name).length
    }));

    const exportData: DatabaseExport = {
      version: '1.0.0',
      exportDate: new Date().toISOString(),
      totalCards: cards.length,
      games: gameStats,
      cards
    };

    const outputPath = path.join('tcg-data', 'export', 'all-cards.json');
    await FileManager.saveJSON(outputPath, exportData);

    this.logger.success(`Exported ${cards.length} cards to ${outputPath}`);
    return outputPath;
  }

  async exportToSQL(): Promise<string> {
    this.logger.info('Exporting all data to SQL...');

    const cards = await this.loadAllCards();

    let sql = '';

    // Create tables
    sql += `-- TCG Database Export
-- Generated: ${new Date().toISOString()}
-- Total Cards: ${cards.length}

-- Drop existing tables
DROP TABLE IF EXISTS cards;
DROP TABLE IF EXISTS games;

-- Create games table
CREATE TABLE games (
  id VARCHAR(50) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  publisher VARCHAR(100),
  release_year INT,
  total_cards INT,
  has_api BOOLEAN,
  api_url VARCHAR(255),
  last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create cards table
CREATE TABLE cards (
  id VARCHAR(100) PRIMARY KEY,
  game_id VARCHAR(50),
  name VARCHAR(200) NOT NULL,
  set_name VARCHAR(100),
  set_code VARCHAR(50),
  card_number VARCHAR(50),
  rarity VARCHAR(50),
  type VARCHAR(100),
  subtype VARCHAR(100),
  description TEXT,
  artist VARCHAR(100),
  release_date DATE,
  image_url TEXT,
  image_url_small TEXT,
  image_url_large TEXT,
  price_usd DECIMAL(10,2),
  price_eur DECIMAL(10,2),
  attributes JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (game_id) REFERENCES games(id)
);

-- Insert games
`;

    for (const [id, game] of Object.entries(GAMES)) {
      const cardCount = cards.filter(c => c.game === game.name).length;
      sql += `INSERT INTO games (id, name, publisher, release_year, total_cards, has_api, api_url) VALUES 
  ('${game.id}', '${game.name.replace(/'/g, "''")}', '${game.publisher}', ${game.releaseYear}, ${cardCount}, ${game.hasApi}, ${game.apiUrl ? `'${game.apiUrl}'` : 'NULL'});\n`;
    }

    sql += '\n-- Insert cards\n';

    // Insert cards in batches
    const batchSize = 100;
    for (let i = 0; i < cards.length; i += batchSize) {
      const batch = cards.slice(i, i + batchSize);
      
      for (const card of batch) {
        const escape = (str: string | undefined) => 
          str ? `'${str.replace(/'/g, "''").replace(/\\/g, '\\\\')}'` : 'NULL';
        
        const releaseDate = card.releaseDate ? `'${card.releaseDate}'` : 'NULL';
        const priceUsd = card.prices?.usd ? parseFloat(card.prices.usd) : 'NULL';
        const priceEur = card.prices?.eur ? parseFloat(card.prices.eur) : 'NULL';
        const attributes = escape(JSON.stringify(card.attributes));

        sql += `INSERT INTO cards (id, game_id, name, set_name, set_code, card_number, rarity, type, subtype, description, artist, release_date, image_url, image_url_small, image_url_large, price_usd, price_eur, attributes) VALUES 
  (${escape(card.id)}, ${escape(GAMES[card.game.toLowerCase().replace(/[^a-z]/g, '-')]?.id)}, ${escape(card.name)}, ${escape(card.set)}, ${escape(card.setCode)}, ${escape(card.cardNumber)}, ${escape(card.rarity)}, ${escape(card.type)}, ${escape(card.subtype)}, ${escape(card.description.substring(0, 500))}, ${escape(card.artist)}, ${releaseDate}, ${escape(card.imageUrl)}, ${escape(card.imageUrlSmall)}, ${escape(card.imageUrlLarge)}, ${priceUsd}, ${priceEur}, ${attributes});\n`;
      }
    }

    // Add indexes
    sql += `
-- Create indexes for better query performance
CREATE INDEX idx_cards_game ON cards(game_id);
CREATE INDEX idx_cards_name ON cards(name);
CREATE INDEX idx_cards_set ON cards(set_name);
CREATE INDEX idx_cards_rarity ON cards(rarity);
CREATE INDEX idx_cards_type ON cards(type);
CREATE INDEX idx_cards_release_date ON cards(release_date);

-- Analysis
SELECT 
  g.name AS game,
  COUNT(c.id) AS card_count,
  AVG(c.price_usd) AS avg_price_usd
FROM games g
LEFT JOIN cards c ON g.id = c.game_id
GROUP BY g.id, g.name
ORDER BY card_count DESC;
`;

    const outputPath = path.join('tcg-data', 'export', 'database.sql');
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    fs.writeFileSync(outputPath, sql, 'utf-8');

    this.logger.success(`Exported ${cards.length} cards to ${outputPath}`);
    return outputPath;
  }

  async exportByGame(): Promise<void> {
    this.logger.info('Exporting data by game...');

    for (const [id, game] of Object.entries(GAMES)) {
      try {
        const cardsPath = FileManager.getCardDataPath(id);
        const cards = await FileManager.loadJSON<Card[]>(cardsPath);
        
        if (!cards || cards.length === 0) {
          this.logger.warn(`No cards found for ${game.name}`);
          continue;
        }

        const exportData = {
          game: game.name,
          gameId: id,
          totalCards: cards.length,
          exportDate: new Date().toISOString(),
          cards
        };

        const outputPath = path.join('tcg-data', 'export', 'by-game', `${id}.json`);
        await FileManager.saveJSON(outputPath, exportData);

        this.logger.info(`Exported ${cards.length} ${game.name} cards to ${outputPath}`);
      } catch (error) {
        this.logger.error(`Failed to export ${game.name}`, error as Error);
      }
    }
  }

  async exportSummary(): Promise<void> {
    this.logger.info('Generating export summary...');

    const cards = await this.loadAllCards();
    const summary: any = {
      totalCards: cards.length,
      exportDate: new Date().toISOString(),
      games: {}
    };

    for (const [id, game] of Object.entries(GAMES)) {
      const gameCards = cards.filter(c => c.game === game.name);
      summary.games[id] = {
        name: game.name,
        totalCards: gameCards.length,
        hasApi: game.hasApi,
        sets: [...new Set(gameCards.map(c => c.set))].length,
        rarities: [...new Set(gameCards.map(c => c.rarity))],
        types: [...new Set(gameCards.map(c => c.type))]
      };
    }

    const outputPath = path.join('tcg-data', 'export', 'summary.json');
    await FileManager.saveJSON(outputPath, summary);

    this.logger.success(`Export summary saved to ${outputPath}`);
  }

  async exportAll(): Promise<void> {
    this.logger.info('Starting full export...');

    await this.exportToJSON();
    await this.exportToSQL();
    await this.exportByGame();
    await this.exportSummary();

    this.logger.success('All exports complete!');
  }
}

// CLI execution
if (require.main === module) {
  const exporter = new DataExporter();
  exporter.exportAll()
    .then(() => process.exit(0))
    .catch(error => {
      console.error('Export failed:', error);
      process.exit(1);
    });
}

