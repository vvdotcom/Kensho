import React from 'react';
import CulturalCompass from './CulturalCompass';
import MapInterface from './MapInterface';
import TopNavigation from './components/TopNavigation';

// --- SVG Components ---

// Sparkle Icon
const SparkleIcon = ({ className }) => (
    <svg width="24" height="24" viewBox="0 0 51 48" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
        <path d="M25.5 0L32.3886 16.6114L49.5 22.5L35.1114 32.3886L31.5 48L25.5 38L19.5 48L15.8886 32.3886L1.5 22.5L18.6114 16.6114L25.5 0Z" fill="currentColor"/>
    </svg>
);

// User Icon for Navbar
const UserIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
        <circle cx="12" cy="7" r="4"></circle>
    </svg>
);

// Menu Icon for Mobile Navbar
const MenuIcon = () => (
     <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="3" y1="12" x2="21" y2="12"></line>
        <line x1="3" y1="6" x2="21" y2="6"></line>
        <line x1="3" y1="18" x2="21" y2="18"></line>
    </svg>
);


// --- Reusable Components ---

// Component for the vertical text on the sides.
const SideText = ({ title, japaneseText, className = '' }) => (
    <div className={`absolute top-1/2 -translate-y-1/2 hidden lg:flex flex-col items-center space-y-4 text-white ${className}`}>
        <p className="[writing-mode:vertical-rl] [text-orientation:mixed] rotate-180 text-xl font-bold tracking-widest uppercase">{title}</p>
        <SparkleIcon className="text-white" />
        <p className="[writing-mode:vertical-rl] [text-orientation:mixed] rotate-180 text-sm tracking-widest">{japaneseText}</p>
    </div>
);

// --- Main Components ---

// Header Component
const Header = () => (
    <header className="w-full p-6 z-10">
        <nav className="flex justify-between items-center text-gray-300">
            <div className="text-2xl font-black tracking-wider uppercase">KENSHO AI</div>
    
        </nav>
    </header>
);

// Ticket Component with border removed
const Ticket = ({ handleLogin, isLoading, loginError }) => (
    <div style={{ backgroundColor: '#dfdfdf' }} className="w-full rounded-2xl shadow-lg flex flex-col lg:flex-row my-4 lg:my-8 relative overflow-hidden lg:min-h-[700px]">
        
        {/* Left Side of Ticket - Images Column */}
        <div className="hidden lg:flex w-full lg:w-1/3 p-8 sm:p-12 flex-col space-y-8 relative">
            {/* Vertical KENSHO AI Title */}
            <div className="absolute left-2 top-1/2 -translate-y-1/2 hidden lg:block">
                <h1 className="[writing-mode:vertical-rl] [text-orientation:upright] text-4xl font-black text-black tracking-widest">
                    KENSHO AI
                </h1>
            </div>
            
            {/* Mobile horizontal title */}
            <div className="text-center py-6 border-t border-b border-gray-300 lg:hidden">
                <h1 className="text-4xl sm:text-5xl font-black text-black tracking-wide">KENSHO AI</h1>
            </div>
            
            <img
                src="https://i.imgur.com/w8upKjK.gif"
                alt="AI dashboard analytics"
                className="w-full h-full object-cover rounded-xl lg:ml-16"
              
                onError={(e) => { e.target.onerror = null; e.target.src='https://placehold.co/400x200/dfdfdf/000000?text=AI+Analytics'; }}
            />
            
        </div>

        {/* Middle Section - Descriptions */}
        <div className="hidden lg:flex w-full lg:w-1/3 p-8 sm:p-12 text-gray-800 flex-col justify-center space-y-12">
            <div>
                <h3 className="text-xl font-bold text-black mb-3">Strategic Intelligence Platform</h3>
                <p className="text-base text-gray-600">Kensho AI moves brands beyond demographics, offering deep understanding of audience's cultural DNA.</p>
            </div>
            
            <div>
                <h3 className="text-xl font-bold text-black mb-3">Audience Analysis & Strategy</h3>
                <p className="text-base text-gray-600">Core feature analyzes your audience's unique passions to generate detailed marketing strategies.</p>
            </div>
            
            <div>
                <h3 className="text-xl font-bold text-black mb-3">Built-in Creative Studio</h3>
                <p className="text-base text-gray-600">Instantly create compelling ad images and videos based on insights. Complete workflow from understanding to campaign.</p>
            </div>
        </div>

        {/* Dashed Line Separator */}
        <div className="hidden lg:flex relative items-center justify-center">
            <div className="absolute left-1/2 -translate-x-1/2 -top-6 w-12 h-12 bg-[#0d0d0d] rounded-full hidden lg:block"></div>
            <div className="absolute left-1/2 -translate-x-1/2 -bottom-6 w-12 h-12 bg-[#0d0d0d] rounded-full hidden lg:block"></div>
            <div className="absolute top-1/2 -translate-y-1/2 -left-6 w-12 h-12 bg-[#0d0d0d] rounded-full lg:hidden"></div>
            <div className="absolute top-1/2 -translate-y-1/2 -right-6 w-12 h-12 bg-[#0d0d0d] rounded-full lg:hidden"></div>
            <div className="w-full h-px lg:w-px lg:h-full border-dashed border-t-2 lg:border-t-0 lg:border-l-2 border-gray-400"></div>
        </div>

        {/* Right Side of Ticket (Login Form) */}
        <div className="w-full lg:w-1/3 p-6 lg:p-16 flex flex-col items-center justify-center">
            {/* Mobile KENSHO AI Title */}
            <div className="text-center mb-8 lg:hidden">
                <h1 className="text-3xl font-black text-black tracking-wide">KENSHO AI</h1>
            </div>
            
            <div className="w-full">
                <h3 className="text-2xl lg:text-4xl font-bold text-black mb-6 lg:mb-8 text-center">Member Login</h3>
                
                {/* Test Credentials Info */}
                <div className="mb-4 lg:mb-6 p-3 lg:p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <p className="text-sm text-blue-800 font-medium mb-2">Test Credentials:</p>
                    <p className="text-xs text-blue-600">Email: demo@kensho.ai</p>
                    <p className="text-xs text-blue-600">Password: demo123</p>
                </div>
                
                <form className="w-full space-y-4 lg:space-y-6" onSubmit={handleLogin}>
                    <div>
                        <label htmlFor="email" className="block text-base lg:text-lg font-medium text-gray-700 mb-2">
                            Email Address
                        </label>
                        <input
                            type="email"
                            id="email"
                            name="email"
                            defaultValue="demo@kensho.ai"
                            className="block w-full px-3 lg:px-4 py-2 lg:py-3 bg-white/50 border border-gray-400 rounded-md shadow-sm placeholder-gray-500 focus:outline-none focus:ring-black focus:border-black text-base lg:text-lg"
                            placeholder="you@example.com"
                            required
                        />
                    </div>
                    <div>
                        <label htmlFor="password" className="block text-base lg:text-lg font-medium text-gray-700 mb-2">
                            Password
                        </label>
                        <input
                            type="password"
                            id="password"
                            name="password"
                            defaultValue="demo123"
                            className="block w-full px-3 lg:px-4 py-2 lg:py-3 bg-white/50 border border-gray-400 rounded-md shadow-sm placeholder-gray-500 focus:outline-none focus:ring-black focus:border-black text-base lg:text-lg"
                            placeholder="••••••••"
                            required
                        />
                    </div>
                    
                    {/* Error Message */}
                    {loginError && (
                        <div className="p-2 lg:p-3 bg-red-50 border border-red-200 rounded-md">
                            <p className="text-sm text-red-600">{loginError}</p>
                        </div>
                    )}
                    
                    <div className="pt-2 lg:pt-4">
                        <button
                            type="submit"
                            disabled={isLoading}
                            className="w-full flex justify-center py-3 lg:py-4 px-4 lg:px-6 border border-transparent rounded-md shadow-sm text-base lg:text-lg font-medium text-white bg-black hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-black transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isLoading ? (
                                <div className="flex items-center space-x-2">
                                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                    <span>Logging in...</span>
                                </div>
                            ) : (
                                'Login'
                            )}
                        </button>
                    </div>
                    <div className="text-center">
                        <a href="#" className="text-base text-gray-600 hover:text-black">
                            Forgot Password?
                        </a>
                    </div>
                </form>
            </div>
        </div>
    </div>
);




// --- Main App Component ---

export default function App() {
    // Toggle between landing page and vibe app
    const [currentPage, setCurrentPage] = React.useState<'landing' | 'compass' | 'map'>('landing');
    const [loginError, setLoginError] = React.useState('');
    const [isLoading, setIsLoading] = React.useState(false);

    // Test credentials
    const TEST_EMAIL = 'demo@kensho.ai';
    const TEST_PASSWORD = 'demo123';

    const handleLogin = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        setLoginError('');

        const formData = new FormData(e.target);
        const email = formData.get('email');
        const password = formData.get('password');

        // Simulate API call delay
        await new Promise(resolve => setTimeout(resolve, 1000));

        if (email === TEST_EMAIL && password === TEST_PASSWORD) {
            setCurrentPage('compass');
        } else {
            setLoginError('Invalid credentials. Use demo@kensho.ai / demo123');
        }
        
        setIsLoading(false);
    };

    const handleNavigation = (page: 'landing' | 'compass' | 'map') => {
        setCurrentPage(page);
    };

    // Render different pages based on current page
    if (currentPage === 'compass') {
        return (
            <>
                <TopNavigation currentPage={currentPage} onNavigate={handleNavigation} />
                    <CulturalCompass />
            </>
        );
    }

    if (currentPage === 'map') {
        return (
            <>
                <TopNavigation currentPage={currentPage} onNavigate={handleNavigation} />
                  <MapInterface />
            </>
        );
    }

    // Landing page
    return (
        <div style={{ backgroundColor: '#0d0d0d' }} className="min-h-screen w-full flex flex-col items-center p-4 sm:p-6 lg:p-8 font-['Exo',_sans-serif]">
            <div className="w-4/5 flex-grow flex flex-col relative">
                <Header />
                <main className="flex-grow flex items-center justify-center relative">
                    {/* Left SideText */}
                    <SideText title="World" japaneseText="世界中のマーケティングソリューション" className="-left-16" />
                    
                    <div className="space-y-4">
                        <Ticket handleLogin={handleLogin} isLoading={isLoading} loginError={loginError} />
                        
                        {/* Cultural Compass Demo Button */}
                      
                    </div>
                    
                    {/* Right SideText */}
                    <SideText title="Tourism" japaneseText="観光業界の革新的なアプローチ" className="-right-16" />
                </main>
            </div>
        </div>
    );
}