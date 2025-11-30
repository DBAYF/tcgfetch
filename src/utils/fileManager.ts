import * as fs from 'fs';
import * as path from 'path';
import axios from 'axios';
import { Card } from '../types';

export class FileManager {
  static async saveJSON(filePath: string, data: any): Promise<void> {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
  }

  static async loadJSON<T>(filePath: string): Promise<T | null> {
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

  static async downloadImage(
    url: string,
    outputPath: string,
    retries: number = 3
  ): Promise<boolean> {
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Skip if already downloaded
    if (fs.existsSync(outputPath)) {
      return true;
    }

    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const response = await axios.get(url, {
          responseType: 'arraybuffer',
          timeout: 30000,
          headers: {
            'User-Agent': 'TCG-Data-Collector/1.0'
          }
        });

        fs.writeFileSync(outputPath, response.data);
        return true;
      } catch (error) {
        if (attempt === retries) {
          console.error(`Failed to download ${url} after ${retries} attempts`);
          return false;
        }
        
        // Wait before retrying (exponential backoff)
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
      }
    }

    return false;
  }

  static getProgressFilePath(game: string): string {
    return path.join('tcg-data', game, 'progress.json');
  }

  static async saveProgress(game: string, progress: any): Promise<void> {
    const progressPath = this.getProgressFilePath(game);
    await this.saveJSON(progressPath, progress);
  }

  static async loadProgress<T>(game: string): Promise<T | null> {
    const progressPath = this.getProgressFilePath(game);
    return await this.loadJSON<T>(progressPath);
  }

  static sanitizeFilename(filename: string): string {
    return filename
      .replace(/[<>:"/\\|?*]/g, '-')
      .replace(/\s+/g, '_')
      .substring(0, 200); // Limit filename length
  }

  static getCardImagePath(
    game: string,
    cardId: string,
    size: string = 'normal'
  ): string {
    const sanitizedId = this.sanitizeFilename(cardId);
    return path.join('tcg-data', game, 'images', size, `${sanitizedId}.jpg`);
  }

  static getCardDataPath(game: string): string {
    return path.join('tcg-data', game, 'cards', 'all-cards.json');
  }

  static getRawDataPath(game: string, filename: string): string {
    return path.join('tcg-data', game, 'raw', filename);
  }
}

