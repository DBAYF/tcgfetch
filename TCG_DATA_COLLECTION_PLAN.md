# Trading Card Game Data Collection - Master Plan

## Executive Summary

This document outlines the complete strategy for collecting card data and images from the top 10 most popular trading card games. The plan includes API details, rate limits, estimated download times, and implementation strategies.

---

## Top 10 Trading Card Games (Q3 2025)

1. **Magic: The Gathering** (~27,000 cards)
2. **Pokémon TCG** (~15,000 cards)
3. **Yu-Gi-Oh!** (~12,000 cards)
4. **One Piece Card Game** (~500+ cards)
5. **Gundam Card Game** (~400+ cards)
6. **Disney Lorcana** (~600+ cards)
7. **Digimon Card Game** (~1,200+ cards)
8. **Star Wars: Unlimited** (~500+ cards)
9. **Flesh and Blood** (~1,500+ cards)
10. **Dragon Ball Super** (~1,800+ cards)

**Total Estimated Cards: ~61,000+**

---

## API Availability & Data Sources

### Tier 1: Excellent API Support (Bulk Download Available)

#### 1. Magic: The Gathering - Scryfall API ⭐ BEST
- **API URL**: https://api.scryfall.com
- **Documentation**: https://scryfall.com/docs/api
- **Rate Limit**: 10 requests/second (very generous)
- **Bulk Data**: YES - JSON files available for download
- **Bulk Data URL**: https://api.scryfall.com/bulk-data
- **Image Quality**: Multiple sizes (small, normal, large, png, art_crop, border_crop)
- **Image URLs**: Direct CDN links included in card data
- **Estimated Download Time**: 2-3 hours (bulk JSON + ~27K images)
- **Data Format**: JSON
- **Authentication**: None required
- **Cost**: Free

**Implementation Strategy:**
1. Download bulk JSON file (all cards in one file)
2. Parse JSON and extract image URLs
3. Download images with rate limiting (10/sec)
4. No need to paginate through API

**Alternative: MTGJson**
- URL: https://mtgjson.com/
- Provides comprehensive JSON files
- No rate limits (static files)
- Updated regularly

#### 2. Pokémon TCG API ⭐ EXCELLENT
- **API URL**: https://api.pokemontcg.io/v2
- **Documentation**: https://docs.pokemontcg.io/
- **Rate Limit**: 1000 requests/hour (with API key), 100 requests/minute (without)
- **Bulk Data**: No, but pagination is efficient
- **Image Quality**: High-res and low-res available
- **Estimated Cards**: ~15,000
- **Estimated Download Time**: 3-4 hours
- **Data Format**: JSON
- **Authentication**: API key recommended (free)
- **Cost**: Free

**Implementation Strategy:**
1. Paginate through all cards (pageSize=250)
2. Extract card data and image URLs
3. Download images concurrently with rate limiting
4. ~60 pages to fetch all cards

#### 3. Yu-Gi-Oh! - YGOPRODECK API ⭐ EXCELLENT
- **API URL**: https://db.ygoprodeck.com/api/v7/cardinfo.php
- **Documentation**: https://db.ygoprodeck.com/api-guide/
- **Rate Limit**: 20 requests/second
- **Bulk Data**: YES - Single endpoint returns all cards
- **Endpoint**: `GET https://db.ygoprodeck.com/api/v7/cardinfo.php` (returns all cards)
- **Image URLs**: Direct links to high-res images
- **Estimated Cards**: ~12,000
- **Estimated Download Time**: 2-3 hours
- **Data Format**: JSON
- **Authentication**: None required
- **Cost**: Free

**Implementation Strategy:**
1. Single API call gets ALL card data
2. Parse JSON and extract image URLs
3. Download images with rate limiting
4. Extremely efficient!

#### 4. Flesh and Blood - FABDB API ⭐ GOOD
- **API URL**: https://api.fabdb.net
- **Documentation**: https://fabdb.net/api/docs
- **Rate Limit**: Not explicitly stated (be conservative: 10/sec)
- **Bulk Data**: Pagination required
- **Estimated Cards**: ~1,500
- **Estimated Download Time**: 1-2 hours
- **Data Format**: JSON
- **Authentication**: None required
- **Cost**: Free

**Implementation Strategy:**
1. Paginate through all cards
2. Extract card data and image URLs
3. Download images with conservative rate limiting

---

### Tier 2: No API - Web Scraping or Manual Collection Required

#### 5. One Piece Card Game
- **Official Site**: https://en.onepiece-cardgame.com/
- **Data Source**: Official card database on website
- **Method**: Web scraping or manual download
- **Estimated Cards**: ~500+
- **Estimated Time**: 4-6 hours (scraping) or manual
- **Challenges**: May require JavaScript rendering

**Implementation Strategy:**
1. Use Puppeteer/Playwright for JavaScript rendering
2. Scrape card list pages
3. Download images from CDN
4. Alternative: Look for community JSON dumps

#### 6. Gundam Card Game
- **Official Site**: https://en.bandai-tcg-plus.com/products/gundam/
- **Data Source**: Official website
- **Method**: Web scraping
- **Estimated Cards**: ~400+
- **Estimated Time**: 3-5 hours
- **Challenges**: May need translation from Japanese site

**Implementation Strategy:**
1. Check both English and Japanese official sites
2. Web scraping with headless browser
3. Community databases may exist

#### 7. Disney Lorcana
- **Official Site**: https://www.disneylorcana.com/en-US/cards
- **Data Source**: Official card database
- **Method**: Web scraping
- **Estimated Cards**: ~600+
- **Estimated Time**: 4-6 hours
- **Challenges**: Newer game, may have protections

**Implementation Strategy:**
1. Use headless browser (Puppeteer)
2. Scrape card database
3. Check for community-maintained APIs

#### 8. Digimon Card Game
- **Official Site**: https://world.digimoncard.com/cardlist/
- **Data Source**: Official card list
- **Method**: Web scraping
- **Estimated Cards**: ~1,200+
- **Estimated Time**: 4-6 hours
- **Challenges**: Multi-language support needed

**Implementation Strategy:**
1. Scrape official card list
2. Download images from official CDN
3. Check for community JSON databases

#### 9. Star Wars: Unlimited
- **Official Site**: https://www.starwarsunlimited.com/
- **Data Source**: Official card database
- **Method**: Web scraping
- **Estimated Cards**: ~500+
- **Estimated Time**: 3-5 hours
- **Challenges**: Very new game (2024)

**Implementation Strategy:**
1. Check official website structure
2. Web scraping
3. Community resources may be developing

#### 10. Dragon Ball Super Card Game
- **Official Site**: https://www.dbs-cardgame.com/
- **Data Source**: Official card list
- **Method**: Web scraping
- **Estimated Cards**: ~1,800+
- **Estimated Time**: 4-6 hours
- **Challenges**: May need Japanese site access

**Implementation Strategy:**
1. Scrape official database
2. Handle pagination
3. Download images from CDN

---

## Overall Implementation Plan

### Phase 1: Quick Wins (API-Based) - Days 1-2

**Priority Order:**
1. Yu-Gi-Oh! (Single API call - FASTEST)
2. Magic: The Gathering (Bulk download)
3. Pokémon TCG (Good pagination)
4. Flesh and Blood (Smaller dataset)

**Estimated Time**: 8-12 hours total
**Estimated Data**: ~55,000+ cards
**Success Rate**: 99%+

### Phase 2: Web Scraping (Manual Intervention May Be Needed) - Days 3-5

**Priority Order:**
1. Disney Lorcana
2. One Piece Card Game
3. Star Wars: Unlimited
4. Gundam Card Game
5. Digimon Card Game
6. Dragon Ball Super

**Estimated Time**: 20-30 hours total
**Estimated Data**: ~5,000+ cards
**Success Rate**: 70-90% (may need manual assistance)

---

## Technical Implementation

### Technology Stack

```
Primary Language: TypeScript/Node.js
- axios: HTTP requests
- p-limit: Rate limiting/concurrency control
- sharp: Image processing/optimization
- cheerio: HTML parsing (scraping)
- puppeteer: Headless browser (JavaScript sites)
- dotenv: Environment configuration
```

### Data Structure

```typescript
interface Card {
  id: string;
  name: string;
  game: string;
  set: string;
  rarity: string;
  type: string;
  subtype?: string;
  description: string;
  imageUrl: string;
  imageUrlSmall?: string;
  imageUrlLarge?: string;
  attributes: Record<string, any>; // Game-specific attributes
  prices?: {
    usd?: string;
    eur?: string;
    jpy?: string;
  };
  releaseDate?: string;
  artist?: string;
  cardNumber?: string;
}
```

### File Organization

```
tcg-data/
├── magic-the-gathering/
│   ├── cards/
│   │   └── all-cards.json
│   ├── images/
│   │   ├── small/
│   │   ├── normal/
│   │   └── large/
│   └── raw/
│       └── scryfall-bulk.json
├── pokemon-tcg/
│   ├── cards/
│   ├── images/
│   └── raw/
├── [other games...]
└── metadata/
    └── collection-stats.json
```

---

## Rate Limiting & Download Strategy

### Concurrent Download Strategy

```typescript
// Example configuration
const RATE_LIMITS = {
  'magic-the-gathering': 10,  // 10 req/sec
  'pokemon-tcg': 16,          // 1000/hour ≈ 16/min
  'yugioh-tcg': 20,           // 20 req/sec
  'flesh-and-blood': 10,      // Conservative
  // Scraping sites: 1-2 req/sec
  'default-scraping': 2
};
```

### Download Time Estimates

| Game | Method | API Calls | Images | Est. Time |
|------|--------|-----------|--------|-----------|
| MTG | API (Bulk) | 1 | 27,000 | 2-3h |
| Pokémon | API | 60 | 15,000 | 3-4h |
| Yu-Gi-Oh! | API | 1 | 12,000 | 2-3h |
| Flesh & Blood | API | 20 | 1,500 | 1-2h |
| One Piece | Scrape | 100+ | 500 | 4-6h |
| Gundam | Scrape | 100+ | 400 | 3-5h |
| Lorcana | Scrape | 100+ | 600 | 4-6h |
| Digimon | Scrape | 150+ | 1,200 | 4-6h |
| Star Wars | Scrape | 100+ | 500 | 3-5h |
| Dragon Ball | Scrape | 200+ | 1,800 | 4-6h |

**Total Estimated Time: 30-45 hours**

With proper parallel execution and automation, this can be reduced to 3-5 days of continuous running.

---

## Storage Requirements

- **Card Data (JSON)**: ~500MB - 1GB
- **Images (all sizes)**: ~50-100GB
  - Small images: ~10-20GB
  - Normal images: ~30-50GB
  - Large/high-res: ~20-30GB

**Recommended**: Start with normal-sized images only (~30-50GB)

---

## Error Handling & Resilience

1. **Resume Capability**: Track downloaded cards to resume interrupted downloads
2. **Retry Logic**: Exponential backoff for failed requests
3. **Validation**: Verify image downloads and JSON integrity
4. **Logging**: Detailed logs for debugging
5. **Checkpoints**: Save progress after each game or batch

---

## Database Schema Preparation

### Recommended Database Structure

```sql
-- Games table
CREATE TABLE games (
  id VARCHAR(50) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  publisher VARCHAR(100),
  release_year INT,
  total_cards INT,
  last_updated TIMESTAMP
);

-- Cards table
CREATE TABLE cards (
  id VARCHAR(100) PRIMARY KEY,
  game_id VARCHAR(50) REFERENCES games(id),
  name VARCHAR(200) NOT NULL,
  set_name VARCHAR(100),
  card_number VARCHAR(50),
  rarity VARCHAR(50),
  type VARCHAR(100),
  subtype VARCHAR(100),
  description TEXT,
  artist VARCHAR(100),
  release_date DATE,
  image_small_url TEXT,
  image_normal_url TEXT,
  image_large_url TEXT,
  price_usd DECIMAL(10,2),
  attributes JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_cards_game ON cards(game_id);
CREATE INDEX idx_cards_name ON cards(name);
CREATE INDEX idx_cards_set ON cards(set_name);
CREATE INDEX idx_cards_rarity ON cards(rarity);
```

---

## Next Steps

### Immediate Actions

1. ✅ Create folder structure
2. ⬜ Set up Node.js/TypeScript project
3. ⬜ Install dependencies
4. ⬜ Create download scripts for Phase 1 (API-based)
5. ⬜ Test with small samples
6. ⬜ Run full Phase 1 downloads
7. ⬜ Create web scraping scripts for Phase 2
8. ⬜ Manual data collection for difficult sites
9. ⬜ Data validation and cleanup
10. ⬜ Database import preparation

---

## Legal & Ethical Considerations

- ✅ All APIs mentioned are public and free
- ⚠️ Web scraping: Respect robots.txt and terms of service
- ⚠️ Rate limiting: Be respectful of server resources
- ⚠️ Attribution: Maintain data source attribution
- ⚠️ Images: Card images are copyrighted; use only for authorized purposes
- ✅ Personal/educational use is generally acceptable
- ⚠️ Commercial use may require licensing

---

## Success Criteria

- [ ] All 10 games have organized folders
- [ ] At least 90% of cards from API-based games downloaded
- [ ] At least 70% of cards from scraping-based games downloaded
- [ ] All JSON data is valid and properly structured
- [ ] Images are properly named and organized
- [ ] Database-ready export files created
- [ ] Documentation of data sources and collection dates

---

**Last Updated**: November 30, 2025
**Status**: Planning Complete - Ready for Implementation

