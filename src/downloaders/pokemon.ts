import axios from 'axios';
import { Card } from '../types';
import { FileManager } from '../utils/fileManager';
import { RateLimiter } from '../utils/rateLimiter';
import { Logger } from '../utils/logger';
import cliProgress from 'cli-progress';

interface PokemonTCGCard {
  id: string;
  name: string;
  set: {
    id: string;
    name: string;
    series: string;
    releaseDate: string;
  };
  rarity: string;
  supertype: string;
  subtypes?: string[];
  hp?: string;
  types?: string[];
  attacks?: Array<{
    name: string;
    cost: string[];
    damage: string;
    text: string;
  }>;
  abilities?: Array<{
    name: string;
    text: string;
    type: string;
  }>;
  rules?: string[];
  images: {
    small: string;
    large: string;
  };
  tcgplayer?: {
    prices?: {
      normal?: {
        market?: number;
      };
    };
  };
  artist?: string;
  number: string;
}

export class PokemonDownloader {
  private logger: Logger;
  private rateLimiter: RateLimiter;
  private gameId = 'pokemon-tcg';
  private apiKey?: string;
  private baseUrl = 'https://api.pokemontcg.io/v2';

  constructor(apiKey?: string) {
    this.logger = new Logger();
    this.apiKey = apiKey;
    // 1000 requests per hour with API key = ~16 per minute = ~0.27 per second
    // We'll use 15 per minute to be safe
    this.rateLimiter = new RateLimiter(0.25); // 15 requests per minute
  }

  private getHeaders() {
    return this.apiKey ? { 'X-Api-Key': this.apiKey } : {};
  }

  private convertCard(pokemonCard: PokemonTCGCard): Card {
    const attacks = pokemonCard.attacks?.map(a => a.name).join(', ') || '';
    const abilities = pokemonCard.abilities?.map(a => a.name).join(', ') || '';
    
    let description = '';
    if (abilities) description += `Abilities: ${abilities}. `;
    if (attacks) description += `Attacks: ${attacks}. `;
    if (pokemonCard.rules) description += pokemonCard.rules.join(' ');

    return {
      id: pokemonCard.id,
      name: pokemonCard.name,
      game: 'Pokémon TCG',
      set: pokemonCard.set.name,
      setCode: pokemonCard.set.id,
      rarity: pokemonCard.rarity,
      type: pokemonCard.supertype,
      subtype: pokemonCard.subtypes?.join(', '),
      description: description.trim(),
      imageUrl: pokemonCard.images.large,
      imageUrlSmall: pokemonCard.images.small,
      imageUrlLarge: pokemonCard.images.large,
      attributes: {
        hp: pokemonCard.hp,
        types: pokemonCard.types,
        attacks: pokemonCard.attacks,
        abilities: pokemonCard.abilities,
        series: pokemonCard.set.series
      },
      prices: {
        usd: pokemonCard.tcgplayer?.prices?.normal?.market?.toString()
      },
      releaseDate: pokemonCard.set.releaseDate,
      artist: pokemonCard.artist,
      cardNumber: pokemonCard.number
    };
  }

  async downloadAllCards(): Promise<Card[]> {
    this.logger.info('Fetching Pokémon TCG cards...');

    const allCards: Card[] = [];
    const pageSize = 250;
    let page = 1;
    let totalPages = 1;

    const progressBar = new cliProgress.SingleBar({
      format: 'Pokemon Cards [{bar}] {percentage}% | Page {value}/{total}',
      barCompleteChar: '\u2588',
      barIncompleteChar: '\u2591',
    });

    try {
      // Get first page to know total
      const firstResponse = await this.rateLimiter.execute(() =>
        axios.get(`${this.baseUrl}/cards`, {
          params: { page: 1, pageSize },
          headers: this.getHeaders()
        })
      );

      totalPages = Math.ceil(firstResponse.data.totalCount / pageSize);
      this.logger.info(`Total cards: ${firstResponse.data.totalCount}, Pages: ${totalPages}`);

      progressBar.start(totalPages, 0);

      // Process first page
      const firstPageCards = firstResponse.data.data.map((card: PokemonTCGCard) => 
        this.convertCard(card)
      );
      allCards.push(...firstPageCards);
      progressBar.increment();

      // Fetch remaining pages
      for (page = 2; page <= totalPages; page++) {
        const response = await this.rateLimiter.execute(() =>
          axios.get(`${this.baseUrl}/cards`, {
            params: { page, pageSize },
            headers: this.getHeaders()
          })
        );

        const cards = response.data.data.map((card: PokemonTCGCard) => 
          this.convertCard(card)
        );
        allCards.push(...cards);
        progressBar.increment();
      }

      progressBar.stop();
      this.logger.success(`Downloaded ${allCards.length} Pokémon cards`);

      // Save cards
      const cardsPath = FileManager.getCardDataPath(this.gameId);
      await FileManager.saveJSON(cardsPath, allCards);
      this.logger.info(`Saved cards to ${cardsPath}`);

      return allCards;
    } catch (error) {
      progressBar.stop();
      this.logger.error('Failed to download Pokémon cards', error as Error);
      throw error;
    }
  }

  async downloadImages(
    cards: Card[],
    sizes: ('small' | 'large')[] = ['large']
  ): Promise<void> {
    this.logger.info(`Downloading images for ${cards.length} cards...`);

    const progressBar = new cliProgress.SingleBar({
      format: 'Pokemon Images [{bar}] {percentage}% | {value}/{total} | ETA: {eta}s',
      barCompleteChar: '\u2588',
      barIncompleteChar: '\u2591',
    });

    progressBar.start(cards.length * sizes.length, 0);

    let downloaded = 0;
    let errors = 0;

    for (const size of sizes) {
      for (const card of cards) {
        try {
          const imageUrl = size === 'small' ? card.imageUrlSmall : card.imageUrlLarge;
          
          if (!imageUrl) {
            progressBar.increment();
            continue;
          }

          const imagePath = FileManager.getCardImagePath(
            this.gameId, 
            card.id, 
            size === 'small' ? 'small' : 'normal'
          );

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
    
    this.logger.info('Starting Pokémon TCG download...');

    try {
      // Download card data
      const cards = await this.downloadAllCards();

      // Download images if requested
      if (downloadImages && cards.length > 0) {
        await this.downloadImages(cards, ['large']);
      }

      const duration = (Date.now() - startTime) / 1000;
      this.logger.success(
        `Pokémon TCG download complete! ${cards.length} cards in ${duration.toFixed(2)}s`
      );

      // Save stats
      await FileManager.saveJSON(
        FileManager.getRawDataPath(this.gameId, 'download-stats.json'),
        {
          game: 'Pokémon TCG',
          totalCards: cards.length,
          timestamp: new Date().toISOString(),
          duration
        }
      );
    } catch (error) {
      this.logger.error('Pokémon TCG download failed', error as Error);
      throw error;
    }
  }
}

// CLI execution
if (require.main === module) {
  const apiKey = process.env.POKEMON_TCG_API_KEY;
  const downloader = new PokemonDownloader(apiKey);
  downloader.download(true)
    .then(() => process.exit(0))
    .catch(error => {
      console.error('Download failed:', error);
      process.exit(1);
    });
}

