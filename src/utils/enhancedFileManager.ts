import * as fs from 'fs';
import * as path from 'path';
import axios, { AxiosInstance } from 'axios';
import * as crypto from 'crypto';
import sizeOf from 'image-size';
import { Card } from '../types';
import { DownloadDatabase } from './database';

/**
 * Production-grade file manager with:
 * - Image validation and integrity checks
 * - Deduplication via checksums
 * - Atomic writes with temp files
 * - Connection pooling
 * - Retry logic with exponential backoff
 * - Resume capability
 */
export class EnhancedFileManager {
  private db: DownloadDatabase;
  private axiosInstance: AxiosInstance;
  private tempDir: string;

  constructor(db: DownloadDatabase) {
    this.db = db;
    this.tempDir = path.join('tcg-data', '.temp');
    
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true });
    }

    // Create axios instance with connection pooling
    this.axiosInstance = axios.create({
      timeout: 60000,
      maxRedirects: 5,
      httpAgent: new (require('http').Agent)({
        keepAlive: true,
        maxSockets: 50,
        maxFreeSockets: 10,
        timeout: 60000,
        freeSocketTimeout: 30000
      }),
      httpsAgent: new (require('https').Agent)({
        keepAlive: true,
        maxSockets: 50,
        maxFreeSockets: 10,
        timeout: 60000,
        freeSocketTimeout: 30000
      }),
      headers: {
        'User-Agent': 'TCGFetch/2.0 (Professional TCG Data Collector)',
        'Accept': '*/*',
        'Accept-Encoding': 'gzip, deflate, br'
      }
    });
  }

  /**
   * Calculate MD5 checksum of data
   */
  private calculateChecksum(data: Buffer | string): string {
    const hash = crypto.createHash('md5');
    if (typeof data === 'string') {
      hash.update(Buffer.from(data));
    } else {
      hash.update(data);
    }
    return hash.digest('hex');
  }

  /**
   * Calculate checksum of a file
   */
  async calculateFileChecksum(filePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const hash = crypto.createHash('md5');
      const stream = fs.createReadStream(filePath);
      
      stream.on('data', data => hash.update(data));
      stream.on('end', () => resolve(hash.digest('hex')));
      stream.on('error', reject);
    });
  }

  /**
   * Validate image file
   */
  async validateImage(filePath: string): Promise<{ valid: boolean; width?: number; height?: number; error?: string }> {
    try {
      if (!fs.existsSync(filePath)) {
        return { valid: false, error: 'File does not exist' };
      }

      const stats = fs.statSync(filePath);
      if (stats.size === 0) {
        return { valid: false, error: 'File is empty' };
      }

      if (stats.size < 100) {
        return { valid: false, error: 'File too small to be valid image' };
      }

      // Get image dimensions
      const buffer = fs.readFileSync(filePath);
      const dimensions = sizeOf(buffer);
      
      if (!dimensions.width || !dimensions.height) {
        return { valid: false, error: 'Could not read image dimensions' };
      }

      if (dimensions.width < 10 || dimensions.height < 10) {
        return { valid: false, error: 'Image dimensions too small' };
      }

      return {
        valid: true,
        width: dimensions.width,
        height: dimensions.height
      };
    } catch (error) {
      return {
        valid: false,
        error: error instanceof Error ? error.message : 'Unknown validation error'
      };
    }
  }

  /**
   * Download with retry logic and exponential backoff
   */
  private async downloadWithRetry(
    url: string,
    outputPath: string,
    maxRetries: number = 5
  ): Promise<{ success: boolean; checksum?: string; size?: number; error?: string }> {
    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const response = await this.axiosInstance.get(url, {
          responseType: 'arraybuffer',
          validateStatus: (status) => status === 200
        });

        const buffer = Buffer.from(response.data);
        const checksum = this.calculateChecksum(buffer);

        // Write to temp file first (atomic write)
        const tempPath = path.join(this.tempDir, `${checksum}.tmp`);
        fs.writeFileSync(tempPath, buffer);

        // Validate before moving
        const validation = await this.validateImage(tempPath);
        
        if (!validation.valid) {
          fs.unlinkSync(tempPath);
          return {
            success: false,
            error: `Image validation failed: ${validation.error}`
          };
        }

        // Move to final location atomically
        const dir = path.dirname(outputPath);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }

        fs.renameSync(tempPath, outputPath);

        return {
          success: true,
          checksum,
          size: buffer.length
        };
      } catch (error) {
        lastError = error as Error;

        // Don't retry on 404
        if (axios.isAxiosError(error) && error.response?.status === 404) {
          return {
            success: false,
            error: 'Image not found (404)'
          };
        }

        // Exponential backoff
        if (attempt < maxRetries) {
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 30000);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    return {
      success: false,
      error: lastError?.message || 'Download failed after retries'
    };
  }

  /**
   * Download image with deduplication and validation
   */
  async downloadImage(
    url: string,
    cardId: string,
    gameId: string,
    size: string = 'normal'
  ): Promise<{ success: boolean; path?: string; skipped?: boolean; error?: string }> {
    const imageId = `${cardId}_${size}`;
    const outputPath = this.getCardImagePath(gameId, cardId, size);

    // Check if already downloaded and validated
    if (this.db.imageExists(imageId) && this.db.imageValidated(imageId)) {
      const existing = this.db.getImage(imageId);
      
      // Verify file still exists
      if (fs.existsSync(existing.file_path)) {
        return {
          success: true,
          path: existing.file_path,
          skipped: true
        };
      }
    }

    // Download
    const result = await this.downloadWithRetry(url, outputPath);
    
    if (!result.success) {
      return {
        success: false,
        error: result.error
      };
    }

    // Validate
    const validation = await this.validateImage(outputPath);
    
    if (!validation.valid) {
      fs.unlinkSync(outputPath);
      return {
        success: false,
        error: `Validation failed: ${validation.error}`
      };
    }

    // Save to database
    this.db.upsertImage({
      id: imageId,
      cardId,
      size,
      url,
      filePath: outputPath,
      checksum: result.checksum!,
      fileSize: result.size!,
      width: validation.width,
      height: validation.height
    });

    this.db.markImageValidated(imageId, validation.width!, validation.height!);

    return {
      success: true,
      path: outputPath
    };
  }

  /**
   * Download multiple images in parallel with concurrency control
   */
  async downloadImagesBatch(
    images: Array<{ url: string; cardId: string; gameId: string; size?: string }>,
    concurrency: number = 10
  ): Promise<{ successful: number; failed: number; skipped: number }> {
    const stats = { successful: 0, failed: 0, skipped: 0 };
    const queue = [...images];
    const active = new Set<Promise<void>>();

    while (queue.length > 0 || active.size > 0) {
      while (active.size < concurrency && queue.length > 0) {
        const image = queue.shift()!;
        
        const promise = (async () => {
          const result = await this.downloadImage(
            image.url,
            image.cardId,
            image.gameId,
            image.size || 'normal'
          );

          if (result.success) {
            if (result.skipped) {
              stats.skipped++;
            } else {
              stats.successful++;
            }
          } else {
            stats.failed++;
          }
        })();

        active.add(promise);
        promise.finally(() => active.delete(promise));
      }

      if (active.size > 0) {
        await Promise.race(active);
      }
    }

    return stats;
  }

  /**
   * Save JSON with atomic write
   */
  async saveJSON(filePath: string, data: any): Promise<void> {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const content = JSON.stringify(data, null, 2);
    const tempPath = path.join(this.tempDir, `${path.basename(filePath)}.tmp`);

    // Write to temp file
    fs.writeFileSync(tempPath, content, 'utf-8');

    // Move atomically
    fs.renameSync(tempPath, filePath);
  }

  /**
   * Load JSON with error handling
   */
  async loadJSON<T>(filePath: string): Promise<T | null> {
    if (!fs.existsSync(filePath)) {
      return null;
    }

    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(content) as T;
    } catch (error) {
      console.error(`Error loading JSON from ${filePath}:`, error);
      return null;
    }
  }

  /**
   * Save card with deduplication
   */
  async saveCard(card: Card, gameId: string): Promise<{ saved: boolean; updated: boolean }> {
    const checksum = this.calculateChecksum(JSON.stringify(card));
    
    const existing = this.db.getCard(card.id);
    
    if (existing) {
      // Check if card has changed
      if (existing.checksum === checksum) {
        return { saved: false, updated: false };
      }
      
      // Card has been updated
      this.db.upsertCard({
        id: card.id,
        gameId,
        name: card.name,
        checksum,
        metadata: card
      });
      
      return { saved: true, updated: true };
    }

    // New card
    this.db.upsertCard({
      id: card.id,
      gameId,
      name: card.name,
      checksum,
      metadata: card
    });

    return { saved: true, updated: false };
  }

  /**
   * Save cards in batch
   */
  async saveCardsBatch(cards: Card[], gameId: string): Promise<{ saved: number; updated: number; skipped: number }> {
    const stats = { saved: 0, updated: 0, skipped: 0 };

    this.db.transaction(() => {
      for (const card of cards) {
        const checksum = this.calculateChecksum(JSON.stringify(card));
        const existing = this.db.getCard(card.id);

        if (existing && existing.checksum === checksum) {
          stats.skipped++;
        } else {
          this.db.upsertCard({
            id: card.id,
            gameId,
            name: card.name,
            checksum,
            metadata: card
          });

          if (existing) {
            stats.updated++;
          } else {
            stats.saved++;
          }
        }
      }
    });

    return stats;
  }

  /**
   * Get card image path
   */
  getCardImagePath(gameId: string, cardId: string, size: string = 'normal'): string {
    const sanitizedId = this.sanitizeFilename(cardId);
    return path.join('tcg-data', gameId, 'images', size, `${sanitizedId}.jpg`);
  }

  /**
   * Get card data path
   */
  getCardDataPath(gameId: string): string {
    return path.join('tcg-data', gameId, 'cards', 'all-cards.json');
  }

  /**
   * Get raw data path
   */
  getRawDataPath(gameId: string, filename: string): string {
    return path.join('tcg-data', gameId, 'raw', filename);
  }

  /**
   * Sanitize filename
   */
  sanitizeFilename(filename: string): string {
    return filename
      .replace(/[<>:"/\\|?*]/g, '-')
      .replace(/\s+/g, '_')
      .substring(0, 200);
  }

  /**
   * Verify all images for a game
   */
  async verifyGameImages(gameId: string): Promise<{
    total: number;
    valid: number;
    invalid: number;
    missing: number;
  }> {
    const stats = { total: 0, valid: 0, invalid: 0, missing: 0 };
    const cards = this.db.getCardsByGame(gameId);

    for (const card of cards) {
      const imageId = `${card.id}_normal`;
      const image = this.db.getImage(imageId);

      if (!image) {
        stats.missing++;
        continue;
      }

      stats.total++;

      if (!fs.existsSync(image.file_path)) {
        stats.missing++;
        continue;
      }

      const validation = await this.validateImage(image.file_path);
      
      if (validation.valid) {
        stats.valid++;
        if (!this.db.imageValidated(imageId)) {
          this.db.markImageValidated(imageId, validation.width!, validation.height!);
        }
      } else {
        stats.invalid++;
      }
    }

    return stats;
  }

  /**
   * Clean up temporary files
   */
  cleanupTemp(): void {
    if (fs.existsSync(this.tempDir)) {
      const files = fs.readdirSync(this.tempDir);
      for (const file of files) {
        fs.unlinkSync(path.join(this.tempDir, file));
      }
    }
  }

  /**
   * Get disk usage stats
   */
  getDiskUsage(gameId?: string): { files: number; bytes: number; formatted: string } {
    const basePath = gameId ? path.join('tcg-data', gameId) : 'tcg-data';
    let totalBytes = 0;
    let fileCount = 0;

    const walk = (dir: string) => {
      if (!fs.existsSync(dir)) return;

      const files = fs.readdirSync(dir);
      for (const file of files) {
        const filePath = path.join(dir, file);
        const stats = fs.statSync(filePath);

        if (stats.isDirectory()) {
          walk(filePath);
        } else {
          totalBytes += stats.size;
          fileCount++;
        }
      }
    };

    walk(basePath);

    const formatBytes = (bytes: number): string => {
      if (bytes === 0) return '0 B';
      const k = 1024;
      const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
    };

    return {
      files: fileCount,
      bytes: totalBytes,
      formatted: formatBytes(totalBytes)
    };
  }
}

