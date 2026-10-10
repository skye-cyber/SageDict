import { BookmarkEntry } from "../../types/global";

enum ThemeType {
    dark = 'dark',
    light = 'light'
}

// ChatItem Active state lock
interface chatLock {
    id: string
    locked: boolean
}

// Define your state shape
interface AppState {
    bookmarks: BookmarkEntry[]
}

type Listener<T> = (value: T | undefined, oldValue?: T) => void;

class TypedStateManager {
    private state: Map<string, unknown> = new Map();
    private listeners: Map<string, Array<Listener<unknown>>> = new Map();

    set<K extends keyof AppState>(key: K, value: AppState[K]): void;
    set(key: string, value: unknown): void;
    set(key: string, value: unknown): void {
        const oldValue = this.state.get(key);
        this.state.set(key, value);

        const keyListeners = this.listeners.get(key);
        if (keyListeners) {
            keyListeners.forEach(fn => fn(value, oldValue));
        }
    }

    get<K extends keyof AppState>(key: K): AppState[K] | undefined;
    get(key: string): unknown;
    get(key: string): unknown {
        return this.state.get(key);
    }

    has(key: string): boolean {
        return this.state.has(key);
    }

    subscribe<T>(key: string, callback: Listener<T>): () => void {
        if (!this.listeners.has(key)) {
            this.listeners.set(key, []);
        }
        this.listeners.get(key)!.push(callback as Listener<unknown>);

        return () => {
            const keyListeners = this.listeners.get(key);
            if (keyListeners) {
                const filtered = keyListeners.filter(fn => fn !== callback);
                if (filtered.length === 0) {
                    this.listeners.delete(key);
                } else {
                    this.listeners.set(key, filtered);
                }
            }
        };
    }

    unset(key: string): void {
        const oldValue = this.state.get(key);
        if (this.state.delete(key)) {
            const keyListeners = this.listeners.get(key);
            if (keyListeners) {
                keyListeners.forEach(fn => fn(undefined, oldValue));
            }
        }
    }

    reset(): void {
        // Notify all listeners
        this.listeners.forEach((listeners, key) => {
            const oldValue = this.state.get(key);
            listeners.forEach(fn => fn(undefined, oldValue));
        });

        this.state.clear();
        this.listeners.clear();
    }

    getAll(): Record<string, unknown> {
        return Object.fromEntries(this.state);
    }

    clear(key: string): void {
        this.unset(key);
    }

    update<T>(key: string, updater: T | ((oldValue: T | undefined) => T)): void {
        const oldValue = this.get(key) as T | undefined;
        const newValue = typeof updater === 'function'
            ? (updater as (oldValue: T | undefined) => T)(oldValue)
            : updater;
        this.set(key, newValue);
    }
}

export const StateManager = new TypedStateManager();
