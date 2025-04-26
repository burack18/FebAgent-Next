'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Service } from '@/types/chat';

// Simple User Icon SVG
const UserIcon: React.FC<{ className?: string }> = ({ className = "w-5 h-5" }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
    </svg>
);

const UserMenu: React.FC = () => {
    const [isOpen, setIsOpen] = useState(false);
    const { currentUser, logout, service, setService } = useAuth();
    const menuRef = useRef<HTMLDivElement>(null);

    // Close dropdown if clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    const handleLogout = () => {
        logout();
        setIsOpen(false);
    };
    const handleServiceChange = (newService: Service) => {
        console.log('Service changed to:', newService);
        setService(newService==1? Service.Gemini : Service.ChatGPT); 
    }

    return (
        <div className="relative ml-auto flex items-center space-x-2" ref={menuRef}>
            <select onChange={(e: any) => handleServiceChange(e.target.value)}>
                <option value={Service.ChatGPT}>ChatGPT</option>
                <option value={Service.Gemini}>Gemini</option>
            </select>
            {currentUser && (
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300 truncate">
                    {currentUser.username}
                </span>
            )}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="p-1 rounded-full text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:focus:ring-offset-gray-800 cursor-pointer"
                title="User Menu"
            >
                <UserIcon />
            </button>

            {isOpen && (
                <div className="absolute right-0 top-full mt-1 w-48 bg-white dark:bg-gray-800 rounded-md shadow-lg py-1 ring-1 ring-black ring-opacity-5 z-20">

                    <button
                        onClick={handleLogout}
                        className="block w-full text-left px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer"
                    >
                        Logout
                    </button>
                </div>
            )}
        </div>
    );
};

export default UserMenu; 