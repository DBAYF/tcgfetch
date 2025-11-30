# TCG Data Collector

A comprehensive data collection tool for the top 10 most popular trading card games. This project systematically downloads card data and high-quality images from public APIs and prepares them for database integration.

## 🎮 Supported Games

### Phase 1: API-Based (Ready to Use)
1. **Magic: The Gathering** (~27,000 cards) - Scryfall API
2. **Pokémon TCG** (~15,000 cards) - Pokémon TCG API
3. **Yu-Gi-Oh!** (~12,000 cards) - YGOPRODECK API
4. **Flesh and Blood** (~1,500 cards) - FABDB API

**Total Phase 1: ~55,000+ cards**

### Phase 2: Web Scraping Required
5. One Piece Card Game (~500+ cards)
6. Gundam Card Game (~400+ cards)
7. Disney Lorcana (~600+ cards)
8. Digimon Card Game (~1,200+ cards)
9. Star Wars: Unlimited (~500+ cards)
10. Dragon Ball Super (~1,800+ cards)

## 📋 Features

- ✅ Automated data collection from public APIs
- ✅ High-quality image downloads with multiple sizes
- ✅ Rate limiting and retry logic
- ✅ Progress tracking and resume capability
- ✅ Data validation and quality checks
- ✅ Export to JSON and SQL formats
- ✅ Comprehensive logging
- ✅ Database-ready output

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ or later
- npm or yarn
- ~50-100GB free disk space (for images)

### Installation

```bash
# Clone or navigate to project directory
cd tcgh

# Install dependencies
npm install

# Copy environment template (optional)
cp .env.example .env

# Build TypeScript
npm run build
```

### Usage

#### Download All API-Based Games

```bash
npm run download:all
```

#### Download Specific Games

```bash
# Magic: The Gathering
npm run download:mtg

# Pokémon TCG
npm run download:pokemon

# Yu-Gi-Oh!
npm run download:yugioh

# Flesh and Blood
npm run download:fab
```

#### API-Only Mode (Skip Phase 2)

```bash
npm run download:api
```

#### Skip Images (Data Only)

```bash
npm start -- --skip-images
```

#### With Validation and Export

```bash
npm start -- --validate --export
```

## 📁 Project Structure

```
tcgh/
├── src/
│   ├── downloaders/       # API downloaders for each game
│   │   ├── mtg.ts
│   │   ├── pokemon.ts
│   │   ├── yugioh.ts
│   │   └── fab.ts
│   ├── scrapers/          # Web scrapers (templates)
│   │   └── template.ts
│   ├── utils/             # Utilities
│   │   ├── fileManager.ts
│   │   ├── rateLimiter.ts
│   │   ├── logger.ts
│   │   ├── validator.ts
│   │   └── exporter.ts
│   ├── types/             # TypeScript types
│   │   └── index.ts
│   └── index.ts           # Main orchestration script
├── tcg-data/              # Downloaded data (created on first run)
│   ├── magic-the-gathering/
│   │   ├── cards/         # JSON card data
│   │   ├── images/        # Card images
│   │   └── raw/           # Raw API responses
│   ├── pokemon-tcg/
│   ├── yugioh-tcg/
│   ├── [other games...]
│   └── export/            # Database-ready exports
│       ├── all-cards.json
│       ├── database.sql
│       └── summary.json
├── logs/                  # Execution logs
├── package.json
├── tsconfig.json
└── README.md
```

## 📊 Data Format

### Card Interface

```typescript
interface Card {
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
  };
  releaseDate?: string;
  artist?: string;
  cardNumber?: string;
}
```

### Output Files

- `tcg-data/{game}/cards/all-cards.json` - All card data in unified format
- `tcg-data/{game}/images/normal/*.jpg` - Card images
- `tcg-data/export/all-cards.json` - Combined database export
- `tcg-data/export/database.sql` - SQL import script

## ⏱️ Estimated Time

| Game | Cards | Est. Time | Status |
|------|-------|-----------|--------|
| Yu-Gi-Oh! | ~12,000 | 2-3 hours | ✅ API |
| Magic: The Gathering | ~27,000 | 2-3 hours | ✅ API |
| Pokémon TCG | ~15,000 | 3-4 hours | ✅ API |
| Flesh and Blood | ~1,500 | 1-2 hours | ✅ API |
| **Phase 1 Total** | **~55,000** | **8-12 hours** | **Ready** |

Phase 2 games require web scraping and may take 20-30 additional hours.

## 🔧 Configuration

### Environment Variables

Create a `.env` file (see `.env.example`):

```bash
# Optional: Pokémon TCG API Key (increases rate limit)
POKEMON_TCG_API_KEY=your_api_key_here
```

Get a free Pokémon TCG API key at: https://dev.pokemontcg.io/

## 📝 Validation & Export

### Validate Downloaded Data

```bash
npm run validate
```

Checks:
- Card data integrity
- Missing images
- Required fields
- File consistency

### Export to Database Formats

```bash
npm run export
```

Creates:
- `all-cards.json` - Complete JSON export
- `database.sql` - PostgreSQL/MySQL import script
- `by-game/*.json` - Individual game exports
- `summary.json` - Statistics and metadata

## 🎯 Next Steps for Web Scraping

For games without APIs (Phase 2), you'll need to:

1. **Research** - Check each game's official website for card databases
2. **Inspect** - Use browser DevTools to find card data endpoints
3. **Customize** - Use the scraper template in `src/scrapers/template.ts`
4. **Test** - Start with small samples before full scraping
5. **Respect** - Follow robots.txt and add appropriate delays

Some games may have community-maintained databases or JSON dumps available.

## 📖 API Documentation

- **Magic: The Gathering**: https://scryfall.com/docs/api
- **Pokémon TCG**: https://docs.pokemontcg.io/
- **Yu-Gi-Oh!**: https://db.ygoprodeck.com/api-guide/
- **Flesh and Blood**: https://fabdb.net/api/docs

## 🤝 Contributing

This is a data collection tool. To add support for additional games:

1. Create a new downloader in `src/downloaders/`
2. Implement the Card interface mapping
3. Add to main orchestration script
4. Update documentation

## ⚖️ Legal & Ethics

- ✅ All APIs used are public and free
- ✅ Rate limiting respects server resources
- ✅ Data is for personal/educational use
- ⚠️ Card images are copyrighted by their respective publishers
- ⚠️ Commercial use may require licensing
- ⚠️ Always respect website terms of service

## 🐛 Troubleshooting

### Rate Limiting Errors

If you encounter rate limiting:
- Reduce concurrent downloads in rate limiter
- Add delays between requests
- Get API keys where available (Pokémon TCG)

### Out of Memory

For large downloads:
- Download games individually
- Use `--skip-images` flag
- Process in smaller batches

### Download Interrupted

The tool supports resuming:
- Progress is saved after each game
- Already downloaded images are skipped
- Run the same command again to continue

## 📞 Support

- Check `logs/` folder for detailed error logs
- Review `TCG_DATA_COLLECTION_PLAN.md` for comprehensive strategy
- Validate data with `npm run validate`

## 🎉 Success Criteria

- [x] Folder structure created
- [x] API downloaders implemented
- [x] Rate limiting and error handling
- [x] Progress tracking
- [x] Data validation
- [x] Database export formats
- [ ] Run Phase 1 downloads (user action)
- [ ] Implement Phase 2 scrapers (optional)

---

**Ready to collect 55,000+ trading cards!**

Run `npm run download:all` to begin.

