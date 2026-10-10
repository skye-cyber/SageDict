use rusqlite::{params, Connection, OpenFlags, OptionalExtension};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use tauri::{AppHandle, Manager, State};
use tauri_plugin_fs::FsExt;
use std::io::Cursor;

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RelatedSynset {
    pub id: String,
    pub lemmas: Vec<String>,
    pub definition: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct SenseRelations {
    #[serde(default)] pub hypernyms: Vec<RelatedSynset>,
    #[serde(default)] pub hyponyms: Vec<RelatedSynset>,
    #[serde(default)] pub instance_hypernyms: Vec<RelatedSynset>,
    #[serde(default)] pub instance_hyponyms: Vec<RelatedSynset>,
    #[serde(default)] pub meronyms: Vec<RelatedSynset>,
    #[serde(default)] pub holonyms: Vec<RelatedSynset>,
    #[serde(default)] pub entails: Vec<RelatedSynset>,
    #[serde(default)] pub causes: Vec<RelatedSynset>,
    #[serde(default)] pub similar_to: Vec<RelatedSynset>,
    #[serde(default)] pub also_see: Vec<RelatedSynset>,
    #[serde(default)] pub derivationally_related: Vec<String>,
    #[serde(default)] pub pertainyms: Vec<String>,
    #[serde(default)] pub participles: Vec<String>,
    #[serde(default)] pub domain_topics: Vec<RelatedSynset>,
    #[serde(default)] pub domain_regions: Vec<RelatedSynset>,
    #[serde(default)] pub domain_usages: Vec<RelatedSynset>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MeaningStructureType {
    #[serde(rename = "type")]
    pub type_: String,
    pub meaning: String,
    pub other: Vec<String>,
    pub examples: Vec<String>,
    pub synset_id: String,
    pub ili: Option<String>,
    pub relations: SenseRelations,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DictionaryEntry {
    pub meanings: Vec<MeaningStructureType>,
    pub synonyms: Vec<String>,
    pub antonyms: Vec<String>,
}

// ---------------------------------------------------------------------------
// DB state
// ---------------------------------------------------------------------------

pub struct Db(pub Mutex<Connection>);

/// Where the compressed archive lives.
/// - dev:  `src-tauri/../src/assets/wordnet.7z` (uncompressed .sqlite also fine in dev)
/// - prod: `$RESOURCE/assets/wordnet.7z`
fn archive_path(app: &AppHandle) -> PathBuf {
    app.path()
    .resource_dir()
    .unwrap_or_default()
    .join("assets/wordnet.7z")
}


/// Ensures a readable `wordnet.sqlite` is available and returns its path.
///
/// Resolution order:
///
/// 1. **Desktop dev** (`cfg!(debug_assertions) && cfg!(desktop)`):
///    Reads the raw SQLite directly from the source tree at
///    `src-tauri/../src/assets/wordnet.sqlite`. No extraction, no archive.
///
/// 2. **All other targets** (packaged desktop, Android/iOS dev and release):
///    Extracts the bundled `assets/wordnet.7z` into the app's per-user
///    data directory on first run, then returns the extracted DB path.
///    On subsequent runs the existing extraction is reused.
///
/// ## Platform notes
///
/// - **Desktop**: `wordnet.7z` is a real file under `resource_dir()`, so
///   `sevenz_rust::decompress_file` can read it directly.
/// - **Android / iOS**: `resource_dir()` returns a URI of the form
///   `asset://localhost/` because resources are stored inside the APK/IPA,
///   not on the filesystem. `std::fs` and `Path::exists` cannot read these.
///   The bytes must be pulled through `tauri_plugin_fs`'s `FsExt::fs().read()`,
///   which understands the `asset://` scheme, then decompressed from an
///   in-memory `Cursor<Vec<u8>>`.
///
/// ## Errors
///
/// Returns `Err` if:
/// - the dev DB is missing on desktop,
/// - the archive is missing from the bundle,
/// - the archive is empty,
/// - decompression fails, or
/// - decompression succeeds but no `wordnet.sqlite` appears in the output.
pub fn ensure_db_extracted(app: &AppHandle) -> Result<PathBuf, String> {
    // -----------------------------------------------------------------
    // 1. Desktop dev: read the raw SQLite straight from the source tree.
    // -----------------------------------------------------------------
    if cfg!(debug_assertions) && cfg!(desktop) {
        let dev_path = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("../src/assets/wordnet.sqlite");
        if !dev_path.exists() {
            return Err(format!(
                "dev db missing at {dev_path:?}. \
Run the loader or copy wordnet.sqlite into src/assets/."
            ));
        }
        return Ok(dev_path);
    }

    // -----------------------------------------------------------------
    // 2. Everywhere else: extract the bundled archive into app_data_dir.
    // -----------------------------------------------------------------
    let data_dir = app
    .path()
    .app_data_dir()
    .map_err(|e| format!("app_data_dir: {e}"))?;
    std::fs::create_dir_all(&data_dir)
    .map_err(|e| format!("create_dir_all({data_dir:?}): {e}"))?;

    let db_path = data_dir.join("wordnet.sqlite");

    // Reuse a previous extraction.
    if db_path.exists() {
        return Ok(db_path);
    }

    // --- Mobile: read the archive bytes via the FS plugin ---------------
    //
    // `resource_dir()` returns `asset://localhost/` on Android/iOS.
    // `FsExt::fs().read()` is synchronous and returns the bytes directly.
    // `sevenz_rust::decompress` accepts any `Read + Seek`, so a
    // `Cursor<Vec<u8>>` over the in-memory bytes works.
    #[cfg(mobile)]
    {
        let resource_dir = app
        .path()
        .resource_dir()
        .map_err(|e| format!("resource_dir: {e}"))?;
        let archive_uri = resource_dir.join("assets/wordnet.7z");

        eprintln!("[wordnet] reading asset bytes from {archive_uri:?}");

        let bytes: Vec<u8> = app
        .fs()
        .read(&archive_uri)
        .map_err(|e| format!("fs read {archive_uri:?}: {e}"))?;

        if bytes.is_empty() {
            return Err(format!(
                "asset {archive_uri:?} is empty — was wordnet.7z bundled?"
            ));
        }

        eprintln!(
            "[wordnet] read {} bytes, decompressing to {data_dir:?}",
            bytes.len()
        );

        sevenz_rust::decompress(Cursor::new(bytes), &data_dir)
        .map_err(|e| format!("7z decompress: {e}"))?;
    }

    // --- Desktop packaged: archive is a real file on disk ---------------
    #[cfg(desktop)]
    {
        let archive = app
        .path()
        .resource_dir()
        .unwrap_or_default()
        .join("assets/wordnet.7z");

        if !archive.exists() {
            return Err(format!("bundled archive missing at {archive:?}"));
        }

        eprintln!("[wordnet] extracting {archive:?} -> {data_dir:?}");

        sevenz_rust::decompress_file(&archive, &data_dir)
        .map_err(|e| format!("7z decompress: {e}"))?;
    }

    // -----------------------------------------------------------------
    // 3. Verify the expected file actually landed.
    // -----------------------------------------------------------------
    if !db_path.exists() {
        return Err(format!(
            "extraction finished but {db_path:?} not found — \
does the archive contain `wordnet.sqlite` at its root?"
        ));
    }

    Ok(db_path)
}

pub fn init_db(app: &AppHandle) -> rusqlite::Result<Db> {
    // let path = db_path(app);
    let path = ensure_db_extracted(app).map_err(|e| {
        rusqlite::Error::SqliteFailure(
            rusqlite::ffi::Error::new(rusqlite::ffi::SQLITE_ERROR),
                                       Some(e),
        )
    })?;
    eprintln!("[wordnet] opening {path:?}");

    if !path.exists() {
        return Err(rusqlite::Error::SqliteFailure(
            rusqlite::ffi::Error::new(rusqlite::ffi::SQLITE_CANTOPEN),
                                                  Some(format!("wordnet.sqlite not found at {path:?}")),
        ));
    }

    // Read-only: never creates an empty stub, never leaves -wal/-shm sidecars.
    let conn = Connection::open_with_flags(
        &path,
        OpenFlags::SQLITE_OPEN_READ_ONLY | OpenFlags::SQLITE_OPEN_NO_MUTEX,
    )?;

    // Fail loudly if the schema isn't what we expect.
    let ok: i64 = conn.query_row(
        "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='entries'",
                                 [],
                                 |r| r.get(0),
    )?;
    if ok == 0 {
        return Err(rusqlite::Error::SqliteFailure(
            rusqlite::ffi::Error::new(rusqlite::ffi::SQLITE_ERROR),
                                                  Some(format!("{path:?} has no `entries` table")),
        ));
    }

    Ok(Db(Mutex::new(conn)))
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

fn pos_label(pos: &str) -> String {
    match pos {
        "n" => "Noun",
        "v" => "Verb",
        "a" | "s" => "Adjective",
        "r" => "Adverb",
        _ => "Other",
    }
    .to_string()
}

#[derive(Clone, Copy, PartialEq, Eq, Hash)]
enum SynsetRelKind {
    Hypernym,
    InstanceHypernym,
    Hyponym,
    InstanceHyponym,
    Meronym,
    Holonym,
    Entails,
    Causes,
    SimilarTo,
    AlsoSee,
    DomainTopic,
    DomainRegion,
    DomainUsage,
}
const SYNSET_REL_MAP: &[(&str, SynsetRelKind)] = &[
    ("hypernym", SynsetRelKind::Hypernym),
    ("instance_hypernym", SynsetRelKind::InstanceHypernym),
    ("hyponym", SynsetRelKind::Hyponym),
    ("instance_hyponym", SynsetRelKind::InstanceHyponym),
    ("mero_part", SynsetRelKind::Meronym),
    ("mero_member", SynsetRelKind::Meronym),
    ("mero_substance", SynsetRelKind::Meronym),
    ("mero_location", SynsetRelKind::Meronym),
    ("holo_part", SynsetRelKind::Holonym),
    ("holo_member", SynsetRelKind::Holonym),
    ("holo_substance", SynsetRelKind::Holonym),
    ("holo_location", SynsetRelKind::Holonym),
    ("entails", SynsetRelKind::Entails),
    ("causes", SynsetRelKind::Causes),
    ("similar_to", SynsetRelKind::SimilarTo),
    ("also_see", SynsetRelKind::AlsoSee),
    ("domain_topic", SynsetRelKind::DomainTopic),
    ("domain_region", SynsetRelKind::DomainRegion),
    ("domain_usage", SynsetRelKind::DomainUsage),
];

fn lexical_lemma_from_sense_id(sense_id: &str) -> Option<String> {
    sense_id.split('%').next().map(|s| s.replace('_', " "))
}

fn fetch_related_synset(
    conn: &Connection,
    synset_id: &str,
) -> rusqlite::Result<RelatedSynset> {
    let mut stmt = conn.prepare(
        "SELECT lemma FROM synset_members WHERE synset_id = ?1 ORDER BY lemma",
    )?;
    let lemmas: Vec<String> = stmt
    .query_map(params![synset_id], |r| r.get::<_, String>(0))?
    .collect::<rusqlite::Result<Vec<_>>>()?;

    let definition: Option<String> = conn
    .query_row(
        "SELECT definition FROM synsets WHERE id = ?1",
        params![synset_id],
        |r| r.get(0),
    )
    .optional()?;

    Ok(RelatedSynset {
        id: synset_id.to_string(),
       lemmas,
       definition,
    })
}

fn fetch_relations(
    conn: &Connection,
    synset_id: &str,
    sense_id: &str,
) -> Result<SenseRelations, String> {
    let mut rels = SenseRelations::default();

    // --- Synset-to-synset relations -------------------------------------
    let mut stmt = conn
    .prepare("SELECT rel, dst_id FROM relations WHERE src_id = ?1")
    .map_err(|e| e.to_string())?;

    let edges: Vec<(String, String)> = stmt
    .query_map(params![synset_id], |r| {
        Ok((r.get::<_, String>(0)?, r.get::<_, String>(1)?))
    })
    .map_err(|e| e.to_string())?
    .collect::<rusqlite::Result<Vec<_>>>()
    .map_err(|e| e.to_string())?;

    let mut grouped: HashMap<SynsetRelKind, Vec<String>> = HashMap::new();
    for (rel, dst) in &edges {
        if let Some((_, kind)) = SYNSET_REL_MAP.iter().find(|(r, _)| r == rel) {
            grouped.entry(*kind).or_default().push(dst.clone());
        }
    }

    // --- Lexical relations (keyed by sense id) --------------------------
    let mut lex_stmt = conn
    .prepare("SELECT rel, dst_id FROM relations WHERE src_id = ?1")
    .map_err(|e| e.to_string())?;

    let lex_edges: Vec<(String, String)> = lex_stmt
    .query_map(params![sense_id], |r| {
        Ok((r.get::<_, String>(0)?, r.get::<_, String>(1)?))
    })
    .map_err(|e| e.to_string())?
    .collect::<rusqlite::Result<Vec<_>>>()
    .map_err(|e| e.to_string())?;

    for (rel, dst) in lex_edges {
        match rel.as_str() {
            "derivation" | "derivationally_related_form" => {
                if let Some(l) = lexical_lemma_from_sense_id(&dst) {
                    rels.derivationally_related.push(l);
                }
            }
            "pertainym" => {
                if let Some(l) = lexical_lemma_from_sense_id(&dst) {
                    rels.pertainyms.push(l);
                }
            }
            "participle" => {
                if let Some(l) = lexical_lemma_from_sense_id(&dst) {
                    rels.participles.push(l);
                }
            }
            _ => {}
        }
    }

    // --- Materialize grouped synset relations ---------------------------
    for (kind, targets) in grouped {
        let mut rows: Vec<RelatedSynset> = Vec::with_capacity(targets.len());
        for t in targets {
            rows.push(fetch_related_synset(conn, &t).map_err(|e| e.to_string())?);
        }
        match kind {
            SynsetRelKind::Hypernym => rels.hypernyms = rows,
            SynsetRelKind::InstanceHypernym => rels.instance_hypernyms = rows,
            SynsetRelKind::Hyponym => rels.hyponyms = rows,
            SynsetRelKind::InstanceHyponym => rels.instance_hyponyms = rows,
            SynsetRelKind::Meronym => rels.meronyms.extend(rows),
            SynsetRelKind::Holonym => rels.holonyms.extend(rows),
            SynsetRelKind::Entails => rels.entails = rows,
            SynsetRelKind::Causes => rels.causes = rows,
            SynsetRelKind::SimilarTo => rels.similar_to = rows,
            SynsetRelKind::AlsoSee => rels.also_see = rows,
            SynsetRelKind::DomainTopic => rels.domain_topics = rows,
            SynsetRelKind::DomainRegion => rels.domain_regions = rows,
            SynsetRelKind::DomainUsage => rels.domain_usages = rows,
        }
    }

    Ok(rels)
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

#[tauri::command]
pub fn dictionary_hint(
    db: State<'_, Db>,
    word: String,
) -> Result<Vec<String>, String> {
    let q = word.trim();
    if q.is_empty() {
        return Ok(vec![]);
    }
    let pattern = format!("{}%", q);

    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
    .prepare(
        "SELECT DISTINCT lemma
        FROM entries
        WHERE lemma LIKE ?1 AND length(lemma) > length(?2)
    ORDER BY lemma
    LIMIT 10",
    )
    .map_err(|e| e.to_string())?;

    let rows = stmt
    .query_map(params![pattern, q], |r| r.get::<_, String>(0))
    .map_err(|e| e.to_string())?
    .collect::<rusqlite::Result<Vec<_>>>()
    .map_err(|e| e.to_string())?;

    Ok(rows)
}

#[tauri::command]
pub fn dictionary_search(
    db: State<'_, Db>,
    query: String,
) -> Result<Option<DictionaryEntry>, String> {
    let term = query.trim();
    if term.is_empty() {
        return Ok(None);
    }

    let conn = db.0.lock().map_err(|e| e.to_string())?;

    let mut stmt = conn
    .prepare(
        "SELECT s.id, s.synset_id, sy.pos, sy.definition, sy.ili
        FROM entries e
        JOIN senses  s  ON s.entry_id = e.id
        JOIN synsets sy ON sy.id = s.synset_id
        WHERE e.lemma = ?1 COLLATE NOCASE",
    )
    .map_err(|e| e.to_string())?;

    struct SenseRow {
        sense_id: String,
        synset_id: String,
        pos: String,
        definition: Option<String>,
        ili: Option<String>,
    }

    let senses: Vec<SenseRow> = stmt
    .query_map(params![term], |r| {
        Ok(SenseRow {
            sense_id: r.get(0)?,
           synset_id: r.get(1)?,
           pos: r.get(2)?,
           definition: r.get(3)?,
           ili: r.get(4)?,
        })
    })
    .map_err(|e| e.to_string())?
    .collect::<rusqlite::Result<Vec<_>>>()
    .map_err(|e| e.to_string())?;

    if senses.is_empty() {
        return Ok(None);
    }

    let mut member_stmt = conn
    .prepare(
        "SELECT lemma FROM synset_members
        WHERE synset_id = ?1
        ORDER BY lemma",
    )
    .map_err(|e| e.to_string())?;

    let mut example_stmt = conn
    .prepare("SELECT example FROM synset_examples WHERE synset_id = ?1")
    .map_err(|e| e.to_string())?;

    let mut antonym_stmt = conn
    .prepare(
        "SELECT DISTINCT sm.lemma
        FROM relations r
        JOIN synset_members sm ON sm.synset_id = r.dst_id
        WHERE r.src_id = ?1 AND r.rel = 'antonym'
    ORDER BY sm.lemma",
    )
    .map_err(|e| e.to_string())?;

    let mut meanings: Vec<MeaningStructureType> = Vec::with_capacity(senses.len());
    let mut all_synonyms: Vec<String> = Vec::new();
    let mut all_antonyms: Vec<String> = Vec::new();

    for s in &senses {
        let synonyms: Vec<String> = member_stmt
        .query_map(params![s.synset_id], |r| r.get::<_, String>(0))
        .map_err(|e| e.to_string())?
        .collect::<rusqlite::Result<Vec<_>>>()
        .map_err(|e| e.to_string())?
        .into_iter()
        .filter(|m| !m.eq_ignore_ascii_case(term))
        .collect();

        let examples: Vec<String> = example_stmt
        .query_map(params![s.synset_id], |r| r.get::<_, String>(0))
        .map_err(|e| e.to_string())?
        .collect::<rusqlite::Result<Vec<_>>>()
        .map_err(|e| e.to_string())?;

        let antonyms: Vec<String> = antonym_stmt
        .query_map(params![s.synset_id], |r| r.get::<_, String>(0))
        .map_err(|e| e.to_string())?
        .collect::<rusqlite::Result<Vec<_>>>()
        .map_err(|e| e.to_string())?;

        let relations = fetch_relations(&conn, &s.synset_id, &s.sense_id)?;

        all_synonyms.extend(synonyms.iter().cloned());
        all_antonyms.extend(antonyms.iter().cloned());

        meanings.push(MeaningStructureType {
            type_: pos_label(&s.pos),
                      meaning: s.definition.clone().unwrap_or_default(),
                      other: synonyms,
                      examples,
                      synset_id: s.synset_id.clone(),
                      ili: s.ili.clone(),
                      relations,
        });
    }

    all_synonyms.sort();
    all_synonyms.dedup();
    all_antonyms.sort();
    all_antonyms.dedup();

    Ok(Some(DictionaryEntry {
        meanings,
        synonyms: all_synonyms,
        antonyms: all_antonyms,
    }))
}

// ---------------------------------------------------------------------------
// Full-text definition search
// ---------------------------------------------------------------------------

#[tauri::command]
pub fn dictionary_search_definitions(
    db: State<'_, Db>,
    query: String,
    limit: Option<u32>,
) -> Result<Vec<DictionaryEntry>, String> {
    let q = query.trim();
    if q.is_empty() {
        return Ok(vec![]);
    }
    let limit = limit.unwrap_or(20).min(200);

    let conn = db.0.lock().map_err(|e| e.to_string())?;

    let mut stmt = conn
    .prepare(
        "SELECT f.synset_id, sy.pos, sy.definition, sy.ili
        FROM synset_fts f
        JOIN synsets sy ON sy.id = f.synset_id
        WHERE synset_fts MATCH ?1
        LIMIT ?2",
    )
    .map_err(|e| e.to_string())?;

    let rows = stmt
    .query_map(params![q, limit], |r| {
        Ok((
            r.get::<_, String>(0)?,
            r.get::<_, String>(1)?,
            r.get::<_, Option<String>>(2)?,
            r.get::<_, Option<String>>(3)?,
        ))
    })
    .map_err(|e| e.to_string())?
    .collect::<rusqlite::Result<Vec<_>>>()
    .map_err(|e| e.to_string())?;

    let mut out = Vec::with_capacity(rows.len());
    for (sid, pos, defn, ili) in rows {
        out.push(DictionaryEntry {
            meanings: vec![MeaningStructureType {
                type_: pos_label(&pos),
                 meaning: defn.unwrap_or_default(),
                 other: vec![],
                 examples: vec![],
                 synset_id: sid,
                 ili,
                 relations: SenseRelations::default(),
            }],
            synonyms: vec![],
            antonyms: vec![],
        });
    }
    Ok(out)
}

// ---------------------------------------------------------------------------
// Startup sanity check
// ---------------------------------------------------------------------------

pub fn db_is_populated(conn: &Connection) -> rusqlite::Result<bool> {
    let n: Option<i64> = conn
    .query_row("SELECT COUNT(*) FROM entries LIMIT 1", [], |r| r.get(0))
    .optional()?;
    Ok(n.unwrap_or(0) > 0)
}
