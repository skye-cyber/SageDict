import React, { useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, ArrowRight, TrendingUp, Hash } from 'lucide-react';

const containerVariants = {
    hidden: {
        opacity: 0,
        y: -8,
        scale: 0.96,
        filter: 'blur(8px)'
    },
    visible: {
        opacity: 1,
        y: 0,
        scale: 1,
        filter: 'blur(0px)',
        transition: {
            type: 'spring',
            damping: 25,
            stiffness: 350,
            staggerChildren: 0.04,
            delayChildren: 0.05,
        },
    },
    exit: {
        opacity: 0,
        y: -8,
        scale: 0.96,
        filter: 'blur(8px)',
        transition: { duration: 0.15, ease: 'easeInOut' },
    },
};

const itemVariants = {
    hidden: { opacity: 0, x: -15 },
    visible: {
        opacity: 1,
        x: 0,
        transition: {
            type: 'spring',
            damping: 25,
            stiffness: 300,
        },
    },
    exit: {
        opacity: 0,
        x: 10,
        transition: { duration: 0.1 },
    },
};

const highlightVariants = {
    initial: { scaleX: 0 },
    animate: {
        scaleX: 1,
        transition: { type: 'spring', damping: 20, stiffness: 300 }
    },
};


interface HighlightedTextProps {
    text: string;
    highlight: string;
}

const HighlightedText: React.FC<HighlightedTextProps> = ({ text, highlight }) => {
    const parts = useMemo(() => {
        if (!highlight) return [{ text, isMatch: false }];

        const lowerText = text.toLowerCase();
        const lowerHighlight = highlight.toLowerCase();
        const result: { text: string; isMatch: boolean }[] = [];

        let lastIndex = 0;
        let index = lowerText.indexOf(lowerHighlight);

        while (index !== -1) {
            if (index > lastIndex) {
                result.push({ text: text.slice(lastIndex, index), isMatch: false });
            }
            result.push({ text: text.slice(index, index + highlight.length), isMatch: true });
            lastIndex = index + highlight.length;
            index = lowerText.indexOf(lowerHighlight, lastIndex);
        }

        if (lastIndex < text.length) {
            result.push({ text: text.slice(lastIndex), isMatch: false });
        }

        return result;
    }, [text, highlight]);

    return (
        <span className="flex items-center">
            {parts.map((part, i) => (
                <span
                    key={i}
                    className={
                        part.isMatch
                            ? 'text-primary-100 font-semibold bg-primary-400/10 px-0.5 rounded'
                            : 'text-gray-600 dark:text-gray-400'
                    }
                >
                    {part.text}
                </span>
            ))}
        </span>
    );
};

interface SearchMatchProps {
    searchPhrase: string;
    matchPhrase: string;
    onSelect: (hint: string) => void;
    index: number;
}

const PartialMatchPhrase: React.FC<SearchMatchProps> = ({
    searchPhrase,
    matchPhrase,
    onSelect,
    index
}) => {
    const handleClick = useCallback(() => {
        onSelect(matchPhrase);
    }, [matchPhrase, onSelect]);

    // Skip if search is longer than match (invalid state)
    if (searchPhrase.length > matchPhrase.length) return null;

    return (
        <motion.div
            variants={itemVariants as any}
            initial="hidden"
            animate="visible"
            exit="exit"
            layout
            onClick={handleClick}
            whileHover={{ x: 4, backgroundColor: 'rgba(82, 82, 255, 0.05)' }}
            whileTap={{ scale: 0.98 }}
            className="group relative flex items-center gap-3 px-4 py-3 cursor-pointer select-none border-b border-gray-100 dark:border-vimdark-500/30 last:border-0 transition-colors"
        >
            {/* Index number */}
            <div className="flex-shrink-0 w-6 h-6 rounded-md bg-gray-100 dark:bg-vimdark-400/50 flex items-center justify-center">
                <span className="text-[10px] font-mono font-bold text-gray-400 dark:text-gray-500">
                    {index + 1}
                </span>
            </div>

            {/* Match content */}
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                    <Search size={14} className="text-gray-400 dark:text-gray-600 flex-shrink-0" />
                    <div className="text-sm truncate">
                        <HighlightedText
                            text={matchPhrase}
                            highlight={searchPhrase}
                        />
                    </div>
                </div>
            </div>

            {/* Arrow indicator on hover */}
            <motion.div
                initial={{ opacity: 0, x: -5 }}
                whileHover={{ opacity: 1, x: 0 }}
                className="opacity-0 group-hover:opacity-100 transition-opacity"
            >
                <ArrowRight size={14} className="text-primary-400" />
            </motion.div>

            {/* Active indicator line */}
            <motion.div
                variants={highlightVariants as any}
                initial="initial"
                whileHover="animate"
                className="absolute left-0 top-2 bottom-2 w-0.5 rounded-full bg-primary-400 origin-top"
            />
        </motion.div>
    );
};


interface MatchPhrasesProps {
    searchPhrase: string;
    matchPhrases: string[];
    onSelect: (hint: string) => void;
}

export const PartialMatchCard: React.FC<MatchPhrasesProps> = ({
    searchPhrase,
    matchPhrases,
    onSelect
}) => {
    // Guard clauses
    if (!searchPhrase?.trim() || matchPhrases.length === 0) return null;
    console.log("MatchPhrase", matchPhrases)
    // Deduplicate and sort matches by relevance (exact startsWith first)
    const processedMatches = useMemo(() => {
        const unique = [...new Set(matchPhrases?.map(m => m.toLowerCase()))];
        return unique.sort((a, b) => {
            const aStarts = a.startsWith(searchPhrase.toLowerCase());
            const bStarts = b.startsWith(searchPhrase.toLowerCase());
            if (aStarts && !bStarts) return -1;
            if (!aStarts && bStarts) return 1;
            return a.localeCompare(b);
        });
    }, [matchPhrases, searchPhrase]);

    return (
        <AnimatePresence>
            <motion.div
                variants={containerVariants as any}
                initial="hidden"
                animate="visible"
                exit="exit"
                layout
                className="absolute top-full left-0 right-1/3 mt-2 z-[50] w-full max-w-lg mx-auto"
            >
                <div className="relative bg-white dark:bg-vimdark-200/95 backdrop-blur-xl rounded-2xl shadow-2xl shadow-black/10 dark:shadow-black/30 border border-gray-200 dark:border-vimdark-500/50 overflow-hidden">
                    {/* Header */}
                    <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-vimdark-500/30 bg-gray-50/50 dark:bg-vimdark-300/30">
                        <div className="flex items-center gap-2">
                            <TrendingUp size={14} className="text-primary-400" />
                            <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                Suggestions
                            </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <Hash size={12} className="text-gray-400" />
                            <span className="text-[10px] font-mono text-gray-400 dark:text-gray-600">
                                {matchPhrases.length}
                            </span>
                        </div>
                    </div>

                    {/* Matches list */}
                    <div className="max-h-72 overflow-x-hidden overflow-y-auto scrollbar-custom py-1">
                        <AnimatePresence mode="popLayout">
                            {matchPhrases.map((match, index) => (
                                <PartialMatchPhrase
                                    key={match}
                                    searchPhrase={searchPhrase}
                                    matchPhrase={match.toLowerCase()}
                                    onSelect={onSelect}
                                    index={index}
                                />
                            ))}
                        </AnimatePresence>
                    </div>

                    {/* Footer hint */}
                    <div className="px-4 py-2.5 border-t border-gray-100 dark:border-vimdark-500/30 bg-gray-50/30 dark:bg-vimdark-300/20">
                        <p className="text-[10px] text-center text-gray-400 dark:text-gray-600">
                            Press <kbd className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-vimdark-400/50 border border-gray-200 dark:border-vimdark-500 font-mono text-[9px]">↑</kbd>
                            <kbd className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-vimdark-400/50 border border-gray-200 dark:border-vimdark-500 font-mono text-[9px] mx-1">↓</kbd>
                            to navigate, <kbd className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-vimdark-400/50 border border-gray-200 dark:border-vimdark-500 font-mono text-[9px] mx-1">Click</kbd>
                            to select
                        </p>
                    </div>

                    {/* Bottom gradient fade */}
                    <div className="absolute bottom-8 left-0 right-0 h-8 bg-gradient-to-t from-white dark:from-vimdark-200 to-transparent pointer-events-none" />
                </div>
            </motion.div>
        </AnimatePresence>
    );
};
