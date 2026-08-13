import React, { useState, useEffect, useCallback } from 'react';
import { 
  ZoomIn, 
  ZoomOut, 
  Maximize2, 
  ChevronLeft, 
  ChevronRight, 
  X, 
  RotateCcw, 
  Grid, 
  Sparkles,
  Download,
  Info
} from 'lucide-react';
import { Property } from '../types/nest.js';

interface PhotoGalleryLightboxProps {
  property: Property;
}

export const PhotoGalleryLightbox: React.FC<PhotoGalleryLightboxProps> = ({ property }) => {
  // Consolidate unique list of photos starting with cover_photo if available
  const allPhotos = React.useMemo(() => {
    const list: string[] = [];
    if (property.cover_photo && !property.photos.includes(property.cover_photo)) {
      list.push(property.cover_photo);
    }
    property.photos.forEach(p => {
      if (!list.includes(p)) list.push(p);
    });
    return list.length > 0 ? list : ['https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=1200&auto=format&fit=crop&q=80'];
  }, [property]);

  const [activePhotoIdx, setActivePhotoIdx] = useState<number>(0);
  const [isLightboxOpen, setIsLightboxOpen] = useState<boolean>(false);
  const [zoomLevel, setZoomLevel] = useState<number>(1); // 1 = 100%, 1.5 = 150%, 2 = 200%, 3 = 300%
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  const activePhoto = allPhotos[activePhotoIdx] || allPhotos[0];

  // Navigation handlers
  const handlePrev = useCallback(() => {
    setActivePhotoIdx((prev) => (prev === 0 ? allPhotos.length - 1 : prev - 1));
    setZoomLevel(1);
    setDragOffset({ x: 0, y: 0 });
  }, [allPhotos.length]);

  const handleNext = useCallback(() => {
    setActivePhotoIdx((prev) => (prev === allPhotos.length - 1 ? 0 : prev + 1));
    setZoomLevel(1);
    setDragOffset({ x: 0, y: 0 });
  }, [allPhotos.length]);

  const handleZoomIn = () => {
    setZoomLevel((prev) => Math.min(prev + 0.5, 3.5));
  };

  const handleZoomOut = () => {
    setZoomLevel((prev) => {
      const next = Math.max(prev - 0.5, 1);
      if (next === 1) setDragOffset({ x: 0, y: 0 });
      return next;
    });
  };

  const handleResetZoom = () => {
    setZoomLevel(1);
    setDragOffset({ x: 0, y: 0 });
  };

  // Keyboard shortcut listeners for Lightbox
  useEffect(() => {
    if (!isLightboxOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsLightboxOpen(false);
        setZoomLevel(1);
        setDragOffset({ x: 0, y: 0 });
      } else if (e.key === 'ArrowLeft') {
        handlePrev();
      } else if (e.key === 'ArrowRight') {
        handleNext();
      } else if (e.key === '+' || e.key === '=') {
        handleZoomIn();
      } else if (e.key === '-') {
        handleZoomOut();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isLightboxOpen, handleNext, handlePrev]);

  // Mouse pan handlers when zoomed
  const handleMouseDown = (e: React.MouseEvent) => {
    if (zoomLevel > 1) {
      setIsDragging(true);
      setDragStart({ x: e.clientX - dragOffset.x, y: e.clientY - dragOffset.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging && zoomLevel > 1) {
      setDragOffset({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  return (
    <div className="space-y-3">
      {/* Primary In-Modal Image Display */}
      <div 
        onClick={() => setIsLightboxOpen(true)}
        className="relative group w-full h-72 rounded-2xl overflow-hidden border border-[#2A3441] bg-[#0B0F14] cursor-pointer shadow-lg"
      >
        <img
          src={activePhoto}
          alt={property.title}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 ease-out"
        />

        {/* Dark Vignette Overlay on Hover */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/20 opacity-60 group-hover:opacity-80 transition-opacity" />

        {/* Top Badges */}
        <div className="absolute top-3 left-3 right-3 flex items-center justify-between">
          <span className="px-3 py-1 rounded-full text-[11px] font-bold bg-[#0B0F14]/80 backdrop-blur-md border border-[#14B8A6]/40 text-[#5EEAD4] flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-[#14B8A6]" />
            Photo {activePhotoIdx + 1} of {allPhotos.length}
          </span>

          <span className="px-3 py-1 rounded-full text-[11px] font-bold bg-[#14B8A6] text-black shadow-lg flex items-center gap-1 group-hover:scale-105 transition-transform">
            <Maximize2 className="w-3.5 h-3.5" />
            Click for Fullscreen Zoom
          </span>
        </div>

        {/* Hover Cue */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
          <div className="bg-[#141B24]/90 text-[#F5F7FA] px-4 py-2 rounded-xl border border-[#14B8A6] shadow-2xl flex items-center gap-2 text-xs font-bold backdrop-blur-md">
            <ZoomIn className="w-4 h-4 text-[#14B8A6]" />
            Click to View Full-Sized Photo & Interactive Lightbox
          </div>
        </div>
      </div>

      {/* Thumbnail Selector Strip */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin">
        {allPhotos.map((photoUrl, idx) => {
          const isSelected = idx === activePhotoIdx;
          return (
            <button
              key={idx}
              type="button"
              onClick={() => setActivePhotoIdx(idx)}
              className={`relative shrink-0 w-20 h-16 rounded-xl overflow-hidden border-2 transition-all ${
                isSelected 
                  ? 'border-[#14B8A6] ring-2 ring-[#14B8A6]/30 scale-105' 
                  : 'border-[#2A3441] opacity-60 hover:opacity-100 hover:border-[#14B8A6]/50'
              }`}
            >
              <img
                src={photoUrl}
                alt={`Thumbnail ${idx + 1}`}
                className="w-full h-full object-cover"
              />
              {isSelected && (
                <div className="absolute inset-0 bg-[#14B8A6]/10 pointer-events-none" />
              )}
            </button>
          );
        })}
      </div>

      {/* FULLSCREEN LIGHTBOX MODAL OVERLAY */}
      {isLightboxOpen && (
        <div className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-2xl flex flex-col justify-between p-4 sm:p-6 select-none animate-fadeIn">
          {/* Top Control Header */}
          <div className="flex items-center justify-between gap-4 z-20 pb-2 border-b border-[#2A3441]/50">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-[#14B8A6]">{property.address_json.city}, {property.address_json.state}</span>
                <span className="text-xs text-[#7A8494]">•</span>
                <span className="text-xs text-[#B4BCC8]">Photo {activePhotoIdx + 1} of {allPhotos.length}</span>
              </div>
              <h3 className="font-extrabold text-lg text-[#F5F7FA] line-clamp-1">{property.title}</h3>
            </div>

            {/* Zoom & Action Controls */}
            <div className="flex items-center gap-2">
              <div className="hidden sm:flex items-center gap-1 bg-[#141B24] p-1 rounded-xl border border-[#2A3441]">
                <button
                  type="button"
                  onClick={handleZoomOut}
                  disabled={zoomLevel <= 1}
                  className="p-2 rounded-lg hover:bg-[#2A3441] text-[#F5F7FA] disabled:opacity-30 disabled:pointer-events-none transition-colors"
                  title="Zoom Out (-)"
                >
                  <ZoomOut className="w-4 h-4" />
                </button>

                <span className="text-xs font-mono font-bold px-2 text-[#5EEAD4]">
                  {Math.round(zoomLevel * 100)}%
                </span>

                <button
                  type="button"
                  onClick={handleZoomIn}
                  disabled={zoomLevel >= 3.5}
                  className="p-2 rounded-lg hover:bg-[#2A3441] text-[#F5F7FA] disabled:opacity-30 disabled:pointer-events-none transition-colors"
                  title="Zoom In (+)"
                >
                  <ZoomIn className="w-4 h-4" />
                </button>

                {zoomLevel > 1 && (
                  <button
                    type="button"
                    onClick={handleResetZoom}
                    className="p-2 rounded-lg hover:bg-[#2A3441] text-[#FFB067] transition-colors ml-1"
                    title="Reset Zoom"
                  >
                    <RotateCcw className="w-4 h-4" />
                  </button>
                )}
              </div>

              <a
                href={activePhoto}
                target="_blank"
                rel="noreferrer"
                className="hidden md:flex items-center gap-1.5 px-3 py-2 bg-[#141B24] hover:bg-[#1C242F] text-[#F5F7FA] border border-[#2A3441] rounded-xl text-xs font-semibold transition-colors"
              >
                <Download className="w-3.5 h-3.5 text-[#14B8A6]" />
                Full Image
              </a>

              <button
                type="button"
                onClick={() => {
                  setIsLightboxOpen(false);
                  setZoomLevel(1);
                  setDragOffset({ x: 0, y: 0 });
                }}
                className="p-2.5 rounded-xl bg-[#141B24] hover:bg-red-500/20 text-[#F5F7FA] hover:text-red-400 border border-[#2A3441] hover:border-red-500/40 transition-all ml-2"
                title="Close (Esc)"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Center Main Stage Viewport */}
          <div 
            className="relative flex-1 flex items-center justify-center overflow-hidden my-4 cursor-grab active:cursor-grabbing"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          >
            {/* Previous Photo Button */}
            <button
              type="button"
              onClick={handlePrev}
              className="absolute left-2 sm:left-6 z-30 p-3 rounded-2xl bg-[#141B24]/80 hover:bg-[#14B8A6] text-[#F5F7FA] hover:text-black border border-[#2A3441] hover:border-[#14B8A6] shadow-2xl transition-all duration-200"
              title="Previous Photo (← Left Arrow)"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>

            {/* Scalable Image */}
            <div className="relative max-w-full max-h-full flex items-center justify-center">
              <img
                src={activePhoto}
                alt={property.title}
                style={{
                  transform: `scale(${zoomLevel}) translate(${dragOffset.x / zoomLevel}px, ${dragOffset.y / zoomLevel}px)`,
                  transition: isDragging ? 'none' : 'transform 0.25s ease-out',
                }}
                className="max-h-[72vh] max-w-[85vw] object-contain rounded-xl shadow-2xl border border-[#2A3441]/50 pointer-events-auto select-none"
              />
            </div>

            {/* Next Photo Button */}
            <button
              type="button"
              onClick={handleNext}
              className="absolute right-2 sm:right-6 z-30 p-3 rounded-2xl bg-[#141B24]/80 hover:bg-[#14B8A6] text-[#F5F7FA] hover:text-black border border-[#2A3441] hover:border-[#14B8A6] shadow-2xl transition-all duration-200"
              title="Next Photo (→ Right Arrow)"
            >
              <ChevronRight className="w-6 h-6" />
            </button>
          </div>

          {/* Bottom Toolbar & Carousel */}
          <div className="z-20 pt-2 border-t border-[#2A3441]/50 flex flex-col items-center gap-3">
            <div className="flex items-center gap-2 overflow-x-auto max-w-full py-1">
              {allPhotos.map((photoUrl, idx) => {
                const isSelected = idx === activePhotoIdx;
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      setActivePhotoIdx(idx);
                      setZoomLevel(1);
                      setDragOffset({ x: 0, y: 0 });
                    }}
                    className={`relative w-16 h-12 rounded-lg overflow-hidden border-2 transition-all ${
                      isSelected
                        ? 'border-[#14B8A6] ring-2 ring-[#14B8A6]/40 scale-110'
                        : 'border-[#2A3441] opacity-50 hover:opacity-100'
                    }`}
                  >
                    <img src={photoUrl} alt={`Thumb ${idx + 1}`} className="w-full h-full object-cover" />
                  </button>
                );
              })}
            </div>

            <div className="text-[11px] text-[#7A8494] flex items-center gap-3">
              <span>💡 Shortcuts: <kbd className="bg-[#141B24] px-1.5 py-0.5 rounded border border-[#2A3441] text-[#F5F7FA]">Esc</kbd> Close</span>
              <span><kbd className="bg-[#141B24] px-1.5 py-0.5 rounded border border-[#2A3441] text-[#F5F7FA]">←</kbd> <kbd className="bg-[#141B24] px-1.5 py-0.5 rounded border border-[#2A3441] text-[#F5F7FA]">→</kbd> Navigate</span>
              <span><kbd className="bg-[#141B24] px-1.5 py-0.5 rounded border border-[#2A3441] text-[#F5F7FA]">+</kbd> <kbd className="bg-[#141B24] px-1.5 py-0.5 rounded border border-[#2A3441] text-[#F5F7FA]">-</kbd> Zoom</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
