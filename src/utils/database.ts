// IndexedDB wrapper for Kensho AI data storage
export interface UserPreferences {
  id: string;
  destination: string;
  movie: string;
  artist: string;
  author: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Recommendation {
  id: string;
  name: string;
  category: string;
  image: string;
  insight: string;
  segment: 'dine' | 'listen' | 'see' | 'explore';
  website?: string;
  x?: number;
  y?: number;
  latitude?: number;
  longitude?: number;
  cost?: string;
  duration?: string;
  recommendedTime?: string;
  createdAt: Date;
}

export interface ItineraryItem extends Recommendation {
  day: number;
  notes: string;
  order: number;
  addedAt: Date;
}

export interface UserSession {
  id: string;
  isGenerated: boolean;
  lastActivity: Date;
}

class KenshoDatabase {
  private dbName = 'KenshoAI';
  private version = 1;
  private db: IDBDatabase | null = null;

  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // User preferences store
        if (!db.objectStoreNames.contains('preferences')) {
          const preferencesStore = db.createObjectStore('preferences', { keyPath: 'id' });
          preferencesStore.createIndex('updatedAt', 'updatedAt', { unique: false });
        }

        // Recommendations store
        if (!db.objectStoreNames.contains('recommendations')) {
          const recommendationsStore = db.createObjectStore('recommendations', { keyPath: 'id' });
          recommendationsStore.createIndex('createdAt', 'createdAt', { unique: false });
          recommendationsStore.createIndex('segment', 'segment', { unique: false });
        }

        // Itinerary store
        if (!db.objectStoreNames.contains('itinerary')) {
          const itineraryStore = db.createObjectStore('itinerary', { keyPath: 'id' });
          itineraryStore.createIndex('day', 'day', { unique: false });
          itineraryStore.createIndex('addedAt', 'addedAt', { unique: false });
          itineraryStore.createIndex('order', 'order', { unique: false });
        }

        // Session store
        if (!db.objectStoreNames.contains('session')) {
          const sessionStore = db.createObjectStore('session', { keyPath: 'id' });
          sessionStore.createIndex('lastActivity', 'lastActivity', { unique: false });
        }
      };
    });
  }

  private async ensureDB(): Promise<IDBDatabase> {
    if (!this.db) {
      await this.init();
    }
    return this.db!;
  }

  // User Preferences Methods
  async saveUserPreferences(preferences: Omit<UserPreferences, 'id' | 'createdAt' | 'updatedAt'>): Promise<void> {
    const db = await this.ensureDB();
    const transaction = db.transaction(['preferences'], 'readwrite');
    const store = transaction.objectStore('preferences');

    const existing = await this.getUserPreferences();
    const now = new Date();

    const data: UserPreferences = {
      id: 'user-preferences',
      ...preferences,
      createdAt: existing?.createdAt || now,
      updatedAt: now
    };

    return new Promise((resolve, reject) => {
      const request = store.put(data);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getUserPreferences(): Promise<UserPreferences | null> {
    const db = await this.ensureDB();
    const transaction = db.transaction(['preferences'], 'readonly');
    const store = transaction.objectStore('preferences');

    return new Promise((resolve, reject) => {
      const request = store.get('user-preferences');
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  async clearUserPreferences(): Promise<void> {
    const db = await this.ensureDB();
    const transaction = db.transaction(['preferences'], 'readwrite');
    const store = transaction.objectStore('preferences');

    return new Promise((resolve, reject) => {
      const request = store.delete('user-preferences');
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // Recommendations Methods
  async saveRecommendations(recommendations: Omit<Recommendation, 'createdAt'>[]): Promise<void> {
    const db = await this.ensureDB();
    const transaction = db.transaction(['recommendations'], 'readwrite');
    const store = transaction.objectStore('recommendations');

    return new Promise((resolve, reject) => {
      // Handle transaction completion
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(new Error('Transaction aborted'));

      // Clear existing recommendations first
      const clearRequest = store.clear();
      
      clearRequest.onsuccess = () => {
        // Add new recommendations after clear completes
        const now = new Date();
        recommendations.forEach(rec => {
          const data: Recommendation = { ...rec, createdAt: now };
          store.add(data);
        });
      };
      
      clearRequest.onerror = () => reject(clearRequest.error);
    });
  }

  async getRecommendations(): Promise<Recommendation[]> {
    const db = await this.ensureDB();
    const transaction = db.transaction(['recommendations'], 'readonly');
    const store = transaction.objectStore('recommendations');

    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  async clearRecommendations(): Promise<void> {
    const db = await this.ensureDB();
    const transaction = db.transaction(['recommendations'], 'readwrite');
    const store = transaction.objectStore('recommendations');

    return new Promise((resolve, reject) => {
      const request = store.clear();
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // Itinerary Methods
  async addToItinerary(item: Omit<ItineraryItem, 'addedAt'>): Promise<void> {
    const db = await this.ensureDB();
    const transaction = db.transaction(['itinerary'], 'readwrite');
    const store = transaction.objectStore('itinerary');

    const data: ItineraryItem = { ...item, addedAt: new Date() };

    return new Promise((resolve, reject) => {
      const request = store.put(data);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getItinerary(): Promise<ItineraryItem[]> {
    const db = await this.ensureDB();
    const transaction = db.transaction(['itinerary'], 'readonly');
    const store = transaction.objectStore('itinerary');

    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => {
        const items = request.result || [];
        // Sort by day, then by order
        items.sort((a, b) => a.day - b.day || a.order - b.order);
        resolve(items);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async removeFromItinerary(id: string): Promise<void> {
    const db = await this.ensureDB();
    const transaction = db.transaction(['itinerary'], 'readwrite');
    const store = transaction.objectStore('itinerary');

    return new Promise((resolve, reject) => {
      const request = store.delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async updateItineraryItem(id: string, updates: Partial<ItineraryItem>): Promise<void> {
    const db = await this.ensureDB();
    const transaction = db.transaction(['itinerary'], 'readwrite');
    const store = transaction.objectStore('itinerary');

    return new Promise((resolve, reject) => {
      const getRequest = store.get(id);
      getRequest.onsuccess = () => {
        const item = getRequest.result;
        if (item) {
          const updatedItem = { ...item, ...updates };
          const putRequest = store.put(updatedItem);
          putRequest.onsuccess = () => resolve();
          putRequest.onerror = () => reject(putRequest.error);
        } else {
          reject(new Error('Item not found'));
        }
      };
      getRequest.onerror = () => reject(getRequest.error);
    });
  }

  async clearItinerary(): Promise<void> {
    const db = await this.ensureDB();
    const transaction = db.transaction(['itinerary'], 'readwrite');
    const store = transaction.objectStore('itinerary');

    return new Promise((resolve, reject) => {
      const request = store.clear();
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // Session Methods
  async saveSession(session: Omit<UserSession, 'id' | 'lastActivity'>): Promise<void> {
    const db = await this.ensureDB();
    const transaction = db.transaction(['session'], 'readwrite');
    const store = transaction.objectStore('session');

    const data: UserSession = {
      id: 'current-session',
      ...session,
      lastActivity: new Date()
    };

    return new Promise((resolve, reject) => {
      const request = store.put(data);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getSession(): Promise<UserSession | null> {
    const db = await this.ensureDB();
    const transaction = db.transaction(['session'], 'readonly');
    const store = transaction.objectStore('session');

    return new Promise((resolve, reject) => {
      const request = store.get('current-session');
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  async clearSession(): Promise<void> {
    const db = await this.ensureDB();
    const transaction = db.transaction(['session'], 'readwrite');
    const store = transaction.objectStore('session');

    return new Promise((resolve, reject) => {
      const request = store.delete('current-session');
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // Utility Methods
  async clearAllData(): Promise<void> {
    await Promise.all([
      this.clearUserPreferences(),
      this.clearRecommendations(),
      this.clearItinerary(),
      this.clearSession()
    ]);
  }

  async exportData(): Promise<{
    preferences: UserPreferences | null;
    recommendations: Recommendation[];
    itinerary: ItineraryItem[];
    session: UserSession | null;
  }> {
    const [preferences, recommendations, itinerary, session] = await Promise.all([
      this.getUserPreferences(),
      this.getRecommendations(),
      this.getItinerary(),
      this.getSession()
    ]);

    return { preferences, recommendations, itinerary, session };
  }

  async getStorageStats(): Promise<{
    preferencesCount: number;
    recommendationsCount: number;
    itineraryCount: number;
    sessionExists: boolean;
  }> {
    const [preferences, recommendations, itinerary, session] = await Promise.all([
      this.getUserPreferences(),
      this.getRecommendations(),
      this.getItinerary(),
      this.getSession()
    ]);

    return {
      preferencesCount: preferences ? 1 : 0,
      recommendationsCount: recommendations.length,
      itineraryCount: itinerary.length,
      sessionExists: !!session
    };
  }
}

// Create singleton instance
export const kenshoDb = new KenshoDatabase();

// Initialize database on module load
kenshoDb.init().catch(console.error);