export interface Card {
  id: string;
  name: string;
  game: string;
  set: string;
  setCode?: string;
  rarity: string;
  type: string;
  subtype?: string;
  description: string;
  imageUrl: string;
  imageUrlSmall?: string;
  imageUrlLarge?: string;
  attributes: Record<string, any>;
  prices?: {
    usd?: string;
    eur?: string;
    jpy?: string;
  };
  releaseDate?: string;
  artist?: string;
  cardNumber?: string;
}

export interface DownloadStats {
  game: string;
  totalCards: number;
  cardsDownloaded: number;
  imagesDownloaded: number;
  errors: number;
  startTime: Date;
  endTime?: Date;
  duration?: number;
}

export interface DownloaderConfig {
  game: string;
  apiUrl?: string;
  rateLimit: number; // requests per second
  imageSizes: ('small' | 'normal' | 'large')[];
  outputDir: string;
  batchSize?: number;
}

export interface GameMetadata {
  id: string;
  name: string;
  publisher: string;
  releaseYear: number;
  totalCards?: number;
  hasApi: boolean;
  apiUrl?: string;
  lastUpdated?: Date;
}

export const GAMES: Record<string, GameMetadata> = {
  'magic-the-gathering': {
    id: 'magic-the-gathering',
    name: 'Magic: The Gathering',
    publisher: 'Wizards of the Coast',
    releaseYear: 1993,
    hasApi: true,
    apiUrl: 'https://api.scryfall.com'
  },
  'pokemon-tcg': {
    id: 'pokemon-tcg',
    name: 'Pokémon Trading Card Game',
    publisher: 'The Pokémon Company',
    releaseYear: 1996,
    hasApi: true,
    apiUrl: 'https://api.pokemontcg.io/v2'
  },
  'yugioh-tcg': {
    id: 'yugioh-tcg',
    name: 'Yu-Gi-Oh! Trading Card Game',
    publisher: 'Konami',
    releaseYear: 1999,
    hasApi: true,
    apiUrl: 'https://db.ygoprodeck.com/api/v7'
  },
  'one-piece-card-game': {
    id: 'one-piece-card-game',
    name: 'One Piece Card Game',
    publisher: 'Bandai',
    releaseYear: 2022,
    hasApi: false
  },
  'gundam-card-game': {
    id: 'gundam-card-game',
    name: 'Gundam Card Game',
    publisher: 'Bandai',
    releaseYear: 2024,
    hasApi: false
  },
  'disney-lorcana': {
    id: 'disney-lorcana',
    name: 'Disney Lorcana',
    publisher: 'Ravensburger',
    releaseYear: 2023,
    hasApi: false
  },
  'digimon-card-game': {
    id: 'digimon-card-game',
    name: 'Digimon Card Game',
    publisher: 'Bandai',
    releaseYear: 2020,
    hasApi: false
  },
  'star-wars-unlimited': {
    id: 'star-wars-unlimited',
    name: 'Star Wars: Unlimited',
    publisher: 'Fantasy Flight Games',
    releaseYear: 2024,
    hasApi: false
  },
  'flesh-and-blood': {
    id: 'flesh-and-blood',
    name: 'Flesh and Blood',
    publisher: 'Legend Story Studios',
    releaseYear: 2019,
    hasApi: true,
    apiUrl: 'https://api.fabdb.net'
  },
  'dragon-ball-super': {
    id: 'dragon-ball-super',
    name: 'Dragon Ball Super Card Game',
    publisher: 'Bandai',
    releaseYear: 2017,
    hasApi: false
  }
};

