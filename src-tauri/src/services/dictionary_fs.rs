use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};

// #[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
// #[serde(rename_all = "PascalCase")]
// pub enum PhraseType {
//     Noun,
//     Adjective,
//     Verb,
//     Adverb,
//     #[serde(untagged)]
//     #[serde(other)]
//     Other,
// }
//
// // Custom deserializer to handle `type: PhraseType | string`
// // This allows both known PhraseType and any other string
// #[derive(Debug, Clone, Serialize, Deserialize)]
// #[serde(untagged)]
// pub enum PhraseTypeOrString {
//     Known(PhraseType),
//     Custom(String),
// }
//
// impl From<PhraseTypeOrString> for String {
//     fn from(val: PhraseTypeOrString) -> Self {
//         match val {
//             PhraseTypeOrString::Known(k) => k.to_string(),
//             PhraseTypeOrString::Custom(s) => s,
//         }
//     }
// }
//
// #[derive(Debug, Clone, Serialize, Deserialize)]
// pub struct MeaningStructureType {
//     // `type` is a reserved keyword in Rust, so we rename it
//     #[serde(rename = "type")]
//     pub type_: PhraseTypeOrString,
//     pub meaning: String,
//     pub other: Vec<String>,
//     pub examples: Vec<String>,
// }
//
// #[derive(Debug, Clone, Serialize, Deserialize)]
// pub struct DictionaryEntry {
//     pub meanings: Vec<MeaningStructureType>,
//     pub synonyms: Vec<String>,
//     pub antonyms: Vec<String>,
// }
//
// // TS `Map<string, DictionaryEntry>` = Rust HashMap
// pub type Dictionary = HashMap<String, DictionaryEntry>;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MeaningStructureType {
    #[serde(rename = "type")]
    pub type_: String, // Just String - handles PhraseType | string automatically
    pub meaning: String,
    pub other: Vec<String>,
    pub examples: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DictionaryEntry {
    pub meanings: Vec<MeaningStructureType>,
    pub synonyms: Vec<String>,
    pub antonyms: Vec<String>,
}

pub type Dictionary = HashMap<String, DictionaryEntry>;

fn dictionary_dir(app: &AppHandle, is_in_dev: bool) -> PathBuf {
    let dir = if cfg!(debug_assertions) {
        // return PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../src/assets/dictionary");
        std::env::current_dir()
            .unwrap_or_default()
            .join("../src/assets/dictionary")
    } else {
        app.path()
            .resource_dir()
            .unwrap_or_default()
            .join("assets/dictionary")
    };
    return dir;
}

fn get_dictionary_path(app: &AppHandle, first_letter: &str) -> PathBuf {
    let path = if cfg!(debug_assertions) {
        std::env::current_dir()
            .unwrap_or_default()
            .join(format!("../src/assets/dictionary/{}.json", first_letter))
    } else {
        app.path()
            .resource_dir()
            .unwrap_or_default()
            .join(format!("../src/assets/dictionary/{}.json", first_letter))
    };
    path
}

fn load_dictionary_file(path: &PathBuf) -> Option<Dictionary> {
    if !path.exists() {
        return None;
    }
    let data = fs::read_to_string(path).ok()?;
    serde_json::from_str(&data).ok()
}

#[tauri::command]
pub fn dictionary_hint(app: AppHandle, word: String) -> Vec<String> {
    if word.trim().is_empty() {
        return vec![];
    }
    let query = word.trim().to_uppercase();
    let first_letter = query
        .chars()
        .next()
        .unwrap_or('A')
        .to_lowercase()
        .to_string();

    let filepath = get_dictionary_path(&app, &first_letter);
    let Some(parsed_data) = load_dictionary_file(&filepath) else {
        return vec![];
    };

    let query_len = query.len();
    let mut hints: Vec<String> = parsed_data
        .keys()
        .filter(|k| k.len() > query_len && k.starts_with(&query))
        .cloned()
        .collect();

    hints.truncate(50);
    hints
}

#[tauri::command]
pub fn dictionary_search(app: AppHandle, query: String) -> Option<DictionaryEntry> {
    if query.trim().is_empty() {
        return None;
    }
    let search_term = query.trim().to_uppercase();
    let first_letter = search_term.chars().next()?.to_lowercase().to_string();

    let filepath = get_dictionary_path(&app, &first_letter);
    let parsed_data = load_dictionary_file(&filepath)?;
    parsed_data.get(&search_term).cloned()
}
