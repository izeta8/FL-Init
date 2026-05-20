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
    return JSON.parse(data) as HistoryEntry[];
  } catch (error) {
    console.error('Error reading history:', error);
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

export async function updateHistoryEntryStatus(id: string, status: 'success' | 'error'): Promise<void> {
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

export async function clearHistory(): Promise<void> {
  await saveHistory([]);
}
