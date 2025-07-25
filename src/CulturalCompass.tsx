import React, { useState, useEffect } from 'react';
import { Calendar, Map, Menu, X, ChevronLeft, ChevronRight, ExternalLink, Sparkles, Wand2 } from 'lucide-react';
import MapInterface from './MapInterface';
import { kenshoDb } from './utils/database';
import { GoogleGenAI } from '@google/genai';
import type { Recommendation as DbRecommendation, ItineraryItem as DbItineraryItem } from './utils/database';
// Types
interface Recommendation {
  id: string;
  name: string;
  category: string;
  image: string;
  insight: string;
  segment: 'dine' | 'listen' | 'see' | 'explore';
  website?: string;
  x?: number;
  y?: number;
}

interface ItineraryItem extends Recommendation {
  day: number;
  notes: string;
  order: number;
}

// --- Helper Functions to process API data ---

/**
 * Maps API tags to one of the four UI segments.
 * @param {Array} tags - The array of tags from a Qloo API entity.
 * @returns 'dine' | 'listen' | 'see' | 'explore'
 */
const mapTagsToSegment = (tags: any[] = []): 'dine' | 'listen' | 'see' | 'explore' => {
  const tagNames = tags.map(t => t.name.toLowerCase());
  if (tagNames.some(t => t.includes('restaurant') || t.includes('hotel') || t.includes('bar') || t.includes('cafe') || t.includes('dining') || t.includes('food'))) {
    return 'dine';
  }
  if (tagNames.some(t => t.includes('music') || t.includes('concert') || t.includes('record') || t.includes('jazz'))) {
    return 'listen';
  }
  if (tagNames.some(t => t.includes('museum') || t.includes('art') || t.includes('gallery') || t.includes('theatre') || t.includes('view') || t.includes('landmark'))) {
    return 'see';
  }
  return 'explore';
};

/**
* Generates X, Y coordinates for the radar chart based on segment and popularity rank.
* @param {string} segment - The recommendation's segment.
* @param {number} popularityRank - The normalized rank of the item (0=most popular, 1=least popular).
* @returns {{x: number, y: number}}
*/
const getRadarCoordinates = (segment: 'dine' | 'listen' | 'see' | 'explore', popularityRank: number = 0.5) => {
    const segmentAngles = { dine: 0, listen: 90, see: 180, explore: 270 };
    const baseAngle = segmentAngles[segment];
    
    // Widen the angle jitter to fill the quadrant more naturally.
    const angleJitter = 35; 
    const angle = baseAngle + (Math.random() * (angleJitter * 2) - angleJitter);
    const angleRad = (angle * Math.PI) / 180;
    
    // Map the RANK to the radius. Most popular (rank 0) is furthest out.
    // This distributes items evenly from a radius of 25 to 95.
    const radius = 25 + ((1 - popularityRank) * 70);
    
    const x = 100 + Math.cos(angleRad) * radius;
    const y = 100 + Math.sin(angleRad) * radius;

    return { x, y };
};

/**
 * Truncates text to a specified number of sentences.
 * @param {string} text - The text to truncate.
 * @param {number} sentenceCount - The maximum number of sentences.
 * @returns {string}
 */
const truncateText = (text: string, sentenceCount: number = 3): string => {
  if (!text) return '';
  const sentences = text.split('. ').filter(s => s);
  if (sentences.length <= sentenceCount) {
    return text;
  }
  return sentences.slice(0, sentenceCount).join('. ') + '.';
};


// --- UI Components (No Changes Here) ---

// Mobile Recommendation Card Component
const MobileRecommendationCard = ({ rec, onAdd }: { rec: Recommendation; onAdd: (rec: Recommendation) => void }) => {
  const segments = [
    { name: 'dine', color: '#ef4444' },
    { name: 'listen', color: '#3b82f6' },
    { name: 'see', color: '#10b981' },
    { name: 'explore', color: '#f59e0b' }
  ];
  
  const segment = segments.find(s => s.name === rec.segment);
  
  return (
    <div className="bg-[#e0e0e0] border border-gray-300 rounded-xl p-4 min-w-[280px] snap-start">
      <div className="relative mb-3">
        <img
          src={rec.image}
          alt={rec.name}
          className="w-full h-32 object-cover rounded-lg"
        />
        <div className="absolute top-2 left-2">
          <span 
            className="inline-block px-2 py-1 text-xs font-bold rounded-full text-white capitalize"
            style={{ backgroundColor: segment?.color }}
          >
            {rec.segment}
          </span>
        </div>
      </div>
      
      <h4 className="text-black font-bold text-sm mb-1">{rec.name}</h4>
      <p className="text-gray-700 text-xs mb-2">{rec.category}</p>
      <p className="text-gray-800 text-xs mb-3">
        {truncateText(rec.insight)}
      </p>
      
      <button
        onClick={() => onAdd(rec)}
        className="w-full py-2 px-3 bg-gray-800 text-white text-xs font-medium rounded-lg hover:bg-black transition-colors"
      >
        + Add to Itinerary
      </button>
    </div>
  );
};

// Desktop Recommendation Card Component
const DesktopRecommendationCard = ({ rec, onAdd }: { rec: Recommendation; onAdd: (rec: Recommendation) => void }) => {
  const segments = [
    { name: 'dine', color: '#ef4444' },
    { name: 'listen', color: '#3b82f6' },
    { name: 'see', color: '#10b981' },
    { name: 'explore', color: '#f59e0b' }
  ];
  
  const segment = segments.find(s => s.name === rec.segment);
  
  return (
    <div className="bg-[#e0e0e0] border border-gray-300 rounded-xl p-4 hover:border-gray-400 transition-colors">
      <div className="flex space-x-4">
        <div className="relative flex-shrink-0">
          <img
            src={rec.image}
            alt={rec.name}
            className="w-20 h-20 object-cover rounded-lg"
          />
          <div className="absolute -top-1 -right-1">
            <span 
              className="inline-block px-2 py-1 text-xs font-bold rounded-full text-white capitalize"
              style={{ backgroundColor: segment?.color }}
            >
              {rec.segment}
            </span>
          </div>
        </div>
        
        <div className="flex-1 min-w-0">
          <h4 className="text-black font-bold text-base mb-1">{rec.name}</h4>
          <p className="text-gray-700 text-sm mb-2">{rec.category}</p>
          <p className="text-gray-800 text-sm mb-3">
            {truncateText(rec.insight)}
          </p>
          
          <button
            onClick={() => onAdd(rec)}
            className="py-2 px-4 bg-gray-800 text-white text-sm font-medium rounded-lg hover:bg-black transition-colors"
          >
            + Add to Itinerary
          </button>
        </div>
      </div>
    </div>
  );
};

// Radar Chart Component
const RadarChart = ({ recommendations, onDotClick, hasInputs }: { 
  recommendations: Recommendation[]; 
  onDotClick: (rec: Recommendation) => void;
  hasInputs: boolean;
}) => {
  const [hoveredRec, setHoveredRec] = useState<Recommendation | null>(null);
  const [selectedRec, setSelectedRec] = useState<Recommendation | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  const segments = [
    { name: 'Dine', color: '#ef4444', angle: 0 },
    { name: 'Listen', color: '#3b82f6', angle: 90 },
    { name: 'See', color: '#10b981', angle: 180 },
    { name: 'Explore', color: '#f59e0b', angle: 270 }
  ];

  const handleMouseMove = (e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  };

  const handleDotClick = (rec: Recommendation) => {
    // On mobile, first click shows details, second click adds to itinerary
    if (window.innerWidth < 1024) {
      if (selectedRec?.id === rec.id) {
        onDotClick(rec);
        setSelectedRec(null);
      } else {
        setSelectedRec(rec);
      }
    } else {
      // On desktop, directly add to itinerary
      onDotClick(rec);
    }
  };
  return (
    <div className="relative w-full h-full flex items-center justify-center">
      <div className="relative w-full max-w-96 aspect-square lg:h-full lg:w-auto lg:max-w-none" onMouseMove={handleMouseMove}>
        <svg viewBox="0 0 200 200" className="w-full h-full">
          {/* Background circles */}
          {[60, 80, 100].map((radius, i) => (
            <circle
              key={i}
              cx="100"
              cy="100"
              r={radius}
              fill="none"
              stroke={hasInputs ? "#374151" : "#1f2937"}
              strokeWidth="1"
              opacity={hasInputs ? 0.5 : 0.2}
            />
          ))}
          
          {/* Segment lines */}
          {segments.map((segment, i) => {
            const angle = (segment.angle * Math.PI) / 180;
            const x2 = 100 + Math.cos(angle) * 100;
            const y2 = 100 + Math.sin(angle) * 100;
            return (
              <line
                key={i}
                x1="100"
                y1="100"
                x2={x2}
                y2={y2}
                stroke={hasInputs ? "#374151" : "#1f2937"}
                strokeWidth="1"
                opacity={hasInputs ? 0.5 : 0.2}
              />
            );
          })}
          
          {/* Colored segments */}
          {hasInputs && segments.map((segment, i) => {
            const startAngle = segment.angle - 45;
            const endAngle = segment.angle + 45;
            const startRad = (startAngle * Math.PI) / 180;
            const endRad = (endAngle * Math.PI) / 180;
            
            const x1 = 100 + Math.cos(startRad) * 100;
            const y1 = 100 + Math.sin(startRad) * 100;
            const x2 = 100 + Math.cos(endRad) * 100;
            const y2 = 100 + Math.sin(endRad) * 100;
            
            return (
              <path
                key={i}
                d={`M 100 100 L ${x1} ${y1} A 100 100 0 0 1 ${x2} ${y2} Z`}
                fill={segment.color}
                opacity={0.1}
              />
            );
          })}
          
          {/* Recommendation dots */}
          {hasInputs && recommendations.map((rec) => {
            const segment = segments.find(s => s.name.toLowerCase() === rec.segment);
            if (!segment) return null;
            
            const isSelected = selectedRec?.id === rec.id;
            return (
              <circle
                key={rec.id}
                cx={rec.x}
                cy={rec.y}
                r={isSelected ? "8" : "6"}
                fill={segment.color}
                stroke={isSelected ? "#ffffff" : "none"}
                strokeWidth={isSelected ? "2" : "0"}
                className="cursor-pointer transition-all animate-pulse"
                onMouseEnter={() => setHoveredRec(rec)}
                onMouseLeave={() => setHoveredRec(null)}
                onClick={() => handleDotClick(rec)}
              />
            );
          })}
        </svg>
        
        {/* Segment labels */}
        {segments.map((segment, i) => {
          const angle = (segment.angle * Math.PI) / 180;
          const x = 50 + Math.cos(angle) * 45;
          const y = 50 + Math.sin(angle) * 45;
          
          return (
            <div
              key={i}
              className="absolute text-xs sm:text-sm font-bold"
              style={{
                left: `${x}%`,
                top: `${y}%`,
                transform: 'translate(-50%, -50%)',
                color: hasInputs ? segment.color : '#4b5563'
              }}
            >
              {segment.name}
            </div>
          );
        })}

        {/* Desktop Tooltip */}
        {hoveredRec && (
          <div 
            className="absolute z-10 bg-white border border-gray-200 rounded-lg p-4 w-64 pointer-events-none hidden lg:block shadow-lg"
            style={{
              left: mousePos.x + 10,
              top: mousePos.y - 10,
              transform: 'translate(0, -100%)'
            }}
          >
            <div className="flex items-start space-x-3">
              <img
                src={hoveredRec.image}
                alt={hoveredRec.name}
                className="w-12 h-12 rounded-lg object-cover"
              />
              <div className="flex-1">
                <h4 className="text-black font-bold text-sm">{hoveredRec.name}</h4>
                <p className="text-gray-600 text-xs mb-2">{hoveredRec.category}</p>
                <p className="text-gray-700 text-xs mb-3">
                  {truncateText(hoveredRec.insight)}
                </p>
                <button
                  onClick={() => onDotClick(hoveredRec)}
                  className="w-full py-2 px-3 bg-gray-800 text-white text-xs font-medium rounded-md hover:bg-black transition-colors"
                >
                  + Add to Itinerary
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Mobile Selected Item Card */}
        {selectedRec && (
          <div className="absolute bottom-0 left-0 right-0 bg-[#e0e0e0] border-t border-gray-300 p-4 lg:hidden z-20">
            <div className="flex items-start space-x-3">
              <img
                src={selectedRec.image}
                alt={selectedRec.name}
                className="w-16 h-16 rounded-lg object-cover flex-shrink-0"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between mb-2">
                  <h4 className="text-black font-bold text-sm">{selectedRec.name}</h4>
                  <button
                    onClick={() => setSelectedRec(null)}
                    className="text-gray-600 hover:text-black flex-shrink-0 ml-2"
                  >
                    <X size={16} />
                  </button>
                </div>
                <p className="text-gray-700 text-xs mb-2">{selectedRec.category}</p>
                <p className="text-gray-800 text-xs mb-3">
                  {truncateText(selectedRec.insight)}
                </p>
                <button
                  onClick={() => {
                    onDotClick(selectedRec);
                    setSelectedRec(null);
                  }}
                  className="w-full py-2 px-3 bg-gray-800 text-white text-xs font-medium rounded-lg hover:bg-black transition-colors"
                >
                  + Add to Itinerary
                </button>
              </div>
            </div>
          </div>
        )}
        {/* Awaiting input state */}
        {!hasInputs && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center px-4">
              <p className="text-gray-500 text-sm">Enter your cultural preferences to activate compass</p>
            </div>
          </div>
        )}
      </div>
      
      {/* Mobile Instructions */}
      {hasInputs && (
        <div className="absolute top-4 left-4 right-4 lg:hidden">
          <div className="bg-black/70 backdrop-blur-sm rounded-lg p-3 text-center">
            <p className="text-gray-300 text-xs">
              Tap dots to see details • Tap again to add to itinerary
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

// Itinerary Item Component
const ItineraryItemCard = ({ item, onRemove, onUpdateDay, onUpdateNotes }: {
  item: ItineraryItem;
  onRemove: (id: string) => void;
  onUpdateDay: (id: string, day: number) => void;
  onUpdateNotes: (id: string, notes: string) => void;
}) => {
  const [showNotes, setShowNotes] = useState(false);

  return (
    <div className="bg-[#e0e0e0] border border-gray-300 rounded-lg p-4 mb-3">
      <div className="flex items-start space-x-3">
        <img
          src={item.image}
          alt={item.name}
          className="w-12 h-12 rounded-lg object-cover flex-shrink-0"
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-black font-bold text-sm truncate">{item.name}</h4>
            <button
              onClick={() => onRemove(item.id)}
              className="text-gray-600 hover:text-red-500 flex-shrink-0 ml-2"
            >
              <X size={16} />
            </button>
          </div>
          <p className="text-gray-700 text-xs mb-2">{item.category}</p>
          
          <div className="flex flex-col sm:flex-row sm:items-center space-y-2 sm:space-y-0 sm:space-x-2 mb-2">
            <select
              value={item.day}
              onChange={(e) => onUpdateDay(item.id, parseInt(e.target.value))}
              className="bg-white border border-gray-400 rounded px-2 py-1 text-xs text-black"
            >
              {[1, 2, 3, 4, 5].map(day => (
                <option key={day} value={day}>Day {day}</option>
              ))}
            </select>
            <button
              onClick={() => setShowNotes(!showNotes)}
              className="text-xs text-gray-800 hover:text-black"
            >
              {showNotes ? 'Hide Notes' : 'Add Notes'}
            </button>
            {item.website && (
              <a 
                href={item.website}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-blue-600 hover:text-blue-800 transition-colors flex items-center"
              >
                Visit Website <ExternalLink size={12} className="ml-1" />
              </a>
            )}
          </div>

          {showNotes && (
            <textarea
              value={item.notes}
              onChange={(e) => onUpdateNotes(item.id, e.target.value)}
              placeholder="Add your notes..."
              className="w-full mt-2 p-2 bg-white border border-gray-400 rounded text-xs text-black placeholder-gray-500 resize-none"
              rows={2}
            />
          )}
        </div>
      </div>
    </div>
  );
};


// Main Component
export default function CulturalCompass() {
  const [showMap, setShowMap] = useState(false);
  const [activeTab, setActiveTab] = useState<'controls' | 'compass' | 'itinerary'>('controls');
  const [showControlPanel, setShowControlPanel] = useState(false);
  const [isGenerated, setIsGenerated] = useState(false);
  const [isLoading, setIsLoading] = useState(false); // Loading state for API call
  const [error, setError] = useState<string | null>(null); // Error state for API call
  const [apiError, setApiError] = useState<string>('');
  const [destination, setDestination] = useState(() => {
    return localStorage.getItem('kensho-destination') || '';
  });
  const [movie, setMovie] = useState(() => {
    return localStorage.getItem('kensho-movie') || '';
  });
  const [artist, setArtist] = useState(() => {
    return localStorage.getItem('kensho-artist') || '';
  });
  const [author, setAuthor] = useState(() => {
    return localStorage.getItem('kensho-author') || '';
  });
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [itinerary, setItinerary] = useState<ItineraryItem[]>([]);
  const [loadingCosts, setLoadingCosts] = useState<Set<string>>(new Set());
  const [costEstimationInProgress, setCostEstimationInProgress] = useState<Set<string>>(new Set());

  // Initialize Gemini AI
  const genAI = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY });
  const [isDbLoading, setIsDbLoading] = useState(true);
  
  // Autoplan state
  const [autoplanDescription, setAutoplanDescription] = useState('');
  const [isAutoplanning, setIsAutoplanning] = useState(false);
  const [autoplanError, setAutoplanError] = useState<string | null>(null);
  
  // Load data from IndexedDB on component mount
  useEffect(() => {
    const loadDataFromDB = async () => {
      try {
        setIsDbLoading(true);
        
        // Load user preferences
        const preferences = await kenshoDb.getUserPreferences();
        if (preferences) {
          setDestination(preferences.destination);
          setMovie(preferences.movie);
          setArtist(preferences.artist);
          setAuthor(preferences.author);
        }
        
        // Load recommendations
        const dbRecommendations = await kenshoDb.getRecommendations();
        setRecommendations(dbRecommendations);
        
        // Load itinerary
        const dbItinerary = await kenshoDb.getItinerary();
        setItinerary(dbItinerary);
        
        // Load session state
        const session = await kenshoDb.getSession();
        if (session) {
          setIsGenerated(session.isGenerated);
        }
        
        // Migrate from localStorage if needed (for existing users)
        await migrateFromLocalStorage();
        
      } catch (error) {
        console.error('Error loading data from database:', error);
        // Fallback to localStorage if IndexedDB fails
        loadFromLocalStorage();
      } finally {
        setIsDbLoading(false);
      }
    };

    const migrateFromLocalStorage = async () => {
      try {
        // Check if we have localStorage data but no DB data
        const hasDbData = await kenshoDb.getStorageStats();
        
        if (hasDbData.preferencesCount === 0) {
          const lsDestination = localStorage.getItem('kensho-destination');
          const lsMovie = localStorage.getItem('kensho-movie');
          const lsArtist = localStorage.getItem('kensho-artist');
          const lsAuthor = localStorage.getItem('kensho-author');
          
          if (lsDestination || lsMovie || lsArtist || lsAuthor) {
            await kenshoDb.saveUserPreferences({
              destination: lsDestination || '',
              movie: lsMovie || '',
              artist: lsArtist || '',
              author: lsAuthor || ''
            });
          }
        }
        
        if (hasDbData.recommendationsCount === 0) {
          const lsRecommendations = localStorage.getItem('kensho-recommendations');
          if (lsRecommendations) {
            try {
              const recs = JSON.parse(lsRecommendations);
              if (recs.length > 0) {
                await kenshoDb.saveRecommendations(recs);
              }
            } catch (error) {
              console.error('Error migrating recommendations:', error);
            }
          }
        }
        
        if (hasDbData.itineraryCount === 0) {
          const lsItinerary = localStorage.getItem('kensho-itinerary');
          if (lsItinerary) {
            try {
              const items = JSON.parse(lsItinerary);
              for (const item of items) {
                await kenshoDb.addToItinerary(item);
              }
            } catch (error) {
              console.error('Error migrating itinerary:', error);
            }
          }
        }
        
        if (!hasDbData.sessionExists) {
          const lsIsGenerated = localStorage.getItem('kensho-is-generated');
          if (lsIsGenerated) {
            await kenshoDb.saveSession({
              isGenerated: lsIsGenerated === 'true'
            });
          }
        }
        
      } catch (error) {
        console.error('Error during migration:', error);
      }
    };

    const loadFromLocalStorage = () => {
      const savedRecommendations = localStorage.getItem('kensho-recommendations');
      const savedItinerary = localStorage.getItem('kensho-itinerary');
      const savedIsGenerated = localStorage.getItem('kensho-is-generated');
      
      if (savedRecommendations) {
        try {
          setRecommendations(JSON.parse(savedRecommendations));
        } catch (error) {
          console.error('Error loading saved recommendations:', error);
        }
      }
      
      if (savedItinerary) {
        try {
          setItinerary(JSON.parse(savedItinerary));
        } catch (error) {
          console.error('Error loading saved itinerary:', error);
        }
      }
      
      if (savedIsGenerated === 'true') {
        setIsGenerated(true);
      }
    };

    loadDataFromDB();
  }, []);

  // Save data to IndexedDB whenever state changes
  useEffect(() => {
    if (!isDbLoading && recommendations.length > 0) {
      kenshoDb.saveRecommendations(recommendations).catch(console.error);
    }
  }, [recommendations, isDbLoading]);

  useEffect(() => {
    if (!isDbLoading) {
      // Save each itinerary item individually to maintain proper database structure
      itinerary.forEach(item => {
        kenshoDb.addToItinerary(item).catch(console.error);
      });
    }
  }, [itinerary, isDbLoading]);

  useEffect(() => {
    if (!isDbLoading) {
      kenshoDb.saveSession({ isGenerated }).catch(console.error);
    }
  }, [isGenerated, isDbLoading]);

  // Save user preferences to IndexedDB whenever they change
useEffect(() => {
  // Don't run if the database is still loading
  if (isDbLoading) return;

  // Set up a timer to save data after 500ms
  const handler = setTimeout(() => {
    console.log('Saving user preferences to database...');
    kenshoDb.saveUserPreferences({
      destination,
      movie,
      artist,
      author
    }).catch(console.error);

    // Also save to localStorage as backup
    localStorage.setItem('kensho-destination', destination);
    localStorage.setItem('kensho-movie', movie);
    localStorage.setItem('kensho-artist', artist);
    localStorage.setItem('kensho-author', author);
  }, 500); // 500ms delay

  // This cleanup function runs every time the user types a new character.
  // It cancels the previous timer, so the save only happens once.
  return () => {
    clearTimeout(handler);
  };
}, [destination, movie, artist, author, isDbLoading]); // Dependencies stay the same
  
  // Check if user has filled in required fields
  const hasRequiredInputs = destination.trim() && (movie.trim() || artist.trim() || author.trim());

  // Reset generated state when inputs change
  useEffect(() => {
    setIsGenerated(false);
    setRecommendations([]);
    setItinerary([]);
  }, [destination, movie, artist, author]);

  const handleGenerateRecommendations = async () => {
    if (!hasRequiredInputs) return;
    
    const apiKey = import.meta.env.VITE_QLOO_API_KEY;
    if (!apiKey) {
      setError("Please provide a Qloo API Key.");
      return;
    }
  
    setIsLoading(true);
    setError(null);
    setApiError('');
    setRecommendations([]);

    const apiEndpoint = 'https://hackathon.api.qloo.com/v2/insights';
    
    // Collect and format all the interests into the required URN structure
    const interestsPayload = [];
    if (movie.trim()) {
      interestsPayload.push({
        entity: `urn:entity:movie:${movie.trim().replace(/\s+/g, '').toLowerCase()}`,
        weight: 10
      });
    }
    if (artist.trim()) {
      interestsPayload.push({
        entity: `urn:entity:artist:${artist.trim().replace(/\s+/g, '').toLowerCase()}`,
        weight: 10
      });
    }
    if (author.trim()) {
      interestsPayload.push({
        entity: `urn:entity:book:${author.trim().replace(/\s+/g, '').toLowerCase()}`,
        weight: 10
      });
    }
  
    // Construct the URL with all parameters
    const params = new URLSearchParams({
      'filter.type': 'urn:entity:place',
      'feature.explainability': 'false',
      'filter.location.query': destination,
      'filter.location.radius': '15000',
      'signal.interests.entities': JSON.stringify(interestsPayload),
      'sort_by': 'affinity',
      'limit': '100'
    });

    const fullUrl = `${apiEndpoint}?${params.toString()}`;

    try {
      const response = await fetch(fullUrl, {
        method: 'POST',
        headers: {
          'X-API-Key': apiKey,
        },
      });
  
      const data = await response.json();

      console.log(data)

      if (!response.ok || !data.success) {
        throw new Error(data?.results?.message || `API Error: ${response.status}`);
      }
  
      const entities = data.results?.entities || [];
      // Sort entities by popularity DESCENDING so index 0 is the most popular
      const sortedEntities = [...entities].sort((a, b) => b.popularity - a.popularity);

      // Map API response to the component's Recommendation type
      const mappedRecommendations = sortedEntities.map((entity: any, index: number) => {
        const segment = mapTagsToSegment(entity.tags);
        
        // Calculate a normalized rank (0 for most popular, ~1 for least popular)
        const popularityRank = sortedEntities.length > 1 ? index / (sortedEntities.length - 1) : 0;

        const { x, y } = getRadarCoordinates(segment, popularityRank);
        
        return {
          id: entity.entity_id,
          name: entity.name,
          category: entity.tags?.find(t => t.type.startsWith('urn:tag:category'))?.name || 'Place',
          image: entity.properties?.images?.[0]?.url || 'https://images.pexels.com/photos/33545/sunrise-phu-quoc-island-ocean.jpg?auto=compress&cs=tinysrgb&w=400',
          insight: entity.properties?.description || 'A location tailored to your unique cultural tastes.',
          website: entity.properties?.website,
          segment,
          x,
          y,
          latitude: entity.location?.lat,
          longitude: entity.location?.lon
        };
      });

      setRecommendations(mappedRecommendations);
      setIsGenerated(true);

      // Save to database
      await kenshoDb.saveRecommendations(mappedRecommendations);
      await kenshoDb.saveSession({ isGenerated: true });

    } catch (err: any) {
      console.error('Error generating recommendations:', err);
      
      // Check if it's a 400 error (invalid destination)
      if (err instanceof Error && err.message.includes('400')) {
        setApiError('Destination is invalid');
      } else {
        setApiError('An error occurred while generating recommendations');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Autoplan function using Gemini AI
  const handleAutoplan = async () => {
    if (!autoplanDescription.trim() || !hasRequiredInputs || !isGenerated || recommendations.length === 0) {
      setAutoplanError('Please generate recommendations first and provide a description of what you\'re looking for.');
      return;
    }

    const geminiApiKey = import.meta.env.VITE_GEMINI_API_KEY;
    if (!geminiApiKey) {
      setAutoplanError('Gemini API key not found. Please add VITE_GEMINI_API_KEY to your environment variables.');
      return;
    }

    setIsAutoplanning(true);
    setAutoplanError(null);

    try {
      const ai = new GoogleGenAI({ apiKey: geminiApiKey });


      // Prepare recommendations data for Gemini
      const recommendationsData = recommendations.map(rec => ({
        id: rec.id,
        name: rec.name,
        category: rec.category,
        segment: rec.segment,
        insight: rec.insight
      }));

      const prompt = `
You are an AI travel planner. Based on the user's description and the available recommendations, select the best locations for their itinerary.

User's travel description: "${autoplanDescription}"

Available recommendations:
${recommendationsData.map(rec => `- ${rec.id}: ${rec.name} (${rec.category}, ${rec.segment}): ${rec.insight}`).join('\n')}

Please analyze the user's description and select 3-5 locations that best match their interests. Consider:
1. The user's specific interests mentioned in their description
2. The variety of experiences (mix of dine, listen, see, explore if possible)
3. The cultural relevance based on the insights provided

Respond with ONLY a JSON array of the recommendation IDs that you select, like this:
["id1", "id2", "id3"]

Do not include any other text or explanation, just the JSON array.
`;

      

       const result = await ai.models.generateContent({
          model: "gemini-2.5-flash",
          contents: prompt,
          config: {
            temperature: 0.1,
          },
        });
      console.log(prompt)
      console.log(result.text)
      const response = result.text;
      
      // Parse the JSON response
      let selectedIds: string[];
      try {
        selectedIds = JSON.parse(response);
      } catch (parseError) {
        // If JSON parsing fails, try to extract IDs from the response
        const idMatches = response.match(/"([^"]+)"/g);
        if (idMatches) {
          selectedIds = idMatches.map(match => match.replace(/"/g, ''));
        } else {
          throw new Error('Could not parse AI response');
        }
      }

      // Add selected recommendations to itinerary
      const selectedRecommendations = recommendations.filter(rec => selectedIds.includes(rec.id));
      
      if (selectedRecommendations.length === 0) {
        setAutoplanError('No matching recommendations found. Try a different description.');
        return;
      }

      // Clear existing itinerary and add new selections
      setItinerary([]);
      await kenshoDb.clearItinerary();

      // Add selected items to itinerary
      const newItineraryItems: ItineraryItem[] = selectedRecommendations.map((rec, index) => ({
        ...rec,
        day: Math.floor(index / 2) + 1, // Distribute across days (2 items per day)
        notes: `Auto-selected based on: ${autoplanDescription}`,
        order: index
      }));

      setItinerary(newItineraryItems);
      
      // Save to database
      for (const item of newItineraryItems) {
        await kenshoDb.addToItinerary(item);
      }

      // Clear the description after successful autoplan
      setAutoplanDescription('');

    } catch (error: any) {
      console.error('Autoplan error:', error);
      setAutoplanError(error.message || 'Failed to generate autoplan. Please try again.');
    } finally {
      setIsAutoplanning(false);
    }
  };

  const addToItinerary = (rec: Recommendation) => {
    if (!itinerary.find(item => item.id === rec.id)) {
      const newItem: ItineraryItem = {
        ...rec,
        day: 1,
        notes: '',
        order: itinerary.length
      };
      setItinerary([...itinerary, newItem]);
      
      // Save to database
      kenshoDb.addToItinerary(newItem).catch(console.error);
    }
  };

  const removeFromItinerary = (id: string) => {
    setItinerary(itinerary.filter(item => item.id !== id));
    
    // Remove from database
    kenshoDb.removeFromItinerary(id).catch(console.error);
  };

  const updateItineraryDay = (id: string, day: number) => {
    setItinerary(itinerary.map(item => 
      item.id === id ? { ...item, day } : item
    ));
    
    // Update in database
    kenshoDb.updateItineraryItem(id, { day }).catch(console.error);
  };

  const updateItineraryNotes = (id: string, notes: string) => {
    setItinerary(itinerary.map(item => 
      item.id === id ? { ...item, notes } : item
    ));
    
    // Update in database
    kenshoDb.updateItineraryItem(id, { notes }).catch(console.error);
  };

  // Clear user preferences only
  const clearUserInputs = async () => {
    try {
      await kenshoDb.clearUserPreferences();
      
      // Also clear localStorage backup
      localStorage.removeItem('kensho-destination');
      localStorage.removeItem('kensho-movie');
      localStorage.removeItem('kensho-artist');
      localStorage.removeItem('kensho-author');
      
      // Reset state
      setDestination('');
      setMovie('');
      setArtist('');
      setAuthor('');
      setIsGenerated(false);
    } catch (error) {
      console.error('Error clearing user inputs:', error);
    }
  };

  // Clear all data including itinerary
  const clearAllData = async () => {
    try {
      await kenshoDb.clearAllData();
      
      // Also clear localStorage
      localStorage.removeItem('kensho-destination');
      localStorage.removeItem('kensho-movie');
      localStorage.removeItem('kensho-artist');
      localStorage.removeItem('kensho-author');
      localStorage.removeItem('kensho-recommendations');
      localStorage.removeItem('kensho-itinerary');
      localStorage.removeItem('kensho-is-generated');
      
      // Reset all state
      setDestination('');
      setMovie('');
      setArtist('');
      setAuthor('');
      setIsGenerated(false);
      setRecommendations([]);
      setItinerary([]);
    } catch (error) {
      console.error('Error clearing all data:', error);
    }
  };

  // Reset generation state only
  const resetGeneration = async () => {
    try {
      await kenshoDb.saveSession({ isGenerated: false });
      setIsGenerated(false);
    } catch (error) {
      console.error('Error resetting generation:', error);
    }
  };

  // Show loading state while database is initializing
  if (isDbLoading) {
    return (
      <div style={{ backgroundColor: '#0d0d0d' }} className="min-h-screen lg:h-screen font-['Exo',_sans-serif] text-white flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-[#dfdfdf] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-400">Loading your data...</p>
        </div>
      </div>
    );
  }

  const clearSavedInputs = () => {
    setDestination('');
    setMovie('');
    setArtist('');
    setAuthor('');
    // Only clear the generated state, but keep recommendations and itinerary
    setIsGenerated(false);
  };

  const hasInputs = isGenerated && recommendations.length > 0;

  if (showMap) {
    return <MapInterface />;
  }

  return (
    <div style={{ backgroundColor: '#0d0d0d' }} className="min-h-screen lg:h-screen font-['Exo',_sans-serif] text-white lg:overflow-hidden">
      {/* Mobile Layout */}
      <div className="lg:hidden">
        <div className="pt-20">
          {/* 1. Control Panel Section */}
          <div style={{ backgroundColor: '#0d0d0d' }} className="border-b border-gray-800 p-4">
            <h2 className="text-lg font-bold mb-4">Control Panel</h2>
            
            {/* Destination Input */}
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2 text-gray-300">Your Destination</label>
              <input
                type="text"
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                placeholder="e.g., Tokyo, Japan"
                className="w-full px-3 py-2 bg-[#2a2a2a] border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-[#dfdfdf] text-sm"
              />
            </div>

            {/* Cultural Preferences */}
            <div>
              <h3 className="text-sm font-medium mb-3 text-gray-300">Your Cultural Preferences</h3>
              <div className="grid grid-cols-1 gap-3">
                <div>
                  <label className="block text-xs font-medium mb-1 text-gray-400">Favorite Movie</label>
                  <input
                    type="text"
                    value={movie}
                    onChange={(e) => setMovie(e.target.value)}
                    placeholder="e.g., Blade Runner 2049"
                    className="w-full px-3 py-2 bg-[#2a2a2a] border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-[#dfdfdf] text-sm"
                  />
                </div>
                
                <div>
                  <label className="block text-xs font-medium mb-1 text-gray-400">Favorite Artist</label>
                  <input
                    type="text"
                    value={artist}
                    onChange={(e) => setArtist(e.target.value)}
                    placeholder="e.g., Radiohead"
                    className="w-full px-3 py-2 bg-[#2a2a2a] border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-[#dfdfdf] text-sm"
                  />
                </div>
                
                <div>
                  <label className="block text-xs font-medium mb-1 text-gray-400">Favorite Book</label>
                  <input
                    type="text"
                    value={author}
                    onChange={(e) => setAuthor(e.target.value)}
                    placeholder="e.g., Norwegian Wood"
                    className="w-full px-3 py-2 bg-[#2a2a2a] border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-[#dfdfdf] text-sm"
                  />
                </div>
              </div>
            </div>
            
            {/* API Error Display */}
            {apiError && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-red-600 font-medium">{apiError}</p>
              </div>
            )}
            
            {/* Generate Button */}
            {hasRequiredInputs && !isGenerated && (
              <div className="mt-6 pt-4 border-t border-gray-700">
                <button
                  onClick={handleGenerateRecommendations}
                  disabled={isLoading}
                  className="w-full py-3 px-4 bg-[#dfdfdf] text-black font-semibold rounded-lg hover:bg-gray-200 transition-colors disabled:bg-gray-500 disabled:cursor-not-allowed"
                >
                  {isLoading ? 'Generating...' : 'Generate My Discovery Zone'}
                </button>
              </div>
            )}
            
            {/* Reset Button */}
            {isGenerated && (
              <div className="mt-6 pt-4 border-t border-gray-700">
                <div className="space-y-2">
                  <button
                    onClick={() => {
                      setIsGenerated(false);
                      setRecommendations([]);
                      setItinerary([]);
                    }}
                    className="w-full py-2 px-4 border border-gray-600 text-gray-300 font-medium rounded-lg hover:bg-gray-800 transition-colors"
                  >
                    Reset & Try Again
                  </button>
                  <button
                    onClick={clearSavedInputs}
                    className="w-full py-2 px-4 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 transition-colors text-sm"
                  >
                    Clear Input Data Only
                  </button>
                  <button
                    onClick={clearAllData}
                    className="w-full py-2 px-4 bg-red-800 text-white font-medium rounded-lg hover:bg-red-900 transition-colors text-sm"
                  >
                    Clear All Data & Itinerary
                  </button>
                </div>
              </div>
            )}
            
            {/* Clear Data Button (always visible if there's saved data) */}
            {!isGenerated && (destination || movie || artist || author) && (
              <div className="mt-6 pt-4 border-t border-gray-700">
                <button
                  onClick={clearSavedInputs}
                  className="w-full py-2 px-4 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 transition-colors text-sm"
                >
                  Clear Input Data Only
                </button>
                <button
                  onClick={clearAllData}
                  className="w-full py-2 px-4 bg-red-800 text-white font-medium rounded-lg hover:bg-red-900 transition-colors mt-2"
                >
                  Clear All Data & Itinerary
                </button>
                <p className="text-center text-gray-500 text-xs mt-2">
                  Your inputs are automatically saved
                </p>
              </div>
            )}
            
            {/* Autoplan Section */}
            {isGenerated && recommendations.length > 0 && (
              <div className="mt-6 pt-4 border-t border-gray-700">
                <div className="flex items-center space-x-2 mb-3">
                  <Sparkles className="w-4 h-4 text-purple-400" />
                  <h3 className="text-sm font-medium text-purple-400">AI Autoplan</h3>
                </div>
                <p className="text-xs text-gray-400 mb-3">
                  Describe what you're looking for and AI will select the best locations for you
                </p>
                <textarea
                  value={autoplanDescription}
                  onChange={(e) => setAutoplanDescription(e.target.value)}
                  placeholder="e.g., I want a romantic evening with great food and live music, or I'm looking for cultural experiences and art galleries..."
                  className="w-full px-3 py-2 bg-[#2a2a2a] border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-purple-400 text-sm resize-none"
                  rows={3}
                />
                <button
                  onClick={handleAutoplan}
                  disabled={isAutoplanning || !autoplanDescription.trim()}
                  className="w-full mt-3 py-2 px-4 bg-purple-600 text-white font-medium rounded-lg hover:bg-purple-700 transition-colors disabled:bg-gray-500 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
                >
                  {isAutoplanning ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>Planning...</span>
                    </>
                  ) : (
                    <>
                      <Wand2 size={16} />
                      <span>Autoplan My Trip</span>
                    </>
                  )}
                </button>
                {autoplanError && (
                  <p className="text-red-400 text-xs mt-2">{autoplanError}</p>
                )}
              </div>
            )}
            
            {error && <div className="text-red-400 text-sm mt-4 text-center">{error}</div>}
          </div>

          {/* 2. Compass Section */}
          <div className="border-b border-gray-800 p-4 min-h-[50vh]">
            <h2 className="text-lg font-bold mb-4">Discovery Zone</h2>
            {isLoading && <div className="text-center py-8 text-gray-400">Generating...</div>}
            {!isLoading && hasInputs ? (
              <div>
                {/* Mobile Compass */}
                <div className="mb-6">
                  <RadarChart 
                    recommendations={recommendations} 
                    onDotClick={addToItinerary}
                    hasInputs={hasInputs}
                  />
                </div>
                
                {/* Mobile Recommendations Carousel */}
                <div>
                  <h3 className="text-base font-bold mb-3">Recommendations for You</h3>
                  <div className="flex space-x-4 overflow-x-auto pb-4 snap-x snap-mandatory">
                    {recommendations.map((rec) => (
                      <MobileRecommendationCard
                        key={rec.id}
                        rec={rec}
                        onAdd={addToItinerary}
                      />
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              !isLoading && <div className="text-center py-8">
                <p className="text-gray-400 text-sm">
                  {!hasRequiredInputs 
                    ? "Enter your destination and cultural preferences above, then generate your discovery zone"
                    : "Click 'Generate My Discovery Zone' above to see personalized recommendations"
                  }
                </p>
              </div>
            )}
          </div>

          {/* 3. Itinerary Section */}
          <div className="p-4 min-h-[40vh] pb-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold">Your Itinerary</h2>
              {itinerary.length > 0 && (
                <span className="bg-blue-500 text-white text-xs px-2 py-1 rounded-full">
                  {itinerary.length} items
                </span>
              )}
            </div>
            
            {itinerary.length === 0 ? (
              <div className="text-center py-8">
                <Calendar className="w-10 h-10 text-gray-600 mx-auto mb-3" />
                <p className="text-gray-400 text-sm">
                  Add recommendations from the compass to build your journey
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {itinerary
                  .sort((a, b) => a.day - b.day || a.order - b.order)
                  .map((item) => (
                    <ItineraryItemCard
                      key={item.id}
                      item={item}
                      onRemove={removeFromItinerary}
                      onUpdateDay={updateItineraryDay}
                      onUpdateNotes={updateItineraryNotes}
                    />
                  ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Desktop Layout */}
      <div className="hidden lg:flex h-screen pt-20">
        {/* Left Panel - Control Panel */}
        <div className="w-80 border-r border-gray-800 p-6 overflow-y-auto h-full">
          <h2 className="text-xl font-bold mb-6">Control Panel</h2>
          
          {/* Destination Input */}
          <div className="mb-8">
            <label className="block text-sm font-medium mb-3 text-gray-300">Your Destination</label>
            <input
              type="text"
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              placeholder="e.g., Tokyo, Japan"
              className="w-full px-4 py-3 bg-[#1a1a1a] border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-[#dfdfdf]"
            />
          </div>

          {/* Cultural Anchors */}
          <div>
            <h3 className="text-sm font-medium mb-4 text-gray-300">Your Cultural Preferences</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2 text-gray-300">Favorite Movie</label>
                <input
                  type="text"
                  value={movie}
                  onChange={(e) => setMovie(e.target.value)}
                  placeholder="e.g., Blade Runner 2049"
                  className="w-full px-4 py-3 bg-[#1a1a1a] border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-[#dfdfdf]"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-2 text-gray-300">Favorite Artist</label>
                <input
                  type="text"
                  value={artist}
                  onChange={(e) => setArtist(e.target.value)}
                  placeholder="e.g., Radiohead"
                  className="w-full px-4 py-3 bg-[#1a1a1a] border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-[#dfdfdf]"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-2 text-gray-300">Favorite Book</label>
                <input
                  type="text"
                  value={author}
                  onChange={(e) => setAuthor(e.target.value)}
                  placeholder="e.g., Norwegian Wood"
                  className="w-full px-4 py-3 bg-[#1a1a1a] border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-[#dfdfdf]"
                />
              </div>
            </div>
          </div>
          
          {/* API Error Display */}
          {apiError && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-600 font-medium">{apiError}</p>
            </div>
          )}
          
          {/* Generate Button */}
          {hasRequiredInputs && !isGenerated && (
            <div className="mt-8 pt-6 border-t border-gray-700">
              <button
                onClick={handleGenerateRecommendations}
                disabled={isLoading}
                className="w-full py-4 px-6 bg-[#dfdfdf] text-black font-bold rounded-lg hover:bg-gray-200 transition-colors text-lg disabled:bg-gray-500 disabled:cursor-not-allowed"
              >
                {isLoading ? 'Generating...' : 'Generate My Discovery Zone'}
              </button>
              <p className="text-center text-gray-400 text-sm mt-3">
                Create personalized recommendations based on your preferences
              </p>
            </div>
          )}
          
          {/* Reset Button */}
          {isGenerated && (
            <div className="mt-6 pt-4 border-t border-gray-700">
              <div className="space-y-3">
                <button
                  onClick={resetGeneration}
                  className="w-full py-3 px-4 border border-gray-600 text-gray-300 font-medium rounded-lg hover:bg-gray-800 transition-colors"
                >
                  Reset & Try Again
                </button>
                <button
                  onClick={clearUserInputs}
                  className="w-full py-2 px-4 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 transition-colors"
                >
                  Clear Input Data Only
                </button>
                <button
                  onClick={clearAllData}
                  className="w-full py-2 px-4 bg-red-800 text-white font-medium rounded-lg hover:bg-red-900 transition-colors"
                >
                  Clear All Data & Itinerary
                </button>
              </div>
            </div>
          )}
          
          {/* Clear Data Button (always visible if there's saved data) */}
          {!isGenerated && (destination || movie || artist || author) && (
            <div className="mt-6 pt-4 border-t border-gray-700">
              <button
                onClick={clearUserInputs}
                className="w-full py-2 px-4 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 transition-colors"
              >
                Clear Input Data Only
              </button>
              <button
                onClick={clearAllData}
                className="w-full py-2 px-4 bg-red-800 text-white font-medium rounded-lg hover:bg-red-900 transition-colors mt-2"
              >
                Clear All Data & Itinerary
              </button>
              <p className="text-center text-gray-400 text-sm mt-2">
                Inputs saved • Itinerary persists through logout
              </p>
            </div>
          )}
          
          {/* Autoplan Section - Desktop */}
          {isGenerated && recommendations.length > 0 && (
            <div className="mt-6 pt-4 border-t border-gray-700">
              <div className="flex items-center space-x-2 mb-4">
                <Sparkles className="w-5 h-5 text-purple-400" />
                <h3 className="text-lg font-bold text-purple-400">AI Autoplan</h3>
              </div>
              <p className="text-sm text-gray-400 mb-4">
                Describe what you're looking for and AI will automatically select the best locations for your itinerary
              </p>
              <textarea
                value={autoplanDescription}
                onChange={(e) => setAutoplanDescription(e.target.value)}
                placeholder="e.g., I want a romantic evening with great food and live music, or I'm looking for cultural experiences and art galleries..."
                className="w-full px-4 py-3 bg-[#1a1a1a] border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-purple-400 resize-none"
                rows={4}
              />
              <button
                onClick={handleAutoplan}
                disabled={isAutoplanning || !autoplanDescription.trim()}
                className="w-full mt-4 py-3 px-4 bg-purple-600 text-white font-bold rounded-lg hover:bg-purple-700 transition-colors disabled:bg-gray-500 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
              >
                {isAutoplanning ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>AI is planning your trip...</span>
                  </>
                ) : (
                  <>
                    <Wand2 size={18} />
                    <span>Autoplan My Trip</span>
                  </>
                )}
              </button>
              {autoplanError && (
                <div className="mt-3 p-3 bg-red-900/20 border border-red-500/30 rounded-lg">
                  <p className="text-red-400 text-sm">{autoplanError}</p>
                </div>
              )}
              <p className="text-xs text-gray-500 mt-3">
                💡 Tip: Be specific about your interests, mood, or type of experience you want
              </p>
            </div>
          )}
          
          {error && <div className="text-red-400 text-sm mt-4">{error}</div>}
        </div>

        {/* Center Panel - Discovery Zone */}
        <div className="flex-1 p-6 flex flex-col h-full">
          <h2 className="text-xl font-bold mb-6">Discovery Zone</h2>
          <div className="flex-1 flex flex-col">
            {/* Compass */}
            <div className="flex-1 min-h-0 flex items-center justify-center">
              {isLoading && <div className="w-full h-full flex items-center justify-center text-gray-400">Generating...</div>}
              {!isLoading && <RadarChart 
                recommendations={recommendations} 
                onDotClick={addToItinerary}
                hasInputs={hasInputs}
              />}
            </div>
            
            {/* Recommendations List */}
            {!isLoading && hasInputs && recommendations.length > 0 && (
              <div className="mt-6 border-t border-gray-800 pt-6">
                <h3 className="text-lg font-bold mb-4">Your Personalized Recommendations</h3>
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 max-h-80 overflow-y-auto">
                  {recommendations.map((rec) => (
                    <DesktopRecommendationCard
                      key={rec.id}
                      rec={rec}
                      onAdd={addToItinerary}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Panel - Itinerary Builder */}
        <div className="w-80 border-l border-gray-800 p-6 overflow-y-auto h-full">
          <h2 className="text-xl font-bold mb-6">Your Itinerary</h2>
          
          {itinerary.length === 0 ? (
            <div className="text-center py-12">
              <Calendar className="w-12 h-12 text-gray-600 mx-auto mb-4" />
              <p className="text-gray-400 text-sm">
                Add recommendations from the compass to build your journey
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {itinerary
                .sort((a, b) => a.day - b.day || a.order - b.order)
                .map((item) => (
                  <ItineraryItemCard
                    key={item.id}
                    item={item}
                    onRemove={removeFromItinerary}
                    onUpdateDay={updateItineraryDay}
                    onUpdateNotes={updateItineraryNotes}
                  />
                ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}