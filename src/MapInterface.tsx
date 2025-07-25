import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, X, Star, MapPin, Navigation, MessageCircle, Send, Bot, User, ChevronRight, ChevronLeft, Route, Clock, Car } from 'lucide-react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { kenshoDb } from './utils/database';
import type { Recommendation as DbRecommendation, ItineraryItem as DbItineraryItem, UserPreferences } from './utils/database';
import { GoogleGenAI } from '@google/genai';

// Types
interface Location {
  id: string;
  name: string;
  category: string;
  image: string;
  insight: string;
  coordinates: [number, number];
  type: 'itinerary' | 'recommendation';
}

// Helper function to convert database items to map locations
const convertToMapLocation = (item: DbRecommendation | DbItineraryItem, type: 'itinerary' | 'recommendation'): Location | null => {
  // Use stored coordinates if available, otherwise use default Tokyo coordinates
  let coordinates: [number, number];
  
  if (item.latitude && item.longitude) {
    coordinates = [item.longitude, item.latitude]; // Note: Mapbox uses [lng, lat] format
  } else {
    // Fallback to Tokyo coordinates if no coordinates are stored
    coordinates = [139.6917, 35.6895];
  }
  
  return {
    id: item.id,
    name: item.name,
    category: item.category,
    image: item.image,
    insight: item.insight,
    coordinates,
    type
  };
};

interface ModalData {
  location: Location;
  isOpen: boolean;
}

// Route information interface
interface RouteInfo {
  duration: number; // in seconds
  distance: number; // in meters
  geometry: any; // GeoJSON geometry
}

// Chat message interface
interface ChatMessage {
  id: string;
  type: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  suggestions?: string[];
}

// Location Modal Component
const LocationModal = ({ modalData, onClose, onGetDirections }: {
  modalData: ModalData;
  onClose: () => void;
  onGetDirections?: (location: Location) => void;
}) => {
  if (!modalData.isOpen) return null;

  const { location } = modalData;

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/50 z-40"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="fixed bottom-0 left-0 right-0 z-50 transform transition-transform duration-300 ease-out">
        <div className="bg-[#1a1a1a] rounded-t-3xl border-t border-gray-700 max-h-[60vh] overflow-hidden">
          {/* Handle */}
          <div className="flex justify-center py-3">
            <div className="w-12 h-1 bg-gray-600 rounded-full"></div>
          </div>
          
          {/* Header */}
          <div className="flex items-center justify-between px-6 pb-4">
            <div className="flex items-center space-x-2">
              {location.type === 'recommendation' ? (
                <Star className="w-5 h-5 text-yellow-400" />
              ) : (
                <MapPin className="w-5 h-5 text-blue-400" />
              )}
              <span className="text-xs text-gray-400 uppercase tracking-wide">
                {location.type === 'recommendation' ? 'For You' : 'Itinerary'}
              </span>
            </div>
            <button 
              onClick={onClose}
              className="text-gray-400 hover:text-white"
            >
              <X size={24} />
            </button>
          </div>

          {/* Content */}
          <div className="px-6 pb-6">
            {/* Image */}
            <div className="relative mb-4 rounded-2xl overflow-hidden">
              <img
                src={location.image}
                alt={location.name}
                className="w-full h-48 object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
              <div className="absolute bottom-4 left-4">
                <span className="inline-block px-3 py-1 bg-black/70 text-white text-xs rounded-full">
                  {location.category}
                </span>
              </div>
            </div>

            {/* Details */}
            <div className="space-y-4">
              <h3 className="text-2xl font-bold text-white">{location.name}</h3>
              
              <div className="bg-[#0d0d0d] rounded-xl p-4 border border-gray-700">
                <p className="text-sm text-gray-300">
                  <span className="text-[#dfdfdf] font-semibold">Why it's perfect for you:</span>
                </p>
                <p className="text-sm text-gray-300 mt-1">{location.insight}</p>
              </div>

              {/* Action Buttons */}
              <div className="flex space-x-3 pt-2">
                <button 
                  onClick={() => onGetDirections?.(location)}
                  className="flex-1 py-3 px-4 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition-colors flex items-center justify-center space-x-2"
                >
                  <Route size={18} />
                  <span>Get Directions</span>
                </button>
                {location.type === 'recommendation' && (
                  <button className="flex-1 py-3 px-4 border border-[#dfdfdf] text-[#dfdfdf] font-semibold rounded-xl hover:bg-[#dfdfdf] hover:text-black transition-colors">
                    Add to Itinerary
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};
const EMPTY_LOCATIONS: Location[] = [];

// Main Map Interface Component
export default function MapInterface({ locations = EMPTY_LOCATIONS }: { locations?: Location[] }) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const homeMarker = useRef<mapboxgl.Marker | null>(null);
  const [dbLocations, setDbLocations] = useState<Location[]>([]);
  const [modalData, setModalData] = useState<ModalData>({ location: dbLocations[0] || locations[0], isOpen: false });
  const [mapLoaded, setMapLoaded] = useState(false);
  const [hoveredLocation, setHoveredLocation] = useState<Location | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });
  const [userLocation, setUserLocation] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(true);
  const [userPreferences, setUserPreferences] = useState<UserPreferences | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      id: '1',
      type: 'assistant',
      content: 'Hello! I\'m your AI tour guide. I can help you discover amazing places, plan your itinerary, and answer questions about your destinations. Add some locations from the Cultural Compass to see them on the map!',
      timestamp: new Date(),
      suggestions: [
        'Plan my route efficiently',
        'Local cultural recommendations',
        'Best times to visit places',
        'Hidden gems in my destination'
      ]
    }
  ]);
  const [currentMessage, setCurrentMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [currentRoute, setCurrentRoute] = useState<RouteInfo | null>(null);
  const [isLoadingRoute, setIsLoadingRoute] = useState(false);
  const [routeSource, setRouteSource] = useState<mapboxgl.GeoJSONSource | null>(null);
  const [userCoordinates, setUserCoordinates] = useState<[number, number] | null>(null);

  // Update initial chat message when user preferences load
  useEffect(() => {
    if (userPreferences) {
      const personalizedWelcome: ChatMessage = {
        id: 'personalized-welcome',
        type: 'assistant',
        content: `Hello! I'm your AI tour guide for ${userPreferences.destination}. Based on your love for "${userPreferences.movie}", ${userPreferences.artist}, and ${userPreferences.author}, I can provide personalized recommendations and help plan your perfect itinerary! What would you like to explore?`,
        timestamp: new Date(),
        suggestions: [
          `Find places like in ${userPreferences.movie}`,
          `${userPreferences.artist} style venues`,
          `Literary spots for ${userPreferences.author} fans`,
          'Plan my route efficiently'
        ]
      };

      setChatMessages(prev => {
        // Replace the generic welcome message with personalized one
        const filtered = prev.filter(msg => msg.id !== '1' && msg.id !== 'personalized-welcome');
        return [personalizedWelcome, ...filtered];
      });
    }
  }, [userPreferences]);

  // Initialize Gemini AI
  const genAI = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY });

  // Function to get directions using Mapbox Directions API
  const getDirections = async (destination: Location) => {
    if (!userCoordinates || !map.current) {
      alert('Please set your location first to get directions');
      return;
    }

    setIsLoadingRoute(true);
    
    try {
      const [startLng, startLat] = userCoordinates;
      const [endLng, endLat] = destination.coordinates;
      
      // Call Mapbox Directions API
      const response = await fetch(
        `https://api.mapbox.com/directions/v5/mapbox/driving/${startLng},${startLat};${endLng},${endLat}?geometries=geojson&access_token=${mapboxgl.accessToken}`
      );
      
      const data = await response.json();
      
      if (data.routes && data.routes.length > 0) {
        const route = data.routes[0];
        const routeInfo: RouteInfo = {
          duration: route.duration,
          distance: route.distance,
          geometry: route.geometry
        };
        
        setCurrentRoute(routeInfo);
        
        // Add route to map
        if (map.current.getSource('route')) {
          (map.current.getSource('route') as mapboxgl.GeoJSONSource).setData(route.geometry);
        } else {
          map.current.addSource('route', {
            type: 'geojson',
            data: route.geometry
          });
          
          map.current.addLayer({
            id: 'route',
            type: 'line',
            source: 'route',
            layout: {
              'line-join': 'round',
              'line-cap': 'round'
            },
            paint: {
              'line-color': '#3b82f6',
              'line-width': 5,
              'line-opacity': 0.8
            }
          });
        }
        
        // Fit map to show entire route
        const coordinates = route.geometry.coordinates;
        const bounds = new mapboxgl.LngLatBounds();
        coordinates.forEach((coord: [number, number]) => bounds.extend(coord));
        
        map.current.fitBounds(bounds, {
          padding: 80,
          duration: 1000
        });
        
        // Close modal
        closeModal();
        
      } else {
        alert('No route found. Please try a different destination.');
      }
    } catch (error) {
      console.error('Error getting directions:', error);
      alert('Failed to get directions. Please try again.');
    } finally {
      setIsLoadingRoute(false);
    }
  };

  // Function to clear current route
  const clearRoute = () => {
    if (map.current && map.current.getLayer('route')) {
      map.current.removeLayer('route');
      map.current.removeSource('route');
    }
    setCurrentRoute(null);
  };

  // Format duration for display
  const formatDuration = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  // Format distance for display
  const formatDistance = (meters: number): string => {
    const km = meters / 1000;
    if (km >= 1) {
      return `${km.toFixed(1)} km`;
    }
    return `${meters.toFixed(0)} m`;
  };

  // Load user preferences on component mount
  useEffect(() => {
    const loadUserPreferences = async () => {
      try {
        const preferences = await kenshoDb.getUserPreferences();
        setUserPreferences(preferences);
      } catch (error) {
        console.error('Error loading user preferences:', error);
      }
    };

    loadUserPreferences();
  }, []);

  // Load locations from database
  useEffect(() => {
    const loadLocationsFromDB = async () => {
      try {
        // Only load itinerary items
        const itinerary = await kenshoDb.getItinerary();

        const mapLocations: Location[] = [];

        // Add only itinerary items to the map
        itinerary.forEach(item => {
          const location = convertToMapLocation(item, 'itinerary');
          if (location) {
            mapLocations.push(location);
          }
        });

        setDbLocations(mapLocations);
      } catch (error) {
        console.error('Error loading locations from database:', error);
      }
    };

    loadLocationsFromDB();
  }, []);

  // Generate AI response using Gemini
  const generateAIResponse = async (userMessage: string): Promise<string> => {
  try {
    // Build context from user preferences and current state (this logic stays the same)
    const contextInfo = [];
    if (userPreferences) {
      contextInfo.push(`User's destination: ${userPreferences.destination}`);
      contextInfo.push(`User's favorite movie: ${userPreferences.movie}`);
      contextInfo.push(`User's favorite artist: ${userPreferences.artist}`);
      contextInfo.push(`User's favorite author: ${userPreferences.author}`);
    }
    if (dbLocations.length > 0) {
      contextInfo.push(`User has ${dbLocations.length} locations in their itinerary: ${dbLocations.map(loc => loc.name).join(', ')}`);
    }
    if (userLocation) {
      contextInfo.push(`User's current location: ${userLocation}`);
    }

    // Build detailed system prompt with user preferences
    let systemPrompt = `You are an AI tour guide assistant for Kensho AI, a cultural intelligence platform. You help users plan their travel experiences based on their cultural preferences and provide personalized recommendations.

IMPORTANT USER CONTEXT:`;

    if (userPreferences) {
      systemPrompt += `

🎯 DESTINATION: ${userPreferences.destination}
- You are specifically helping the user explore ${userPreferences.destination}
- All recommendations should be relevant to ${userPreferences.destination}
- Consider local culture, customs, and attractions in ${userPreferences.destination}

🎬 CULTURAL PREFERENCES:
- Favorite Movie: "${userPreferences.movie}"
  * Use this to understand their storytelling preferences, themes they enjoy, visual aesthetics they appreciate
  * Recommend locations that match the mood, setting, or themes of this movie
  * Consider filming locations if the movie was shot in or relates to ${userPreferences.destination}

🎵 Music Taste: "${userPreferences.artist}"
  * This reveals their cultural vibe, energy level, and aesthetic preferences
  * Recommend venues, neighborhoods, or experiences that match this musical style
  * Consider live music venues, cultural districts, or areas known for this genre

📚 Literary Interest: "${userPreferences.author}"
  * This shows their intellectual interests, preferred themes, and cultural depth
  * Recommend bookstores, literary cafes, museums, or locations connected to similar authors
  * Consider the themes and settings this author explores in their work`;
    } else {
      systemPrompt += `

⚠️ No user preferences available yet. Encourage them to complete their cultural profile in the Cultural Compass for personalized recommendations.`;
    }

    if (dbLocations.length > 0) {
      systemPrompt += `

🗺️ CURRENT ITINERARY (${dbLocations.length} locations):
${dbLocations.map(loc => `- ${loc.name} (${loc.category}): ${loc.insight}`).join('\n')}

Use this itinerary context to:
- Help optimize routes and timing
- Suggest complementary nearby locations
- Provide logistical advice for visiting these places
- Recommend the best order to visit them`;
    }

    if (userLocation) {
      systemPrompt += `

📍 USER'S CURRENT LOCATION: ${userLocation}
- Provide directions and transportation advice from this location
- Consider travel time and logistics from their current position`;
    }

    systemPrompt += `

🎯 YOUR ROLE AS AI TOUR GUIDE:
- Provide personalized travel advice that connects their cultural preferences to real experiences
- Help with route planning and itinerary optimization
- Share local insights, hidden gems, and cultural recommendations
- Answer questions about destinations, local customs, and travel tips
- Be enthusiastic, knowledgeable, and culturally aware
- Keep responses concise but informative (2-3 sentences max unless asked for details)
- Always tie recommendations back to their stated preferences when possible

🌟 PERSONALIZATION STRATEGY:
- Connect movie preferences to visual experiences, atmospheres, and locations
- Link music taste to neighborhoods, venues, and cultural vibes  
- Use literary interests to suggest intellectual and cultural experiences
- Combine all three preferences to create unique, personalized recommendations

USER'S CURRENT QUESTION: "${userMessage}"

Respond as a helpful, culturally-aware tour guide who understands the user's unique tastes and preferences.`;

    console.log('System Prompt:', systemPrompt);
    
    // The new way to call the model
    const result = await genAI.models.generateContent({
      model: "gemini-2.5-flash",
      contents: systemPrompt, // Pass the prompt in the 'contents' property
    });
    
    // The new way to access the response text
    return result.text;

  } catch (error) {
    console.error('Error generating AI response:', error);
    return "I'm having trouble connecting right now, but I'm here to help with your travel planning! Feel free to ask me about routes, local recommendations, or anything about your destination.";
  }
};

  // Handle sending chat messages
  const handleSendMessage = async () => {
    if (!currentMessage.trim()) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      type: 'user',
      content: currentMessage,
      timestamp: new Date()
    };

    setChatMessages(prev => [...prev, userMessage]);
    setCurrentMessage('');
    setIsTyping(true);

    try {
      // Generate AI response using Gemini
      const aiResponse = await generateAIResponse(currentMessage);
      
      const assistantMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content: aiResponse,
        timestamp: new Date(),
        suggestions: [
          'Plan optimal routes',
          'Local cultural recommendations',
          'Best times to visit',
          'Travel tips for my destination'
        ]
      };

      setChatMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Error in chat:', error);
      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content: "I'm having trouble connecting right now, but I'm here to help with your travel planning! Feel free to ask me about routes, local recommendations, or anything about your destination.",
        timestamp: new Date()
      };
      setChatMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsTyping(false);
    }
  };

  // Handle suggestion clicks
  const handleSuggestionClick = (suggestion: string) => {
    setCurrentMessage(suggestion);
  };

  // Handle Enter key in chat input
  const handleChatKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Function to geocode user location and add home marker
  const handleLocationSearch = async () => {
    if (!userLocation.trim() || !map.current) return;
    
    setIsSearching(true);
    
    try {
      // Use Mapbox Geocoding API
      const response = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(userLocation)}.json?access_token=${mapboxgl.accessToken}&limit=1`
      );
      
      const data = await response.json();
      
      if (data.features && data.features.length > 0) {
        const [lng, lat] = data.features[0].center;
        
        // Remove existing home marker if it exists
        if (homeMarker.current) {
          homeMarker.current.remove();
        }
        
        // Create home marker element
        const homeMarkerElement = document.createElement('div');
        homeMarkerElement.style.cssText = `
          width: 32px;
          height: 32px;
          background-color: #ef4444;
          border: none;
          border-radius: 50%;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 16px;
          color: white;
          box-shadow: 0 2px 10px rgba(0,0,0,0.3);
          z-index: 1000;
        `;
        homeMarkerElement.innerHTML = '🏠';
        
        // Create and add home marker
        homeMarker.current = new mapboxgl.Marker(homeMarkerElement)
          .setLngLat([lng, lat])
          .addTo(map.current);
        
        // Store user coordinates for s
        setUserCoordinates([lng, lat]);
        
        // Fly to the user's location
        map.current.flyTo({
          center: [lng, lat],
          zoom: 13,
          duration: 2000
        });
      }
    } catch (error) {
      console.error('Error geocoding location:', error);
    } finally {
      setIsSearching(false);
    }
  };

  // Handle Enter key press in location input
  const handleLocationKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleLocationSearch();
    }
  };
  // Initialize map
  useEffect(() => {
    if (!mapContainer.current) return;

    // Set your Mapbox access token here
    mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_API_KEY ; // Replace with your actual token

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/standard',
      center: [0, 0], // Default center
      pitch: 45,
      bearing: 0,
        config: {
        basemap: {
          showRoadLabels : false,
          showTransitLabels: false,

          theme: 'faded'
        }
      }
      
    });

    

    map.current.on('load', () => {
      setMapLoaded(true);
    });

    return () => {
      if (map.current) {
        map.current.remove();
      }
    };
  }, []);
const markersRef = useRef<{ [id: string]: mapboxgl.Marker }>({});

  // Add markers when locations change
useEffect(() => {
  if (!map.current || !mapLoaded) return;

  const allLocations = [...dbLocations, ...locations];

  // Logic to synchronize markers with the allLocations array
  const displayedMarkerIds = Object.keys(markersRef.current);

  // 1. Remove markers that are no longer in the locations list
  displayedMarkerIds.forEach(markerId => {
    const isStillPresent = allLocations.some(loc => loc.id === markerId);
    if (!isStillPresent) {
      markersRef.current[markerId].remove();
      delete markersRef.current[markerId];
    }
  });

  // 2. Add new markers for locations that aren't on the map yet
  allLocations.forEach((location) => {
    if (!markersRef.current[location.id]) {
      // Create custom marker element
      const markerElement = document.createElement('div');
      markerElement.className = 'custom-marker';
      // ... (The CSS styling for the markerElement remains the same)
      markerElement.style.cssText = `
        width: 24px;
        height: 24px;
        border-radius: 50%;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 12px;
        font-weight: bold;
        animation: pulse 2s infinite;
        ${location.type === 'itinerary' 
          ? 'background-color: #3b82f6; color: white; border: 2px solid #1e40af;' 
          : 'background-color: #fbbf24; color: black; border: 2px solid #f59e0b;'
        }
      `;
      
      if (location.type === 'recommendation') {
        markerElement.innerHTML = '★';
      } else {
        markerElement.innerHTML = '●';
      }

      // Add event listeners (hover, click, etc.)
      markerElement.addEventListener('mouseenter', () => setHoveredLocation(location));
      markerElement.addEventListener('mouseleave', () => setHoveredLocation(null));
      markerElement.addEventListener('mousemove', (e) => {
        // This is still inefficient but separate from the main problem.
        // For a smoother experience, you could manage tooltip state outside of React state.
        const rect = mapContainer.current!.getBoundingClientRect();
        setTooltipPosition({ x: e.clientX - rect.left, y: e.clientY - rect.top });
      });
      markerElement.addEventListener('click', () => setModalData({ location, isOpen: true }));
      
      // Create and store the new marker instance
      const marker = new mapboxgl.Marker(markerElement)
        .setLngLat(location.coordinates)
        .setOffset([0, 0])
        .addTo(map.current!);

      markersRef.current[location.id] = marker;
    }
  });

  // 3. IMPORTANT: Only fit the bounds when the locations are first loaded.
  // We check if the markersRef was previously empty but now has markers.
  const hasJustAddedFirstMarkers = displayedMarkerIds.length === 0 && allLocations.length > 0;

  if (hasJustAddedFirstMarkers) {
    const bounds = new mapboxgl.LngLatBounds();
    allLocations.forEach(location => {
      bounds.extend(location.coordinates);
    });
    
    map.current.fitBounds(bounds, {
      padding: 80, // Add more padding for a better view
      duration: 1000 // Animate the transition
    });
  }

}, [dbLocations, locations, mapLoaded]); // Dependencies remain the same

  // Add CSS for pulsing animation
  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      @keyframes pulse {
        0% {
          box-shadow: 0 0 0 0 rgba(251, 191, 36, 0.7);
        }
        70% {
          box-shadow: 0 0 0 10px rgba(251, 191, 36, 0);
        }
        100% {
          box-shadow: 0 0 0 0 rgba(251, 191, 36, 0);
        }
      }
      
      .custom-marker[style*="background-color: #3b82f6"] {
        animation: none !important;
      }
    `;
    document.head.appendChild(style);

    return () => {
      document.head.removeChild(style);
    };
  }, []);

  const closeModal = () => {
    setModalData(prev => ({ ...prev, isOpen: false }));
  };

  // Combine database locations with any passed locations
  const allLocations = [...dbLocations, ...locations];

  return (
    <div style={{ backgroundColor: '#0d0d0d' }} className="min-h-screen font-['Exo',_sans-serif] text-white relative">

      {/* Location Input - Desktop */}
      <div className="absolute top-20 left-4 right-4 z-40 hidden lg:block">
        <div className={`max-w-md transition-all duration-300 ${isChatOpen ? 'mr-[40%]' : 'mx-auto'}`}>
          <div className="bg-black/90 backdrop-blur-sm rounded-xl p-4 border border-blue-500/50 shadow-lg">
            <div className="flex items-center space-x-2 mb-3">
              <Navigation size={20} className="text-blue-400" />
              <h3 className="text-white font-semibold">Set Your Starting Location</h3>
            </div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Enter your address, hotel, or current location
            </label>
            <div className="flex space-x-2">
              <input
                type="text"
                value={userLocation}
                onChange={(e) => setUserLocation(e.target.value)}
                onKeyPress={handleLocationKeyPress}
                placeholder="e.g., Tokyo Station, Shibuya Hotel, or full address..."
                className="flex-1 px-3 py-2 bg-[#1a1a1a] border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-[#dfdfdf] text-sm"
              />
              <button
                onClick={handleLocationSearch}
                disabled={!userLocation.trim() || isSearching}
                className="px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-500 disabled:cursor-not-allowed text-sm flex items-center space-x-1"
              >
                {isSearching ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <>
                    <Navigation size={16} />
                    <span>Set Location</span>
                  </>
                )}
              </button>
            </div>
            {!userCoordinates && (
              <div className="mt-3 p-2 bg-yellow-500/20 border border-yellow-500/30 rounded-lg">
                <p className="text-yellow-200 text-xs">
                  💡 Set your location first to get directions to any destination on the map
                </p>
              </div>
            )}
            {userCoordinates && (
              <div className="mt-3 p-2 bg-green-500/20 border border-green-500/30 rounded-lg">
                <p className="text-green-200 text-xs flex items-center space-x-1">
                  <span>✅</span>
                  <span>Location set! Click any map marker to get directions</span>
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Route Information Panel - Desktop */}
      {currentRoute && (
        <div className="absolute top-20 right-4 z-40 hidden lg:block">
          <div className={`max-w-sm transition-all duration-300 ${isChatOpen ? 'mr-[40%]' : ''}`}>
            <div className="bg-black/90 backdrop-blur-sm rounded-xl p-4 border border-gray-700">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-white font-semibold text-sm flex items-center space-x-2">
                  <Route size={16} className="text-blue-400" />
                  <span>Route Information</span>
                </h3>
                <button
                  onClick={clearRoute}
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  <X size={16} />
                </button>
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center space-x-3 text-sm">
                  <Clock size={14} className="text-green-400" />
                  <span className="text-gray-300">Duration:</span>
                  <span className="text-white font-medium">{formatDuration(currentRoute.duration)}</span>
                </div>
                
                <div className="flex items-center space-x-3 text-sm">
                  <Car size={14} className="text-blue-400" />
                  <span className="text-gray-300">Distance:</span>
                  <span className="text-white font-medium">{formatDistance(currentRoute.distance)}</span>
                </div>
              </div>
              
              <div className="mt-3 pt-3 border-t border-gray-600">
                <p className="text-xs text-gray-400">
                  Route shown in blue on the map
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Mobile Location Input - Above Chat */}
      <div className="fixed bottom-120 left-4 right-4 z-40 lg:hidden">
        <div className="bg-black/90 backdrop-blur-sm rounded-xl p-4 border border-blue-500/50 shadow-lg">
          <div className="flex items-center space-x-2 mb-3">
            <Navigation size={18} className="text-blue-400" />
            <h3 className="text-white font-semibold text-sm">Set Starting Location</h3>
          </div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Enter your address or current location
          </label>
          <div className="flex space-x-2">
            <input
              type="text"
              value={userLocation}
              onChange={(e) => setUserLocation(e.target.value)}
              onKeyPress={handleLocationKeyPress}
              placeholder="e.g., Tokyo Station, hotel name..."
              className="flex-1 px-3 py-2 bg-[#1a1a1a] border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-[#dfdfdf] text-sm"
            />
            <button
              onClick={handleLocationSearch}
              disabled={!userLocation.trim() || isSearching}
              className="px-3 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-500 disabled:cursor-not-allowed text-sm flex items-center space-x-1"
            >
              {isSearching ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <>
                  <Navigation size={16} />
                  <span>Set</span>
                </>
              )}
            </button>
          </div>
          {!userCoordinates && (
            <div className="mt-2 p-2 bg-yellow-500/20 border border-yellow-500/30 rounded-lg">
              <p className="text-yellow-200 text-xs">
                💡 Required for directions
              </p>
            </div>
          )}
          {userCoordinates && (
            <div className="mt-2 p-2 bg-green-500/20 border border-green-500/30 rounded-lg">
              <p className="text-green-200 text-xs">
                ✅ Ready for directions!
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Mobile Route Information - Above Location Input */}
      {currentRoute && (
        <div className="fixed bottom-96 left-4 right-4 z-40 lg:hidden">
          <div className="bg-black/90 backdrop-blur-sm rounded-xl p-4 border border-gray-700">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-white font-semibold text-sm flex items-center space-x-2">
                <Route size={16} className="text-blue-400" />
                <span>Route Info</span>
              </h3>
              <button
                onClick={clearRoute}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <X size={16} />
              </button>
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-center space-x-2 text-sm">
                <Clock size={14} className="text-green-400" />
                <div>
                  <p className="text-gray-400 text-xs">Duration</p>
                  <p className="text-white font-medium">{formatDuration(currentRoute.duration)}</p>
                </div>
              </div>
              
              <div className="flex items-center space-x-2 text-sm">
                <Car size={14} className="text-blue-400" />
                <div>
                  <p className="text-gray-400 text-xs">Distance</p>
                  <p className="text-white font-medium">{formatDistance(currentRoute.distance)}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Map Container */}
      <div 
        ref={mapContainer} 
        className="w-full h-full"
        style={{ minHeight: '100vh' }}
      />

      {/* Empty State */}
      {allLocations.length === 0 && mapLoaded && (
        <div className={`absolute inset-0 flex items-center justify-center pointer-events-none z-20 transition-all duration-300 ${isChatOpen ? 'right-[40%]' : ''}`}>
          <div className="bg-black/80 backdrop-blur-sm rounded-xl p-8 border border-gray-700 text-center max-w-md mx-4">
            <MapPin className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-white font-semibold text-lg mb-2">No Itinerary Items Yet</h3>
            <p className="text-gray-400 text-sm mb-4">
              Add recommendations to your itinerary from the Cultural Compass to see them on the map.
            </p>
            <div className="text-xs text-gray-500 space-y-1">
              <p>💡 Tip: Set your location above to see it marked on the map</p>
              <p>🗺️ Then click any location marker to get directions</p>
            </div>
          </div>
        </div>
      )}

      {/* Hover Tooltip */}
      {hoveredLocation && (
        <div 
          className="absolute z-50 pointer-events-none"
          style={{
            left: tooltipPosition.x + 15,
            top: tooltipPosition.y - 10,
            transform: 'translateY(-100%)'
          }}
        >
          <div className="bg-black/90 backdrop-blur-sm rounded-lg p-3 border border-gray-600 max-w-xs shadow-xl">
            <div className="flex items-start space-x-3">
              <img
                src={hoveredLocation.image}
                alt={hoveredLocation.name}
                className="w-12 h-12 rounded-lg object-cover flex-shrink-0"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center space-x-2 mb-1">
                  {hoveredLocation.type === 'recommendation' ? (
                    <Star className="w-4 h-4 text-yellow-400 flex-shrink-0" />
                  ) : (
                    <MapPin className="w-4 h-4 text-blue-400 flex-shrink-0" />
                  )}
                  <h4 className="text-white font-semibold text-sm truncate">{hoveredLocation.name}</h4>
                </div>
                <p className="text-gray-300 text-xs mb-2">{hoveredLocation.category}</p>
                <p className="text-gray-400 text-xs leading-relaxed">
                  {hoveredLocation.insight.length > 80 
                    ? hoveredLocation.insight.substring(0, 80) + '...'
                    : hoveredLocation.insight
                  }
                </p>
                <div className="mt-2 pt-2 border-t border-gray-700">
                  <span className="text-xs text-gray-500">
                    Part of your itinerary
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Legend */}
      <div className={`absolute bottom-4 left-4 bg-black/80 backdrop-blur-sm rounded-xl p-4 border border-gray-700 z-20 transition-all duration-300 hidden lg:block ${isChatOpen ? 'mr-[40%]' : ''}`}>
        <h3 className="text-sm font-semibold text-white mb-3">Legend</h3>
        <div className="space-y-2">
          <div className="flex items-center space-x-3">
            <div className="w-4 h-4 bg-red-500 rounded-full flex items-center justify-center text-xs">🏠</div>
            <span className="text-xs text-gray-300">Your Location</span>
          </div>
          <div className="flex items-center space-x-3">
            <div className="w-4 h-4 bg-blue-500 rounded-full"></div>
            <span className="text-xs text-gray-300">Your Itinerary ({dbLocations.length})</span>
          </div>
          {currentRoute && (
            <div className="flex items-center space-x-3">
              <div className="w-4 h-1 bg-blue-400 rounded"></div>
              <span className="text-xs text-gray-300">Active Route</span>
            </div>
          )}
        </div>
      </div>

      {/* AI Chat Assistant - Desktop */}
      <div className={`fixed top-0 right-0 h-full w-[40%] bg-[#1a1a1a] border-l border-gray-700 z-40 transform transition-transform duration-300 ease-in-out hidden lg:block ${isChatOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        {/* Chat Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-700 bg-[#0d0d0d]">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-[#dfdfdf] rounded-full flex items-center justify-center">
              <Bot size={18} className="text-[#0d0d0d]" />
            </div>
            <div>
              <h3 className="text-white font-semibold text-sm">AI Tour Guide</h3>
              <p className="text-gray-400 text-xs">{allLocations.length} locations loaded</p>
            </div>
          </div>
          <button
            onClick={() => setIsChatOpen(false)}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <ChevronRight size={20} />
          </button>
        </div>

        {/* Chat Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 h-[calc(100vh-140px)]">
          {chatMessages.map((message) => (
            <div key={message.id} className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[90%] ${message.type === 'user' ? 'order-2' : 'order-1'}`}>
                <div className={`flex items-start space-x-2 ${message.type === 'user' ? 'flex-row-reverse space-x-reverse' : ''}`}>
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${message.type === 'user' ? 'bg-[#dfdfdf]' : 'bg-blue-600'}`}>
                    {message.type === 'user' ? (
                      <User size={14} className="text-[#0d0d0d]" />
                    ) : (
                      <Bot size={14} className="text-white" />
                    )}
                  </div>
                  <div className={`rounded-2xl px-4 py-2 ${message.type === 'user' ? 'bg-[#dfdfdf] text-[#0d0d0d]' : 'bg-[#2a2a2a] text-white'}`}>
                    <p className="text-sm leading-relaxed">{message.content}</p>
                  </div>
                </div>
                
                {/* Suggestions */}
                {message.type === 'assistant' && message.suggestions && (
                  <div className="mt-2 ml-8 space-y-1 grid grid-cols-1 xl:grid-cols-2 gap-1">
                    {message.suggestions.map((suggestion, index) => (
                      <button
                        key={index}
                        onClick={() => handleSuggestionClick(suggestion)}
                        className="block w-full text-left px-3 py-2 text-xs bg-[#0d0d0d] text-gray-300 rounded-lg hover:bg-gray-800 hover:text-white transition-colors border border-gray-700 truncate"
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
          
          {/* Typing Indicator */}
          {isTyping && (
            <div className="flex justify-start">
              <div className="flex items-start space-x-2">
                <div className="w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center flex-shrink-0">
                  <Bot size={14} className="text-white" />
                </div>
                <div className="bg-[#2a2a2a] rounded-2xl px-4 py-2">
                  <div className="flex space-x-1">
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Chat Input */}
        <div className="p-4 border-t border-gray-700 bg-[#0d0d0d]">
          <div className="flex space-x-2">
            <input
              type="text"
              value={currentMessage}
              onChange={(e) => setCurrentMessage(e.target.value)}
              onKeyPress={handleChatKeyPress}
              placeholder="Ask me anything about your journey..."
              className="flex-1 px-4 py-3 bg-[#2a2a2a] border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-[#dfdfdf] text-sm"
            />
            <button
              onClick={handleSendMessage}
              disabled={!currentMessage.trim()}
              className="px-4 py-3 bg-[#dfdfdf] text-[#0d0d0d] rounded-lg hover:bg-gray-200 transition-colors disabled:bg-gray-600 disabled:cursor-not-allowed"
            >
              <Send size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Chat Assistant - Bottom */}
      <div className={`fixed bottom-0 left-0 right-0 bg-[#1a1a1a] border-t border-gray-700 z-40 transform transition-transform duration-300 ease-in-out lg:hidden ${isChatOpen ? 'translate-y-0' : 'translate-y-full'}`} style={{ height: '300px' }}>
        {/* Chat Header */}
        <div className="flex items-center justify-between p-3 border-b border-gray-700 bg-[#0d0d0d]">
          <div className="flex items-center space-x-3">
            <div className="w-6 h-6 bg-[#dfdfdf] rounded-full flex items-center justify-center">
              <Bot size={14} className="text-[#0d0d0d]" />
            </div>
            <div>
              <h3 className="text-white font-semibold text-sm">AI Tour Guide</h3>
              <p className="text-gray-400 text-xs">{allLocations.length} locations loaded</p>
            </div>
          </div>
          <button
            onClick={() => setIsChatOpen(false)}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Chat Messages */}
        <div className="flex-1 overflow-y-auto p-3 space-y-3" style={{ height: 'calc(300px - 120px)' }}>
          {chatMessages.map((message) => (
            <div key={message.id} className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] ${message.type === 'user' ? 'order-2' : 'order-1'}`}>
                <div className={`flex items-start space-x-2 ${message.type === 'user' ? 'flex-row-reverse space-x-reverse' : ''}`}>
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${message.type === 'user' ? 'bg-[#dfdfdf]' : 'bg-blue-600'}`}>
                    {message.type === 'user' ? (
                      <User size={12} className="text-[#0d0d0d]" />
                    ) : (
                      <Bot size={12} className="text-white" />
                    )}
                  </div>
                  <div className={`rounded-2xl px-3 py-2 ${message.type === 'user' ? 'bg-[#dfdfdf] text-[#0d0d0d]' : 'bg-[#2a2a2a] text-white'}`}>
                    <p className="text-xs leading-relaxed">{message.content}</p>
                  </div>
                </div>
                
                {/* Suggestions */}
                {message.type === 'assistant' && message.suggestions && (
                  <div className="mt-2 ml-7 space-y-1">
                    {message.suggestions.map((suggestion, index) => (
                      <button
                        key={index}
                        onClick={() => handleSuggestionClick(suggestion)}
                        className="block w-full text-left px-2 py-1 text-xs bg-[#0d0d0d] text-gray-300 rounded-lg hover:bg-gray-800 hover:text-white transition-colors border border-gray-700"
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
          
          {/* Typing Indicator */}
          {isTyping && (
            <div className="flex justify-start">
              <div className="flex items-start space-x-2">
                <div className="w-5 h-5 bg-blue-600 rounded-full flex items-center justify-center flex-shrink-0">
                  <Bot size={12} className="text-white" />
                </div>
                <div className="bg-[#2a2a2a] rounded-2xl px-3 py-2">
                  <div className="flex space-x-1">
                    <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"></div>
                    <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                    <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Chat Input */}
        <div className="p-3 border-t border-gray-700 bg-[#0d0d0d]">
          <div className="flex space-x-2">
            <input
              type="text"
              value={currentMessage}
              onChange={(e) => setCurrentMessage(e.target.value)}
              onKeyPress={handleChatKeyPress}
              placeholder="Ask me anything..."
              className="flex-1 px-3 py-2 bg-[#2a2a2a] border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-[#dfdfdf] text-sm"
            />
            <button
              onClick={handleSendMessage}
              disabled={!currentMessage.trim()}
              className="px-3 py-2 bg-[#dfdfdf] text-[#0d0d0d] rounded-lg hover:bg-gray-200 transition-colors disabled:bg-gray-600 disabled:cursor-not-allowed"
            >
              <Send size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* Chat Toggle Button (when closed) - Desktop */}
      {!isChatOpen && (
        <button
          onClick={() => setIsChatOpen(true)}
          className="fixed bottom-6 right-6 w-14 h-14 bg-[#dfdfdf] text-[#0d0d0d] rounded-full shadow-lg hover:bg-gray-200 transition-all duration-300 z-40 flex items-center justify-center hidden lg:flex"
        >
          <MessageCircle size={24} />
        </button>
      )}

      {/* Mobile Chat Toggle Button (when closed) */}
      {!isChatOpen && (
        <button
          onClick={() => setIsChatOpen(true)}
          className="fixed bottom-6 right-6 w-12 h-12 bg-[#dfdfdf] text-[#0d0d0d] rounded-full shadow-lg hover:bg-gray-200 transition-all duration-300 z-40 flex items-center justify-center lg:hidden"
        >
          <MessageCircle size={20} />
        </button>
      )}

      {/* Location Modal */}
      {modalData.location && (
        <LocationModal 
          modalData={modalData} 
          onClose={closeModal} 
          onGetDirections={getDirections}
        />
      )}

      {/* Map Loading State */}
      {!mapLoaded && (
        <div className="absolute inset-0 bg-[#0d0d0d] flex items-center justify-center z-20">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-[#dfdfdf] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-400">Loading map...</p>
          </div>
        </div>
      )}
    </div>
  );
}