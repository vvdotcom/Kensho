import React from 'react';
import { LogOut, Compass, Map, User } from 'lucide-react';

interface TopNavigationProps {
  currentPage: 'landing' | 'compass' | 'map';
  onNavigate: (page: 'landing' | 'compass' | 'map') => void;
}

export default function TopNavigation({ currentPage, onNavigate }: TopNavigationProps) {
  const navItems = [
    { id: 'compass', label: 'Compass', icon: Compass },
    { id: 'map', label: 'Map', icon: Map },
    { id: 'landing', label: 'Logout', icon: LogOut },
  ] as const;

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-[#0d0d0d] backdrop-blur-sm border-b border-gray-800 font-['Exo',_sans-serif]">
      <div className="flex items-center justify-between px-6 py-4">
        {/* Logo */}
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-[#dfdfdf] rounded-lg flex items-center justify-center">
            <span className="text-[#0d0d0d] font-black text-sm">K</span>
          </div>
          <span className="text-white font-bold text-lg tracking-wide">KENSHO AI</span>
        </div>

        {/* Navigation Items */}
        <nav className="hidden md:flex items-center space-x-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentPage === item.id;
            
            return (
              <button
                key={item.id}
                onClick={() => onNavigate(item.id)}
                className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-all duration-200 ${
                  isActive
                    ? 'bg-[#dfdfdf] text-[#0d0d0d] font-semibold'
                    : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
                }`}
              >
                <Icon size={18} />
                <span className="text-sm">{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Mobile Navigation */}
        <div className="flex md:hidden items-center space-x-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentPage === item.id;
            
            return (
              <button
                key={item.id}
                onClick={() => onNavigate(item.id)}
                className={`p-2 rounded-lg transition-all duration-200 ${
                  isActive
                    ? 'bg-[#dfdfdf] text-[#0d0d0d]'
                    : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
                }`}
              >
                <Icon size={20} />
              </button>
            );
          })}
        </div>

        {/* User Profile */}
        <div className="flex items-center space-x-3">
          <div className="hidden sm:block text-right">
            <p className="text-white text-sm font-medium">Demo User</p>
            <p className="text-gray-400 text-xs">demo@kensho.ai</p>
          </div>
          <div className="w-8 h-8 bg-gray-700 rounded-full flex items-center justify-center">
            <User size={16} className="text-gray-300" />
          </div>
        </div>
      </div>
    </div>
  );
}