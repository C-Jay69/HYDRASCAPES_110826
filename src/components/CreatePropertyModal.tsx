import React, { useState } from 'react';
import { X, Building, Sparkles, Plus, Image as ImageIcon } from 'lucide-react';
import { Property } from '../types/nest.js';
import { dollarsToCents } from '../lib/money.js';

interface CreatePropertyModalProps {
  onClose: () => void;
  onSubmit: (data: Partial<Property>) => void;
}

export const CreatePropertyModal: React.FC<CreatePropertyModalProps> = ({ onClose, onSubmit }) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [city, setCity] = useState('San Francisco');
  const [state, setState] = useState('CA');
  const [bedrooms, setBedrooms] = useState(3);
  const [bathrooms, setBathrooms] = useState(2);
  const [maxGuests, setMaxGuests] = useState(6);
  const [basePriceDollars, setBasePriceDollars] = useState(450);
  const [photoUrl, setPhotoUrl] = useState('https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=1000&auto=format&fit=crop&q=80');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      title: title || "Modern Waterfront Residence",
      description: description || "Stunning modern home with premium finishes, abundant natural light, and spacious living spaces.",
      address_json: { city, state, country: "USA" },
      bedrooms,
      bathrooms,
      max_guests: maxGuests,
      base_price_minor: dollarsToCents(basePriceDollars),
      min_price_minor: dollarsToCents(Math.round(basePriceDollars * 0.7)),
      max_price_minor: dollarsToCents(Math.round(basePriceDollars * 1.8)),
      cleaning_fee_minor: dollarsToCents(150),
      photos: [photoUrl],
      cover_photo: photoUrl,
      status: "pending_host", // Owner seeks co-host!
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-[#141B24] border border-[#2A3441] rounded-2xl max-w-xl w-full p-6 shadow-2xl my-8">
        
        <div className="flex items-center justify-between pb-4 border-b border-[#2A3441] mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#FF7A45]/20 border border-[#FF7A45]/40 flex items-center justify-center">
              <Building className="w-5 h-5 text-[#FFB067]" />
            </div>
            <div>
              <h3 className="font-bold text-lg text-[#F5F7FA]">List New Property</h3>
              <p className="text-xs text-[#B4BCC8]">Automatic AI Property Eye vision analysis will trigger on save</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg bg-[#0B0F14] text-[#7A8494] hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-[#B4BCC8] block mb-1">Property Title</label>
            <input
              type="text"
              required
              placeholder="e.g. Pacific Heights Glass Villa"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-[#0B0F14] border border-[#2A3441] text-[#F5F7FA] text-xs rounded-xl p-3 focus:outline-none focus:border-[#14B8A6]"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-[#B4BCC8] block mb-1">Description</label>
            <textarea
              rows={3}
              placeholder="Describe architectural features, lighting, amenities, and layout..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-[#0B0F14] border border-[#2A3441] text-[#F5F7FA] text-xs rounded-xl p-3 focus:outline-none focus:border-[#14B8A6]"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-[#B4BCC8] block mb-1">City</label>
              <input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="w-full bg-[#0B0F14] border border-[#2A3441] text-[#F5F7FA] text-xs rounded-xl p-3"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-[#B4BCC8] block mb-1">State</label>
              <input
                type="text"
                value={state}
                onChange={(e) => setState(e.target.value)}
                className="w-full bg-[#0B0F14] border border-[#2A3441] text-[#F5F7FA] text-xs rounded-xl p-3"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-semibold text-[#B4BCC8] block mb-1">Bedrooms</label>
              <input
                type="number"
                min={1}
                value={bedrooms}
                onChange={(e) => setBedrooms(Number(e.target.value))}
                className="w-full bg-[#0B0F14] border border-[#2A3441] text-[#F5F7FA] text-xs rounded-xl p-3"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-[#B4BCC8] block mb-1">Bathrooms</label>
              <input
                type="number"
                min={1}
                value={bathrooms}
                onChange={(e) => setBathrooms(Number(e.target.value))}
                className="w-full bg-[#0B0F14] border border-[#2A3441] text-[#F5F7FA] text-xs rounded-xl p-3"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-[#B4BCC8] block mb-1">Max Guests</label>
              <input
                type="number"
                min={1}
                value={maxGuests}
                onChange={(e) => setMaxGuests(Number(e.target.value))}
                className="w-full bg-[#0B0F14] border border-[#2A3441] text-[#F5F7FA] text-xs rounded-xl p-3"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-[#B4BCC8] block mb-1">Base Nightly Rate ($ USD)</label>
            <input
              type="number"
              min={50}
              value={basePriceDollars}
              onChange={(e) => setBasePriceDollars(Number(e.target.value))}
              className="w-full bg-[#0B0F14] border border-[#2A3441] text-[#F5F7FA] text-xs rounded-xl p-3"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-[#B4BCC8] block mb-1">Cover Photo Image URL</label>
            <div className="flex gap-2">
              <input
                type="url"
                value={photoUrl}
                onChange={(e) => setPhotoUrl(e.target.value)}
                className="flex-1 bg-[#0B0F14] border border-[#2A3441] text-[#F5F7FA] text-xs rounded-xl p-3"
              />
            </div>
          </div>

          <div className="pt-4 border-t border-[#2A3441] flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-[#0B0F14] text-[#B4BCC8] text-xs font-medium rounded-xl hover:bg-[#2A3441]"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-gradient-to-r from-[#FF7A45] to-[#14B8A6] text-white text-xs font-bold rounded-xl shadow-lg flex items-center gap-1.5"
            >
              <Sparkles className="w-4 h-4" />
              Save & Analyze Vision
            </button>
          </div>
        </form>

      </div>
    </div>
  );
};
