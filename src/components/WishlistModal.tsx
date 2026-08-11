import React, { useState } from 'react';
import { Heart, Plus, X, Check, FolderPlus, Sparkles, Compass } from 'lucide-react';
import { Property, Wishlist } from '../types/nest.js';

interface WishlistModalProps {
  property: Property;
  wishlists: Wishlist[];
  onToggleWishlist: (wishlistId: string, propertyId: string) => void;
  onCreateWishlist: (title: string, description?: string, initialPropertyId?: string) => void;
  onClose: () => void;
}

export const WishlistModal: React.FC<WishlistModalProps> = ({
  property,
  wishlists,
  onToggleWishlist,
  onCreateWishlist,
  onClose,
}) => {
  const [isCreating, setIsCreating] = useState<boolean>(false);
  const [newTitle, setNewTitle] = useState<string>('');
  const [newDescription, setNewDescription] = useState<string>('');

  const handleCreateNew = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    onCreateWishlist(newTitle.trim(), newDescription.trim(), property.id);
    setNewTitle('');
    setNewDescription('');
    setIsCreating(false);
  };

  return (
    <div 
      className="fixed inset-0 z-[110] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn"
      onClick={onClose}
    >
      <div 
        className="bg-[#1C242F] border border-[#2A3441] rounded-2xl w-full max-w-md p-6 shadow-2xl relative text-[#F5F7FA]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 mb-4 border-b border-[#2A3441]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-[#FF7A45]/15 border border-[#FF7A45]/30">
              <Heart className="w-5 h-5 text-[#FF7A45] fill-[#FF7A45]" />
            </div>
            <div>
              <h3 className="font-extrabold text-base text-[#F5F7FA]">Save to Wishlist</h3>
              <p className="text-xs text-[#B4BCC8] line-clamp-1">{property.title}</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-[#0B0F14] text-[#7A8494] hover:text-white border border-[#2A3441] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Wishlist List */}
        {!isCreating ? (
          <div className="space-y-3 max-h-72 overflow-y-auto pr-1 scrollbar-thin">
            {wishlists.map((list) => {
              const isSaved = list.property_ids.includes(property.id);
              return (
                <button
                  key={list.id}
                  onClick={() => onToggleWishlist(list.id, property.id)}
                  className={`w-full flex items-center justify-between p-3.5 rounded-xl border text-left transition-all group ${
                    isSaved
                      ? 'bg-[#14B8A6]/10 border-[#14B8A6] shadow-sm'
                      : 'bg-[#0B0F14] border-[#2A3441] hover:border-[#FF7A45]/50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`p-2.5 rounded-lg ${
                      isSaved ? 'bg-[#14B8A6] text-black' : 'bg-[#1C242F] text-[#7A8494] group-hover:text-[#FF7A45]'
                    }`}>
                      <Heart className={`w-4 h-4 ${isSaved ? 'fill-black' : ''}`} />
                    </div>
                    <div>
                      <h4 className="font-bold text-sm text-[#F5F7FA] group-hover:text-[#5EEAD4] transition-colors">
                        {list.title}
                      </h4>
                      <p className="text-[11px] text-[#B4BCC8]">
                        {list.property_ids.length} saved {list.property_ids.length === 1 ? 'property' : 'properties'}
                      </p>
                    </div>
                  </div>

                  <div className={`w-6 h-6 rounded-lg flex items-center justify-center border transition-all ${
                    isSaved ? 'bg-[#14B8A6] border-[#14B8A6] text-black' : 'border-[#2A3441] bg-[#1C242F]'
                  }`}>
                    {isSaved && <Check className="w-4 h-4 stroke-[3]" />}
                  </div>
                </button>
              );
            })}

            <button
              onClick={() => setIsCreating(true)}
              className="w-full mt-3 p-3.5 rounded-xl border border-dashed border-[#FF7A45]/60 bg-[#FF7A45]/5 hover:bg-[#FF7A45]/15 text-[#FFB067] font-semibold text-xs flex items-center justify-center gap-2 transition-all"
            >
              <FolderPlus className="w-4 h-4 text-[#FF7A45]" />
              <span>Create New Wishlist (e.g., Dublin July 2027)</span>
            </button>
          </div>
        ) : (
          /* Create New Wishlist Form */
          <form onSubmit={handleCreateNew} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-[#B4BCC8] mb-1.5">
                Wishlist Title <span className="text-[#FF7A45]">*</span>
              </label>
              <input
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="e.g., Dublin July 2027, Summer Ski Chalets"
                className="w-full bg-[#0B0F14] border border-[#2A3441] rounded-xl px-3.5 py-2.5 text-xs text-[#F5F7FA] focus:outline-none focus:border-[#FF7A45]"
                autoFocus
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#B4BCC8] mb-1.5">
                Description (Optional)
              </label>
              <textarea
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                placeholder="e.g. Planning co-hosting & stay itinerary for summer 2027"
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
                Back
              </button>
              <button
                type="submit"
                disabled={!newTitle.trim()}
                className="px-4 py-2 rounded-xl bg-[#FF7A45] hover:bg-[#ff8a5a] text-white text-xs font-bold transition-all disabled:opacity-50 shadow-md shadow-[#FF7A45]/30 flex items-center gap-1.5"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Create & Save Property</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
