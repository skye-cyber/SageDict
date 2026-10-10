declare module '*.css' {
    const content: string;
    export default content;
}

declare module '*.scss' { }
declare module '*.sass' { }
declare module '*.less' { }
declare module '*.svg' {
    const content: string;
    export default content;
}
declare module '*.png' {
    const content: string;
    export default content;
}

export enum PhraseType {
    Noun = "Noun",
    Adjective = "Adjective",
    Verb = "Verb",
    Adverb = "Adverb"
}


export interface MeaningStructureType_ {
    type: PhraseType | string
    meaning: string
    other: string[]  // Other illustrative meaning
    examples: string[]
}

interface Nyms {
    id: string;
    lemmas: string[];
    definition: string;
}

interface Relations {
    hypernyms?: string[]; // broader terms / parent concepts
    hyponyms?: string[]; // narrower terms / child concepts
    meronyms?: string[]; // parts or components of this term
    holonyms?: string[]; // whole/group this term belongs to
    domain?: string; // subject area or field
    frames?: string[]; // usage patterns or syntactic frames
    instance_hyponyms?: Nyms[];
    instance_hypernyms?: Nyms[];
    also_see: string[];
    causes: string[];
    derivationally_related: string[];
    domain_region: string[];
    domain_topic: string[];
    domain_usage: string[];
    entails: string[];
    participles: string;
    similar_to: string[];
}

interface MeaningStructureType {
    type: string; // part of speech or meaning category
    meaning: string; // main definition or sense
    other: string[]; // related terms / synonyms
    examples: string[]; // example sentences or usage examples
    relations: Relations;
    synset_id: string;
}


export interface DictionaryEntry {
    meanings: MeaningStructureType[]
    synonyms: string[]
    antonyms: string[]
}

export interface BookMarkData { }

export type Dictionary = Map<string, DictionaryEntry>


export enum ThemeType {
    dark = 'dark',
    light = 'light'
}

export interface BookmarkEntry {
    id: string;
    phrase: string;
    added_at: string;
    notes?: string;
}

export interface BookmarkMeta {
    created_at: string;
    update_at: string | null;
}

export interface BookMark {
    metadata: BookmarkMeta;
    bookmarks: BookmarkEntry[];
}
