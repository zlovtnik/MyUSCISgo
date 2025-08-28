import { useState } from 'react';

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

  const handleOverlayKeyDown = (event: React.KeyboardEvent) => {
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
        className="fixed top-4 left-4 z-50 bg-black rounded-lg p-4 shadow-lg hover:shadow-xl transition-all duration-200 border border-gray-600 hover:border-gray-400"
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
        <dialog
          id="app-menu-panel"
          aria-modal="true"
          className="fixed top-0 left-0 h-full w-80 bg-white shadow-2xl z-50 m-0"
        >
          <div className="p-6">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-xl font-bold text-gray-900">USCIS Tools</h2>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                aria-label="Close menu"
              >
                <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <nav className="space-y-2">
              {menuItems.map((item) => (
                <button
                  type="button"
                  key={item.id}
                  onClick={() => handleMenuItemClick(item.id)}
                  className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-left transition-all duration-200 ${
                    currentPage === item.id
                      ? 'bg-blue-50 text-blue-700 border border-blue-200'
                      : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                  }`}
                  aria-current={currentPage === item.id ? 'page' : undefined}
                >
                  <span className="text-sm">{item.icon}</span>
                  <span className="font-medium">{item.label}</span>
                  {currentPage === item.id && (
                    <svg className="w-4 h-4 ml-auto text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  )}
                </button>
              ))}
            </nav>

            <div className="mt-8 pt-6 border-t border-gray-200">
              <div className="text-sm text-gray-500">
                <p className="mb-2">Secure USCIS API Tools</p>
                <p>All processing done locally using WebAssembly</p>
              </div>
            </div>
          </div>
        </dialog>
      )}
    </>
  );
}
