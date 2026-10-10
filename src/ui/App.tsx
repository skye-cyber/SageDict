/// <reference path="../types/global.d.ts">
import React, { useState } from 'react';
import HomePage from './pages/HomePage';
import "./styles/global.css"
import { SettingPanel } from './components/Panels/Settings/Settings';


const App: React.FC = () => {
    const [settingOpen, setSettingsOpen] = useState(false)
    const onSettingToggle =()=>{
        setSettingsOpen(!settingOpen)
    }
    return (
        <div className="min-h-screen flex flex-col bg-white dark:bg-vimdark-100 overflow-hidden max-w-[100vw]">
            <HomePage onSettingToggle={onSettingToggle} />
            <SettingPanel isOpen={settingOpen} onSettingToggle={onSettingToggle} />
        </div>
    );
};

export default App;
