import Database from 'better-sqlite3';
import * as path from 'path';
import * as fs from 'fs';
import * as crypto from 'crypto';

/**
 * Production-grade database for tracking downloads, preventing duplicates,
 * and enabling incremental updates
 */
export class DownloadDatabase {
  private db: Database.Database;

  constructor(dbPath: string = 'tcg-data/download-tracker.db') {
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL'); // Write-Ahead Logging for performance
    this.db.pragma('synchronous = NORMAL'); // Balance safety and speed
    this.db.pragma('cache_size = 10000'); // Increase cache
    this.db.pragma('temp_store = MEMORY'); // Use memory for temp storage
    
    this.initializeTables();
  }

  private initializeTables(): void {
    // Cards table - tracks all downloaded cards
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS cards (
        id TEXT PRIMARY KEY,
        game_id TEXT NOT NULL,
        name TEXT NOT NULL,
        checksum TEXT NOT NULL,
        downloaded_at INTEGER NOT NULL,
        last_updated INTEGER NOT NULL,
        version INTEGER DEFAULT 1,
        metadata TEXT
      );
      
      CREATE INDEX IF NOT EXISTS idx_cards_game ON cards(game_id);
      CREATE INDEX IF NOT EXISTS idx_cards_checksum ON cards(checksum);
      CREATE INDEX IF NOT EXISTS idx_cards_updated ON cards(last_updated);
    `);

    // Images table - tracks downloaded images with integrity checks
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS images (
        id TEXT PRIMARY KEY,
        card_id TEXT NOT NULL,
        size TEXT NOT NULL,
        url TEXT NOT NULL,
        file_path TEXT NOT NULL,
        checksum TEXT NOT NULL,
        file_size INTEGER NOT NULL,
        downloaded_at INTEGER NOT NULL,
        validated BOOLEAN DEFAULT 0,
        width INTEGER,
        height INTEGER,
        FOREIGN KEY (card_id) REFERENCES cards(id)
      );
      
      CREATE INDEX IF NOT EXISTS idx_images_card ON images(card_id);
      CREATE INDEX IF NOT EXISTS idx_images_checksum ON images(checksum);
      CREATE INDEX IF NOT EXISTS idx_images_validated ON images(validated);
    `);

    // Download sessions - track each download run
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS download_sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        game_id TEXT NOT NULL,
        started_at INTEGER NOT NULL,
        completed_at INTEGER,
        status TEXT DEFAULT 'running',
        cards_downloaded INTEGER DEFAULT 0,
        images_downloaded INTEGER DEFAULT 0,
        errors INTEGER DEFAULT 0,
        metadata TEXT
      );
      
      CREATE INDEX IF NOT EXISTS idx_sessions_game ON download_sessions(game_id);
      CREATE INDEX IF NOT EXISTS idx_sessions_status ON download_sessions(status);
    `);

    // API cache - cache API responses to prevent re-fetching
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS api_cache (
        key TEXT PRIMARY KEY,
        game_id TEXT NOT NULL,
        response TEXT NOT NULL,
        checksum TEXT NOT NULL,
        cached_at INTEGER NOT NULL,
        expires_at INTEGER NOT NULL,
        hit_count INTEGER DEFAULT 0
      );
      
      CREATE INDEX IF NOT EXISTS idx_cache_game ON api_cache(game_id);
      CREATE INDEX IF NOT EXISTS idx_cache_expires ON api_cache(expires_at);
    `);

    // Error log - track failures for retry
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS error_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id INTEGER,
        error_type TEXT NOT NULL,
        error_message TEXT NOT NULL,
        context TEXT,
        occurred_at INTEGER NOT NULL,
        resolved BOOLEAN DEFAULT 0,
        FOREIGN KEY (session_id) REFERENCES download_sessions(id)
      );
      
      CREATE INDEX IF NOT EXISTS idx_errors_session ON error_log(session_id);
      CREATE INDEX IF NOT EXISTS idx_errors_resolved ON error_log(resolved);
    `);

    // Performance metrics
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS performance_metrics (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id INTEGER,
        metric_type TEXT NOT NULL,
        metric_value REAL NOT NULL,
        recorded_at INTEGER NOT NULL,
        FOREIGN KEY (session_id) REFERENCES download_sessions(id)
      );
      
      CREATE INDEX IF NOT EXISTS idx_metrics_session ON performance_metrics(session_id);
      CREATE INDEX IF NOT EXISTS idx_metrics_type ON performance_metrics(metric_type);
    `);
  }

  // Card operations
  cardExists(cardId: string): boolean {
    const stmt = this.db.prepare('SELECT 1 FROM cards WHERE id = ?');
    return stmt.get(cardId) !== undefined;
  }

  getCard(cardId: string): any {
    const stmt = this.db.prepare('SELECT * FROM cards WHERE id = ?');
    return stmt.get(cardId);
  }

  hasCardChanged(cardId: string, newChecksum: string): boolean {
    const stmt = this.db.prepare('SELECT checksum FROM cards WHERE id = ?');
    const result = stmt.get(cardId) as any;
    return result ? result.checksum !== newChecksum : true;
  }

  upsertCard(card: {
    id: string;
    gameId: string;
    name: string;
    checksum: string;
    metadata?: any;
  }): void {
    const now = Date.now();
    const stmt = this.db.prepare(`
      INSERT INTO cards (id, game_id, name, checksum, downloaded_at, last_updated, metadata)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        checksum = excluded.checksum,
        last_updated = excluded.last_updated,
        version = version + 1,
        metadata = excluded.metadata
    `);

    stmt.run(
      card.id,
      card.gameId,
      card.name,
      card.checksum,
      now,
      now,
      card.metadata ? JSON.stringify(card.metadata) : null
    );
  }

  getCardsByGame(gameId: string): any[] {
    const stmt = this.db.prepare('SELECT * FROM cards WHERE game_id = ?');
    return stmt.all(gameId);
  }

  // Image operations
  imageExists(imageId: string): boolean {
    const stmt = this.db.prepare('SELECT 1 FROM images WHERE id = ?');
    return stmt.get(imageId) !== undefined;
  }

  getImage(imageId: string): any {
    const stmt = this.db.prepare('SELECT * FROM images WHERE id = ?');
    return stmt.get(imageId);
  }

  imageValidated(imageId: string): boolean {
    const stmt = this.db.prepare('SELECT validated FROM images WHERE id = ?');
    const result = stmt.get(imageId) as any;
    return result ? result.validated === 1 : false;
  }

  upsertImage(image: {
    id: string;
    cardId: string;
    size: string;
    url: string;
    filePath: string;
    checksum: string;
    fileSize: number;
    width?: number;
    height?: number;
  }): void {
    const now = Date.now();
    const stmt = this.db.prepare(`
      INSERT INTO images (id, card_id, size, url, file_path, checksum, file_size, downloaded_at, width, height)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        url = excluded.url,
        file_path = excluded.file_path,
        checksum = excluded.checksum,
        file_size = excluded.file_size,
        downloaded_at = excluded.downloaded_at,
        validated = 0,
        width = excluded.width,
        height = excluded.height
    `);

    stmt.run(
      image.id,
      image.cardId,
      image.size,
      image.url,
      image.filePath,
      image.checksum,
      image.fileSize,
      now,
      image.width || null,
      image.height || null
    );
  }

  markImageValidated(imageId: string, width: number, height: number): void {
    const stmt = this.db.prepare(`
      UPDATE images SET validated = 1, width = ?, height = ? WHERE id = ?
    `);
    stmt.run(width, height, imageId);
  }

  getUnvalidatedImages(limit: number = 100): any[] {
    const stmt = this.db.prepare(`
      SELECT * FROM images WHERE validated = 0 LIMIT ?
    `);
    return stmt.all(limit);
  }

  // Session operations
  startSession(gameId: string, metadata?: any): number {
    const stmt = this.db.prepare(`
      INSERT INTO download_sessions (game_id, started_at, metadata)
      VALUES (?, ?, ?)
    `);

    const result = stmt.run(
      gameId,
      Date.now(),
      metadata ? JSON.stringify(metadata) : null
    );

    return result.lastInsertRowid as number;
  }

  updateSession(sessionId: number, updates: {
    cardsDownloaded?: number;
    imagesDownloaded?: number;
    errors?: number;
  }): void {
    const fields = [];
    const values = [];

    if (updates.cardsDownloaded !== undefined) {
      fields.push('cards_downloaded = cards_downloaded + ?');
      values.push(updates.cardsDownloaded);
    }
    if (updates.imagesDownloaded !== undefined) {
      fields.push('images_downloaded = images_downloaded + ?');
      values.push(updates.imagesDownloaded);
    }
    if (updates.errors !== undefined) {
      fields.push('errors = errors + ?');
      values.push(updates.errors);
    }

    if (fields.length > 0) {
      const stmt = this.db.prepare(`
        UPDATE download_sessions SET ${fields.join(', ')} WHERE id = ?
      `);
      stmt.run(...values, sessionId);
    }
  }

  completeSession(sessionId: number, status: 'completed' | 'failed' | 'cancelled'): void {
    const stmt = this.db.prepare(`
      UPDATE download_sessions SET completed_at = ?, status = ? WHERE id = ?
    `);
    stmt.run(Date.now(), status, sessionId);
  }

  getSession(sessionId: number): any {
    const stmt = this.db.prepare('SELECT * FROM download_sessions WHERE id = ?');
    return stmt.get(sessionId);
  }

  getLastSession(gameId: string): any {
    const stmt = this.db.prepare(`
      SELECT * FROM download_sessions 
      WHERE game_id = ? 
      ORDER BY started_at DESC 
      LIMIT 1
    `);
    return stmt.get(gameId);
  }

  // API cache operations
  getCachedResponse(key: string): string | null {
    const stmt = this.db.prepare(`
      SELECT response FROM api_cache 
      WHERE key = ? AND expires_at > ?
    `);
    
    const result = stmt.get(key, Date.now()) as any;
    
    if (result) {
      // Update hit count
      this.db.prepare('UPDATE api_cache SET hit_count = hit_count + 1 WHERE key = ?').run(key);
      return result.response;
    }
    
    return null;
  }

  cacheResponse(key: string, gameId: string, response: string, ttlSeconds: number = 3600): void {
    const checksum = crypto.createHash('md5').update(response).digest('hex');
    const now = Date.now();
    const expiresAt = now + (ttlSeconds * 1000);

    const stmt = this.db.prepare(`
      INSERT INTO api_cache (key, game_id, response, checksum, cached_at, expires_at)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET
        response = excluded.response,
        checksum = excluded.checksum,
        cached_at = excluded.cached_at,
        expires_at = excluded.expires_at,
        hit_count = 0
    `);

    stmt.run(key, gameId, response, checksum, now, expiresAt);
  }

  clearExpiredCache(): number {
    const stmt = this.db.prepare('DELETE FROM api_cache WHERE expires_at < ?');
    const result = stmt.run(Date.now());
    return result.changes;
  }

  // Error logging
  logError(sessionId: number, errorType: string, errorMessage: string, context?: any): void {
    const stmt = this.db.prepare(`
      INSERT INTO error_log (session_id, error_type, error_message, context, occurred_at)
      VALUES (?, ?, ?, ?, ?)
    `);

    stmt.run(
      sessionId,
      errorType,
      errorMessage,
      context ? JSON.stringify(context) : null,
      Date.now()
    );
  }

  getUnresolvedErrors(sessionId?: number): any[] {
    let stmt;
    if (sessionId) {
      stmt = this.db.prepare(`
        SELECT * FROM error_log WHERE session_id = ? AND resolved = 0
      `);
      return stmt.all(sessionId);
    } else {
      stmt = this.db.prepare('SELECT * FROM error_log WHERE resolved = 0');
      return stmt.all();
    }
  }

  markErrorResolved(errorId: number): void {
    const stmt = this.db.prepare('UPDATE error_log SET resolved = 1 WHERE id = ?');
    stmt.run(errorId);
  }

  // Performance metrics
  recordMetric(sessionId: number, metricType: string, value: number): void {
    const stmt = this.db.prepare(`
      INSERT INTO performance_metrics (session_id, metric_type, metric_value, recorded_at)
      VALUES (?, ?, ?, ?)
    `);
    stmt.run(sessionId, metricType, value, Date.now());
  }

  getMetrics(sessionId: number, metricType?: string): any[] {
    let stmt;
    if (metricType) {
      stmt = this.db.prepare(`
        SELECT * FROM performance_metrics 
        WHERE session_id = ? AND metric_type = ?
        ORDER BY recorded_at
      `);
      return stmt.all(sessionId, metricType);
    } else {
      stmt = this.db.prepare(`
        SELECT * FROM performance_metrics 
        WHERE session_id = ?
        ORDER BY recorded_at
      `);
      return stmt.all(sessionId);
    }
  }

  // Statistics
  getStats(gameId?: string): any {
    if (gameId) {
      const stmt = this.db.prepare(`
        SELECT 
          COUNT(*) as total_cards,
          COUNT(DISTINCT game_id) as games,
          (SELECT COUNT(*) FROM images WHERE card_id IN (SELECT id FROM cards WHERE game_id = ?)) as total_images,
          (SELECT COUNT(*) FROM images WHERE validated = 1 AND card_id IN (SELECT id FROM cards WHERE game_id = ?)) as validated_images
        FROM cards WHERE game_id = ?
      `);
      return stmt.get(gameId, gameId, gameId);
    } else {
      const stmt = this.db.prepare(`
        SELECT 
          COUNT(*) as total_cards,
          COUNT(DISTINCT game_id) as games,
          (SELECT COUNT(*) FROM images) as total_images,
          (SELECT COUNT(*) FROM images WHERE validated = 1) as validated_images,
          (SELECT COUNT(*) FROM download_sessions WHERE status = 'completed') as completed_sessions,
          (SELECT COUNT(*) FROM error_log WHERE resolved = 0) as unresolved_errors
        FROM cards
      `);
      return stmt.get();
    }
  }

  // Maintenance
  vacuum(): void {
    this.db.exec('VACUUM');
  }

  analyze(): void {
    this.db.exec('ANALYZE');
  }

  close(): void {
    this.clearExpiredCache();
    this.analyze();
    this.db.close();
  }

  // Transaction support
  transaction<T>(fn: () => T): T {
    const transaction = this.db.transaction(fn);
    return transaction();
  }
}

