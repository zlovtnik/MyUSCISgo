import { useState } from 'react';
import type { KeyboardEvent } from 'react';

export type Page = 'credentials' | 'certification';

interface MenuProps {
  readonly currentPage: Page;
  readonly onPageChange: (page: Page) => void;
}

export function Menu({ currentPage, onPageChange }: MenuProps) {
  const [isOpen, setIsOpen] = useState(false);

  const menuItems = [
    { id: 'credentials' as Page, label: 'Credential Processor', icon: '🔐' },
    { id: 'certification' as Page, label: 'Token Certification', icon: '✅' },
  ];

  const toggleMenu = () => {
    setIsOpen(!isOpen);
  };

  const handleMenuItemClick = (page: Page) => {
    onPageChange(page);
    setIsOpen(false);
  };

  const handleOverlayKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Enter' || event.key === ' ') {
      setIsOpen(false);
    }
  };

  return (
    <>
      {/* Burger Menu Button */}
      <button
        type="button"
        onClick={toggleMenu}
        className="!fixed !top-4 !left-4 !z-[9999] !bg-red-500 !text-white !rounded-lg !p-4 !shadow-2xl hover:!shadow-3xl !transition-all !duration-200 !border-4 !border-yellow-400 hover:!border-yellow-300 hover:!bg-red-600 !w-auto !h-auto"
        style={{
          zIndex: 9999
        }}
        aria-label="Toggle menu"
        aria-expanded={isOpen}
        aria-controls="app-menu-panel"
      >
        <div className="w-7 h-7 flex flex-col justify-center items-center">
          <span className={`block w-6 h-0.5 bg-white transition-all duration-300 ${isOpen ? 'rotate-45 translate-y-1.5' : '-translate-y-1'}`}></span>
          <span className={`block w-6 h-0.5 bg-white transition-all duration-300 ${isOpen ? 'opacity-0' : 'opacity-100'}`}></span>
          <span className={`block w-6 h-0.5 bg-white transition-all duration-300 ${isOpen ? '-rotate-45 -translate-y-1.5' : 'translate-y-1'}`}></span>
        </div>
      </button>

      {/* Overlay */}
      {isOpen && (
        <button
          type="button"
          className="fixed inset-0 bg-black bg-opacity-50 z-40"
          onClick={() => setIsOpen(false)}
          onKeyDown={handleOverlayKeyDown}
          aria-label="Close menu"
        />
      )}

      {/* Menu Panel */}
      {isOpen && (
        <div
          id="app-menu-panel"
          className="!fixed !top-0 !left-0 !h-full !w-80 !bg-red-100 !border-4 !border-blue-500 !z-[10000] !shadow-2xl"
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            height: '100vh',
            width: '320px',
            backgroundColor: '#fee2e2',
            border: '4px solid #3b82f6',
            zIndex: 10000,
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
          }}
        >
          <div className="p-6">
            <div className="flex items-center justify-between mb-8">
              <h2 className="!text-2xl !font-bold !text-red-800 !bg-yellow-200 !p-2 !rounded">USCIS Tools</h2>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="!p-2 !bg-red-500 !text-white !rounded-lg !hover:bg-red-600"
                aria-label="Close menu"
              >
                ✕
              </button>
            </div>

            <nav className="space-y-2">
              {menuItems.map((item) => (
                <button
                  type="button"
                  key={item.id}
                  onClick={() => handleMenuItemClick(item.id)}
                  className="!w-full !flex !items-center !space-x-3 !px-4 !py-3 !rounded-lg !text-left !bg-blue-200 !text-blue-900 !border-2 !border-blue-400 !hover:bg-blue-300 !transition-all !duration-200"
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '12px 16px',
                    backgroundColor: '#bfdbfe',
                    color: '#1e3a8a',
                    border: '2px solid #60a5fa',
                    borderRadius: '8px'
                  }}
                  aria-current={currentPage === item.id ? 'page' : undefined}
                >
                  <span className="!text-lg">{item.icon}</span>
                  <span className="!font-medium !text-lg">{item.label}</span>
                  {currentPage === item.id && (
                    <span className="!ml-auto !text-green-600 !text-lg">✓</span>
                  )}
                </button>
              ))}
            </nav>

            <div className="!mt-8 !pt-6 !border-t-2 !border-gray-400">
              <div className="!text-sm !text-gray-700 !bg-green-100 !p-3 !rounded">
                <p className="!mb-2 !font-bold">Secure USCIS API Tools</p>
                <p>All processing done locally using WebAssembly</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
