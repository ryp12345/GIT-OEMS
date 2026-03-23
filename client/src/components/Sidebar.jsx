import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';

const menuLinks = [
  { name: 'Dashboard', path: '/dashboard', icon: '📊' },
  { name: 'Elective Instance', path: '/elective-instance', icon: '🗂️' },
  { name: 'Courses', path: '/courses', icon: '📚' },
  { name: 'Students', path: '/students', icon: '👨‍🎓' },
  { name: 'Elective Preference', path: '/elective-preference', icon: '✅' },
  { name: 'Allocation', path: '/allocation', icon: '📝' },
  { name: 'Reports', path: '/reports', icon: '📈' }
];

export default function Sidebar() {
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(true);
  const sidebarWidth = isOpen ? 'w-64' : 'w-20';

  return (
    <aside className={`${sidebarWidth} bg-slate-800 text-white transition-all duration-300 shadow-lg min-h-full flex flex-col`} style={{ backgroundColor: '#001f3f' }}> 
      <div className="flex flex-col items-center justify-center pt-6 pb-2">
        <img src="/git_logo.jpg" alt="Git logo" className="h-16 w-16 rounded-md object-contain ring-1 ring-slate-200 bg-white mb-2" />
        {isOpen && <span className="text-xl font-bold">OEMSV2</span>}
      </div>
      <div className="flex items-center justify-end px-4 pb-2">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="text-slate-300 hover:text-white focus:outline-none"
          aria-label="Toggle sidebar"
        >
          <span className="text-xl select-none">• • •</span>
        </button>
      </div>
      <nav className="space-y-2 px-3 pb-4 flex-1">
        {menuLinks.map(link => (
          <Link
            key={link.path}
            to={link.path}
            title={!isOpen ? link.name : ''}
            className={`flex items-center space-x-3 px-4 py-3 rounded-lg transition duration-200 font-semibold text-sm ${
              location.pathname === link.path
                ? 'bg-blue-500 text-white'
                : 'text-slate-200 hover:bg-slate-700'
            }`}
          >
            <span className="text-xl">{link.icon}</span>
            {isOpen && <span>{link.name.toUpperCase()}</span>}
          </Link>
        ))}
      </nav>
    </aside>
  );
}
