import React from 'react';
import { FiBookOpen, FiSun, FiMoon, FiSettings } from 'react-icons/fi';
import { useTheme } from '../components/Themes/useThemeHeadless';

interface HeaderProps {
    onSettingToggle: () => void;
}

const Header: React.FC<HeaderProps> = ({ onSettingToggle }) => {
    const { isDark, toggleTheme } = useTheme()

    return (
        <header className="flex bg-white dark:bg-vimdark-500 items-center justify-between p-3 border-b border-gray-200 dark:border-vimdark-500">
            <div className="flex items-center space-x-2">
                <FiBookOpen className="text-2xl text-blue-500" />
            </div>
            <div className="flex items-center space-x-2 text-primary-200 dark:text-white">
                <button
                    onClick={toggleTheme}
                    className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-vimdark-400"
                    title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
                >
                    {isDark ? <FiSun /> : <FiMoon />}
                </button>
                <button
                    onClick={onSettingToggle}
                    className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-vimdark-400"
                    title="Settings"
                >
                    <FiSettings />
                </button>
            </div>
        </header>
    );
};

export default Header;
