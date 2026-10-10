use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::{AppHandle, Manager, State};

// ---------------------------------------------------------------------------
// Types matching the JS side
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BookmarkEntry {
    pub id: String,
    pub phrase: String,
    pub added_at: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub notes: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BookmarkMeta {
    pub created_at: String,
    pub update_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Bookmark {
    pub metadata: BookmarkMeta,
    pub bookmarks: Vec<BookmarkEntry>,
}

// ---------------------------------------------------------------------------
// DB state
// ---------------------------------------------------------------------------

pub struct UserDb(pub Mutex<Connection>);

/// Where the seed `user.sqlite` ships from.
/// - dev:  `src-tauri/../src/assets/user.sqlite` (mutable in place; you probably
///         want to keep dev working against this file directly)
/// - prod: `$RESOURCE/assets/user.sqlite`
fn user_db_seed_path(app: &AppHandle) -> PathBuf {
    if cfg!(debug_assertions) {
        PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../src/assets/user.sqlite")
    } else {
        app.path()
            .app_data_dir()
            .unwrap_or_default()
            .join("user.sqlite")
    }
}

/// Where the working `user.sqlite` lives at runtime.
fn user_db_runtime_path(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app
    .path()
    .app_data_dir()
    .map_err(|e| format!("app_data_dir: {e}"))?;
    std::fs::create_dir_all(&dir)
    .map_err(|e| format!("create_dir_all({dir:?}): {e}"))?;
    Ok(dir.join("user.sqlite"))
}

/// Ensure a writable `user.sqlite` exists in the app data dir.
///
/// - First run: copy the bundled seed into place.
/// - Subsequent runs: leave the existing file alone (it holds user data).
/// - If the seed is missing entirely, create an empty schema-only DB instead,
///   so the app still works on a machine where the seed was not bundled.
pub fn ensure_user_db(app: &AppHandle) -> Result<PathBuf, String> {
    // In dev, work directly against the source file so DB changes survive
    // restarts and you can inspect it with `sqlite3` without hunting in
    // `~/.local/share`.
    if cfg!(debug_assertions) {
        let dev_path = user_db_seed_path(app);
        if !dev_path.exists() {
            // Create it if missing — bookmarks module will create the schema.
            if let Some(parent) = dev_path.parent() {
                std::fs::create_dir_all(parent)
                .map_err(|e| format!("create_dir_all({parent:?}): {e}"))?;
            }
            let _ = rusqlite::Connection::open(&dev_path);
        }
        return Ok(dev_path);
    }

    let target = user_db_runtime_path(app)?;
    if target.exists() {
        return Ok(target);
    }

    let seed = user_db_seed_path(app);
    if seed.exists() {
        eprintln!("[user] seeding {seed:?} -> {target:?}");
        std::fs::copy(&seed, &target)
        .map_err(|e| format!("copy {seed:?} -> {target:?}: {e}"))?;
    } else {
        eprintln!("[user] no seed at {seed:?}, creating empty {target:?}");
        // Create the file so the caller can open it; schema is applied
        // by init_user_db below.
        let _ = rusqlite::Connection::open(&target)
        .map_err(|e| format!("create {target:?}: {e}"))?;
    }

    Ok(target)
}

pub fn init_user_db(app: &AppHandle) -> rusqlite::Result<UserDb> {
    let path = user_db_seed_path(app);
    if let Some(parent) = path.parent() {
        let _ = std::fs::create_dir_all(parent);
    }
    let conn = Connection::open(&path)?;
    conn.pragma_update(None, "journal_mode", "WAL")?;
    conn.pragma_update(None, "synchronous", "NORMAL")?;
    conn.pragma_update(None, "foreign_keys", "ON")?;
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS bookmark_meta (
             id         INTEGER PRIMARY KEY CHECK (id = 1),
             created_at TEXT NOT NULL,
             update_at  TEXT
         );
         CREATE TABLE IF NOT EXISTS bookmarks (
             id       TEXT PRIMARY KEY,
             phrase   TEXT NOT NULL UNIQUE,
             added_at TEXT NOT NULL,
             notes    TEXT
         );
         CREATE INDEX IF NOT EXISTS idx_bookmarks_added_at
             ON bookmarks(added_at DESC);",
    )?;
    Ok(UserDb(Mutex::new(conn)))
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

fn now_iso() -> String {
    // If you already depend on chrono, use Utc::now().to_rfc3339().
    // Otherwise shell out to a tiny formatter:
    use std::time::{SystemTime, UNIX_EPOCH};
    let secs = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);
    // You almost certainly already have a date formatter in your project;
    // plug it in here. Format below is a fallback only.
    format!("{}", secs)
}

fn ensure_meta(conn: &Connection) -> rusqlite::Result<BookmarkMeta> {
    let row: Option<(String, Option<String>)> = conn
        .query_row(
            "SELECT created_at, update_at FROM bookmark_meta WHERE id = 1",
            [],
            |r| Ok((r.get(0)?, r.get(1)?)),
        )
        .optional()?;

    if let Some((created_at, update_at)) = row {
        return Ok(BookmarkMeta { created_at, update_at });
    }

    let created = now_iso();
    conn.execute(
        "INSERT INTO bookmark_meta(id, created_at, update_at) VALUES (1, ?1, NULL)",
        params![created],
    )?;
    Ok(BookmarkMeta {
        created_at: created,
        update_at: None,
    })
}

fn touch_meta(conn: &Connection) -> rusqlite::Result<()> {
    conn.execute(
        "UPDATE bookmark_meta SET update_at = ?1 WHERE id = 1",
        params![now_iso()],
    )?;
    Ok(())
}

fn read_all(conn: &Connection) -> rusqlite::Result<Bookmark> {
    let metadata = ensure_meta(conn)?;
    let mut stmt = conn.prepare(
        "SELECT id, phrase, added_at, notes FROM bookmarks ORDER BY added_at DESC",
    )?;
    let bookmarks = stmt
        .query_map([], |r| {
            Ok(BookmarkEntry {
                id: r.get(0)?,
                phrase: r.get(1)?,
                added_at: r.get(2)?,
                notes: r.get(3)?,
            })
        })?
        .collect::<rusqlite::Result<Vec<_>>>()?;
    Ok(Bookmark { metadata, bookmarks })
}

// ---------------------------------------------------------------------------
// Commands — mirror the existing JS API one-for-one
// ---------------------------------------------------------------------------

/// Return the full { metadata, bookmarks } object. Same as reading the file.
#[tauri::command]
pub fn bookmarks_read_all(db: State<'_, UserDb>) -> Result<Value, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let data = read_all(&conn).map_err(|e| e.to_string())?;
    serde_json::to_value(data).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn bookmarks_read_meta(db: State<'_, UserDb>) -> Result<Value, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let meta = ensure_meta(&conn).map_err(|e| e.to_string())?;
    serde_json::to_value(meta).map_err(|e| e.to_string())
}

/// Return just the bookmarks array. Preserves the old function signature.
#[tauri::command]
pub fn bookmarks_read_bookmarks(db: State<'_, UserDb>) -> Result<Value, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let data = read_all(&conn).map_err(|e| e.to_string())?;
    Ok(json!({ "bookmarks": data.bookmarks }))
}

/// Replace the entire bookmark list (matches `updateBookmark`).
/// Each incoming entry must have a `phrase`; `id` and `added_at` are
/// generated server-side if missing.
#[tauri::command]
pub fn bookmarks_replace(
    db: State<'_, UserDb>,
    bookmark: Vec<BookmarkEntry>,
) -> Result<Value, String> {
    let mut conn = db.0.lock().map_err(|e| e.to_string())?;
    let tx = conn.transaction().map_err(|e| e.to_string())?;

    ensure_meta(&tx).map_err(|e| e.to_string())?;
    tx.execute("DELETE FROM bookmarks", []).map_err(|e| e.to_string())?;

    for b in &bookmark {
        let id = if b.id.is_empty() {
            format!("bm_{}", now_iso())
        } else {
            b.id.clone()
        };
        let added_at = if b.added_at.is_empty() {
            now_iso()
        } else {
            b.added_at.clone()
        };
        tx.execute(
            "INSERT OR REPLACE INTO bookmarks(id, phrase, added_at, notes)
             VALUES (?1, ?2, ?3, ?4)",
            params![id, b.phrase, added_at, b.notes],
        )
        .map_err(|e| e.to_string())?;
    }

    touch_meta(&tx).map_err(|e| e.to_string())?;
    tx.commit().map_err(|e| e.to_string())?;

    let data = read_all(&conn).map_err(|e| e.to_string())?;
    Ok(json!({ "bookmarks": data.bookmarks, "metadata": data.metadata }))
}

/// Add one bookmark by phrase. Matches `addBookmarkItem`.
/// Returns the new array of bookmarks.
#[tauri::command]
pub fn bookmarks_add(
    db: State<'_, UserDb>,
    phrase: String,
) -> Result<Value, String> {
    let trimmed = phrase.trim();
    if trimmed.is_empty() {
        return Err("phrase is empty".into());
    }

    let mut conn = db.0.lock().map_err(|e| e.to_string())?;
    let tx = conn.transaction().map_err(|e| e.to_string())?;

    ensure_meta(&tx).map_err(|e| e.to_string())?;

    let exists: Option<String> = tx
        .query_row(
            "SELECT id FROM bookmarks WHERE phrase = ?1",
            params![trimmed],
            |r| r.get(0),
        )
        .optional()
        .map_err(|e| e.to_string())?;

    if exists.is_none() {
        tx.execute(
            "INSERT INTO bookmarks(id, phrase, added_at, notes)
             VALUES (?1, ?2, ?3, NULL)",
            params![format!("bm_{}", now_iso()), trimmed, now_iso()],
        )
        .map_err(|e| e.to_string())?;
        touch_meta(&tx).map_err(|e| e.to_string())?;
    }

    tx.commit().map_err(|e| e.to_string())?;

    let data = read_all(&conn).map_err(|e| e.to_string())?;
    Ok(json!({ "bookmarks": data.bookmarks }))
}

/// Delete a bookmark by id. Matches `bookmarks_delete`.
/// Returns true if a row was removed.
#[tauri::command]
pub fn bookmarks_delete(
    db: State<'_, UserDb>,
    bookmark_id: String,
) -> Result<bool, String> {
    let mut conn = db.0.lock().map_err(|e| e.to_string())?;
    let tx = conn.transaction().map_err(|e| e.to_string())?;

    ensure_meta(&tx).map_err(|e| e.to_string())?;
    let removed = tx
        .execute("DELETE FROM bookmarks WHERE id = ?1", params![bookmark_id])
        .map_err(|e| e.to_string())?;

    if removed > 0 {
        touch_meta(&tx).map_err(|e| e.to_string())?;
    }
    tx.commit().map_err(|e| e.to_string())?;
    Ok(removed > 0)
}

/// Delete by phrase (what `deleteBookmarkItem` actually does today).
#[tauri::command]
pub fn bookmarks_delete_by_phrase(
    db: State<'_, UserDb>,
    phrase: String,
) -> Result<Value, String> {
    let mut conn = db.0.lock().map_err(|e| e.to_string())?;
    let tx = conn.transaction().map_err(|e| e.to_string())?;

    ensure_meta(&tx).map_err(|e| e.to_string())?;
    let removed = tx
        .execute("DELETE FROM bookmarks WHERE phrase = ?1", params![phrase])
        .map_err(|e| e.to_string())?;
    if removed > 0 {
        touch_meta(&tx).map_err(|e| e.to_string())?;
    }
    tx.commit().map_err(|e| e.to_string())?;

    let data = read_all(&conn).map_err(|e| e.to_string())?;
    Ok(json!({ "bookmarks": data.bookmarks }))
}
