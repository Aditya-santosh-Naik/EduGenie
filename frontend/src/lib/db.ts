import Dexie, { type Table } from 'dexie';

export interface Flashcard {
  id?: number;
  front: string;
  back: string;
  topic: string;
  createdAt: number;
  interval: number;
  repetition: number;
  easeFactor: number;
  nextReview: number;
}

export interface OfflineCache {
  id?: number;
  topic: string;
  mode: string;
  level: string;
  response: string; // Storing as JSON string
  savedAt: number;
}

export interface GraphNode {
  id: string;
  topic: string;
  masteryScore: number;
  studiedAt: Date;
}

export interface GraphEdge {
  id?: number;
  source: string;
  target: string;
  type: 'prerequisite' | 'related';
}

export class EdugenieDB extends Dexie {
  flashcards!: Table<Flashcard, number>;
  offlineCache!: Table<OfflineCache, number>;
  graphNodes!: Table<GraphNode, string>;
  graphEdges!: Table<GraphEdge, number>;

  constructor() {
    super('EdugenieDB');
    this.version(1).stores({
      flashcards: '++id, topic, createdAt'
    });
    this.version(2).stores({
      offlineCache: '++id, topic, [topic+mode+level], savedAt'
    });
    this.version(3).stores({
      graphNodes: 'id, topic, masteryScore, studiedAt',
      graphEdges: '++id, source, target, [source+target]'
    });
    this.version(4).stores({
      flashcards: '++id, topic, createdAt, nextReview'
    });
  }
}

export const db = new EdugenieDB();
