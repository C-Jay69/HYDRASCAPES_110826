import React from 'react';
import { Eye, Sparkles, MapPin, Users, Bed, Bath, ShieldCheck, Star, Award, Heart } from 'lucide-react';
import { Property } from '../types/nest.js';
import { formatCurrency } from '../lib/money.js';

interface PropertyCardProps {
  property: Property;
  onSelect: (property: Property) => void;
  isFavorited?: boolean;
  onToggleFavorite?: (property: Property, e: React.MouseEvent) => void;
}

export const PropertyCard: React.FC<PropertyCardProps> = ({ 
  property, 
  onSelect, 
  isFavorited = false,
  onToggleFavorite 
}) => {
  const vision = property.vision_analysis;

  return (
    <div 
      onClick={() => onSelect(property)}
      className="group bg-[#1C242F] rounded-2xl border border-[#2A3441] overflow-hidden hover:border-[#14B8A6] transition-all duration-300 ease-out transform hover:-translate-y-1.5 hover:scale-[1.01] cursor-pointer flex flex-col hover:shadow-2xl hover:shadow-[#14B8A6]/15 relative"
    >
      {/* Property Cover Image & Overlay Badges */}
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-[#0B0F14]">
        <img
          src={property.cover_photo || property.photos[0]}
          alt={property.title}
          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700 ease-out"
        />

        <div className="absolute inset-0 bg-gradient-to-t from-[#0B0F14]/90 via-transparent to-black/30 group-hover:from-[#0B0F14]/95 transition-all duration-300" />

        {/* Quality Tier Badge */}
        {vision && (
          <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-[#0B0F14]/80 backdrop-blur-md border border-[#FF7A45]/40 text-[#FFB067] group-hover:border-[#FF7A45]/70 transition-colors z-10">
            <Sparkles className="w-3 h-3 text-[#FF7A45] group-hover:rotate-12 transition-transform duration-300" />
            <span className="uppercase tracking-wider">{vision.quality_tier} TIER</span>
          </div>
        )}

        {/* Heart Wishlist Toggle Button */}
        {onToggleFavorite && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleFavorite(property, e);
            }}
            className={`absolute top-3 right-3 p-2 rounded-full backdrop-blur-md transition-all duration-300 z-20 shadow-lg ${
              isFavorited
                ? 'bg-[#FF7A45] text-white scale-110 shadow-[#FF7A45]/40'
                : 'bg-[#0B0F14]/70 text-white/80 hover:text-white hover:bg-[#FF7A45]/80 hover:scale-110 border border-white/20'
            }`}
            title={isFavorited ? 'Saved in Wishlist' : 'Save to Wishlist'}
          >
            <Heart className={`w-4 h-4 transition-transform ${isFavorited ? 'fill-white' : ''}`} />
          </button>
        )}

        {/* Host Trust Badges Overlay */}
        <div className="absolute bottom-3 left-3 flex items-center gap-1.5 z-10">
          {property.is_superhost && (
            <div className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-[#FF7A45] text-white shadow-md shadow-[#FF7A45]/30">
              <Award className="w-3 h-3 text-white" />
              <span>SUPERHOST</span>
            </div>
          )}
          {property.is_verified_host && (
            <div className="flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-extrabold bg-[#141B24]/90 backdrop-blur-md border border-[#14B8A6]/60 text-[#5EEAD4] shadow-md">
              <ShieldCheck className="w-3 h-3 text-[#14B8A6]" />
              <span>VERIFIED</span>
            </div>
          )}
          {property.status === 'pending_host' && (
            <div className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-[#F5B841] text-black">
              Seeking Co-Host
            </div>
          )}
        </div>
      </div>

      {/* Property Details */}
      <div className="p-4 flex-1 flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between text-xs text-[#B4BCC8] mb-1">
            <div className="flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-[#14B8A6]" />
              <span>{property.address_json.city}, {property.address_json.state}</span>
            </div>

            {/* Guest Star Rating Badge */}
            <div className="flex items-center gap-1 font-semibold text-[#F5F7FA]">
              <Star className="w-3.5 h-3.5 text-[#F5B841] fill-[#F5B841]" />
              <span>{property.rating_avg ? property.rating_avg.toFixed(1) : '5.0'}</span>
              <span className="text-[#7A8494] font-normal text-[11px]">
                ({property.review_count || 0})
              </span>
            </div>
          </div>

          <h3 className="font-semibold text-base text-[#F5F7FA] group-hover:text-[#5EEAD4] transition-colors line-clamp-1 mb-2">
            {property.title}
          </h3>

          {/* Host Profile & Rating Info */}
          <div className="flex items-center justify-between text-xs text-[#B4BCC8] mb-2.5 bg-[#0B0F14]/50 px-2.5 py-1.5 rounded-lg border border-[#2A3441]/60">
            <div className="flex items-center gap-2">
              {property.host_avatar ? (
                <img
                  src={property.host_avatar}
                  alt={property.host_name || 'Host'}
                  className="w-5 h-5 rounded-full object-cover border border-[#14B8A6]"
                />
              ) : (
                <div className="w-5 h-5 rounded-full bg-[#14B8A6]/20 border border-[#14B8A6]/40 flex items-center justify-center text-[10px] font-bold text-[#5EEAD4]">
                  {(property.host_name || property.owner_name || 'H').charAt(0)}
                </div>
              )}
              <span className="text-[#F5F7FA] font-medium text-xs line-clamp-1">
                Hosted by {property.host_name || property.owner_name}
              </span>
            </div>

            {property.host_rating_avg && (
              <span className="text-[11px] text-[#FFB067] font-semibold shrink-0">
                {property.host_rating_avg.toFixed(2)} ★ Host
              </span>
            )}
          </div>

          {/* Key Specs */}
          <div className="flex items-center gap-3 text-xs text-[#B4BCC8] mb-3 pb-3 border-b border-[#2A3441]">
            <span className="flex items-center gap-1">
              <Bed className="w-3.5 h-3.5 text-[#7A8494]" />
              {property.bedrooms} beds
            </span>
            <span className="flex items-center gap-1">
              <Bath className="w-3.5 h-3.5 text-[#7A8494]" />
              {property.bathrooms} baths
            </span>
            <span className="flex items-center gap-1">
              <Users className="w-3.5 h-3.5 text-[#7A8494]" />
              {property.max_guests} guests
            </span>
          </div>

          {/* AI Highlights Bullet Preview */}
          {vision?.highlights && vision.highlights.length > 0 && (
            <div className="bg-[#0B0F14]/60 p-2.5 rounded-lg border border-[#2A3441] mb-3">
              <div className="text-[10px] uppercase font-bold text-[#FFB067] mb-1 flex items-center gap-1">
                <Sparkles className="w-2.5 h-2.5" />
                AI Property Eye Highlight
              </div>
              <p className="text-xs text-[#B4BCC8] line-clamp-2 leading-relaxed">
                "{vision.highlights[0]}"
              </p>
            </div>
          )}
        </div>

        {/* Pricing Footer */}
        <div className="flex items-center justify-between pt-2 border-t border-[#2A3441]">
          <div>
            <div className="text-xs text-[#7A8494]">Base Rate</div>
            <div className="text-lg font-bold text-[#F5F7FA]">
              {formatCurrency(property.base_price_minor)}
              <span className="text-xs font-normal text-[#B4BCC8]"> / night</span>
            </div>
          </div>

          <button className="px-3 py-1.5 rounded-lg bg-[#FF7A45]/15 text-[#FFB067] group-hover:bg-[#FF7A45] group-hover:text-white group-hover:scale-105 group-hover:shadow-md group-hover:shadow-[#FF7A45]/30 transition-all duration-300 text-xs font-semibold">
            View Details & Quote
          </button>
        </div>
      </div>
    </div>
  );
};
