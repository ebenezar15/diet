import type { SyncEntity } from '@/types';
import type { SyncRecord } from './merge';

export interface RemoteRow {
  entity: SyncEntity;
  record: SyncRecord;
}

/** Swappable sync backend. Supabase is the default implementation. */
export interface SyncBackend {
  readonly name: string;
  isConfigured(): boolean;
  currentUserId(): Promise<string | null>;
  signIn(email: string): Promise<void>;
  signOut(): Promise<void>;
  /** Fetch remote copies of specific records (for field-level merge before upsert). */
  fetch(entity: SyncEntity, ids: string[]): Promise<SyncRecord[]>;
  push(rows: RemoteRow[]): Promise<void>;
  /** Rows changed on the server since `cursor` (opaque); returns next cursor. */
  pull(cursor: string | null): Promise<{ rows: RemoteRow[]; cursor: string | null }>;
}
