import React from 'react';

interface BottomNavProps {
  navItems: string[];
  activeItem: string;
  onItemClick: (item: string) => void;
}

const BottomNav: React.FC<BottomNavProps> = ({ navItems, activeItem, onItemClick }) => {
  return (
    // The wrapper ignores clicks so you can click photos "through" the gaps
    <nav className="fixed bottom-0 left-0 right-0 bg-transparent z-50 pointer-events-none">
      <div className="container mx-auto px-4 pb-2">
        <div className="flex justify-center items-center h-20 space-x-8">
          {navItems.map((item) => (
            <button
              key={item}
              onClick={() => onItemClick(item)}
              // POINTER-EVENTS-AUTO is the fix here! 
              // It tells the browser "ignore the nav bar, but click THIS button"
              className={`
                pointer-events-auto cursor-pointer
                relative px-2 py-4 text-[11px] uppercase tracking-[0.3em] 
                transition-all duration-300 mix-blend-difference text-white
                ${activeItem === item ? 'opacity-100 font-bold' : 'opacity-50 hover:opacity-100'}
              `}
            >
              {item}
              {activeItem === item && (
                <span className="absolute bottom-2 left-0 right-0 h-[1px] bg-white" />
              )}
            </button>
          ))}
        </div>
      </div>
    </nav>
  );
};

export default BottomNav;