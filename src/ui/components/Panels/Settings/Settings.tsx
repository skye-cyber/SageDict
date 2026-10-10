import { motion, AnimatePresence } from 'framer-motion';
import { useState, useRef, useEffect } from 'react';
import {
    Bookmark,
    Settings,
    X,
} from 'lucide-react';
import { AppearanceSettings } from './Appearance.tsx';
import { GeneralSettings } from './General.tsx';
import { NotificationSettings } from './Notifications.tsx';
import { PrivacySettings } from './Privacy.tsx';
import { BookmarkContent } from './Bookmark.tsx';

interface PanelProps {
    isOpen: boolean;
    onSettingToggle: () => void;
}

type TabId = 'bookmarks' | 'appearance' | 'notifications' | 'privacy' | 'general';

interface TabConfig {
    id: TabId;
    label: string;
    icon: React.ElementType;
    color: string;
}


const panelVariants = {
    hidden: {
        opacity: 0,
        y: -20,
        scale: 0.95,
        filter: 'blur(10px)'
    },
    visible: {
        opacity: 1,
        y: 0,
        scale: 1,
        filter: 'blur(0px)',
        transition: {
            type: 'spring',
            damping: 25,
            stiffness: 300,
            staggerChildren: 0.05,
            delayChildren: 0.1
        }
    },
    exit: {
        opacity: 0,
        y: -20,
        scale: 0.95,
        filter: 'blur(10px)',
        transition: { duration: 0.2 }
    }
};

const tabContentVariants = {
    hidden: { opacity: 0, x: 20 },
    visible: {
        opacity: 1,
        x: 0,
        transition: { type: 'spring', damping: 30, stiffness: 300 }
    },
    exit: {
        opacity: 0,
        x: -20,
        transition: { duration: 0.15 }
    }
};


const tabs: TabConfig[] = [
    { id: 'bookmarks', label: 'Bookmarks', icon: Bookmark, color: '#5252ff' },
    //{ id: 'appearance', label: 'Appearance', icon: Palette, color: '#38bdf8' },
    { id: 'general', label: 'General', icon: Settings, color: '#6d98fd' },
    //{ id: 'notifications', label: 'Alerts', icon: Bell, color: '#83b4fd' },
    //{ id: 'privacy', label: 'Privacy', icon: Shield, color: '#6e77fe' },
];


const TabButton: React.FC<{
    tab: TabConfig;
    isActive: boolean;
    onClick: () => void;
}> = ({ tab, isActive, onClick }) => {
    const Icon = tab.icon;

    return (
        <motion.button
            onClick={onClick}
            className={`relative flex items-center justify-center sd:justify-start gap-1 sm:gap-2.5 px-1 py-2 sm:px-4 sm:py-3 rounded-xl text-sm font-medium transition-colors duration-200 w-full
            ${isActive
                    ? 'text-white'
                    : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/5'
                }`}
            whileHover={{ x: 4 }}
            whileTap={{ scale: 0.97 }}
        >
            {isActive && (
                <motion.div
                    layoutId="activeTab"
                    className="absolute inset-0 rounded-xl"
                    style={{ backgroundColor: tab.color }}
                    initial={false}
                    transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                />
            )}
            <span className="relative z-10 flex items-center gap-2.5">
                <Icon size={18} />
                <span className="hidden lg:inline">{tab.label}</span>
            </span>
            {isActive && (
                <motion.div
                    layoutId="activeIndicator"
                    className="absolute top-1 right-1 sd:right-2 sd:top-1/2  -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-white"
                    transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                />
            )}
        </motion.button>
    );
};


export const SettingPanel: React.FC<PanelProps> = ({ isOpen, onSettingToggle }) => {
    const [activeTab, setActiveTab] = useState<TabId>('bookmarks');
    const panelRef = useRef<HTMLDivElement>(null);

    // Close on escape key
    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onSettingToggle();
        };
        if (isOpen) {
            document.addEventListener('keydown', handleEscape);
            return () => document.removeEventListener('keydown', handleEscape);
        }
    }, [isOpen, onSettingToggle]);

    // Close on click outside
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
                onSettingToggle();
            }
        };
        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
            return () => document.removeEventListener('mousedown', handleClickOutside);
        }
    }, [isOpen, onSettingToggle]);




    const activeTabConfig = tabs.find(t => t.id === activeTab)!;

    const renderContent = () => {
        switch (activeTab) {
            case 'bookmarks':
                return <BookmarkContent />
            case 'appearance':
                return <AppearanceSettings />;
            case 'general':
                return <GeneralSettings />;
            case 'notifications':
                return <NotificationSettings />;
            case 'privacy':
                return <PrivacySettings />;
            default:
                return null;
        }
    };


    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="fixed inset-0 bg-black/30 dark:bg-black/40 z-40"
                        onClick={onSettingToggle}
                    />

                    {/* Panel */}
                    <motion.div
                        ref={panelRef}
                        variants={panelVariants as any}
                        initial="hidden"
                        animate="visible"
                        exit="exit"
                        className="fixed top-0 sm:top-12 right-0 z-50 max-[450px]:w-[100dvw] sm:w-[80vw] h-[100dvh] sm:h-[85vh] overflow-hidden rounded-xl sm:rounded-2xl shadow-2xl border border-gray-200 dark:border-white/10 bg-gradient-to-br from-[#ffffff] to-[#f8f9fa] dark:from-[#1a1a1a] dark:to-[#151515] select-none"
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between p-5 border-b border-gray-200 dark:border-white/5">
                            <div className="flex items-center gap-3">
                                <motion.div
                                    initial={{ rotate: -180, scale: 0 }}
                                    animate={{ rotate: 0, scale: 1 }}
                                    transition={{ type: 'spring', damping: 20 }}
                                    className="p-2 rounded-xl"
                                    style={{ backgroundColor: `${activeTabConfig.color}15` }}
                                >
                                    <activeTabConfig.icon size={20} style={{ color: activeTabConfig.color }} />
                                </motion.div>
                                <div>
                                    <motion.h2
                                        key={activeTab}
                                        initial={{ opacity: 0, x: -10 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        className="text-lg font-bold text-gray-900 dark:text-gray-100"
                                    >
                                        {activeTabConfig.label}
                                    </motion.h2>
                                    <p className="text-[11px] text-gray-500 dark:text-gray-500">Manage your preferences</p>
                                </div>
                            </div>

                            <motion.button
                                whileHover={{ scale: 1.1, rotate: 90 }}
                                whileTap={{ scale: 0.9 }}
                                onClick={onSettingToggle}
                                className="p-2 rounded-xl text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/5 transition-colors"
                            >
                                <X size={18} />
                            </motion.button>
                        </div>

                        <div className="flex h-[calc(85vh-80px)]">
                            {/* Sidebar Tabs */}
                            <div className="w-12 sm:w-16 lg:w-52 p-1 sm:p-3 border-r border-gray-200 dark:border-white/5 space-y-1 flex-shrink-0 overflow-y-auto">
                                {tabs.map((tab) => (
                                    <TabButton
                                        key={tab.id}
                                        tab={tab}
                                        isActive={activeTab === tab.id}
                                        onClick={() => setActiveTab(tab.id)}
                                    />
                                ))}

                                {/* Decorative element */}
                                <div className="hidden mt-6 pt-6 border-t border-gray-200 dark:border-white/5">
                                    <div className="px-4 py-3 rounded-xl bg-gray-50 dark:bg-white/[0.02] border border-gray-200 dark:border-white/5">
                                        <div className="flex items-center gap-2 mb-2">
                                            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                                            <span className="text-[10px] text-gray-500 font-mono">SYSTEM ACTIVE</span>
                                        </div>
                                        <div className="h-1 w-full bg-gray-200 dark:bg-white/5 rounded-full overflow-hidden">
                                            <motion.div
                                                className="h-full rounded-full bg-primary-100"
                                                animate={{ width: ['0%', '100%', '0%'] }}
                                                transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Content Area */}
                            <div className="flex-1 p-1 sm:p-5 overflow-y-auto scrollbar-custom">
                                <AnimatePresence mode="wait">
                                    <motion.div
                                        key={activeTab}
                                        variants={tabContentVariants as any}
                                        initial="hidden"
                                        animate="visible"
                                        exit="exit"
                                    >
                                        {renderContent()}
                                    </motion.div>
                                </AnimatePresence>
                            </div>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
};
