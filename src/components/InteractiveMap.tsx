import React, { useState } from 'react';
import { APIProvider, Map, AdvancedMarker, Pin, InfoWindow } from '@vis.gl/react-google-maps';
import { MapPin, Navigation, Sparkles, X, Key, Info } from 'lucide-react';
import { Property } from '../types/nest.js';
import { formatCurrency } from '../lib/money.js';

interface InteractiveMapProps {
  properties: Property[];
  onSelectProperty: (property: Property) => void;
}

const API_KEY =
  process.env.GOOGLE_MAPS_PLATFORM_KEY ||
  (import.meta as any).env?.VITE_GOOGLE_MAPS_PLATFORM_KEY ||
  (globalThis as any).GOOGLE_MAPS_PLATFORM_KEY ||
  '';

const hasValidKey = Boolean(API_KEY) && API_KEY !== 'YOUR_GOOGLE_MAPS_API_KEY' && API_KEY !== 'YOUR_API_KEY';

export const InteractiveMap: React.FC<InteractiveMapProps> = ({ properties, onSelectProperty }) => {
  const [activeProperty, setActiveProperty] = useState<Property | null>(properties[0] || null);

  // Default Map center (SF Bay Area)
  const defaultCenter = { lat: 37.7749, lng: -122.4194 };

  // Map properties to estimated lat/lng coords if not present
  const defaultCoords: Record<string, { lat: number; lng: number }> = {
    'prop-sf-grand-bay': { lat: 37.8024, lng: -122.4058 },
    'prop-malibu-sanctuary': { lat: 34.0259, lng: -118.7798 },
    'prop-aspen-chalet': { lat: 39.1911, lng: -106.8175 },
    'prop-austin-soho': { lat: 30.2672, lng: -97.7431 },
    'prop-miami-penthouse': { lat: 25.7617, lng: -80.1918 },
  };

  if (!hasValidKey) {
    return (
      <div className="relative w-full h-[550px] bg-[#0B0F14] rounded-2xl border border-[#2A3441] overflow-hidden shadow-2xl flex flex-col justify-between p-6">
        {/* Background Graphic */}
        <div 
          className="absolute inset-0 bg-cover bg-center opacity-30 mix-blend-luminosity pointer-events-none"
          style={{
            backgroundImage: `url('https://images.unsplash.com/photo-1526778548025-fa2f459cd5c1?w=1600&auto=format&fit=crop&q=80')`
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0B0F14] via-[#0B0F14]/80 to-transparent pointer-events-none" />

        {/* Top Bar Banner */}
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#141B24]/90 backdrop-blur-md p-4 rounded-xl border border-[#2A3441]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#F5B841]/20 border border-[#F5B841]/30 flex items-center justify-center">
              <Key className="w-5 h-5 text-[#F5B841]" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-[#F5F7FA]">Google Maps & Places API Integration Ready</h3>
              <p className="text-xs text-[#B4BCC8]">Connect your Google Maps Platform key for full interactive vector tiles and Places search</p>
            </div>
          </div>

          <div className="text-[11px] bg-[#0B0F14] text-[#5EEAD4] px-3 py-1.5 rounded-lg border border-[#14B8A6]/30 font-mono font-semibold">
            GOOGLE_MAPS_PLATFORM_KEY
          </div>
        </div>

        {/* Interactive Simulated Preview */}
        <div className="relative z-10 my-auto text-center max-w-xl mx-auto space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#14B8A6]/20 border border-[#14B8A6]/30 text-[#5EEAD4] text-xs font-semibold">
            <Navigation className="w-3.5 h-3.5" />
            Live Marketplace Property Coordinates ({properties.length} Active Listings)
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-left">
            {properties.map((p) => (
              <button
                key={p.id}
                onClick={() => onSelectProperty(p)}
                className="bg-[#141B24]/90 hover:bg-[#1C242F] p-3 rounded-xl border border-[#2A3441] hover:border-[#14B8A6] transition-all text-xs"
              >
                <div className="flex items-center gap-1.5 text-[#5EEAD4] font-bold">
                  <MapPin className="w-3.5 h-3.5" />
                  {formatCurrency(p.base_price_minor)}
                </div>
                <div className="text-[#F5F7FA] font-medium line-clamp-1 mt-0.5">{p.title}</div>
                <div className="text-[10px] text-[#7A8494]">{p.address_json.city}, {p.address_json.state}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Setup Instructions Card */}
        <div className="relative z-10 bg-[#141B24]/95 backdrop-blur-md p-4 rounded-xl border border-[#2A3441] text-xs text-[#B4BCC8] flex items-start gap-3">
          <Info className="w-4 h-4 text-[#14B8A6] shrink-0 mt-0.5" />
          <div>
            <strong className="text-[#F5F7FA]">To enable full Google Maps & Places Platform rendering:</strong>
            <ol className="list-decimal list-inside space-y-0.5 mt-1 text-[11px] text-[#B4BCC8]">
              <li>Open <strong>Settings</strong> (⚙️ gear icon in the top right corner) → <strong>Secrets</strong></li>
              <li>Add key name <code className="text-[#5EEAD4]">GOOGLE_MAPS_PLATFORM_KEY</code></li>
              <li>Paste your Google Maps API key and press <strong>Enter</strong></li>
            </ol>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-[550px] bg-[#0B0F14] rounded-2xl border border-[#2A3441] overflow-hidden shadow-2xl">
      <APIProvider apiKey={API_KEY} version="weekly">
        <Map
          defaultCenter={defaultCenter}
          defaultZoom={4}
          mapId="NEST_MAP_VIEW"
          internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
          style={{ width: '100%', height: '100%' }}
        >
          {properties.map((prop) => {
            const pos = defaultCoords[prop.id] || { lat: 37.7749 + (Math.random() - 0.5) * 5, lng: -122.4194 + (Math.random() - 0.5) * 5 };
            const isSelected = activeProperty?.id === prop.id;

            return (
              <AdvancedMarker
                key={prop.id}
                position={pos}
                onClick={() => setActiveProperty(prop)}
              >
                <Pin
                  background={isSelected ? '#FF7A45' : '#14B8A6'}
                  borderColor="#0B0F14"
                  glyphColor="#FFFFFF"
                />
              </AdvancedMarker>
            );
          })}

          {activeProperty && (
            <InfoWindow
              position={defaultCoords[activeProperty.id] || defaultCenter}
              onCloseClick={() => setActiveProperty(null)}
            >
              <div className="p-2 max-w-xs text-black">
                <img
                  src={activeProperty.cover_photo || activeProperty.photos[0]}
                  alt={activeProperty.title}
                  className="w-full h-24 object-cover rounded mb-2"
                />
                <h4 className="font-bold text-sm leading-tight">{activeProperty.title}</h4>
                <p className="text-xs text-gray-600 mb-2">{activeProperty.address_json.city}, {activeProperty.address_json.state}</p>
                <div className="flex items-center justify-between">
                  <span className="font-black text-sm">{formatCurrency(activeProperty.base_price_minor)}/night</span>
                  <button
                    onClick={() => onSelectProperty(activeProperty)}
                    className="px-2.5 py-1 bg-[#14B8A6] text-black font-bold text-xs rounded"
                  >
                    Details
                  </button>
                </div>
              </div>
            </InfoWindow>
          )}
        </Map>
      </APIProvider>
    </div>
  );
};
