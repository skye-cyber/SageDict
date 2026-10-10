import { motion, AnimatePresence } from 'framer-motion';
import { useCallback, useEffect, useState } from 'react';
import { BookmarkEntry } from '../../../../types/global';
import { ExternalLink, Trash2, Search, Plus, Bookmark } from 'lucide-react';
import { globalEventBus } from '../../../../core/Globals/eventBus';
import { StateManager } from '../../../../core/Globals/StatesManager';
import { sage } from '../../../../core/hooks/sage';


const CardHoverColors: Array<string> = [
    "#38bdf8",
    "#5252ff",
    "#6d98fd",
    "#83b4fd",
    "#4d5a88"
]

const bookmarkItemVariants = {
    hidden: { opacity: 0, y: 10, scale: 0.95 },
    visible: (i: number) => ({
        opacity: 1,
        y: 0,
        scale: 1,
        transition: { delay: i * 0.05, type: 'spring', damping: 20 }
    }),
    exit: { opacity: 0, scale: 0.9, transition: { duration: 0.2 } }
};

export const BookmarkCard: React.FC<{
    bookmark: BookmarkEntry;
    index: number;
    onDelete: (id: string) => void;
    onView: (bookmark: BookmarkEntry) => void;
}> = ({ bookmark, index, onDelete, onView }) => {
    const [isHovered, setIsHovered] = useState(false);

    return (
        <motion.div
            custom={index}
            variants={bookmarkItemVariants as any}
            initial="hidden"
            animate="visible"
            exit="exit"
            layout
            onHoverStart={() => setIsHovered(true)}
            onHoverEnd={() => setIsHovered(false)}
            className="group relative gap-2 w-[90%] ml-2"
        >
            <motion.div
                className="relative p-4 rounded-xl border border-gray-200 dark:border-white/5 bg-white dark:bg-white/[0.02] overflow-hidden cursor-pointer shadow-sm hover:shadow-md dark:shadow-none transition-shadow w-full"
                whileHover={{ scale: 1.02, borderColor: 'rgba(82, 82, 255, 0.3)' }}
                whileTap={{ scale: 0.98 }}
                onClick={() => onView(bookmark)}
            >
                {/* Color accent bar */}
                <motion.div
                    className="absolute left-0 top-0 bottom-0 w-1 rounded-l-xl dark:bg-[#38bdf8]"
                    style={{ backgroundColor: '#5252ff' }}
                    animate={{ width: isHovered ? 4 : 3 }}
                />

                <div className="flex items-start justify-between pl-3">
                    {bookmark.phrase && (
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                                <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
                                    {bookmark.phrase}
                                </h3>
                                {bookmark.phrase && (
                                    <ExternalLink size={12} className="text-gray-400 flex-shrink-0" />
                                )}
                            </div>

                            <span className="hidden inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-medium bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-white/5">
                                {bookmark.phrase}
                            </span>

                            <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-2">
                                {bookmark.added_at}
                            </p>
                        </div>
                    )}

                    <AnimatePresence>
                        {isHovered && (
                            <motion.div
                                initial={{ opacity: 0, scale: 0.8 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.8 }}
                                className="flex items-center gap-1 ml-2"
                            >
                                <motion.button
                                    whileHover={{ scale: 1.1 }}
                                    whileTap={{ scale: 0.9 }}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onDelete(bookmark.phrase);
                                    }}
                                    className="p-1.5 rounded-lg text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                                >
                                    <Trash2 size={14} />
                                </motion.button>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                {/* Hover glow effect */}
                <motion.div
                    className="absolute inset-0 rounded-xl pointer-events-none"
                    style={{
                        background: `radial-gradient(circle at 50% 0%, ${CardHoverColors[Math.round(Math.random() * 10)]}10, transparent 70%)`
                    }}
                    animate={{ opacity: isHovered ? 1 : 0 }}
                    transition={{ duration: 0.3 }}
                />
            </motion.div>
        </motion.div>
    );
};


export const BookmarkContent: React.FC = ({ }) => {
    const [searchQuery, setSearchQuery] = useState<string | null>(null)
    const [bookmarks, setBookmarks] = useState<BookmarkEntry[] | null>(null);

    const loadBookmark = async () => {
        const bookmarkItems = await sage.bookmarks.readBookmarks()
        if (bookmarkItems) {
            setBookmarks(bookmarkItems)
            StateManager.set('bookmarks', bookmarkItems)
        }
    }

    useEffect(() => {
        if (bookmarks) return;
        loadBookmark()
    })

    const filteredBookmarks = bookmarks?.filter(b =>
        searchQuery ? b.phrase.toLowerCase().includes(searchQuery.toLowerCase()) : b
    );

    const onBookmarkDelete = useCallback(async (phrase: string) => {
        const new_bookmarks = await sage.bookmarks.deleteByPhrase(phrase)
        if (new_bookmarks) {
            globalEventBus.emit('bookmark:change') // loadBookmark()
        }
    }, [bookmarks]);

    const onBookmarkView = (bookmark: BookmarkEntry) => {
        if (bookmark.phrase) {
            globalEventBus.emit('search:query:update', (bookmark.phrase))
        }
    };

    useEffect(() => {
        const bookMarkChangeListener = globalEventBus.on('bookmark:change', loadBookmark)
        return () => bookMarkChangeListener.unsubscribe()
    }, [])

    return (
        <div className="space-y-2">
            {/* Search & Add */}
            <div className="flex gap-2">
                <div className="relative flex-1">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Search bookmarks..."
                        value={searchQuery || '' as string}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-gray-50 dark:bg-white/[0.03] border border-gray-200 dark:border-white/5 text-gray-800 dark:text-gray-200 text-sm placeholder-gray-400 dark:placeholder-gray-600 focus:outline-none focus:border-primary-400/30 transition-all"
                    />
                </div>
                <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="p-2.5 rounded-xl bg-primary-400/10 border border-primary-400/20 text-primary-500 dark:text-primary-400 hover:bg-primary-400/20 transition-colors"
                >
                    <Plus size={18} />
                </motion.button>
            </div>

            {/* Bookmarks List */}
            <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1 scrollbar-custom pb-6">
                <AnimatePresence mode="popLayout">
                    {filteredBookmarks && filteredBookmarks.length > 0 ? (
                        filteredBookmarks.map((bookmark, index) => (
                            <BookmarkCard
                                key={index}
                                bookmark={bookmark}
                                index={index}
                                onDelete={onBookmarkDelete}
                                onView={onBookmarkView}
                            />
                        ))
                    ) : (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="text-center py-12"
                        >
                            <Bookmark size={32} className="mx-auto text-gray-300 dark:text-gray-700 mb-3" />
                            <p className="text-sm text-gray-500 dark:text-gray-500">No bookmarks found</p>
                            <p className="text-xs text-gray-400 dark:text-gray-600 mt-1">Try adjusting your search</p>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* Stats footer */}
            <div className="sticky bottom-0 pt-3 border-t border-gray-200 dark:border-white/5 flex justify-between items-center text-[11px] text-gray-400 dark:text-gray-600">
                <span>{bookmarks?.length || 0} total bookmarks</span>
                <span>{filteredBookmarks?.length || 0} shown</span>
            </div>
        </div>
    );
}
