import React, { useState } from 'react';
import { Heart, Plus, Trash2, FolderPlus, Compass, ArrowLeft, Sparkles, Building, MapPin } from 'lucide-react';
import { Property, Wishlist } from '../types/nest.js';
import { PropertyCard } from './PropertyCard.tsx';

interface WishlistsViewProps {
  wishlists: Wishlist[];
  properties: Property[];
  onSelectProperty: (property: Property) => void;
  onCreateWishlist: (title: string, description?: string) => void;
  onDeleteWishlist: (wishlistId: string) => void;
  onToggleWishlist: (wishlistId: string, propertyId: string) => void;
  onOpenWishlistModal: (property: Property) => void;
  isPropertyFavorited: (propertyId: string) => boolean;
}

export const WishlistsView: React.FC<WishlistsViewProps> = ({
  wishlists,
  properties,
  onSelectProperty,
  onCreateWishlist,
  onDeleteWishlist,
  onToggleWishlist,
  onOpenWishlistModal,
  isPropertyFavorited,
}) => {
  const [selectedWishlistId, setSelectedWishlistId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState<boolean>(false);
  const [newTitle, setNewTitle] = useState<string>('');
  const [newDescription, setNewDescription] = useState<string>('');

  const activeWishlist = wishlists.find((w) => w.id === selectedWishlistId);

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    onCreateWishlist(newTitle.trim(), newDescription.trim());
    setNewTitle('');
    setNewDescription('');
    setIsCreating(false);
  };

  // If a specific Wishlist is selected, show its properties
  if (activeWishlist) {
    const savedProperties = properties.filter((p) =>
      activeWishlist.property_ids.includes(p.id)
    );

    return (
      <div className="space-y-6 animate-fadeIn">
        {/* Back navigation & Wishlist Title Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#1C242F] p-6 rounded-2xl border border-[#2A3441]">
          <div>
            <button
              onClick={() => setSelectedWishlistId(null)}
              className="flex items-center gap-1.5 text-xs text-[#14B8A6] hover:text-[#5EEAD4] font-semibold mb-2 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to All Wishlists</span>
            </button>
            <div className="flex items-center gap-3">
              <h2 className="text-2xl font-black text-[#F5F7FA]">{activeWishlist.title}</h2>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#FF7A45]/20 text-[#FFB067] border border-[#FF7A45]/30">
                {savedProperties.length} {savedProperties.length === 1 ? 'property' : 'properties'}
              </span>
            </div>
            {activeWishlist.description && (
              <p className="text-xs text-[#B4BCC8] mt-1">{activeWishlist.description}</p>
            )}
          </div>

          <button
            onClick={() => {
              if (confirm(`Are you sure you want to delete the wishlist "${activeWishlist.title}"?`)) {
                onDeleteWishlist(activeWishlist.id);
                setSelectedWishlistId(null);
              }
            }}
            className="px-3.5 py-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 text-xs font-semibold flex items-center gap-2 self-start sm:self-auto transition-colors"
          >
            <Trash2 className="w-4 h-4" />
            <span>Delete Wishlist</span>
          </button>
        </div>

        {/* Saved Properties Grid */}
        {savedProperties.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {savedProperties.map((property) => (
              <PropertyCard
                key={property.id}
                property={property}
                onSelect={onSelectProperty}
                isFavorited={isPropertyFavorited(property.id)}
                onToggleFavorite={(_, e) => {
                  e.stopPropagation();
                  onOpenWishlistModal(property);
                }}
              />
            ))}
          </div>
        ) : (
          <div className="bg-[#1C242F]/50 border border-[#2A3441] rounded-2xl p-12 text-center max-w-lg mx-auto">
            <div className="w-12 h-12 rounded-2xl bg-[#FF7A45]/15 text-[#FF7A45] flex items-center justify-center mx-auto mb-3">
              <Heart className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-lg text-[#F5F7FA] mb-1">No Saved Properties Yet</h3>
            <p className="text-xs text-[#B4BCC8] mb-4">
              Explore available properties and click the heart icon on any card to save it to "{activeWishlist.title}".
            </p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Overview Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gradient-to-r from-[#1C242F] to-[#0B0F14] p-6 rounded-2xl border border-[#2A3441]">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Heart className="w-5 h-5 text-[#FF7A45] fill-[#FF7A45]" />
            <h2 className="text-xl font-black text-[#F5F7FA]">My Wishlists & Favorites</h2>
          </div>
          <p className="text-xs text-[#B4BCC8]">
            Organize properties for future stays, co-hosting opportunities, or trip itineraries (e.g. Dublin July 2027).
          </p>
        </div>

        <button
          onClick={() => setIsCreating(true)}
          className="px-4 py-2.5 rounded-xl bg-[#FF7A45] hover:bg-[#ff8a5a] text-white text-xs font-extrabold flex items-center gap-2 transition-all shadow-lg shadow-[#FF7A45]/20 self-start sm:self-auto"
        >
          <FolderPlus className="w-4 h-4" />
          <span>Create New Wishlist</span>
        </button>
      </div>

      {/* Create Modal overlay if triggered */}
      {isCreating && (
        <div className="fixed inset-0 z-[110] bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#1C242F] border border-[#2A3441] rounded-2xl w-full max-w-md p-6 shadow-2xl">
            <h3 className="font-bold text-lg text-[#F5F7FA] mb-1">Create Wishlist</h3>
            <p className="text-xs text-[#B4BCC8] mb-4">
              Group your favorite properties by destination, trip dates, or theme.
            </p>

            <form onSubmit={handleCreateSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#B4BCC8] mb-1.5">
                  Wishlist Title <span className="text-[#FF7A45]">*</span>
                </label>
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="e.g. Dublin July 2027, Summer Ski Chalets"
                  className="w-full bg-[#0B0F14] border border-[#2A3441] rounded-xl px-3.5 py-2.5 text-xs text-[#F5F7FA] focus:outline-none focus:border-[#FF7A45]"
                  autoFocus
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#B4BCC8] mb-1.5">
                  Description
                </label>
                <textarea
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder="e.g. Trip plans for summer 2027 co-hosting evaluation"
                  rows={2}
                  className="w-full bg-[#0B0F14] border border-[#2A3441] rounded-xl px-3.5 py-2 text-xs text-[#F5F7FA] focus:outline-none focus:border-[#FF7A45]"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#2A3441]">
                <button
                  type="button"
                  onClick={() => setIsCreating(false)}
                  className="px-3.5 py-2 rounded-xl bg-[#0B0F14] text-[#B4BCC8] border border-[#2A3441] text-xs font-semibold hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!newTitle.trim()}
                  className="px-4 py-2 rounded-xl bg-[#FF7A45] hover:bg-[#ff8a5a] text-white text-xs font-bold transition-all disabled:opacity-50"
                >
                  Create Wishlist
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Wishlist Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {wishlists.map((list) => {
          const listProperties = properties.filter((p) =>
            list.property_ids.includes(p.id)
          );
          const coverPhoto = listProperties[0]?.cover_photo || listProperties[0]?.photos[0];

          return (
            <div
              key={list.id}
              onClick={() => setSelectedWishlistId(list.id)}
              className="group bg-[#1C242F] rounded-2xl border border-[#2A3441] overflow-hidden hover:border-[#FF7A45] transition-all cursor-pointer flex flex-col justify-between hover:shadow-xl hover:shadow-[#FF7A45]/10"
            >
              {/* Card Cover Preview */}
              <div className="relative h-44 w-full bg-[#0B0F14] overflow-hidden">
                {coverPhoto ? (
                  <img
                    src={coverPhoto}
                    alt={list.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center text-[#2A3441] p-4 text-center">
                    <Heart className="w-10 h-10 mb-2 opacity-50" />
                    <span className="text-xs text-[#7A8494]">Empty Wishlist</span>
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-[#1C242F] via-transparent to-black/30" />

                <span className="absolute top-3 right-3 px-2.5 py-1 rounded-full text-[11px] font-bold bg-[#0B0F14]/80 text-[#5EEAD4] border border-[#14B8A6]/40 backdrop-blur-md">
                  {list.property_ids.length} {list.property_ids.length === 1 ? 'Property' : 'Properties'}
                </span>
              </div>

              {/* Card Details */}
              <div className="p-5 flex-1 flex flex-col justify-between">
                <div>
                  <h3 className="font-extrabold text-base text-[#F5F7FA] group-hover:text-[#FFB067] transition-colors line-clamp-1 mb-1">
                    {list.title}
                  </h3>
                  <p className="text-xs text-[#B4BCC8] line-clamp-2 min-h-[2rem]">
                    {list.description || 'Custom user wishlist collection.'}
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-[#2A3441] flex items-center justify-between text-[11px] text-[#7A8494]">
                  <span>Created {new Date(list.created_at).toLocaleDateString()}</span>
                  <span className="text-[#14B8A6] font-bold group-hover:translate-x-1 transition-transform">
                    View Collection →
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
