# Quick Start Guide - TCG Data Collector

## 🎯 Ready to Download 55,000+ Trading Cards!

Everything is set up and ready to go. Here's how to start collecting card data.

---

## ⚡ Quick Commands

### Download Everything (Recommended)

```bash
npm start
```

This will download all API-based games:
- Yu-Gi-Oh! (~12,000 cards) - **Fastest!**
- Magic: The Gathering (~27,000 cards)
- Pokémon TCG (~15,000 cards)
- Flesh and Blood (~1,500 cards)

**Total: ~55,000 cards in 8-12 hours**

### Individual Game Downloads

```bash
# Download specific games
npm run download:yugioh    # Fastest - single API call
npm run download:mtg       # Bulk download
npm run download:pokemon   # Requires pagination
npm run download:fab       # Smaller dataset
```

---

## 📊 What Will Be Downloaded?

### Data Collected for Each Card:
- ✅ Card ID and Name
- ✅ Set information
- ✅ Rarity and Type
- ✅ Full card text/description
- ✅ Artist name
- ✅ Release date
- ✅ Prices (USD/EUR when available)
- ✅ High-quality images (multiple sizes)
- ✅ Game-specific attributes

### File Structure Created:

```
tcg-data/
├── magic-the-gathering/
│   ├── cards/all-cards.json      ← Card data
│   ├── images/normal/*.jpg        ← Card images
│   └── raw/scryfall-bulk.json    ← Original API response
├── pokemon-tcg/
├── yugioh-tcg/
├── flesh-and-blood/
└── export/
    ├── all-cards.json             ← Combined export
    ├── database.sql               ← SQL import script
    └── summary.json               ← Statistics
```

---

## 🚀 Step-by-Step First Run

### 1. Download All Cards

```bash
npm start
```

You'll see:
- Progress bars for each game
- Card counts in real-time
- ETA for completion
- Logs saved to `logs/` folder

### 2. Validate Data (After Download)

```bash
npm run validate
```

Checks:
- All cards have required fields
- Images were downloaded successfully
- No corrupt data

### 3. Export to Database Format

```bash
npm run export
```

Creates:
- `tcg-data/export/all-cards.json` - Complete JSON
- `tcg-data/export/database.sql` - SQL import
- Individual game exports

---

## ⏱️ Timeline Expectations

| Game | Cards | Images | Est. Time | When? |
|------|-------|--------|-----------|-------|
| Yu-Gi-Oh! | 12K | 12K | 2-3h | 1st |
| MTG | 27K | 27K | 2-3h | 2nd |
| Pokémon | 15K | 15K | 3-4h | 3rd |
| FAB | 1.5K | 1.5K | 1-2h | 4th |

**Total: 8-12 hours for ~55,000 cards**

The script runs continuously and handles:
- ✅ Automatic retries on failures
- ✅ Rate limiting (respects API limits)
- ✅ Progress saving (resume if interrupted)
- ✅ Skip already downloaded images

---

## 💾 Storage Requirements

- **Card Data (JSON)**: ~500MB
- **Images (normal size)**: ~30-50GB
- **Raw API data**: ~1-2GB
- **Total**: ~35-55GB

Make sure you have enough disk space!

---

## 🎛️ Advanced Options

### Skip Images (Data Only)

```bash
npm start -- --skip-images
```

Much faster, only ~500MB download

### Download Only Specific Games

```bash
npm start -- --games=yugioh,pokemon
```

### Validate + Export in One Go

```bash
npm start -- --validate --export
```

### API-Only Mode

```bash
npm start -- --api-only
```

---

## 🔑 Optional: Pokémon TCG API Key

For better rate limits (1000/hour instead of 100/min):

1. Get free API key: https://dev.pokemontcg.io/
2. Create `.env` file:
   ```bash
   echo "POKEMON_TCG_API_KEY=your_key_here" > .env
   ```
3. Run download normally

---

## 🐛 Troubleshooting

### "Cannot find module"
```bash
npm install
npm run build
```

### "Rate limit exceeded"
- The script already handles this
- Wait a few minutes and run again
- Consider getting Pokémon API key

### "Out of disk space"
- Use `--skip-images` flag
- Download games individually
- Free up space and continue

### Download Interrupted?
- Just run the same command again
- Progress is saved automatically
- Already downloaded files are skipped

---

## 📈 Monitoring Progress

### Real-Time Progress
- Watch the terminal for progress bars
- Each game shows cards/images downloaded
- ETA updates automatically

### Check Logs
```bash
# View latest log
ls -lt logs/ | head -n 1

# Follow log in real-time
tail -f logs/download-*.log
```

### Check Downloaded Data
```bash
# Count cards downloaded
ls tcg-data/*/cards/*.json | wc -l

# Count images downloaded
find tcg-data -name "*.jpg" | wc -l

# Check sizes
du -sh tcg-data/*
```

---

## 🎯 Integration with Your Lovable Project

After downloading, you'll have:

### 1. JSON Format (Easiest)
```typescript
// Import cards
import allCards from './tcg-data/export/all-cards.json';

// Use in your app
const mtgCards = allCards.cards.filter(c => c.game === 'Magic: The Gathering');
```

### 2. SQL Import
```bash
# PostgreSQL
psql your_database < tcg-data/export/database.sql

# MySQL
mysql your_database < tcg-data/export/database.sql
```

### 3. Direct API
```typescript
// Use the Card interface
import { Card } from './src/types';

// Your cards are already in this format!
```

---

## 🌐 Web Scraping (Phase 2)

For games without APIs:
- One Piece Card Game
- Gundam Card Game  
- Disney Lorcana
- Digimon Card Game
- Star Wars: Unlimited
- Dragon Ball Super

**Template provided** in `src/scrapers/template.ts`

These require:
1. Manual website inspection
2. Custom CSS selectors
3. Potentially Puppeteer for JavaScript sites
4. More development time

**Recommendation**: Start with Phase 1 (55,000 cards), then evaluate if Phase 2 is needed.

---

## ✅ Success Checklist

After running the downloader:

- [ ] Check `tcg-data/` folder has 4 game directories
- [ ] Each game has `cards/all-cards.json`
- [ ] Each game has `images/normal/` with JPG files
- [ ] Run `npm run validate` shows high success rate
- [ ] Run `npm run export` creates export files
- [ ] Check `tcg-data/export/summary.json` for stats

---

## 🎉 You're Ready!

**To start downloading now:**

```bash
npm start
```

**Or for just one game to test:**

```bash
npm run download:yugioh
```

**Questions?**
- Check `README.md` for full documentation
- Check `TCG_DATA_COLLECTION_PLAN.md` for detailed strategy
- Review `logs/` for any errors

---

**Happy Collecting! 🃏**

Your comprehensive TCG database awaits. Run `npm start` and grab some coffee - you're downloading 55,000+ cards!

