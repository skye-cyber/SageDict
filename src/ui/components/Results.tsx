import React, { useState, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Bookmark,
    BookmarkCheck,
    ChevronDown,
    Volume2,
    Sparkles,
    ArrowRight,
    Tag,
    BookOpen,
    Layers,
    Hash
} from 'lucide-react';
import { DictionaryEntry, MeaningStructureType, Nyms } from '../../types/global';
import { globalEventBus } from '../../core/Globals/eventBus';
import { StateManager } from '../../core/Globals/StatesManager';
import { BookmarkEntry } from '../../types/global';
import { sage } from '../../core/hooks/sage';


const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
        opacity: 1,
        transition: {
            staggerChildren: 0.08,
            delayChildren: 0.15,
        },
    },
};

const itemVariants = {
    hidden: { opacity: 0, y: 20, filter: 'blur(8px)' },
    visible: {
        opacity: 1,
        y: 0,
        filter: 'blur(0px)',
        transition: {
            type: 'spring',
            damping: 25,
            stiffness: 300,
        },
    },
};

const cardVariants = {
    hidden: { opacity: 0, y: 30, scale: 0.97, filter: 'blur(6px)' },
    visible: (i: number) => ({
        opacity: 1,
        y: 0,
        scale: 1,
        filter: 'blur(0px)',
        transition: {
            delay: i * 0.08,
            type: 'spring',
            damping: 25,
            stiffness: 300,
        },
    }),
    exit: { opacity: 0, scale: 0.95, transition: { duration: 0.2 } },
};

const expandVariants = {
    hidden: { opacity: 0, height: 0, filter: 'blur(4px)' },
    visible: {
        opacity: 1,
        height: 'auto',
        filter: 'blur(0px)',
        transition: {
            type: 'spring',
            damping: 30,
            stiffness: 300,
            staggerChildren: 0.04,
            delayChildren: 0.05,
        },
    },
    exit: {
        opacity: 0,
        height: 0,
        filter: 'blur(4px)',
        transition: { duration: 0.25, ease: 'easeInOut' },
    },
};

const expandContentVariants = {
    hidden: { opacity: 0, y: 10 },
    visible: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -5 },
};

const sidebarItemVariants = {
    hidden: { opacity: 0, x: -15 },
    visible: (i: number) => ({
        opacity: 1,
        x: 0,
        transition: { delay: i * 0.03, type: 'spring', damping: 25 },
    }),
};


interface WordCardProps {
    entry: MeaningStructureType;
    //     searchPhrase: string;
    index: number;
}

const ToCamelCase = (text: string) => text.slice(0, 1).toLocaleUpperCase().concat(text.slice(1))

const WordCard: React.FC<WordCardProps> = ({ entry, index }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const [isBookmarked, setIsBookmarked] = useState(false);

    const toggleExpand = useCallback(() => {
        setIsExpanded(prev => !prev);
    }, []);

    const toggleBookmark = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
        setIsBookmarked(prev => !prev);
    }, []);

    // Color mapping for part of speech
    const posColors: Record<string, { bg: string; text: string; border: string; darkBg: string; darkBorder: string; darkText: string }> = {
        noun: { bg: 'bg-blue-50', text: 'text-blue-600', border: 'border-blue-200', darkBg: 'dark:bg-blue-900/20', darkText: 'dark:text-blue-300', darkBorder: 'dark:border-blue-800' },
        verb: { bg: 'bg-green-50', text: 'text-green-600', border: 'border-green-200', darkBg: 'dark:bg-green-900/20', darkText: 'dark:text-green-300', darkBorder: 'dark:border-green-800' },
        adjective: { bg: 'bg-purple-50', text: 'text-purple-600', border: 'border-purple-200', darkBg: 'dark:bg-purple-900/20', darkText: 'dark:text-purple-300', darkBorder: 'dark:border-purple-800' },
        adverb: { bg: 'bg-orange-50', text: 'text-orange-600', border: 'border-orange-200', darkBg: 'dark:bg-orange-900/20', darkText: 'dark:text-orange-300', darkBorder: 'dark:border-orange-800' },
        default: { bg: 'bg-gray-50', text: 'text-gray-600', border: 'border-gray-200', darkBg: 'dark:bg-gray-800/30', darkText: 'dark:text-gray-300', darkBorder: 'dark:border-gray-700' },
    };

    const posStyle = entry.domain
        ? (posColors[entry.domain.toLowerCase()] || posColors.default)
        : posColors.default;

    return (
        <motion.div
            custom={index}
            variants={cardVariants as any}
            initial="hidden"
            animate="visible"
            exit="exit"
            layout
            className={`relative group rounded-xl sm:rounded-2xl border transition-all duration-300 overflow-hidden ${isExpanded
                ? 'bg-white dark:bg-vimdark-200 border-primary-400/30 shadow-lg shadow-primary-400/5 dark:shadow-primary-400/5'
                : 'bg-white dark:bg-vimdark-200/80 border-gray-200 dark:border-vimdark-500/60 hover:border-gray-300 dark:hover:border-vimdark-400 hover:shadow-md'
                }
            `}
        >
            {/* Accent bar on expanded */}
            <AnimatePresence>
                {isExpanded && (
                    <motion.div
                        initial={{ scaleY: 0 }}
                        animate={{ scaleY: 1 }}
                        exit={{ scaleY: 0 }}
                        transition={{ duration: 0.3 }}
                        className="absolute left-0 top-0 bottom-0 w-0.5 sm:w-1 bg-gradient-to-b from-primary-400 to-secondary-400 origin-top"
                    />
                )}
            </AnimatePresence>

            {/* Header */}
            <motion.div
                onClick={toggleExpand}
                className="relative p-2 sm:p-5 cursor-pointer"
                whileHover={{ backgroundColor: 'rgba(255,255,255,0.02)' }}
            >
                <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0 space-y-2">
                        {/* Type & Part of Speech Row */}
                        <div className="flex items-center gap-2 flex-wrap">
                            <span className="inline-flex items-center gap-1 text-xs font-medium text-yellow-600 dark:text-yellow-400">
                                <Layers size={12} />
                                {entry.type}
                            </span>

                            {entry.domain && (
                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider border ${posStyle.bg} ${posStyle.text} ${posStyle.border} ${posStyle.darkBg} ${posStyle.darkText} ${posStyle.darkBorder}`}>
                                    {entry.domain}
                                </span>
                            )}

                            {entry.phonetic && (
                                <motion.button
                                    whileHover={{ scale: 1.1 }}
                                    whileTap={{ scale: 0.9 }}
                                    onClick={(e) => e.stopPropagation()}
                                    className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-primary-400 transition-colors"
                                >
                                    <Volume2 size={12} />
                                    <span className="font-mono">{entry.phonetic}</span>
                                </motion.button>
                            )}
                        </div>

                        {/* Definition Preview */}
                        <div>
                            <p className={`text-sm leading-relaxed transition-all duration-300 ${isExpanded ? 'text-gray-800 dark:text-gray-200' : 'text-gray-600 dark:text-gray-400 line-clamp-2'}`}>
                                {ToCamelCase(entry.meaning)}
                            </p>
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 flex-shrink-0">
                        <motion.button
                            whileHover={{ scale: 1.15 }}
                            whileTap={{ scale: 0.85 }}
                            onClick={toggleBookmark}
                            className={`hidden p-2 rounded-xl transition-all duration-200${isBookmarked
                                ? 'text-primary-400 bg-primary-400/10'
                                : 'text-gray-400 hover:text-primary-400 hover:bg-primary-400/5'
                                }
                                `}
                        >
                            {isBookmarked ? <BookmarkCheck size={18} /> : <Bookmark size={18} />}
                        </motion.button>

                        <motion.div
                            animate={{ rotate: isExpanded ? 180 : 0 }}
                            transition={{ type: 'spring', damping: 20 }}
                            className="p-2 text-gray-400"
                        >
                            <ChevronDown size={18} />
                        </motion.div>
                    </div>
                </div>
            </motion.div>

            {/* Expanded Content */}
            <AnimatePresence>
                {isExpanded && (
                    <motion.div
                        variants={expandVariants as any}
                        initial="hidden"
                        animate="visible"
                        exit="exit"
                        className="overflow-hidden"
                    >
                        <div className="px-5 pb-5 pt-0 space-y-5">
                            <div className="h-px bg-gradient-to-r from-transparent via-gray-200 dark:via-vimdark-500 to-transparent" />

                            {/* Other Meanings */}
                            {entry.other.length > 0 && (
                                <DefCardSubSections title='Alternative Meanings' contentArray={entry.other} />
                            )}

                            {(entry.relations.instance_hyponyms && entry.relations.instance_hyponyms?.length > 0) ? (
                                [...entry.relations.instance_hyponyms, ((entry.relations.hyponyms as any) as Nyms)].map((hyp, idx) => {
                                    if (hyp.lemmas) return <DefCardSubSections key={idx} title='Hypernyms' contentArray={hyp.lemmas} otherText={hyp.definition} />
                                })
                            ) : ''}

                            {(entry.relations.instance_hypernyms && entry.relations.instance_hypernyms?.length > 0) ? (
                                [...entry.relations.instance_hypernyms, ((entry.relations.hypernyms as any) as Nyms)].map((hyp, idx) => {
                                    if (hyp.lemmas) return <DefCardSubSections key={idx} title='Hypernyms' contentArray={hyp.lemmas} otherText={hyp.definition} />
                                })
                            ) : ''}

                            {(entry.relations.holonyms && entry.relations.holonyms?.length > 0) ? (
                                ((entry.relations.holonyms as any) as Nyms[]).map((hyp, idx) => {
                                    if (hyp.lemmas) return <DefCardSubSections key={idx} title='Hypernyms' contentArray={hyp.lemmas} otherText={hyp.definition} />
                                })
                            ) : ''}

                            {/* Examples */}
                            {(entry.examples && entry.examples.length > 0) && (
                                <motion.div variants={expandContentVariants}>
                                    <div className="flex items-center gap-2 mb-3">
                                        <BookOpen size={14} className="text-accent-400" />
                                        <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                            Examples
                                        </h4>
                                    </div>
                                    <div className="space-y-2">
                                        {entry.examples.map((example, idx) => (
                                            <motion.div
                                                key={idx}
                                                initial={{ opacity: 0, x: -10 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                transition={{ delay: idx * 0.08 }}
                                                className="relative pl-4 py-2"
                                            >
                                                <div className="absolute left-0 top-2 bottom-2 w-0.5 rounded-full bg-gradient-to-b from-accent-400/50 to-transparent" />
                                                <p className="text-sm text-gray-600 dark:text-gray-400 italic leading-relaxed">
                                                    "{example.charAt(0).toUpperCase()}{example.slice(1)}"
                                                </p>
                                            </motion.div>
                                        ))}
                                    </div>
                                </motion.div>
                            )}

                            {/* AI Insights Teaser */}
                            <motion.div
                                variants={expandContentVariants}
                                className="hidden relative p-4 rounded-xl bg-gradient-to-br from-primary-400/5 via-secondary-400/5 to-transparent border-2 border-primary-300/10 overflow-hidden"
                            >
                                <div className="absolute top-0 right-0 w-32 h-32 bg-primary-400/5 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2" />
                                <div className="relative flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <Sparkles size={16} className="text-primary-100" />
                                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">AI Insights</span>
                                    </div>
                                    <span className="text-[10px] font-semibold bg-primary-400/10 text-primary-100 px-2.5 py-1 rounded-full border border-primary-400/20">
                                        Coming Soon
                                    </span>
                                </div>
                                <p className="relative text-xs text-gray-500 dark:text-gray-500 mt-2">
                                    Contextual analysis and intelligent usage recommendations powered by AI
                                </p>
                            </motion.div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
};

interface SidebarListProps {
    items: string[];
    title: string;
    icon: React.ElementType;
    colorClass: string;
    emptyMessage: string;
}

const SidebarList: React.FC<SidebarListProps> = ({ items, title, icon: Icon, colorClass, emptyMessage }) => {
    const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

    return (
        <motion.div
            variants={itemVariants as any}
            className="flex flex-col h-full"
        >
            <div className="flex items-center gap-2 mb-4 px-1">
                <Icon size={14} className={colorClass} />
                <h5 className="text-xs font-bold text-gray-500 dark:text-gray-500 uppercase tracking-widest">
                    {title}
                </h5>
                <span className="ml-auto text-[10px] text-gray-400 dark:text-gray-600 bg-gray-100 dark:bg-vimdark-400/30 px-2 py-0.5 rounded-full">
                    {items.length}
                </span>
            </div>

            <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-1">
                <AnimatePresence>
                    {items.length > 0 ? (
                        items.map((item, index) => (
                            <motion.div
                                key={`${item}-${index}`}
                                custom={index}
                                variants={sidebarItemVariants as any}
                                initial="hidden"
                                animate="visible"
                                onClick={() => {
                                    // One word only
                                    if (item.split(' ').length === 1) {
                                        globalEventBus.emit('search:query:update', item.toLowerCase())
                                    }
                                }}
                                onHoverStart={() => setHoveredIndex(index)}
                                onHoverEnd={() => setHoveredIndex(null)}
                                className={`group relative flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm cursor-pointer transition-all duration-200 ${hoveredIndex === index
                                    ? 'bg-white dark:bg-vimdark-300 shadow-sm border border-gray-100 dark:border-vimdark-500/50'
                                    : 'hover:bg-white/50 dark:hover:bg-vimdark-300/50'
                                    }
                    `}
                            >
                                <motion.div
                                    animate={{
                                        scale: hoveredIndex === index ? 1.2 : 1,
                                        backgroundColor: hoveredIndex === index ? 'rgba(82, 82, 255, 0.15)' : 'rgba(255, 255, 255, 0.05)'
                                    }}
                                    className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                                    style={{ backgroundColor: hoveredIndex === index ? "#5252ff" : undefined }}
                                />
                                <span className="text-gray-600 dark:text-gray-400 group-hover:text-gray-900 dark:group-hover:text-gray-200 transition-colors capitalize">
                                    {item}
                                </span>

                                <motion.div
                                    initial={{ opacity: 0, x: -5 }}
                                    animate={{ opacity: hoveredIndex === index ? 1 : 0, x: hoveredIndex === index ? 0 : -5 }}
                                    className="ml-auto"
                                >
                                    <ArrowRight size={12} className="text-primary-400" />
                                </motion.div>
                            </motion.div>
                        ))
                    ) : (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="text-center py-8 text-xs text-gray-400 dark:text-gray-600 italic"
                        >
                            {emptyMessage}
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </motion.div>
    );
};


const DefCardSubSections: React.FC<{ contentArray: string[], title: string, otherText?: string }> = ({ contentArray, title, otherText }) => {
    return (
        <motion.div variants={expandContentVariants}>
            <div className="flex items-center gap-2 mb-3">
                <Hash size={14} className="text-secondary-400" />
                <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    {title}
                </h4>
            </div>
            <div className="flex flex-wrap gap-2">
                {contentArray.map((contentText: string, idx: any) => (
                    <motion.span
                        key={idx}
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: idx * 0.05 }}
                        onClick={() => {
                            // One word only
                            if (contentText.split(' ').length === 1) {
                                globalEventBus.emit('search:query:update', contentText.toLowerCase())
                            }
                        }}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-gray-50 dark:bg-vimdark-400/40 text-gray-600 dark:text-gray-400 border border-gray-100 dark:border-vimdark-500/50 hover:border-primary-400/30 transition-colors cursor-default ${(contentText.split(' ').length === 1) ? 'cursor-pointer' : ''}`}
                    >
                        <span className="flex items-center justify-center w-4 h-4 rounded-full bg-primary-100/10 dark:bg-primary-400/30 text-primary-100 text-[9px] font-bold">
                            {idx + 1}
                        </span>
                        {contentText}
                    </motion.span>
                ))}
            </div>
            {otherText && (
                <div>
                    <p className={`text-sm leading-relaxed transition-all duration-300 text-gray-600 dark:text-gray-400 line-clamp-2`}>
                        {ToCamelCase(otherText)}
                    </p>
                </div>
            )}
        </motion.div>
    )
}
interface ResultType {
    searchPhrase: string;
    results: DictionaryEntry;
}

enum Sections {
    Meaning = "meaning",
    Antonyms = "antonyms",
    Synonyms = "synonyms",
    All = "all"
}

const ResultCard: React.FC<ResultType> = ({ searchPhrase, results }) => {
    const [isBookmarked, setIsBookmarked] = useState<boolean>(false)
    const [activeSection, setActiveSection] = useState<Sections>(Sections.All)

    const updateBookmark = useCallback(async () => {
        StateManager.set('bookmarks', await sage.bookmarks.readBookmarks() || [])
    }, [isBookmarked])

    useEffect(() => {
        updateSection()
        const set = async () => {
            await updateBookmark()
            setTimeout(() => {
                const BK = StateManager.get('bookmarks') as BookmarkEntry[] | null | undefined;
                const isInBookmark = Array.isArray(BK)
                    ? BK.some(e => e.phrase.toLowerCase() === searchPhrase.toLowerCase())
                    : false;
                setIsBookmarked(isInBookmark)
            })
        }
        set()
        const updateListener = globalEventBus.on('bookmark:change', set)
        return () => updateListener.unsubscribe()
    }, [])

    const toggleMainBookmark = useCallback(async () => {
        const BK = StateManager.get('bookmarks') as BookmarkEntry[] | null | undefined;
        const isInBookmark = Array.isArray(BK)
            ? BK.some(e => e.phrase.toLowerCase() === searchPhrase.toLowerCase())
            : false;
        let bookmarkResponse
        if (isInBookmark) {
            bookmarkResponse = await sage.bookmarks.delete(searchPhrase)
        } else {
            bookmarkResponse = await sage.bookmarks.add(searchPhrase)
        }

        if (bookmarkResponse) {
            setIsBookmarked(!isInBookmark)
            await updateBookmark()
        }
    }, []);

    const updateSection = () => {
        if (window.innerWidth > 880) {
            (activeSection !== Sections.All) ? setActiveSection(Sections.All) : ''
        } else (
            (activeSection === Sections.All) ? setActiveSection(Sections.Meaning) : ''
        )
    }

    useEffect(() => {
        window.addEventListener('resize', updateSection)
        return () => window.removeEventListener('resize', updateSection);
    })
    return (
        <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="relative"
        >
            {/* Main Card Container */}
            <div className="relative bg-white dark:bg-vimdark-200/90 backdrop-blur-xl rounded-3xl border border-gray-200 dark:border-vimdark-500/50 shadow-lg shadow-black/5 dark:shadow-black/20 h-[80dvh] max-h-[80dvh] overflow-hidden scrollbar-custom p-2">

                {/* Top gradient line */}
                <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary-400/50 to-transparent" />

                {/* Header */}
                <motion.div
                    variants={itemVariants as any}
                    className="relative px-3 sm:px-6 py-3 sm:py-5 border-b border-gray-100 dark:border-vimdark-500/50"
                >
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            {/* Search Term Display */}
                            <div>
                                <div className="flex items-center space-z-1 text-baseline">
                                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">
                                        {searchPhrase}
                                    </h2>
                                    <motion.button
                                        whileHover={{ scale: 1.15, rotate: 10 }}
                                        whileTap={{ scale: 0.9 }}
                                        onClick={toggleMainBookmark}
                                        className={`p-2 rounded-xl transition-all duration-200 ${isBookmarked
                                            ? 'text-primary-100 bg-primary-400/10'
                                            : 'text-gray-300 hover:text-primary-200 hover:bg-primary-400/5'
                                            }
                                            `}
                                    >
                                        {isBookmarked ? <BookmarkCheck size={20} /> : <Bookmark size={20} />}
                                    </motion.button>
                                </div>
                                <div className="flex max-[600px]:block gap-1">
                                    <div className="flex items-center gap-1 sm:gap-3 text-xs sm:text-sm text-gray-400 dark:text-gray-500">
                                        <span className="flex items-center gap-1">
                                            <Layers size={12} />
                                            {results.meanings.length} definition{results.meanings.length !== 1 ? 's' : ''}
                                        </span>
                                        <span className="w-1 h-1 rounded-full bg-gray-300 dark:bg-gray-600" />
                                        <span className="flex items-center gap-1">
                                            <Tag size={12} />
                                            {results.synonyms.length + results.antonyms.length} related words
                                        </span>
                                    </div>
                                    <hr className='dark:border-vimdark-50' />
                                    <div className="min-[880px]:hidden flex ml-2 shadow-centered-md shadow-gray-50 dark:shadow-vimdark-400 border-x-2 dark:border-x-gray-700 rounded text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                                        <button onClick={() => setActiveSection(Sections.Meaning)} className={`hover:bg-gray-100 dark:hover:bg-vimdark-100 rounded-b-md px-1 py-2 hover:border-b-3 hover:border-primary-600 focus:ring-none focus:outline-none ${activeSection == Sections.Meaning ? 'border-b-4 border-primary-600 dark:border-primary-100' : ''}`}>Meaning</button>
                                        <button onClick={() => setActiveSection(Sections.Antonyms)} className={`hover:bg-gray-100 dark:hover:bg-vimdark-100 rounded-b-md px-1 py-2 hover:border-b-3 hover:border-primary-600 focus:ring-none focus:outline-none ${activeSection == Sections.Antonyms ? 'border-b-4 border-primary-600 dark:border-primary-100' : ''}`}>Synonyms</button>
                                        <button onClick={() => setActiveSection(Sections.Synonyms)} className={`hover:bg-gray-100 dark:hover:bg-vimdark-100 rounded-b-md px-1 py-2  hover:border-b-3 hover:border-primary-600 focus:ring-none focus:outline-none ${activeSection == Sections.Synonyms ? 'border-b-4 border-primary-600 dark:border-primary-100' : ''}`}>Antonyms</button>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Decorative */}
                        <div className="hidden sm:flex items-center gap-1 sm:gap-2">
                            <div className="w-2 h-2 rounded-full bg-primary-100 animate-pulse" />
                            <span className="text-[10px] font-mono text-gray-400 dark:text-gray-600 uppercase tracking-wider">
                                Live
                            </span>
                        </div>
                    </div>
                </motion.div>

                {/* Three Column Layout */}
                <div className="flex flex-col sd:flex-row">
                    {/* Synonyms Sidebar */}
                    {/*useMediaQue('(min-width: 400px)') && (*/}
                    <motion.div
                        variants={itemVariants as any}
                        className={`${[Sections.All, Sections.Synonyms].includes(activeSection) ? '' : 'hidden'} sd:w-56 xl:w-64 flex-shrink-0 p-5 border-b md:border-b-0 md:border-r border-gray-100 dark:border-vimdark-500/50 bg-gray-50/50 dark:bg-vimdark-300/30`}
                    >
                        <SidebarList
                            items={results.synonyms}
                            title="Synonyms"
                            icon={ArrowRight}
                            colorClass="text-green-500 dark:text-green-400"
                            emptyMessage="No synonyms found"
                        />
                    </motion.div>

                    {/* Main Content - Definitions */}
                    <div className={`${![Sections.All, Sections.Meaning].includes(activeSection) ? 'hidden' : ''} flex-1 p-0.5 sm:p-2`}>
                        <motion.div
                            variants={itemVariants as any}
                            className="flex items-center gap-2 mb-2 px-1"
                        >
                            <BookOpen size={14} className="text-primary-100" />
                            <h5 className="text-xs font-bold text-gray-500 dark:text-gray-500 uppercase tracking-widest">
                                Definitions
                            </h5>
                        </motion.div>

                        <div className="space-y-3 h-full max-h-[50dvh] sm:max-h-[60dvh] overflow-y-auto pr-2 scrollbar-custom sm:pb-10">
                            <AnimatePresence mode="popLayout">
                                {results.meanings.map((entry, index) => (
                                    <WordCard
                                        key={`${searchPhrase}-${entry.type}-${index}`}
                                        entry={entry}
                                        index={index}
                                    />
                                ))}
                            </AnimatePresence>
                        </div>
                    </div>

                    {/* Antonyms Sidebar */}
                    <motion.div
                        variants={itemVariants as any}
                        className={`${![Sections.All, Sections.Antonyms].includes(activeSection) ? 'hidden' : ''} md:w-56 xl:w-64 flex-shrink-0 p-5 border-t md:border-t-0 md:border-l border-gray-100 dark:border-vimdark-500/50 bg-gray-50/50 dark:bg-vimdark-300/30`}
                    >
                        <SidebarList
                            items={results.antonyms}
                            title="Antonyms"
                            icon={ArrowRight}
                            colorClass="text-red-500 dark:text-red-400"
                            emptyMessage="No antonyms found"
                        />
                    </motion.div>
                </div>
            </div>
        </motion.div>
    );
};

export default ResultCard;
