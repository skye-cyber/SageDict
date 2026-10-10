import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence, useAnimation } from 'framer-motion';
import { BookOpen, Sparkles } from 'lucide-react';
import Header from '../components/Header';
import ResultCard from '../components/Results';
import EmptyState from '../components/EmptyState';
import { PartialMatchCard } from '../components/PartialMatch';
import { DictionaryEntry } from '../../types/global';
import SearchBar from '../components/SearchBar';
import { sage } from '../../core/hooks/sage';

const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
        opacity: 1,
        transition: {
            staggerChildren: 0.08,
            delayChildren: 0.1,
        },
    },
};

const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
        opacity: 1,
        y: 0,
        //         filter: 'blur(0px)',
        transition: {
            type: 'spring',
            damping: 25,
            stiffness: 300,
        },
    },
};


const SearchSkeleton: React.FC = () => (
    <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="flex flex-col items-center justify-center py-20 space-y-6"
    >
        <div className="relative">
            <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                className="w-12 h-12 rounded-full border-2 border-primary-400/20 border-t-primary-400"
            />
            <motion.div
                animate={{ rotate: -360 }}
                transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
                className="absolute inset-1 w-10 h-10 rounded-full border-2 border-secondary-400/20 border-b-secondary-400"
            />
        </div>
        <div className="text-center space-y-2">
            <motion.p
                animate={{ opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="text-sm font-medium text-gray-500 dark:text-gray-400"
            >
                Searching dictionary...
            </motion.p>
            <p className="text-xs text-gray-400 dark:text-gray-600">Analyzing definitions and context</p>
        </div>
    </motion.div>
);


interface HomePageProps {
    onSettingToggle: () => void;
}

const HomePage: React.FC<HomePageProps> = ({ onSettingToggle }) => {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<DictionaryEntry | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [partialMatches, setPartialMatches] = useState<string[] | null>(null);
    const [isFocused, setIsFocused] = useState(false);
    const [hasSearched, setHasSearched] = useState(false);
    const controls = useAnimation();
//     const [searchedPhrase, setSearchedPhrase] = useState<string | null>(null)

    const performSearch = useCallback(async (searchQuery: string) => {
        if (!searchQuery.trim()) {
            setResults(null);
            setHasSearched(false);
            return;
        }

        setIsLoading(true);
        setHasSearched(true);
        setPartialMatches(null);
//         setSearchedPhrase(query)
        try {
            // Simulate slight delay for UX smoothness if needed
            const searchResult = await sage.dict.searchWord(searchQuery);
            // Staggered reveal animation
            await controls.start('hidden');
            if (searchResult) {
                setResults(searchResult);
            }
            await controls.start('visible');
        } catch (err) {
            console.error('Search error:', err);
            setResults(null);
        } finally {
            setIsLoading(false);
        }
    }, [controls]);

    const hintOnType = useCallback(async(searchQuery: string) => {
//         setQuery(searchQuery);
        if (!searchQuery.trim()) {
            setPartialMatches(null);
            return;
        }
        const hints = await sage.dict.getHint(searchQuery);
        setPartialMatches(hints?.length ? hints : null);
    }, []);

    const handleSearch = useCallback((value: string) => {
        setQuery(value);
        performSearch(value);
    }, [performSearch]);

    const clearSearch = useCallback(() => {
        setQuery('');
        setResults(null);
        setPartialMatches(null);
        setHasSearched(false);
    }, []);

    // Clear partial matches when clicking outside (handled in SearchBar blur)

    return (
        <motion.div
            initial="hidden"
            animate="visible"
            variants={containerVariants}
            className="relative min-h-screen bg-gray-50 dark:bg-vimdark-100 text-gray-900 dark:text-white overflow-hidden"
        >
            {/* Ambient Background Effects */}
            <div className="dark:hidden fixed inset-0 pointer-events-none overflow-hidden">
                <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary-400/5 rounded-full blur-3xl" />
                <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-secondary-400/5 rounded-full blur-3xl" />
            </div>

            <div className="relative z-[10] flex flex-col min-h-screen pt-6 sm:pt-0">
                {/* Header */}
                <motion.div variants={itemVariants as any}>
                    <Header onSettingToggle={onSettingToggle} />
                </motion.div>

                {/* Search Section */}
                <motion.section
                    variants={itemVariants as any}
                    className={`flex flex-col justify-center px-4 transition-all duration-500 ${hasSearched ? 'pt-1 pb-0' : 'flex-1 pb-2'
                        }`}
                >
                    {/* Hero text - only shown before first search */}
                    <AnimatePresence>
                        {!hasSearched && (
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -20, filter: 'blur(8px)' }}
                                transition={{ duration: 0.5 }}
                                className="text-center mb-8 space-y-3"
                            >
                                <motion.div
                                    initial={{ scale: 0 }}
                                    animate={{ scale: 1 }}
                                    transition={{ type: 'spring', damping: 20, delay: 0.2 }}
                                    className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary-100/10 border border-primary-400/20 mb-4"
                                >
                                    <BookOpen size={32} className="text-primary-100" />
                                </motion.div>
                                <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-gray-900 via-primary-200 to-secondary-400 dark:from-white dark:via-primary-100 dark:to-secondary-400 bg-clip-text text-transparent">
                                    Dictionary
                                </h1>
                                <p className="text-gray-500 dark:text-gray-400 text-sm md:text-base max-w-md mx-auto">
                                    Advanced search with intelligent matching and instant definitions
                                </p>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Search Bar Container */}
                    <div className="relative w-full max-w-full sm:max-w-2xl mx-auto">
                        <SearchBar
                            query={query}
                            onSearch={handleSearch}
                            onClear={clearSearch}
                            onType={hintOnType}
                            isFocused={isFocused}
                            setIsFocused={(v) => setIsFocused(v)}
                        />

                        {/* Partial Matches Dropdown */}
                        {(partialMatches && partialMatches.length > 0 && isFocused) && (
                            <PartialMatchCard
                                searchPhrase={query}
                                matchPhrases={partialMatches}
                                onSelect={(hint) => {
                                    handleSearch(hint);
                                    setIsFocused(false);
                                }}
                            />
                        )}
                    </div>

                    {/* Quick tags - shown when focused and empty */}
                    <AnimatePresence>
                        {isFocused && !query && !hasSearched && (
                            <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                className="flex flex-wrap justify-center gap-2 mt-6"
                            >
                                {['serendipity', 'ephemeral', 'luminous', 'resilience'].map((word, i) => (
                                    <motion.button
                                        key={word}
                                        initial={{ opacity: 0, scale: 0.9 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        transition={{ delay: i * 0.05 }}
                                        whileHover={{ scale: 1.05, y: -2 }}
                                        whileTap={{ scale: 0.95 }}
                                        onClick={() => handleSearch(word)}
                                        className="px-3 py-1.5 rounded-full text-xs font-medium bg-white dark:bg-vimdark-200 border border-gray-200 dark:border-vimdark-400 text-gray-600 dark:text-gray-400 hover:border-primary-400/30 hover:text-primary-100 dark:hover:text-primary-100 transition-colors shadow-sm"
                                    >
                                        {word}
                                    </motion.button>
                                ))}
                            </motion.div>
                        )}
                    </AnimatePresence>
                </motion.section>

                {/* Results Section */}
                <main className="flex-1 p-0 sm:px-4 pb-8">
                    <div className="max-w-full sm:max-w-6xl mx-auto">
                        <AnimatePresence mode="wait">
                            {isLoading ? (
                                <motion.div
                                    key="loading"
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                >
                                    <SearchSkeleton />
                                </motion.div>
                            ) : results && results.meanings ? (
                                <ResultCard searchPhrase={query} results={results} />
                            ) : (
                                <motion.div
                                    key="empty"
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                >
                                    <EmptyState query={query} />
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </main>

                {/* Footer */}
                <motion.footer
                    variants={itemVariants as any}
                    className="hidden py-4 px-4 text-center border-t border-gray-200 dark:border-vimdark-500/50"
                >
                    <div className="flex items-center justify-center gap-2 text-xs text-gray-400 dark:text-gray-600">
                        <Sparkles size={12} className="text-primary-400/60" />
                        <span>Desktop Dictionary — Advanced search with AI integration</span>
                    </div>
                </motion.footer>
            </div>
        </motion.div>
    );
};

export default HomePage;
