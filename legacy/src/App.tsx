import React, { useState, useEffect } from 'react';
import { 
  Search, 
  Map, 
  Grid, 
  Plus, 
  Sparkles, 
  Building, 
  ShieldCheck, 
  Calendar, 
  DollarSign, 
  Eye, 
  ShieldAlert, 
  Layers, 
  CheckCircle2, 
  UserCheck, 
  FileText,
  Clock,
  ChevronRight,
  X,
  Share2,
  Copy,
  Check
} from 'lucide-react';

import { Header } from './components/Header.tsx';
import { PropertyCard } from './components/PropertyCard.tsx';
import { PropertyEyeCard } from './components/PropertyEyeCard.tsx';
import { PricingTraceCard } from './components/PricingTraceCard.tsx';
import { HostMatchingCard } from './components/HostMatchingCard.tsx';
import { DisputeArbitratorModal } from './components/DisputeArbitratorModal.tsx';
import { CreatePropertyModal } from './components/CreatePropertyModal.tsx';
import { InteractiveMap } from './components/InteractiveMap.tsx';
import { N8nWorkflowSuite } from './components/N8nWorkflowSuite.tsx';
import { AdminAnalyticsMaintenance } from './components/AdminAnalyticsMaintenance.tsx';
import { PropertyReviews } from './components/PropertyReviews.tsx';
import { DateRangePicker } from './components/DateRangePicker.tsx';
import { PhotoGalleryLightbox } from './components/PhotoGalleryLightbox.tsx';
import { WishlistModal } from './components/WishlistModal.tsx';
import { WishlistsView } from './components/WishlistsView.tsx';

import { 
  Profile, 
  Property, 
  Booking, 
  Dispute, 
  HostApplication, 
  Payout, 
  AuditLog, 
  N8nWorkflow, 
  PriceSuggestion, 
  BookingInspection,
  Wishlist
} from './types/nest.js';
import { formatCurrency, dollarsToCents } from './lib/money.js';

export default function App() {
  const [activeTab, setActiveTab] = useState<string>('explore');
  const [currentProfile, setCurrentProfile] = useState<Profile | null>(null);
  const [allProfiles, setAllProfiles] = useState<Profile[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [hostApps, setHostApps] = useState<HostApplication[]>([]);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [workflows, setWorkflows] = useState<N8nWorkflow[]>([]);
  const [wishlists, setWishlists] = useState<Wishlist[]>([]);
  const [wishlistPropertyModal, setWishlistPropertyModal] = useState<Property | null>(null);

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [viewMode, setViewMode] = useState<'grid' | 'map'>('grid');

  // Modals & Selected States
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
  const [isCreatingProperty, setIsCreatingProperty] = useState<boolean>(false);
  const [selectedDispute, setSelectedDispute] = useState<Dispute | null>(null);
  const [disputeInspections, setDisputeInspections] = useState<BookingInspection[]>([]);
  const [isCopied, setIsCopied] = useState<boolean>(false);

  const handleShareProperty = async (property: Property) => {
    const shareUrl = `${window.location.origin}/?property=${property.id}`;
    const shareData = {
      title: property.title,
      text: `Check out ${property.title} in ${property.address_json.city}, ${property.address_json.state} on Nest Co-Hosting Marketplace!`,
      url: shareUrl,
    };

    if (navigator.share && navigator.canShare && navigator.canShare(shareData)) {
      try {
        await navigator.share(shareData);
        return;
      } catch (err) {
        if ((err as Error).name === 'AbortError') return;
      }
    }

    try {
      await navigator.clipboard.writeText(shareUrl);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2500);
    } catch (e) {
      console.error('Failed to copy link:', e);
    }
  };

  // Quote & Booking Flow
  const [checkinDate, setCheckinDate] = useState<string>('2026-09-01');
  const [checkoutDate, setCheckoutDate] = useState<string>('2026-09-04');
  const [pricingSuggestion, setPricingSuggestion] = useState<PriceSuggestion | null>(null);
  const [isLoadingQuote, setIsLoadingQuote] = useState<boolean>(false);

  // Application Modal for Co-Hosts
  const [applyProperty, setApplyProperty] = useState<Property | null>(null);
  const [proposedFee, setProposedFee] = useState<number>(15);
  const [pitchText, setPitchText] = useState<string>('');

  // Inspection Upload Modal
  const [inspectBooking, setInspectBooking] = useState<Booking | null>(null);
  const [inspectKind, setInspectKind] = useState<'check_in' | 'check_out'>('check_in');
  const [inspectNotes, setInspectNotes] = useState<string>('');

  // Fetch initial state from server API
  const loadData = async () => {
    try {
      const meRes = await fetch('/api/me');
      const meData = await meRes.json();
      setCurrentProfile(meData.profile);

      const profilesRes = await fetch('/api/profiles');
      setAllProfiles(await profilesRes.json());

      const propsRes = await fetch('/api/properties');
      setProperties(await propsRes.json());

      const bookingsRes = await fetch('/api/bookings');
      setBookings(await bookingsRes.json());

      const disputesRes = await fetch('/api/disputes');
      setDisputes(await disputesRes.json());

      const appsRes = await fetch('/api/host-applications');
      setHostApps(await appsRes.json());

      const payoutsRes = await fetch('/api/payouts');
      setPayouts(await payoutsRes.json());

      const logsRes = await fetch('/api/admin/audit-logs');
      setAuditLogs(await logsRes.json());

      const wfRes = await fetch('/api/admin/workflows');
      setWorkflows(await wfRes.json());

      const wishlistsRes = await fetch('/api/wishlists');
      setWishlists(await wishlistsRes.json());
    } catch (e) {
      console.error("Error loading server data:", e);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Wishlist Action Handlers
  const handleToggleWishlistProperty = async (wishlistId: string, propertyId: string) => {
    try {
      const res = await fetch(`/api/wishlists/${wishlistId}/toggle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ propertyId }),
      });
      if (res.ok) {
        const wishlistsRes = await fetch('/api/wishlists');
        setWishlists(await wishlistsRes.json());
      }
    } catch (err) {
      console.error('Failed to toggle wishlist property:', err);
    }
  };

  const handleCreateWishlist = async (title: string, description?: string, initialPropertyId?: string) => {
    try {
      const res = await fetch('/api/wishlists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, description, initialPropertyId }),
      });
      if (res.ok) {
        const wishlistsRes = await fetch('/api/wishlists');
        setWishlists(await wishlistsRes.json());
      }
    } catch (err) {
      console.error('Failed to create wishlist:', err);
    }
  };

  const handleDeleteWishlist = async (wishlistId: string) => {
    try {
      const res = await fetch(`/api/wishlists/${wishlistId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        const wishlistsRes = await fetch('/api/wishlists');
        setWishlists(await wishlistsRes.json());
      }
    } catch (err) {
      console.error('Failed to delete wishlist:', err);
    }
  };

  const isPropertyFavorited = (propertyId: string): boolean => {
    return wishlists.some((w) => w.property_ids.includes(propertyId));
  };

  const getTotalFavoritedPropertiesCount = (): number => {
    const allSaved = new Set<string>();
    wishlists.forEach((w) => w.property_ids.forEach((id) => allSaved.add(id)));
    return allSaved.size;
  };

  // Persona Switch Handler
  const handleSwitchRole = async (userId: string) => {
    await fetch('/api/me/switch-role', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId })
    });
    loadData();
  };

  // Property Selection & Pricing Quote Fetch
  const handleSelectProperty = async (prop: Property) => {
    setSelectedProperty(prop);
    setIsLoadingQuote(true);
    try {
      const quoteRes = await fetch('/api/bookings/quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ propertyId: prop.id, checkin: checkinDate, checkout: checkoutDate })
      });
      const quoteData = await quoteRes.json();
      setPricingSuggestion(quoteData.suggestion);
    } catch (e) {
      console.error("Quote error:", e);
    } finally {
      setIsLoadingQuote(false);
    }
  };

  // Trigger Asynchronous Property Vision Analysis
  const handleTriggerVision = async (propertyId: string) => {
    await fetch(`/api/properties/${propertyId}/analyze-vision`, { method: 'POST' });
    loadData();
    if (selectedProperty?.id === propertyId) {
      const updated = await (await fetch(`/api/properties/${propertyId}`)).json();
      setSelectedProperty(updated);
    }
  };

  // Create Property Handler
  const handleCreateProperty = async (data: Partial<Property>) => {
    const res = await fetch('/api/properties', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    const newProp = await res.json();
    setIsCreatingProperty(false);
    loadData();
    // Auto-trigger vision
    handleTriggerVision(newProp.id);
  };

  // Create Booking
  const handleBookNow = async () => {
    if (!selectedProperty) return;
    try {
      const res = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          property_id: selectedProperty.id,
          checkin: checkinDate,
          checkout: checkoutDate,
          per_night_rate_minor: pricingSuggestion?.suggested_price_minor || selectedProperty.base_price_minor
        })
      });
      const booking = await res.json();
      if (res.ok) {
        alert("Reservation confirmed! Double-booking exclusion constraint verified.");
        setSelectedProperty(null);
        setActiveTab('dashboard-guest');
        loadData();
      } else {
        alert("Booking error: " + booking.error);
      }
    } catch (e: any) {
      alert("Booking error: " + e.message);
    }
  };

  // Co-Host Application
  const handleApplyHostSubmit = async () => {
    if (!applyProperty) return;
    const res = await fetch('/api/host-applications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        property_id: applyProperty.id,
        proposed_fee_pct: proposedFee,
        pitch_text: pitchText,
      })
    });
    const appData = await res.json();
    if (res.ok) {
      alert("Co-Host application submitted! KYC verification checked.");
      setApplyProperty(null);
      loadData();
    } else {
      alert("Application failed: " + appData.error);
    }
  };

  // AI Host Match Evaluation
  const handleEvaluateMatchAI = async (appId: string) => {
    await fetch(`/api/host-applications/${appId}/evaluate`, { method: 'POST' });
    loadData();
  };

  // Inspection Photo Upload
  const handleSubmitInspection = async () => {
    if (!inspectBooking) return;
    await fetch(`/api/bookings/${inspectBooking.id}/inspections`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        kind: inspectKind,
        photos: inspectBooking.property_cover ? [inspectBooking.property_cover] : [],
        notes: inspectNotes,
      })
    });
    setInspectBooking(null);
    alert("Inspection photos submitted for dispute evidence.");
    loadData();
  };

  // Open Dispute
  const handleOpenDispute = async (booking: Booking) => {
    const res = await fetch('/api/disputes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        booking_id: booking.id,
        respondent_id: booking.owner_id,
        amount_claimed_minor: dollarsToCents(450),
        description: "Surface scuffing and stain discovered during post-checkout inspection.",
      })
    });
    if (res.ok) {
      alert("Dispute opened. Payout automatically frozen pending adjudication!");
      loadData();
    }
  };

  // Open Dispute Arbitrator Modal
  const handleOpenDisputeModal = async (dispute: Dispute) => {
    setSelectedDispute(dispute);
    const res = await fetch(`/api/bookings/${dispute.booking_id}/inspections`);
    const data = await res.json();
    setDisputeInspections(data);
  };

  // Assess AI Dispute
  const handleAssessDisputeAI = async (disputeId: string) => {
    const res = await fetch(`/api/disputes/${disputeId}/assess`, { method: 'POST' });
    const data = await res.json();
    setSelectedDispute(data.dispute);
    loadData();
  };

  // Resolve Dispute
  const handleResolveDisputeAdmin = async (disputeId: string, decision: string, awardCents: number) => {
    await fetch(`/api/disputes/${disputeId}/resolve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ decision, awardClaimantMinor: awardCents })
    });
    setSelectedDispute(null);
    loadData();
  };

  // Trigger Workflow
  const handleRunWorkflow = async (wfId: string) => {
    await fetch('/api/admin/workflows/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workflowId: wfId })
    });
    alert(`Workflow ${wfId} executed successfully!`);
    loadData();
  };

  if (!currentProfile) {
    return <div className="min-h-screen bg-[#0B0F14] text-white flex items-center justify-center">Loading Nest...</div>;
  }

  const filteredProperties = properties.filter(p => 
    p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.address_json.city?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-[#0B0F14] text-[#F5F7FA] font-sans flex flex-col">
      {/* Header Bar */}
      <Header
        currentProfile={currentProfile}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onSwitchRole={handleSwitchRole}
        allProfiles={allProfiles}
        wishlistsCount={getTotalFavoritedPropertiesCount()}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 lg:px-8 py-8">
        
        {/* TAB 1: EXPLORE MARKETPLACE */}
        {activeTab === 'explore' && (
          <div className="space-y-6">
            {/* Search & Mode Bar */}
            <div className="bg-[#141B24] p-4 rounded-2xl border border-[#2A3441] flex flex-col md:flex-row items-center justify-between gap-4 shadow-xl">
              <div className="relative flex-1 w-full">
                <Search className="w-4 h-4 text-[#7A8494] absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search properties by location (San Francisco, Malibu, Aspen, NYC)..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-[#0B0F14] border border-[#2A3441] text-[#F5F7FA] text-xs rounded-xl pl-10 pr-4 py-3 focus:outline-none focus:border-[#14B8A6]"
                />
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all ${
                    viewMode === 'grid' ? 'bg-[#FF7A45] text-white' : 'bg-[#0B0F14] text-[#B4BCC8]'
                  }`}
                >
                  <Grid className="w-3.5 h-3.5" />
                  Grid View
                </button>
                <button
                  onClick={() => setViewMode('map')}
                  className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all ${
                    viewMode === 'map' ? 'bg-[#14B8A6] text-black' : 'bg-[#0B0F14] text-[#B4BCC8]'
                  }`}
                >
                  <Map className="w-3.5 h-3.5" />
                  Map View
                </button>
              </div>
            </div>

            {/* View Switching */}
            {viewMode === 'map' ? (
              <InteractiveMap properties={filteredProperties} onSelectProperty={handleSelectProperty} />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredProperties.map(prop => (
                  <PropertyCard 
                    key={prop.id} 
                    property={prop} 
                    onSelect={handleSelectProperty}
                    isFavorited={isPropertyFavorited(prop.id)}
                    onToggleFavorite={(_, e) => {
                      e.stopPropagation();
                      setWishlistPropertyModal(prop);
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: OWNER PORTAL */}
        {activeTab === 'dashboard-owner' && (
          <div className="space-y-8">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#141B24] p-6 rounded-2xl border border-[#2A3441]">
              <div>
                <h2 className="text-xl font-bold text-[#F5F7FA]">Owner Property Management</h2>
                <p className="text-xs text-[#B4BCC8]">Manage properties, AI Property Eye vision re-analysis, and host applications</p>
              </div>
              <button
                onClick={() => setIsCreatingProperty(true)}
                className="px-4 py-2.5 bg-gradient-to-r from-[#FF7A45] to-[#14B8A6] text-white text-xs font-bold rounded-xl shadow-lg flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                List New Property
              </button>
            </div>

            {/* My Properties List */}
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-[#FFB067] uppercase tracking-wider">My Managed Properties</h3>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {properties.filter(p => p.owner_id === currentProfile.id || currentProfile.role === 'owner').map(prop => (
                  <div key={prop.id} className="bg-[#1C242F] rounded-2xl border border-[#2A3441] p-5 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-xs font-bold text-[#5EEAD4]">{prop.address_json.city}, {prop.address_json.state}</span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-[#FF7A45]/20 text-[#FFB067]">
                          {prop.status.toUpperCase()}
                        </span>
                      </div>
                      <h4 className="font-bold text-base text-[#F5F7FA] mb-2">{prop.title}</h4>
                      <p className="text-xs text-[#B4BCC8] line-clamp-2 mb-4">{prop.description}</p>
                    </div>

                    {/* AI Property Eye Status */}
                    <PropertyEyeCard
                      vision={prop.vision_analysis}
                      visionStatus={prop.vision_status}
                      onTriggerReanalysis={() => handleTriggerVision(prop.id)}
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Host Applications for Owner Properties */}
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-[#5EEAD4] uppercase tracking-wider">Received Co-Host Applications</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {hostApps.map(app => (
                  <HostMatchingCard
                    key={app.id}
                    application={app}
                    onEvaluateAI={handleEvaluateMatchAI}
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: CO-HOST HUB */}
        {activeTab === 'dashboard-host' && (
          <div className="space-y-8">
            {/* KYC Status Banner */}
            <div className="bg-[#141B24] p-6 rounded-2xl border border-[#14B8A6]/40 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-[#14B8A6]/20 border border-[#14B8A6]/40 flex items-center justify-center">
                  <ShieldCheck className="w-6 h-6 text-[#5EEAD4]" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-[#F5F7FA]">Host KYC Identity Status: Verified</h3>
                  <p className="text-xs text-[#B4BCC8]">Your identity is verified via Stripe Identity. Unlocked to co-host properties.</p>
                </div>
              </div>
            </div>

            {/* Eligible Properties Seeking Co-Hosts */}
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-[#FFB067] uppercase tracking-wider">Properties Seeking Co-Hosts</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {properties.map(prop => (
                  <div key={prop.id} className="bg-[#1C242F] rounded-2xl border border-[#2A3441] p-5 flex flex-col justify-between">
                    <div>
                      <h4 className="font-bold text-base text-[#F5F7FA] mb-1">{prop.title}</h4>
                      <p className="text-xs text-[#B4BCC8] mb-3">{prop.address_json.city}, {prop.address_json.state}</p>
                      <div className="text-xs text-[#7A8494] mb-3">Owner Base Price: {formatCurrency(prop.base_price_minor)}/night</div>
                    </div>

                    <button
                      onClick={() => setApplyProperty(prop)}
                      className="w-full py-2 bg-gradient-to-r from-[#FF7A45] to-[#14B8A6] text-white text-xs font-bold rounded-xl shadow-md"
                    >
                      Apply to Co-Host
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: GUEST TRIPS & INSPECTIONS */}
        {activeTab === 'dashboard-guest' && (
          <div className="space-y-8">
            <div className="bg-[#141B24] p-6 rounded-2xl border border-[#2A3441]">
              <h2 className="text-xl font-bold text-[#F5F7FA]">My Booked Trips</h2>
              <p className="text-xs text-[#B4BCC8]">Upload check-in / check-out inspection photos or open dispute</p>
            </div>

            <div className="space-y-4">
              {bookings.map(book => (
                <div key={book.id} className="bg-[#1C242F] rounded-2xl border border-[#2A3441] p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                  <div className="space-y-1">
                    <span className="text-xs font-bold text-[#14B8A6] uppercase">{book.status}</span>
                    <h4 className="font-bold text-base text-[#F5F7FA]">{book.property_title}</h4>
                    <p className="text-xs text-[#B4BCC8]">
                      Dates: {book.checkin} → {book.checkout} ({book.nights} nights)
                    </p>
                    <div className="text-xs font-bold text-[#FFB067]">Total Paid: {formatCurrency(book.total_amount_minor)}</div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => { setInspectBooking(book); setInspectKind('check_in'); }}
                      className="px-3.5 py-2 bg-[#0B0F14] hover:bg-[#2A3441] text-[#5EEAD4] border border-[#14B8A6]/30 text-xs font-semibold rounded-xl"
                    >
                      Upload Check-In Inspection
                    </button>
                    <button
                      onClick={() => { setInspectBooking(book); setInspectKind('check_out'); }}
                      className="px-3.5 py-2 bg-[#0B0F14] hover:bg-[#2A3441] text-[#FFB067] border border-[#FF7A45]/30 text-xs font-semibold rounded-xl"
                    >
                      Upload Check-Out Inspection
                    </button>
                    <button
                      onClick={() => handleOpenDispute(book)}
                      className="px-3.5 py-2 bg-[#EF4444]/20 hover:bg-[#EF4444] text-[#EF4444] hover:text-white border border-[#EF4444]/30 text-xs font-semibold rounded-xl transition-all"
                    >
                      Open Dispute
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 5: ADMIN PORTAL */}
        {activeTab === 'admin' && (
          <div className="space-y-8">
            <div className="bg-[#141B24] p-6 rounded-2xl border border-[#2A3441]">
              <h2 className="text-xl font-bold text-[#F5F7FA]">Platform Administration & Operations</h2>
              <p className="text-xs text-[#B4BCC8]">Dispute adjudication, payout oversight, audit logs, analytics & maintenance</p>
            </div>

            {/* Analytics & Platform Maintenance */}
            <AdminAnalyticsMaintenance
              properties={properties}
              bookings={bookings}
              disputes={disputes}
              payouts={payouts}
              auditLogs={auditLogs}
              onTriggerMaintenanceSync={loadData}
            />

            {/* Active Disputes Table */}
            <div className="bg-[#1C242F] p-6 rounded-2xl border border-[#2A3441]">
              <h3 className="font-bold text-sm text-[#EF4444] uppercase tracking-wider mb-4 flex items-center gap-2">
                <ShieldAlert className="w-4 h-4" />
                Active Platform Disputes (Payouts Frozen)
              </h3>
              <div className="space-y-3">
                {disputes.map(disp => (
                  <div key={disp.id} className="bg-[#0B0F14] p-4 rounded-xl border border-[#2A3441] flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2 text-xs mb-1">
                        <span className="font-bold text-[#F5F7FA]">{disp.claimant_name} vs {disp.respondent_name}</span>
                        <span className="text-[10px] px-2 py-0.5 rounded bg-[#EF4444]/20 text-[#EF4444] uppercase">{disp.status}</span>
                      </div>
                      <p className="text-xs text-[#B4BCC8] line-clamp-1">{disp.description}</p>
                    </div>

                    <button
                      onClick={() => handleOpenDisputeModal(disp)}
                      className="px-4 py-2 bg-[#F5B841] text-black text-xs font-bold rounded-xl"
                    >
                      Review & Adjudicate
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* 10 Suite n8n Automation Workflows */}
            <N8nWorkflowSuite workflows={workflows} onTriggerWorkflow={handleRunWorkflow} />
          </div>
        )}

        {/* TAB 6: SPECIFICATION & COSTS DOCS */}
        {activeTab === 'docs' && (
          <div className="bg-[#141B24] p-8 rounded-2xl border border-[#2A3441] space-y-6">
            <h2 className="text-2xl font-bold text-[#F5F7FA]">Nest Specification v5 & Documentation</h2>
            <div className="prose prose-invert max-w-none text-xs text-[#B4BCC8] space-y-4 leading-relaxed">
              <h3 className="text-sm font-bold text-[#14B8A6]">Authoritative Build Mandates</h3>
              <ul className="list-disc pl-5 space-y-1">
                <li><strong>Multimodal Vision Pipeline:</strong> Asynchronous property analysis evaluating condition score (1-10), quality tier, and guest highlights using Gemini.</li>
                <li><strong>Financial Safety Invariant:</strong> AI never calculates or transfers money directly. All arithmetic performed in integer minor currency units.</li>
                <li><strong>GiST Double-Booking Prevention:</strong> PostgreSQL exclusion constraint enforced at database/state boundary.</li>
                <li><strong>Structured Zod Validation:</strong> 100% of AI responses schema-validated before application execution.</li>
              </ul>
            </div>
          </div>
        )}

        {/* TAB 7: WISHLISTS & SAVED FAVORITES */}
        {activeTab === 'wishlists' && (
          <WishlistsView
            wishlists={wishlists}
            properties={properties}
            onSelectProperty={handleSelectProperty}
            onCreateWishlist={handleCreateWishlist}
            onDeleteWishlist={handleDeleteWishlist}
            onToggleWishlist={handleToggleWishlistProperty}
            onOpenWishlistModal={(property) => setWishlistPropertyModal(property)}
            isPropertyFavorited={isPropertyFavorited}
          />
        )}

      </main>

      {/* MODAL 1: PROPERTY DETAIL & BOOKING QUOTE */}
      {selectedProperty && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-[#141B24] border border-[#2A3441] rounded-2xl max-w-4xl w-full p-6 shadow-2xl my-8">
            <div className="flex items-center justify-between pb-4 border-b border-[#2A3441] mb-6">
              <div>
                <span className="text-xs font-semibold text-[#14B8A6]">{selectedProperty.address_json.city}, {selectedProperty.address_json.state}</span>
                <h3 className="font-bold text-xl text-[#F5F7FA]">{selectedProperty.title}</h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleShareProperty(selectedProperty)}
                  className={`px-3 py-2 rounded-xl border transition-all flex items-center gap-1.5 text-xs font-semibold ${
                    isCopied
                      ? 'bg-[#14B8A6]/20 border-[#14B8A6] text-[#5EEAD4]'
                      : 'bg-[#0B0F14] border-[#2A3441] text-[#F5F7FA] hover:border-[#14B8A6] hover:text-[#5EEAD4]'
                  }`}
                  title="Share property link"
                >
                  {isCopied ? (
                    <>
                      <Check className="w-4 h-4 text-[#14B8A6]" />
                      <span>Link Copied!</span>
                    </>
                  ) : (
                    <>
                      <Share2 className="w-4 h-4 text-[#14B8A6]" />
                      <span>Share</span>
                    </>
                  )}
                </button>
                <button 
                  type="button"
                  onClick={() => setSelectedProperty(null)} 
                  className="p-2 rounded-xl bg-[#0B0F14] text-[#7A8494] hover:text-white border border-[#2A3441] hover:border-[#7A8494] transition-colors"
                  title="Close Modal"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="space-y-4">
                <PhotoGalleryLightbox property={selectedProperty} />
                <p className="text-xs text-[#B4BCC8] leading-relaxed">{selectedProperty.description}</p>
                <PropertyEyeCard vision={selectedProperty.vision_analysis} visionStatus={selectedProperty.vision_status} />
              </div>

              <div className="space-y-4">
                {/* Heat Map Date Range Picker */}
                <DateRangePicker
                  property={selectedProperty}
                  checkinDate={checkinDate}
                  checkoutDate={checkoutDate}
                  existingBookings={bookings}
                  onChange={async (inDate, outDate) => {
                    setCheckinDate(inDate);
                    setCheckoutDate(outDate);
                    if (selectedProperty && inDate && outDate) {
                      setIsLoadingQuote(true);
                      try {
                        const quoteRes = await fetch('/api/bookings/quote', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ propertyId: selectedProperty.id, checkin: inDate, checkout: outDate })
                        });
                        const quoteData = await quoteRes.json();
                        setPricingSuggestion(quoteData.suggestion);
                      } catch (e) {
                        console.error("Quote error:", e);
                      } finally {
                        setIsLoadingQuote(false);
                      }
                    }
                  }}
                />

                {pricingSuggestion && <PricingTraceCard suggestion={pricingSuggestion} />}

                <button
                  onClick={handleBookNow}
                  disabled={!checkinDate || !checkoutDate}
                  className="w-full mt-2 py-3 bg-gradient-to-r from-[#FF7A45] to-[#14B8A6] text-white font-bold text-sm rounded-xl shadow-lg hover:opacity-90 transition-all disabled:opacity-50 disabled:pointer-events-none"
                >
                  Confirm Reservation ({pricingSuggestion ? formatCurrency(pricingSuggestion.suggested_price_minor) : formatCurrency(selectedProperty.base_price_minor)} / night)
                </button>
              </div>
            </div>

            {/* Guest-to-Property Reviews Section */}
            <div className="mt-6">
              <PropertyReviews
                propertyId={selectedProperty.id}
                propertyTitle={selectedProperty.title}
                onReviewAdded={loadData}
              />
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: CREATE PROPERTY */}
      {isCreatingProperty && (
        <CreatePropertyModal onClose={() => setIsCreatingProperty(false)} onSubmit={handleCreateProperty} />
      )}

      {/* MODAL 3: APPLY AS CO-HOST */}
      {applyProperty && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#141B24] border border-[#2A3441] rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <h3 className="font-bold text-lg text-[#F5F7FA] mb-1">Apply to Co-Host Property</h3>
            <p className="text-xs text-[#B4BCC8] mb-4">Property: {applyProperty.title}</p>

            <div className="space-y-4">
              <div>
                <label className="text-xs text-[#B4BCC8] block mb-1">Proposed Co-Hosting Fee (%)</label>
                <input
                  type="number"
                  min={5}
                  max={40}
                  value={proposedFee}
                  onChange={(e) => setProposedFee(Number(e.target.value))}
                  className="w-full bg-[#0B0F14] border border-[#2A3441] text-[#F5F7FA] text-xs rounded-xl p-3"
                />
              </div>

              <div>
                <label className="text-xs text-[#B4BCC8] block mb-1">Pitch Proposal to Owner</label>
                <textarea
                  rows={3}
                  value={pitchText}
                  onChange={(e) => setPitchText(e.target.value)}
                  placeholder="Explain your hosting track record, local availability, and guest response times..."
                  className="w-full bg-[#0B0F14] border border-[#2A3441] text-[#F5F7FA] text-xs rounded-xl p-3"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button onClick={() => setApplyProperty(null)} className="px-4 py-2 bg-[#0B0F14] text-xs font-semibold rounded-xl">Cancel</button>
                <button onClick={handleApplyHostSubmit} className="px-5 py-2 bg-[#14B8A6] text-black text-xs font-bold rounded-xl">Submit Proposal</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: DISPUTE ARBITRATOR MODAL */}
      {selectedDispute && (
        <DisputeArbitratorModal
          dispute={selectedDispute}
          inspections={disputeInspections}
          onClose={() => setSelectedDispute(null)}
          onAssessAI={handleAssessDisputeAI}
          onResolveAdmin={handleResolveDisputeAdmin}
          isAdmin={currentProfile.role === 'admin'}
        />
      )}

      {/* MODAL 5: INSPECTION UPLOAD */}
      {inspectBooking && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#141B24] border border-[#2A3441] rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <h3 className="font-bold text-lg text-[#F5F7FA] mb-1">Upload Inspection Evidence</h3>
            <p className="text-xs text-[#B4BCC8] mb-4">Kind: {inspectKind.toUpperCase()}</p>

            <div className="space-y-4">
              <div>
                <label className="text-xs text-[#B4BCC8] block mb-1">Inspection Notes</label>
                <textarea
                  rows={3}
                  value={inspectNotes}
                  onChange={(e) => setInspectNotes(e.target.value)}
                  placeholder="Describe property condition, surfaces, keys, and appliances..."
                  className="w-full bg-[#0B0F14] border border-[#2A3441] text-[#F5F7FA] text-xs rounded-xl p-3"
                />
              </div>

              <div className="flex justify-end gap-2">
                <button onClick={() => setInspectBooking(null)} className="px-4 py-2 bg-[#0B0F14] text-xs font-semibold rounded-xl">Cancel</button>
                <button onClick={handleSubmitInspection} className="px-5 py-2 bg-[#14B8A6] text-black text-xs font-bold rounded-xl">Submit Inspection</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 6: SAVE TO WISHLIST MODAL */}
      {wishlistPropertyModal && (
        <WishlistModal
          property={wishlistPropertyModal}
          wishlists={wishlists}
          onToggleWishlist={handleToggleWishlistProperty}
          onCreateWishlist={handleCreateWishlist}
          onClose={() => setWishlistPropertyModal(null)}
        />
      )}

    </div>
  );
}
