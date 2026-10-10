import { invoke } from '@tauri-apps/api/core';
import type { DictionaryEntry, BookmarkEntry, BookMark,BookmarkMeta } from '../../types/global';

// ==================== FS ====================
export const fsApi = {
    mkdir: (dir: string) => invoke<boolean>('fs_mkdir', { dir }),
    readDir: (dir: string) =>
        invoke<string[]>('fs_read_dir', { dir }).catch(() => false as const),
    write: (filePath: string, data: string) =>
        invoke<boolean>('fs_write', { filePath, data: typeof data === 'string' ? data : JSON.stringify(data) }),
    read: (filePath: string) =>
        invoke<any>('fs_read', { filePath }).catch(() => false as const),
    delete: (filePath: string) => invoke<boolean>('fs_delete', { filePath }),
    exists: (filePath: string) => invoke<boolean>('fs_exists', { filePath }),
    rename: (oldPath: string, newPath: string) =>
        invoke<boolean>('fs_rename', { oldPath, newPath }),
    trash: (filePath: string) => invoke<boolean>('fs_trash', { filePath }),
    homedir: () => invoke<string>('fs_homedir'),
    downloads: () => invoke<string>('fs_downloads'),
    temp: () => invoke<string>('fs_temp'),

    // Pure helpers — no IPC needed
    join: (...parts: string[]) => parts.filter(Boolean).join('/').replace(/\/+/g, '/'),
    basename: (p: string, ext?: string) => {
        const base = p.split(/[\\/]/).pop() ?? '';
        return ext && base.endsWith(ext) ? base.slice(0, -ext.length) : base;
    },
    extname: (p: string) => {
        const base = p.split(/[\\/]/).pop() ?? '';
        const dot = base.lastIndexOf('.');
        return dot > 0 ? base.slice(dot) : '';
    },
    dirname: (p: string) => {
        const parts = p.split(/[\\/]/);
        parts.pop();
        return parts.join('/') || '/';
    },
    stat: async (p: string) => ({ size: await invoke<number>('fs_stat_size', { filePath: p }) }),
};

// ==================== BOOKMARKS ====================
export const bookmarksApi = {
    readAll: (filePath?: string) =>
    invoke<BookMark>("bookmarks_read_all", { filePath }).catch(
        () => false as const
    ),

    readMeta: (filePath?: string) =>
    invoke<BookmarkMeta>("bookmarks_read_meta", { filePath }).catch(
        () => false as const
    ),

    readBookmarks: (filePath?: string) =>
    invoke<{ bookmarks: BookmarkEntry[] }>("bookmarks_read_bookmarks", {
        filePath,
    })
    .then((res) => res.bookmarks)
    .catch((e) => e),

    update: (bookmark: BookmarkEntry[], filePath?: string) =>
    invoke<{ bookmarks: BookmarkEntry[]; metadata: BookmarkMeta }>(
        "bookmarks_replace",
        { bookmark, filePath }
    ).catch(() => false as const),

    add: (phrase: string, filePath?: string) =>
    invoke<{ bookmarks: BookmarkEntry[] }>("bookmarks_add", {
        phrase,
        filePath,
    })
    .then((res) => res.bookmarks)
    .catch(() => false as const),

    deleteByPhrase: (phrase: string, filePath?: string) =>
    invoke<{ bookmarks: BookmarkEntry[] }>("bookmarks_delete_by_phrase", {
        phrase,
        filePath,
    })
    .then((res) => res.bookmarks)
    .catch(() => false as const),

    delete: (bookmarkId: string, filePath?: string) =>
    invoke<boolean>("bookmarks_delete", { bookmarkId, filePath }).catch(
        () => false as const
    ),
};


// ==================== CONTENT ====================
export const dictionaryApi = {
    // read: (filename: string) =>
    //     invoke<object>('content_read', { filename }).catch(() => false as const),
    // list: (subdir: string = '') =>
    //     invoke<string[]>('content_list', { subdir }).catch(() => []),
    getHint: async (word: string) =>
        invoke<[hintMatch: string]>('dictionary_hint', { word }).catch(
            (e) => e,
        ),
    searchWord: async (query: string) =>
        invoke<DictionaryEntry>('dictionary_search', { query }).catch(
            (e) => e,
        ),
};

// ==================== SYSTEM ====================
export const systemApi = {
    platform: navigator.platform.toLowerCase().includes('win')
        ? 'win32'
        : navigator.platform.toLowerCase().includes('mac')
            ? 'darwin'
            : 'linux',

    homedir: fsApi.homedir,   // async — matches old API surface
    downloads: fsApi.downloads,
    temp: fsApi.temp,

    formatDate: async (isoString: string): Promise<string> =>
        new Date(isoString).toLocaleDateString(undefined, {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
        }),

    isDev: () => invoke<boolean>('get_dev_status'),
    appVersion: () => invoke<string>('get_app_version'),
};


export const sage = {
    fs: fsApi,
    bookmarks: bookmarksApi,
    dict: dictionaryApi,
    system: systemApi,
};
