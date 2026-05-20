import fs from 'fs';
import path from 'path';
import { APPDATA_PATH } from './config-manager';
import { HistoryEntry } from '../shared/types';

const HISTORY_PATH = path.join(APPDATA_PATH, 'history.json');

function ensureHistoryExists(): void {
  if (!fs.existsSync(HISTORY_PATH)) {
    fs.writeFileSync(HISTORY_PATH, JSON.stringify([], null, 2), 'utf8');
  }
}

export async function getHistory(): Promise<HistoryEntry[]> {
  try {
    ensureHistoryExists();
    const data = await fs.promises.readFile(HISTORY_PATH, 'utf8');
    if (!data || data.trim() === '') {
      await saveHistory([]);
      return [];
    }
    return JSON.parse(data) as HistoryEntry[];
  } catch (error) {
    console.error('Error reading history:', error);
    if (error instanceof SyntaxError) {
      console.log('Self-healing: rewriting corrupted history file to empty array.');
      await saveHistory([]);
    }
    return [];
  }
}

export async function saveHistory(history: HistoryEntry[]): Promise<void> {
  try {
    ensureHistoryExists();
    const jsonHistory = JSON.stringify(history, null, 2);
    await fs.promises.writeFile(HISTORY_PATH, jsonHistory, 'utf8');
  } catch (error) {
    console.error('Error saving history:', error);
  }
}

export async function addHistoryEntry(entry: HistoryEntry): Promise<void> {
  const history = await getHistory();
  const index = history.findIndex(h => h.id === entry.id);
  if (index !== -1) {
    history[index] = entry;
  } else {
    // Add new entries to the front so newest downloads show first
    history.unshift(entry);
  }
  await saveHistory(history);
}

export async function updateHistoryEntryStatus(id: string, status: 'success' | 'error' | 'cancelled'): Promise<void> {
  const history = await getHistory();
  const index = history.findIndex(h => h.id === id);
  if (index !== -1) {
    history[index].status = status;
    await saveHistory(history);
  }
}

export async function deleteHistoryEntry(id: string): Promise<void> {
  const history = await getHistory();
  const updatedHistory = history.filter(h => h.id !== id);
  await saveHistory(updatedHistory);
}

export async function updateHistoryEntryVideoName(id: string, videoName: string): Promise<void> {
  const history = await getHistory();
  const index = history.findIndex(h => h.id === id);
  if (index !== -1) {
    history[index].videoName = videoName;
    await saveHistory(history);
  }
}

export async function clearHistory(): Promise<void> {
  await saveHistory([]);
}

export function cleanRunningHistorySync(): void {
  try {
    ensureHistoryExists();
    const data = fs.readFileSync(HISTORY_PATH, 'utf8');
    if (!data || data.trim() === '') {
      fs.writeFileSync(HISTORY_PATH, JSON.stringify([], null, 2), 'utf8');
      return;
    }
    const history = JSON.parse(data) as HistoryEntry[];
    let updated = false;
    for (const entry of history) {
      if (entry.status === 'running') {
        entry.status = 'cancelled';
        updated = true;
      }
    }
    if (updated) {
      fs.writeFileSync(HISTORY_PATH, JSON.stringify(history, null, 2), 'utf8');
    }
  } catch (error) {
    console.error('Error cleaning running history synchronously:', error);
    if (error instanceof SyntaxError) {
      console.log('Self-healing: rewriting corrupted history file to empty array synchronously.');
      try {
        fs.writeFileSync(HISTORY_PATH, JSON.stringify([], null, 2), 'utf8');
      } catch (writeErr) {
        console.error('Failed to self-heal history file:', writeErr);
      }
    }
  }
}
