import React, { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, X, Command, Sparkles, ArrowRight } from 'lucide-react';
import { globalEventBus } from '../../core/Globals/eventBus';

const containerVariants = {
    focused: {
        scale: 1.02,
        transition: { type: 'spring', damping: 25, stiffness: 300 },
    },
    unfocused: {
        scale: 1,
        transition: { type: 'spring', damping: 25, stiffness: 300 },
    },
};

const iconVariants = {
    idle: { rotate: 0, scale: 1 },
    searching: {
        rotate: [0, -10, 10, -10, 0],
        scale: [1, 1.1, 1],
        transition: { duration: 0.5 }
    },
};

const clearButtonVariants = {
    hidden: { opacity: 0, scale: 0.8, x: 10 },
    visible: {
        opacity: 1,
        scale: 1,
        x: 0,
        transition: { type: 'spring', damping: 20, stiffness: 300 }
    },
    exit: {
        opacity: 0,
        scale: 0.8,
        x: 10,
        transition: { duration: 0.15 }
    },
};

const shortcutVariants = {
    hidden: { opacity: 0, scale: 0.9 },
    visible: { opacity: 1, scale: 1 },
};


interface SearchBarProps {
    query: string;
    onSearch: (value: string) => void;
    onClear: () => void;
    onType: (value: string) => void;
    isFocused: boolean
    setIsFocused: (v: boolean) => void
}

const SearchBar: React.FC<SearchBarProps> = ({ query, onSearch, isFocused, setIsFocused, onType, onClear }) => {
    const inputRef = useRef<HTMLInputElement>(null);
    const [localQuery, setLocalQuery] = useState(query);
    const [isTyping, setIsTyping] = useState(false);
    const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // Sync with external query prop
    useEffect(() => {
        setLocalQuery(query);
    }, [query]);

    // Global keyboard shortcut: Cmd/Ctrl + K to focus
    useEffect(() => {
        const handleGlobalKeyDown = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
                e.preventDefault();
                inputRef.current?.focus();
            }
        };

        window.addEventListener('keydown', handleGlobalKeyDown);
        return () => window.removeEventListener('keydown', handleGlobalKeyDown);
    }, []);

    // Typing indicator debounce
    const triggerTyping = useCallback(() => {
        setIsTyping(true);
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = setTimeout(() => setIsTyping(false), 300);
    }, []);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        setLocalQuery(value);
        onType(value);
        triggerTyping();
    };

    const handleSubmit = useCallback((e?: React.FormEvent) => {
        e?.preventDefault();
        if (!localQuery.trim()) return;
        onSearch(localQuery);
        inputRef.current?.blur();
    }, [localQuery, onSearch]);

    const handleClear = useCallback(() => {
        setLocalQuery('');
        onClear();
        inputRef.current?.focus();
    }, [onClear]);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Escape') {
            if (localQuery) {
                handleClear();
            } else {
                inputRef.current?.blur();
            }
        } else if (e.key === 'Enter') {
            handleSubmit();
        }
    };

    const hasValue = localQuery.length > 0;

    useEffect(() => {
        const queryUPD = globalEventBus.on('search:query:update', (query) => {
            setLocalQuery(query)
            onSearch(query)
        })
        // const searchListener = globalEventBus.on('perform:search', () => onSearch(localQuery))
        return () => {
            queryUPD.unsubscribe()
            // searchListener.unsubscribe()
        }
    }, [])
    return (
        <motion.form
            onSubmit={handleSubmit}
            variants={containerVariants as any}
            animate={isFocused ? 'focused' : 'unfocused'}
            className="relative w-full max-w-full sm:max-w-2xl mx-auto"
        >

            {/* Main input container */}
            <div
                className={`relative flex items-center gap-3 px-5 py-4 rounded-2xl border-2 transition-all duration-300 bg-white dark:bg-vimdark-200/90 shadow-sm sm:shadow-lg ${isFocused ?
                    'border-primary-400/50 shadow-primary-400/10 dark:shadow-none ring-1 ring-primary-100'
                    : 'border-gray-200 dark:border-vimdark-500/60 hover:border-gray-300 dark:hover:border-vimdark-400'
                    }`}
            >
                {/* Search icon */}
                <motion.div
                    variants={iconVariants}
                    animate={isTyping ? 'searching' : 'idle'}
                    className="flex-shrink-0"
                >
                    <Search
                        size={20}
                        className={`transition-colors duration-300 ${isFocused ? 'text-primary-200' : 'text-gray-400 dark:text-gray-500'}`}
                    />
                </motion.div>

                {/* Input field */}
                <input
                    ref={inputRef}
                    type="text"
                    value={localQuery}
                    onChange={handleChange}
                    onFocus={() => setIsFocused(true)}
                    onBlur={() => setTimeout(() => setIsFocused(false), 200)}
                    onKeyDown={handleKeyDown}
                    placeholder="Search for words..."
                    className="flex-1 bg-transparent text-lg text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-600 focus:outline-none font-medium min-w-0"
                    autoComplete="off"
                    spellCheck={false}
                    autoCapitalize="off"
                />

                {/* Right side actions */}
                <div className="flex items-center gap-2 flex-shrink-0">
                    <AnimatePresence mode="wait">
                        {hasValue ? (
                            <motion.div
                                key="clear"
                                variants={clearButtonVariants as any}
                                initial="hidden"
                                animate="visible"
                                exit="exit"
                            >
                                <motion.button
                                    type="button"
                                    whileHover={{ scale: 1.1 }}
                                    whileTap={{ scale: 0.9 }}
                                    onClick={handleClear}
                                    className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-vimdark-400/50 transition-colors"
                                    title="Clear search"
                                >
                                    <X size={16} />
                                </motion.button>
                            </motion.div>
                        ) : (
                            <motion.kbd
                                key="shortcut"
                                variants={shortcutVariants}
                                initial="hidden"
                                animate="visible"
                                exit="hidden"
                                className="hidden sm:flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-mono font-medium text-gray-400 bg-gray-100 dark:bg-vimdark-400/50 border border-gray-200 dark:border-vimdark-400"
                            >
                                <Command size={10} />
                                <span>K</span>
                            </motion.kbd>
                        )}
                    </AnimatePresence>

                    {/* Submit button (visible when typing) */}
                    <AnimatePresence>
                        {hasValue && (
                            <motion.button
                                type="submit"
                                initial={{ opacity: 0, scale: 0.8, width: 0 }}
                                animate={{ opacity: 1, scale: 1, width: 'auto' }}
                                exit={{ opacity: 0, scale: 0.8, width: 0 }}
                                whileHover={{ scale: 1.1 }}
                                whileTap={{ scale: 0.9 }}
                                className="p-2 rounded-xl bg-primary-400 text-white shadow-lg shadow-primary-400/25 hover:bg-primary-300 transition-colors"
                            >
                                <ArrowRight size={16} />
                            </motion.button>
                        )}
                    </AnimatePresence>
                </div>
            </div>

            {/* Typing indicator line */}
            <motion.div
                className="absolute bottom-0 left-5 right-5 h-0.5 rounded-full bg-gradient-to-r from-primary-400 to-secondary-400 origin-left"
                initial={{ scaleX: 0 }}
                animate={{ scaleX: isTyping ? [0, 1, 0] : 0 }}
                transition={{ duration: 0.6, ease: 'easeInOut' }}
            />

            {/* Helper text */}
            <AnimatePresence>
                {isFocused && !hasValue && (
                    <motion.div
                        initial={{ opacity: 0, y: -5 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -5 }}
                        className="absolute top-full left-0 right-0 mt-0 px-1 flex items-center gap-2 text-[11px] text-gray-500 dark:text-gray-400"
                    >
                        <Sparkles size={12} className="text-primary-100" />
                        <span>Type a word and press Enter to search</span>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.form>
    );
};

export default SearchBar;
