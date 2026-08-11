import React, { useEffect, useState } from 'react';
import { Home, Shield, Search, UserCheck, Settings, FileText, Activity, ShieldCheck, Sparkles, Building, Layers, LogIn, Heart } from 'lucide-react';
import { Profile, UserRole } from '../types/nest.js';

interface HeaderProps {
  currentProfile: Profile;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onSwitchRole: (userId: string) => void;
  allProfiles: Profile[];
  wishlistsCount?: number;
}

export const Header: React.FC<HeaderProps> = ({
  currentProfile,
  activeTab,
  setActiveTab,
  onSwitchRole,
  allProfiles,
  wishlistsCount = 0,
}) => {
  const [googleOauthConfigured, setGoogleOauthConfigured] = useState(false);

  useEffect(() => {
    fetch('/api/auth/google/url')
      .then(res => res.json())
      .then(data => {
        setGoogleOauthConfigured(Boolean(data.configured));
      })
      .catch(() => {});

    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'OAUTH_AUTH_SUCCESS') {
        alert('Google OAuth verification completed successfully!');
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const handleGoogleLogin = async () => {
    try {
      const res = await fetch('/api/auth/google/url');
      if (!res.ok) throw new Error('Failed to fetch auth URL');
      const { url } = await res.json();

      const popup = window.open(
        url,
        'google_oauth_popup',
        'width=600,height=700'
      );
      if (!popup) {
        alert('Please allow popups to sign in with Google.');
      }
    } catch (err) {
      console.error('Google OAuth error:', err);
    }
  };
  return (
    <header className="sticky top-0 z-50 bg-[#141B24]/90 backdrop-blur-md border-b border-[#2A3441] px-4 lg:px-8 py-3">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
        
        {/* Brand Logo & Tagline */}
        <div className="flex items-center gap-3 cursor-pointer" onClick={() => setActiveTab('explore')}>
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#FF7A45] to-[#14B8A6] p-[2px] shadow-lg shadow-[#FF7A45]/20">
            <div className="w-full h-full bg-[#0B0F14] rounded-[10px] flex items-center justify-center">
              <Home className="w-5 h-5 text-[#FFB067]" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl font-bold tracking-tight text-[#F5F7FA]">NEST</span>
              <span className="px-2 py-0.5 text-[10px] font-semibold tracking-wider bg-[#FF7A45]/15 text-[#FFB067] border border-[#FF7A45]/30 rounded-full uppercase">
                Co-Hosting Marketplace
              </span>
            </div>
            <p className="text-xs text-[#B4BCC8]">AI-Powered • Vision • Dynamic Pricing</p>
          </div>
        </div>

        {/* Primary Navigation Tabs */}
        <nav className="flex items-center gap-1 bg-[#0B0F14]/60 p-1.5 rounded-xl border border-[#2A3441]">
          <button
            onClick={() => setActiveTab('explore')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
              activeTab === 'explore'
                ? 'bg-[#FF7A45] text-white shadow-md shadow-[#FF7A45]/30'
                : 'text-[#B4BCC8] hover:text-white hover:bg-[#1C242F]'
            }`}
          >
            <Search className="w-3.5 h-3.5" />
            Explore Properties
          </button>

          <button
            onClick={() => setActiveTab('wishlists')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
              activeTab === 'wishlists'
                ? 'bg-[#FF7A45] text-white shadow-md shadow-[#FF7A45]/30'
                : 'text-[#B4BCC8] hover:text-white hover:bg-[#1C242F]'
            }`}
          >
            <Heart className={`w-3.5 h-3.5 ${activeTab === 'wishlists' ? 'fill-white' : 'text-[#FF7A45]'}`} />
            <span>Wishlists</span>
            {wishlistsCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-extrabold bg-[#14B8A6] text-black ml-0.5">
                {wishlistsCount}
              </span>
            )}
          </button>

          {currentProfile.role === 'owner' && (
            <button
              onClick={() => setActiveTab('dashboard-owner')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                activeTab === 'dashboard-owner'
                  ? 'bg-[#FF7A45] text-white shadow-md shadow-[#FF7A45]/30'
                  : 'text-[#B4BCC8] hover:text-white hover:bg-[#1C242F]'
              }`}
            >
              <Building className="w-3.5 h-3.5" />
              Owner Portal
            </button>
          )}

          {currentProfile.role === 'host' && (
            <button
              onClick={() => setActiveTab('dashboard-host')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                activeTab === 'dashboard-host'
                  ? 'bg-[#14B8A6] text-white shadow-md shadow-[#14B8A6]/30'
                  : 'text-[#B4BCC8] hover:text-white hover:bg-[#1C242F]'
              }`}
            >
              <UserCheck className="w-3.5 h-3.5" />
              Co-Host Hub
            </button>
          )}

          {currentProfile.role === 'guest' && (
            <button
              onClick={() => setActiveTab('dashboard-guest')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                activeTab === 'dashboard-guest'
                  ? 'bg-[#FF7A45] text-white shadow-md shadow-[#FF7A45]/30'
                  : 'text-[#B4BCC8] hover:text-white hover:bg-[#1C242F]'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              My Trips
            </button>
          )}

          <button
            onClick={() => setActiveTab('admin')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
              activeTab === 'admin'
                ? 'bg-[#F5B841] text-black font-semibold shadow-md shadow-[#F5B841]/30'
                : 'text-[#B4BCC8] hover:text-white hover:bg-[#1C242F]'
            }`}
          >
            <Shield className="w-3.5 h-3.5" />
            Admin & Workflows
          </button>

          <button
            onClick={() => setActiveTab('docs')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
              activeTab === 'docs'
                ? 'bg-[#1C242F] text-[#5EEAD4] border border-[#14B8A6]/40'
                : 'text-[#B4BCC8] hover:text-white hover:bg-[#1C242F]'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            Docs & Spec
          </button>
        </nav>

        {/* Persona Switcher & Active User Profile */}
        <div className="flex items-center gap-3">
          <div className="hidden lg:flex flex-col text-right">
            <span className="text-xs font-semibold text-[#F5F7FA]">{currentProfile.full_name}</span>
            <div className="flex items-center justify-end gap-1.5 text-[11px]">
              <span className={`px-1.5 py-0.2 rounded font-medium ${
                currentProfile.role === 'owner' ? 'bg-[#FF7A45]/20 text-[#FFB067]' :
                currentProfile.role === 'host' ? 'bg-[#14B8A6]/20 text-[#5EEAD4]' :
                currentProfile.role === 'admin' ? 'bg-[#F5B841]/20 text-[#F5B841]' :
                'bg-blue-500/20 text-blue-300'
              }`}>
                {currentProfile.role.toUpperCase()}
              </span>
              {currentProfile.kyc_status === 'verified' && (
                <span className="flex items-center gap-0.5 text-[#22C55E]" title="Identity Verified">
                  <ShieldCheck className="w-3 h-3 text-[#F5B841]" />
                  Verified
                </span>
              )}
            </div>
          </div>

          <img
            src={currentProfile.avatar_path || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'}
            alt={currentProfile.full_name}
            className="w-9 h-9 rounded-full object-cover border-2 border-[#14B8A6]"
          />

          {/* Google OAuth Login Button */}
          <button
            onClick={handleGoogleLogin}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#0B0F14] hover:bg-[#1C242F] text-[#5EEAD4] border border-[#14B8A6]/40 rounded-lg text-xs font-semibold transition-all shadow-sm"
            title="Authenticate via Google OAuth"
          >
            <LogIn className="w-3.5 h-3.5 text-[#14B8A6]" />
            <span>Google Login</span>
          </button>

          {/* Quick Persona Switcher Select */}
          <select
            value={currentProfile.id}
            onChange={(e) => onSwitchRole(e.target.value)}
            className="bg-[#0B0F14] border border-[#2A3441] text-[#F5F7FA] text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-[#14B8A6]"
          >
            {allProfiles.map(p => (
              <option key={p.id} value={p.id}>
                Simulate: {p.full_name} ({p.role})
              </option>
            ))}
          </select>
        </div>

      </div>
    </header>
  );
};
