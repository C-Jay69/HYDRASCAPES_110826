import { 
  Profile, 
  Property, 
  AvailabilityBlock, 
  Booking, 
  BookingInspection, 
  HostApplication, 
  MessageThread, 
  Message, 
  Review, 
  Payout, 
  Dispute, 
  AuditLog, 
  N8nWorkflow,
  PriceSuggestion,
  PricingRule,
  Wishlist
} from "../types/nest.js";
import { calculatePayoutSplit, dollarsToCents } from "./money.js";

class NestDatabase {
  private profiles: Profile[] = [];
  private properties: Property[] = [];
  private availabilityBlocks: AvailabilityBlock[] = [];
  private bookings: Booking[] = [];
  private bookingInspections: BookingInspection[] = [];
  private hostApplications: HostApplication[] = [];
  private messageThreads: MessageThread[] = [];
  private messages: Message[] = [];
  private reviews: Review[] = [];
  private payouts: Payout[] = [];
  private disputes: Dispute[] = [];
  private priceSuggestions: PriceSuggestion[] = [];
  private pricingRules: Map<string, PricingRule> = new Map();
  private wishlists: Wishlist[] = [];
  private auditLogs: AuditLog[] = [];
  private processedWebhooks: Set<string> = new Set();
  private activeUserId: string = "user-owner-1"; // Default persona

  constructor() {
    this.seed();
  }

  // --- SEED INITIALIZATION ---
  private seed() {
    const now = new Date().toISOString();

    // 1. PROFILES
    this.profiles = [
      {
        id: "user-owner-1",
        email: "sarah.j@nest.com",
        role: "owner",
        full_name: "Sarah Jenkins",
        avatar_path: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80",
        location_json: { city: "San Francisco", state: "CA", country: "USA" },
        bio: "Luxury real estate investor and interior design enthusiast with properties in SF & Malibu.",
        rating_avg: 4.95,
        rating_count: 32,
        kyc_status: "verified",
        kyc_verified_at: "2026-01-10T10:00:00Z",
        stripe_connect_id: "acct_owner_sarah123",
        created_at: now,
        updated_at: now,
      },
      {
        id: "user-owner-2",
        email: "marcus.vance@nest.com",
        role: "owner",
        full_name: "Marcus Vance",
        avatar_path: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80",
        location_json: { city: "Aspen", state: "CO", country: "USA" },
        bio: "Owner of alpine chalets looking for dedicated local co-hosts.",
        rating_avg: 4.88,
        rating_count: 19,
        kyc_status: "verified",
        kyc_verified_at: "2026-02-01T12:00:00Z",
        stripe_connect_id: "acct_owner_marcus456",
        created_at: now,
        updated_at: now,
      },
      {
        id: "user-host-1",
        email: "elena.r@cohostsf.com",
        role: "host",
        full_name: "Elena Rostova",
        avatar_path: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80",
        location_json: { city: "San Francisco", state: "CA", country: "USA" },
        bio: "Superhost with 8 years co-hosting luxury SF Bay properties. 100% response rate & 5-star concierge services.",
        rating_avg: 4.98,
        rating_count: 64,
        kyc_status: "verified",
        kyc_verified_at: "2026-01-05T09:00:00Z",
        stripe_connect_id: "acct_host_elena789",
        created_at: now,
        updated_at: now,
      },
      {
        id: "user-host-2",
        email: "david.kim@aspenhosts.com",
        role: "host",
        full_name: "David Kim",
        avatar_path: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80",
        location_json: { city: "Aspen", state: "CO", country: "USA" },
        bio: "Licensed mountain hospitality specialist with ski-in/ski-out experience.",
        rating_avg: 4.92,
        rating_count: 28,
        kyc_status: "verified",
        kyc_verified_at: "2026-02-15T14:00:00Z",
        stripe_connect_id: "acct_host_david101",
        created_at: now,
        updated_at: now,
      },
      {
        id: "user-guest-1",
        email: "alex.rivera@gmail.com",
        role: "guest",
        full_name: "Alex Rivera",
        avatar_path: "https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=150&auto=format&fit=crop&q=80",
        location_json: { city: "Seattle", state: "WA", country: "USA" },
        bio: "Frequent traveler & software executive seeking premier stays.",
        rating_avg: 5.0,
        rating_count: 12,
        kyc_status: "verified",
        kyc_verified_at: "2026-03-01T08:00:00Z",
        stripe_customer_id: "cus_alex_rivera",
        created_at: now,
        updated_at: now,
      },
      {
        id: "user-guest-2",
        email: "chloe.b@design.io",
        role: "guest",
        full_name: "Chloe Bennett",
        avatar_path: "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150&auto=format&fit=crop&q=80",
        location_json: { city: "Los Angeles", state: "CA", country: "USA" },
        bio: "Architectural photographer traveling for coastal shoots.",
        rating_avg: 4.90,
        rating_count: 8,
        kyc_status: "verified",
        created_at: now,
        updated_at: now,
      },
      {
        id: "user-admin-1",
        email: "admin@nestmarketplace.com",
        role: "admin",
        full_name: "Nest Operations Admin",
        avatar_path: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&auto=format&fit=crop&q=80",
        location_json: { city: "San Francisco", state: "CA" },
        bio: "Platform Administrator & Dispute Moderator",
        rating_avg: 5.0,
        rating_count: 0,
        kyc_status: "verified",
        created_at: now,
        updated_at: now,
      }
    ];

    // 2. PROPERTIES
    this.properties = [
      {
        id: "prop-sf-grand-bay",
        owner_id: "user-owner-1",
        assigned_host_id: "user-host-1",
        title: "The Grand Bay Architectural Villa",
        description: "An iconic modern villa overlooking San Francisco Bay with floor-to-ceiling glass, radiant heated floors, a chef's kitchen, and a private infinity spa deck.",
        address_json: { address: "1420 Montgomery St", city: "San Francisco", state: "CA", zipCode: "94133", country: "USA" },
        latitude: 37.7989,
        longitude: -122.4042,
        bedrooms: 4,
        bathrooms: 3.5,
        max_guests: 8,
        amenities: ["Ocean View", "Private Hot Tub", "Chef Kitchen", "EV Charger", "High-Speed WiFi", "Wine Cellar", "Sauna"],
        base_price_minor: dollarsToCents(650),
        min_price_minor: dollarsToCents(450),
        max_price_minor: dollarsToCents(1200),
        currency: "USD",
        cleaning_fee_minor: dollarsToCents(220),
        status: "managed",
        photos: [
          "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=1000&auto=format&fit=crop&q=80",
          "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=1000&auto=format&fit=crop&q=80",
          "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=1000&auto=format&fit=crop&q=80",
          "https://images.unsplash.com/photo-1600566753376-12c8ab7fb75b?w=1000&auto=format&fit=crop&q=80"
        ],
        cover_photo: "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=1000&auto=format&fit=crop&q=80",
        vision_status: "complete",
        vision_analyzed_at: "2026-08-01T14:20:00Z",
        vision_model: "gemini-3.6-flash",
        vision_analysis: {
          quality_tier: "luxury",
          condition_score: 9,
          interior_modernity_score: 10,
          curb_appeal_score: 9,
          notable_features: ["Floor-to-ceiling glass facade", "Panoramic bay bridge view", "Marble waterfall island", "Custom lighting design"],
          red_flags: [],
          aesthetic_vibe: "modern_minimalist",
          estimated_size_bracket: "spacious",
          lighting_quality: "exceptional",
          visual_justification: "High contrast architectural geometry with flood of natural ambient sunlight and pristine premium surface materials.",
          confidence: "high",
          highlights: [
            "Breathtaking 180-degree San Francisco Bay & skyline views",
            "State-of-the-art designer kitchen with Sub-Zero appliances",
            "Exclusive heated infinity spa deck overlooking the city"
          ]
        },
        created_at: now,
        updated_at: now,
      },
      {
        id: "prop-malibu-sanctuary",
        owner_id: "user-owner-1",
        assigned_host_id: "user-host-1",
        title: "Malibu Oceanfront Glass Sanctuary",
        description: "Direct beachfront modern masterpiece sitting directly on Carbon Beach. Features private beach access, expansive teak deck, outdoor fireplace, and sound system.",
        address_json: { address: "22108 Pacific Coast Hwy", city: "Malibu", state: "CA", zipCode: "90265", country: "USA" },
        latitude: 34.0381,
        longitude: -118.6774,
        bedrooms: 5,
        bathrooms: 5.0,
        max_guests: 10,
        amenities: ["Private Beach Access", "Oceanfront Deck", "Outdoor Firepit", "Sonos Sound", "Sub-Zero Bar", "Security System"],
        base_price_minor: dollarsToCents(1250),
        min_price_minor: dollarsToCents(850),
        max_price_minor: dollarsToCents(2500),
        currency: "USD",
        cleaning_fee_minor: dollarsToCents(350),
        status: "managed",
        photos: [
          "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=1000&auto=format&fit=crop&q=80",
          "https://images.unsplash.com/photo-1613977257363-707ba9348227?w=1000&auto=format&fit=crop&q=80",
          "https://images.unsplash.com/photo-1613490493576-7fde63acd811?w=1000&auto=format&fit=crop&q=80"
        ],
        cover_photo: "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=1000&auto=format&fit=crop&q=80",
        vision_status: "complete",
        vision_analyzed_at: "2026-08-02T10:00:00Z",
        vision_model: "gemini-3.6-flash",
        vision_analysis: {
          quality_tier: "luxury",
          condition_score: 10,
          interior_modernity_score: 9,
          curb_appeal_score: 10,
          notable_features: ["Direct Pacific ocean frontage", "Private stairs to beach sand", "Teak lounge deck"],
          red_flags: [],
          aesthetic_vibe: "coastal_breeze",
          estimated_size_bracket: "palatial",
          lighting_quality: "exceptional",
          visual_justification: "Unobstructed coastal panorama with premium organic wood and stone accents.",
          confidence: "high",
          highlights: [
            "Direct footsteps to private ocean tidepools and golden sand",
            "Panoramic sunset terrace with gas fire bowl",
            "Master suite featuring soaking tub with ocean soundscape"
          ]
        },
        created_at: now,
        updated_at: now,
      },
      {
        id: "prop-aspen-chalet",
        owner_id: "user-owner-2",
        assigned_host_id: "user-host-2",
        title: "Aspen Alpine Glass Chalet",
        description: "Ski-in/ski-out luxury timber frame chalet near Ajax Mountain. Features outdoor heated plunge pool, stone fireplace, sauna, and ski storage room.",
        address_json: { address: "710 Red Mountain Rd", city: "Aspen", state: "CO", zipCode: "81611", country: "USA" },
        latitude: 39.1911,
        longitude: -106.8175,
        bedrooms: 3,
        bathrooms: 2.5,
        max_guests: 6,
        amenities: ["Ski-In/Ski-Out", "Heated Plunge Pool", "Cedar Sauna", "Stone Fireplace", "Boot Warmers", "Mountain Views"],
        base_price_minor: dollarsToCents(850),
        min_price_minor: dollarsToCents(550),
        max_price_minor: dollarsToCents(1800),
        currency: "USD",
        cleaning_fee_minor: dollarsToCents(250),
        status: "managed",
        photos: [
          "https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?w=1000&auto=format&fit=crop&q=80",
          "https://images.unsplash.com/photo-1510798831971-661eb04b3739?w=1000&auto=format&fit=crop&q=80"
        ],
        cover_photo: "https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?w=1000&auto=format&fit=crop&q=80",
        vision_status: "complete",
        vision_analysis: {
          quality_tier: "premium",
          condition_score: 9,
          interior_modernity_score: 8,
          curb_appeal_score: 9,
          notable_features: ["Exposed timber beams", "Custom stone fireplace", "Year-round heated plunge pool"],
          red_flags: [],
          aesthetic_vibe: "cozy_rustic",
          estimated_size_bracket: "spacious",
          lighting_quality: "bright_natural",
          visual_justification: "Warm timber construction paired with modern glass openings framing snow-capped peaks.",
          confidence: "high",
          highlights: [
            "Instant ski-in access directly to Ajax slopes",
            "Heated cedar sauna & year-round plunge pool",
            "Grand great room with floor-to-ceiling stone hearth"
          ]
        },
        created_at: now,
        updated_at: now,
      },
      {
        id: "prop-soho-loft",
        owner_id: "user-owner-1",
        title: "SoHo Designer Penthouse Loft",
        description: "Cast-iron building penthouse with private key elevator, 14ft ceilings, exposed brick, skylights, and lush rooftop garden garden.",
        address_json: { address: "480 Broome St", city: "New York", state: "NY", zipCode: "10013", country: "USA" },
        latitude: 40.7233,
        longitude: -74.0030,
        bedrooms: 2,
        bathrooms: 2.0,
        max_guests: 4,
        amenities: ["Private Elevator", "Private Rooftop Garden", "Exposed Brick", "14ft Ceilings", "Sonos", "Chef Stove"],
        base_price_minor: dollarsToCents(520),
        min_price_minor: dollarsToCents(380),
        max_price_minor: dollarsToCents(950),
        currency: "USD",
        cleaning_fee_minor: dollarsToCents(180),
        status: "pending_host",
        photos: [
          "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=1000&auto=format&fit=crop&q=80",
          "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=1000&auto=format&fit=crop&q=80"
        ],
        cover_photo: "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=1000&auto=format&fit=crop&q=80",
        vision_status: "complete",
        vision_analysis: {
          quality_tier: "premium",
          condition_score: 9,
          interior_modernity_score: 9,
          curb_appeal_score: 8,
          notable_features: ["Exposed original brick", "Skylights", "Private planted rooftop terrace"],
          red_flags: [],
          aesthetic_vibe: "urban_industrial",
          estimated_size_bracket: "medium",
          lighting_quality: "exceptional",
          visual_justification: "Classic SoHo architectural heritage combined with high-end contemporary art and lighting.",
          confidence: "high",
          highlights: [
            "Private key-coded elevator opening directly into loft",
            "Secluded private rooftop oasis overlooking downtown Manhattan",
            "Soaring 14-foot architectural timber ceilings"
          ]
        },
        created_at: now,
        updated_at: now,
      }
    ];

    // Initialize Pricing Rules
    this.properties.forEach(p => {
      this.pricingRules.set(p.id, {
        property_id: p.id,
        auto_apply: true,
        auto_apply_threshold_pct: 15,
        enable_event_pricing: true,
        enable_seasonality: true,
        enable_vision_adjust: true,
        enable_weather: true,
        floor_price_minor: p.min_price_minor,
        ceiling_price_minor: p.max_price_minor,
        updated_at: now,
      });
    });

    // 3. BOOKINGS
    this.bookings = [
      {
        id: "book-001",
        property_id: "prop-sf-grand-bay",
        guest_id: "user-guest-1",
        owner_id: "user-owner-1",
        host_id: "user-host-1",
        checkin: "2026-08-15",
        checkout: "2026-08-18",
        nights: 3,
        guests_count: 4,
        per_night_rate_minor: dollarsToCents(650),
        nightly_subtotal_minor: dollarsToCents(1950),
        cleaning_fee_minor: dollarsToCents(220),
        taxes_minor: dollarsToCents(217),
        total_amount_minor: dollarsToCents(2387),
        currency: "USD",
        status: "confirmed",
        stripe_payment_intent_id: "pi_3N99sfGrandBayMock",
        cancellation_policy_key: "Moderate",
        cancellation_policy_version: 1,
        cancellation_policy_snapshot: { name: "Moderate", refund24h: 100, refund5d: 100 },
        created_at: "2026-08-01T12:00:00Z",
        updated_at: now,
      },
      {
        id: "book-002",
        property_id: "prop-malibu-sanctuary",
        guest_id: "user-guest-2",
        owner_id: "user-owner-1",
        host_id: "user-host-1",
        checkin: "2026-07-10",
        checkout: "2026-07-14",
        nights: 4,
        guests_count: 2,
        per_night_rate_minor: dollarsToCents(1250),
        nightly_subtotal_minor: dollarsToCents(5000),
        cleaning_fee_minor: dollarsToCents(350),
        taxes_minor: dollarsToCents(535),
        total_amount_minor: dollarsToCents(5885),
        currency: "USD",
        status: "completed",
        stripe_payment_intent_id: "pi_3N88MalibuCompletedMock",
        cancellation_policy_key: "Strict",
        cancellation_policy_version: 1,
        cancellation_policy_snapshot: { name: "Strict" },
        created_at: "2026-07-01T10:00:00Z",
        updated_at: now,
      }
    ];

    // 4. INSPECTIONS
    this.bookingInspections = [
      {
        id: "insp-001-in",
        booking_id: "book-001",
        kind: "check_in",
        photos: [
          "https://images.unsplash.com/photo-1600566753376-12c8ab7fb75b?w=800&auto=format&fit=crop&q=80",
          "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800&auto=format&fit=crop&q=80"
        ],
        notes: "Check-in inspection confirmed clean living surfaces and undamaged hardwood flooring.",
        submitted_by: "user-host-1",
        submitted_at: "2026-08-15T15:00:00Z",
      }
    ];

    // 5. PAYOUTS
    const split = calculatePayoutSplit(dollarsToCents(1950), 82, 15, 3);
    this.payouts = [
      {
        id: "payout-001",
        booking_id: "book-001",
        owner_id: "user-owner-1",
        host_id: "user-host-1",
        settlement_base_minor: split.settlementBaseMinor,
        owner_amount_minor: split.ownerAmountMinor,
        host_amount_minor: split.hostAmountMinor,
        platform_amount_minor: split.platformAmountMinor,
        owner_pct_snapshot: split.ownerPctSnapshot,
        host_pct_snapshot: split.hostPctSnapshot,
        platform_pct_snapshot: split.platformPctSnapshot,
        currency: "USD",
        status: "held",
        releasable_at: "2026-08-19T11:00:00Z",
        created_at: "2026-08-01T12:05:00Z",
      }
    ];

    // 6. HOST APPLICATIONS
    this.hostApplications = [
      {
        id: "app-soho-1",
        property_id: "prop-soho-loft",
        host_id: "user-host-1",
        status: "applied",
        proposed_fee_pct: 15,
        pitch_text: "I manage 5 luxury urban lofts with 99% 5-star ratings and 24/7 guest concierges.",
        ai_match_score: 94,
        ai_match_reasoning: "Host demonstrates extensive experience in top-tier metro markets and high hospitality scores.",
        ai_model: "gemini-3.6-flash",
        ai_scored_at: "2026-08-05T10:00:00Z",
        created_at: "2026-08-05T09:30:00Z",
      }
    ];

    // 7. REVIEWS
    this.reviews = [
      {
        id: "rev-001",
        booking_id: "book-001",
        reviewer_id: "user-guest-1",
        target_type: "property",
        target_id: "prop-sf-grand-bay",
        rating: 5,
        comment: "Spectacular stay! The panoramic Bay views from the infinity spa terrace were unbelievable. Elena (co-host) was incredibly responsive and made check-in seamless.",
        created_at: "2026-08-18T14:30:00Z",
        reviewer_name: "Alex Rivera",
        reviewer_avatar: "https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=150&auto=format&fit=crop&q=80"
      },
      {
        id: "rev-002",
        booking_id: "book-002",
        reviewer_id: "user-guest-2",
        target_type: "property",
        target_id: "prop-malibu-sanctuary",
        rating: 5,
        comment: "A true oceanfront dream. Waking up to waves at Carbon Beach was magic. Impeccably clean, stylish modern interior, and great sound system.",
        created_at: "2026-07-15T09:10:00Z",
        reviewer_name: "Chloe Bennett",
        reviewer_avatar: "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150&auto=format&fit=crop&q=80"
      },
      {
        id: "rev-003",
        booking_id: "book-003",
        reviewer_id: "user-guest-1",
        target_type: "property",
        target_id: "prop-aspen-chalet",
        rating: 5,
        comment: "Fantastic ski-in/ski-out location! The cedar sauna and heated plunge pool were amazing after a full day on the Ajax slopes.",
        created_at: "2026-03-05T18:00:00Z",
        reviewer_name: "Alex Rivera",
        reviewer_avatar: "https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=150&auto=format&fit=crop&q=80"
      }
    ];

    // 8. AUDIT LOGS
    this.auditLogs = [
      {
        id: 1,
        actor_id: "user-owner-1",
        action: "PROPERTY_CREATE",
        entity_type: "property",
        entity_id: "prop-sf-grand-bay",
        new_values: { title: "The Grand Bay Architectural Villa" },
        created_at: now,
      },
      {
        id: 2,
        actor_id: "user-admin-1",
        action: "KYC_VERIFIED",
        entity_type: "profile",
        entity_id: "user-host-1",
        created_at: now,
      }
    ];

    // 9. WISHLISTS
    this.wishlists = [
      {
        id: "wishlist-1",
        user_id: "user-owner-1",
        title: "My Favorites",
        description: "My top saved properties for future stays and co-hosting inspiration.",
        property_ids: ["prop-sf-grand-bay", "prop-malibu-glasshouse"],
        created_at: now,
        updated_at: now,
      },
      {
        id: "wishlist-2",
        user_id: "user-owner-1",
        title: "Dublin July 2027",
        description: "Planned summer trip to Ireland and European getaways.",
        property_ids: ["prop-aspen-chalet"],
        created_at: now,
        updated_at: now,
      }
    ];
  }

  // --- PERSONA MANAGEMENT ---
  public getActiveUserId(): string {
    return this.activeUserId;
  }

  public setActiveUserId(userId: string) {
    this.activeUserId = userId;
  }

  public getActiveProfile(): Profile {
    return this.profiles.find(p => p.id === this.activeUserId) || this.profiles[0];
  }

  // --- PROFILES ---
  public getAllProfiles(): Profile[] {
    return [...this.profiles];
  }

  public getProfileById(id: string): Profile | undefined {
    return this.profiles.find(p => p.id === id);
  }

  public updateProfile(id: string, updates: Partial<Profile>): Profile {
    const p = this.getProfileById(id);
    if (!p) throw new Error("Profile not found");
    Object.assign(p, updates, { updated_at: new Date().toISOString() });
    this.addAuditLog(id, "PROFILE_UPDATE", "profile", id, updates);
    return { ...p };
  }

  // --- PROPERTIES ---
  public getProperties(filters?: { city?: string; maxPrice?: number; bedrooms?: number; hostAvailable?: boolean }): Property[] {
    let result = [...this.properties];
    if (filters?.city) {
      const q = filters.city.toLowerCase();
      result = result.filter(p => p.address_json.city?.toLowerCase().includes(q) || p.title.toLowerCase().includes(q));
    }
    if (filters?.maxPrice) {
      const maxCents = dollarsToCents(filters.maxPrice);
      result = result.filter(p => p.base_price_minor <= maxCents);
    }
    if (filters?.bedrooms) {
      result = result.filter(p => p.bedrooms >= filters.bedrooms!);
    }
    if (filters?.hostAvailable) {
      result = result.filter(p => p.status === 'pending_host');
    }

    return result.map(p => this.enrichProperty(p));
  }

  public getPropertyById(id: string): Property | undefined {
    const p = this.properties.find(prop => prop.id === id);
    if (!p) return undefined;
    return this.enrichProperty(p);
  }

  private enrichProperty(p: Property): Property {
    const owner = this.getProfileById(p.owner_id);
    const host = p.assigned_host_id ? this.getProfileById(p.assigned_host_id) : undefined;
    
    const propReviews = this.reviews.filter(r => r.target_type === 'property' && r.target_id === p.id);
    const review_count = propReviews.length;
    const rating_avg = review_count > 0 
      ? Number((propReviews.reduce((sum, r) => sum + r.rating, 0) / review_count).toFixed(1))
      : 5.0;

    const activeHost = host || owner;
    const is_superhost = activeHost 
      ? Boolean((activeHost.rating_avg && activeHost.rating_avg >= 4.85) || activeHost.role === 'host')
      : false;
    const is_verified_host = activeHost ? activeHost.kyc_status === 'verified' : false;

    return {
      ...p,
      owner_name: owner?.full_name,
      host_name: host?.full_name || owner?.full_name,
      host_avatar: host?.avatar_path || owner?.avatar_path,
      is_superhost,
      is_verified_host,
      host_rating_avg: activeHost?.rating_avg || rating_avg,
      rating_avg,
      review_count,
    };
  }

  public createProperty(propertyData: Partial<Property>): Property {
    const now = new Date().toISOString();
    const id = `prop-${Date.now()}`;
    const newProp: Property = {
      id,
      owner_id: propertyData.owner_id || this.activeUserId,
      title: propertyData.title || "Untitled Property",
      description: propertyData.description || "",
      address_json: propertyData.address_json || { city: "San Francisco", state: "CA" },
      latitude: propertyData.latitude || 37.7749,
      longitude: propertyData.longitude || -122.4194,
      bedrooms: propertyData.bedrooms || 1,
      bathrooms: propertyData.bathrooms || 1,
      max_guests: propertyData.max_guests || 2,
      amenities: propertyData.amenities || ["WiFi"],
      base_price_minor: propertyData.base_price_minor || dollarsToCents(200),
      min_price_minor: propertyData.min_price_minor || dollarsToCents(120),
      max_price_minor: propertyData.max_price_minor || dollarsToCents(500),
      currency: "USD",
      cleaning_fee_minor: propertyData.cleaning_fee_minor || dollarsToCents(100),
      status: propertyData.status || "listed",
      photos: propertyData.photos || ["https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=1000&auto=format&fit=crop&q=80"],
      cover_photo: propertyData.cover_photo || propertyData.photos?.[0],
      vision_status: "pending",
      created_at: now,
      updated_at: now,
    };

    this.properties.unshift(newProp);
    this.pricingRules.set(id, {
      property_id: id,
      auto_apply: true,
      auto_apply_threshold_pct: 15,
      enable_event_pricing: true,
      enable_seasonality: true,
      enable_vision_adjust: true,
      enable_weather: true,
      floor_price_minor: newProp.min_price_minor,
      ceiling_price_minor: newProp.max_price_minor,
      updated_at: now,
    });

    this.addAuditLog(newProp.owner_id, "PROPERTY_CREATE", "property", id, { title: newProp.title });
    return this.enrichProperty(newProp);
  }

  public updateProperty(id: string, updates: Partial<Property>): Property {
    const p = this.properties.find(prop => prop.id === id);
    if (!p) throw new Error("Property not found");
    Object.assign(p, updates, { updated_at: new Date().toISOString() });
    this.addAuditLog(this.activeUserId, "PROPERTY_UPDATE", "property", id, updates);
    return this.enrichProperty(p);
  }

  // --- BOOKINGS & GiST EXCLUSION CONSTRAINT ---
  public checkAvailability(propertyId: string, checkin: string, checkout: string): boolean {
    const start = new Date(checkin).getTime();
    const end = new Date(checkout).getTime();

    // Check existing active bookings
    const activeBookings = this.bookings.filter(
      b => b.property_id === propertyId && ['reserved', 'confirmed', 'checked_in', 'checked_out', 'completed'].includes(b.status)
    );

    for (const b of activeBookings) {
      const bStart = new Date(b.checkin).getTime();
      const bEnd = new Date(b.checkout).getTime();
      // Overlap condition: [start, end) intersects [bStart, bEnd)
      if (start < bEnd && end > bStart) {
        return false; // Overlap detected!
      }
    }

    // Check manual availability blocks
    const blocks = this.availabilityBlocks.filter(a => a.property_id === propertyId);
    for (const block of blocks) {
      const bStart = new Date(block.start_date).getTime();
      const bEnd = new Date(block.end_date).getTime();
      if (start < bEnd && end > bStart) {
        return false;
      }
    }

    return true;
  }

  public createBooking(bookingData: Partial<Booking>): Booking {
    if (!bookingData.property_id || !bookingData.checkin || !bookingData.checkout) {
      throw new Error("Missing required booking fields");
    }

    // Enforce PostgreSQL GiST exclusion constraint logic!
    const isAvailable = this.checkAvailability(bookingData.property_id, bookingData.checkin, bookingData.checkout);
    if (!isAvailable) {
      throw new Error("DOUBLE_BOOKING_PREVENTED: Property is not available for requested dates");
    }

    const property = this.getPropertyById(bookingData.property_id);
    if (!property) throw new Error("Property not found");

    const checkinDate = new Date(bookingData.checkin);
    const checkoutDate = new Date(bookingData.checkout);
    const nights = Math.max(1, Math.round((checkoutDate.getTime() - checkinDate.getTime()) / (1000 * 60 * 60 * 24)));

    const perNightRate = bookingData.per_night_rate_minor || property.base_price_minor;
    const subtotal = perNightRate * nights;
    const cleaningFee = property.cleaning_fee_minor;
    const taxes = Math.round((subtotal + cleaningFee) * 0.10); // 10% tax
    const totalAmount = subtotal + cleaningFee + taxes;

    const now = new Date().toISOString();
    const id = `book-${Date.now()}`;

    const newBooking: Booking = {
      id,
      property_id: property.id,
      guest_id: bookingData.guest_id || this.activeUserId,
      owner_id: property.owner_id,
      host_id: property.assigned_host_id,
      checkin: bookingData.checkin,
      checkout: bookingData.checkout,
      nights,
      guests_count: bookingData.guests_count || 1,
      per_night_rate_minor: perNightRate,
      nightly_subtotal_minor: subtotal,
      cleaning_fee_minor: cleaningFee,
      taxes_minor: taxes,
      total_amount_minor: totalAmount,
      currency: "USD",
      status: "confirmed",
      stripe_payment_intent_id: `pi_${Date.now()}`,
      cancellation_policy_key: "Moderate",
      cancellation_policy_version: 1,
      cancellation_policy_snapshot: { name: "Moderate", refund24h: 100 },
      created_at: now,
      updated_at: now,
    };

    this.bookings.unshift(newBooking);

    // Automatically create held payout record
    const split = calculatePayoutSplit(subtotal, 82, property.assigned_host_id ? 15 : 0, property.assigned_host_id ? 3 : 18);
    this.payouts.unshift({
      id: `payout-${Date.now()}`,
      booking_id: id,
      owner_id: property.owner_id,
      host_id: property.assigned_host_id,
      settlement_base_minor: split.settlementBaseMinor,
      owner_amount_minor: split.ownerAmountMinor,
      host_amount_minor: split.hostAmountMinor,
      platform_amount_minor: split.platformAmountMinor,
      owner_pct_snapshot: split.ownerPctSnapshot,
      host_pct_snapshot: split.hostPctSnapshot,
      platform_pct_snapshot: split.platformPctSnapshot,
      currency: "USD",
      status: "held",
      releasable_at: new Date(checkoutDate.getTime() + 24 * 60 * 60 * 1000).toISOString(), // 24h after checkout
      created_at: now,
    });

    this.addAuditLog(newBooking.guest_id, "BOOKING_CREATED", "booking", id, { total: totalAmount });
    return this.enrichBooking(newBooking);
  }

  public getBookingsForUser(userId: string): Booking[] {
    return this.bookings
      .filter(b => b.guest_id === userId || b.owner_id === userId || b.host_id === userId)
      .map(b => this.enrichBooking(b));
  }

  public getBookingById(id: string): Booking | undefined {
    const b = this.bookings.find(book => book.id === id);
    if (!b) return undefined;
    return this.enrichBooking(b);
  }

  private enrichBooking(b: Booking): Booking {
    const prop = this.properties.find(p => p.id === b.property_id);
    const guest = this.getProfileById(b.guest_id);
    const owner = this.getProfileById(b.owner_id);
    const host = b.host_id ? this.getProfileById(b.host_id) : undefined;

    return {
      ...b,
      property_title: prop?.title,
      property_cover: prop?.cover_photo,
      guest_name: guest?.full_name,
      owner_name: owner?.full_name,
      host_name: host?.full_name,
    };
  }

  // --- INSPECTIONS ---
  public addInspection(inspection: Partial<BookingInspection>): BookingInspection {
    const now = new Date().toISOString();
    const newInsp: BookingInspection = {
      id: `insp-${Date.now()}`,
      booking_id: inspection.booking_id!,
      kind: inspection.kind || "check_in",
      photos: inspection.photos || [],
      notes: inspection.notes || "",
      submitted_by: inspection.submitted_by || this.activeUserId,
      submitted_at: now,
    };
    this.bookingInspections.push(newInsp);
    return newInsp;
  }

  public getInspectionsForBooking(bookingId: string): BookingInspection[] {
    return this.bookingInspections.filter(i => i.booking_id === bookingId);
  }

  // --- DISPUTES (Automatically Freezes Payout!) ---
  public createDispute(disputeData: Partial<Dispute>): Dispute {
    const now = new Date().toISOString();
    const id = `disp-${Date.now()}`;
    const newDispute: Dispute = {
      id,
      booking_id: disputeData.booking_id!,
      claimant_id: disputeData.claimant_id || this.activeUserId,
      respondent_id: disputeData.respondent_id!,
      amount_claimed_minor: disputeData.amount_claimed_minor || dollarsToCents(300),
      description: disputeData.description || "Claim regarding property condition after check-out.",
      status: "open",
      created_at: now,
    };

    this.disputes.unshift(newDispute);

    // CRITICAL: Dispute automatically freezes payout according to trigger freeze_payout_on_dispute()
    const payout = this.payouts.find(p => p.booking_id === disputeData.booking_id);
    if (payout) {
      payout.status = "frozen";
    }

    this.addAuditLog(newDispute.claimant_id, "DISPUTE_OPENED", "dispute", id, { booking_id: newDispute.booking_id });
    return this.enrichDispute(newDispute);
  }

  public getDisputes(): Dispute[] {
    return this.disputes.map(d => this.enrichDispute(d));
  }

  private enrichDispute(d: Dispute): Dispute {
    const b = this.getBookingById(d.booking_id);
    const claimant = this.getProfileById(d.claimant_id);
    const respondent = this.getProfileById(d.respondent_id);

    return {
      ...d,
      property_title: b?.property_title,
      claimant_name: claimant?.full_name,
      respondent_name: respondent?.full_name,
    };
  }

  public resolveDispute(id: string, decision: string, awardClaimantMinor: number): Dispute {
    const d = this.disputes.find(disp => disp.id === id);
    if (!d) throw new Error("Dispute not found");

    d.status = "resolved";
    d.admin_decision = decision;
    d.admin_award_claimant_minor = awardClaimantMinor;
    d.resolved_by = this.activeUserId;
    d.resolved_at = new Date().toISOString();

    // Unfreeze or update payout accordingly
    const payout = this.payouts.find(p => p.booking_id === d.booking_id);
    if (payout) {
      payout.status = "releasable";
    }

    this.addAuditLog(this.activeUserId, "DISPUTE_RESOLVED", "dispute", id, { decision, awardClaimantMinor });
    return this.enrichDispute(d);
  }

  // --- HOST APPLICATIONS ---
  public applyToHost(appData: Partial<HostApplication>): HostApplication {
    const now = new Date().toISOString();

    // Enforce KYC requirement!
    const hostProfile = this.getProfileById(appData.host_id || this.activeUserId);
    if (!hostProfile || hostProfile.kyc_status !== 'verified') {
      throw new Error("HOST_NOT_VERIFIED: Host must complete KYC verification before applying to manage properties");
    }

    const id = `app-${Date.now()}`;
    const newApp: HostApplication = {
      id,
      property_id: appData.property_id!,
      host_id: hostProfile.id,
      status: "applied",
      proposed_fee_pct: appData.proposed_fee_pct || 15,
      pitch_text: appData.pitch_text || "",
      created_at: now,
    };

    this.hostApplications.unshift(newApp);
    this.addAuditLog(hostProfile.id, "HOST_APPLICATION_SUBMITTED", "host_application", id, { property_id: newApp.property_id });
    return this.enrichHostApplication(newApp);
  }

  public getHostApplications(propertyId?: string): HostApplication[] {
    let result = [...this.hostApplications];
    if (propertyId) {
      result = result.filter(a => a.property_id === propertyId);
    }
    return result.map(a => this.enrichHostApplication(a));
  }

  private enrichHostApplication(a: HostApplication): HostApplication {
    const host = this.getProfileById(a.host_id);
    const prop = this.getPropertyById(a.property_id);
    return {
      ...a,
      host_name: host?.full_name,
      host_avatar: host?.avatar_path,
      host_rating: host?.rating_avg,
      property_title: prop?.title,
    };
  }

  // --- REVIEWS ---
  public getReviewsForProperty(propertyId: string): Review[] {
    return this.reviews
      .filter(r => r.target_type === 'property' && r.target_id === propertyId)
      .map(r => {
        const reviewer = this.getProfileById(r.reviewer_id);
        return {
          ...r,
          reviewer_name: r.reviewer_name || reviewer?.full_name || "Verified Guest",
          reviewer_avatar: r.reviewer_avatar || reviewer?.avatar_path,
        };
      });
  }

  public createReview(reviewData: Partial<Review>): Review {
    const now = new Date().toISOString();
    const reviewer = this.getProfileById(reviewData.reviewer_id || this.activeUserId);
    
    const rating = Math.min(5, Math.max(1, Math.round(reviewData.rating || 5)));
    const id = `rev-${Date.now()}`;
    
    const newReview: Review = {
      id,
      booking_id: reviewData.booking_id || `book-${Date.now()}`,
      reviewer_id: reviewer?.id || this.activeUserId,
      target_type: reviewData.target_type || "property",
      target_id: reviewData.target_id!,
      rating,
      comment: reviewData.comment || "",
      created_at: now,
      reviewer_name: reviewer?.full_name || "Verified Guest",
      reviewer_avatar: reviewer?.avatar_path,
    };

    this.reviews.unshift(newReview);
    this.addAuditLog(newReview.reviewer_id, "REVIEW_SUBMITTED", "review", id, { 
      property_id: newReview.target_id, 
      rating: newReview.rating 
    });

    return newReview;
  }

  // --- PAYOUTS & STRIPE CONNECT ---
  public getPayouts(): Payout[] {
    return this.payouts.map(p => {
      const owner = this.getProfileById(p.owner_id);
      const host = p.host_id ? this.getProfileById(p.host_id) : undefined;
      const booking = this.getBookingById(p.booking_id);
      return {
        ...p,
        owner_name: owner?.full_name,
        host_name: host?.full_name,
        property_title: booking?.property_title,
      };
    });
  }

  // --- N8N WORKFLOWS SUITE ---
  public getN8nWorkflows(): N8nWorkflow[] {
    return [
      { id: "1", name: "1. vision-property-analysis", description: "Triggers multimodal Gemini vision pipeline on photo changes.", lastRunStatus: "success", lastRunTime: "10 mins ago", triggerEvent: "property.photos.updated", nodesCount: 6 },
      { id: "2", name: "2. kyc-verification", description: "Verifies identity verification sessions & unlocks co-hosting.", lastRunStatus: "success", lastRunTime: "1 hour ago", triggerEvent: "stripe.identity.verified", nodesCount: 5 },
      { id: "3", name: "3. nightly-signals", description: "Collects local events, seasonality & occupancy signals.", lastRunStatus: "success", lastRunTime: "4 hours ago", triggerEvent: "cron.nightly", nodesCount: 8 },
      { id: "4", name: "4. pricing-engine", description: "Computes multi-layer dynamic price suggestions.", lastRunStatus: "success", lastRunTime: "15 mins ago", triggerEvent: "pricing.recompute", nodesCount: 9 },
      { id: "5", name: "5. host-application-matcher", description: "Generates advisory AI host-property match compatibility.", lastRunStatus: "success", lastRunTime: "2 hours ago", triggerEvent: "host_app.created", nodesCount: 5 },
      { id: "6", name: "6. booking-lifecycle", description: "Manages check-in/check-out notifications and inspection prompts.", lastRunStatus: "success", lastRunTime: "30 mins ago", triggerEvent: "booking.status_changed", nodesCount: 7 },
      { id: "7", name: "7. payout-release", description: "Processes delayed Stripe transfers 24h post checkout.", lastRunStatus: "idle", lastRunTime: "12 hours ago", triggerEvent: "cron.hourly", nodesCount: 6 },
      { id: "8", name: "8. dispute-intake", description: "Freezes payouts and runs AI visual inspection comparison.", lastRunStatus: "success", lastRunTime: "Yesterday", triggerEvent: "dispute.opened", nodesCount: 8 },
      { id: "9", name: "9. review-requests", description: "Prompts verified guests & co-hosts for stay reviews.", lastRunStatus: "idle", lastRunTime: "1 day ago", triggerEvent: "booking.completed", nodesCount: 4 },
      { id: "10", name: "10. guest-personalization", description: "Recommends properties based on vision highlights & preferences.", lastRunStatus: "success", lastRunTime: "5 mins ago", triggerEvent: "guest.search", nodesCount: 5 }
    ];
  }

  // --- WISHLISTS & FAVORITES ---
  public getWishlists(userId?: string): Wishlist[] {
    const uid = userId || this.activeUserId;
    let userLists = this.wishlists.filter(w => w.user_id === uid);

    // If user has no wishlists, ensure a default "My Favorites" list exists
    if (userLists.length === 0) {
      const defaultList: Wishlist = {
        id: `wishlist-${Date.now()}`,
        user_id: uid,
        title: "My Favorites",
        description: "Default saved properties list",
        property_ids: [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      this.wishlists.push(defaultList);
      userLists = [defaultList];
    }
    return userLists;
  }

  public createWishlist(userId: string, title: string, description?: string, initialPropertyId?: string): Wishlist {
    const now = new Date().toISOString();
    const newWishlist: Wishlist = {
      id: `wishlist-${Date.now()}`,
      user_id: userId,
      title: title.trim() || "New Wishlist",
      description: description || "",
      property_ids: initialPropertyId ? [initialPropertyId] : [],
      created_at: now,
      updated_at: now,
    };
    this.wishlists.push(newWishlist);
    this.addAuditLog(userId, "WISHLIST_CREATE", "wishlist", newWishlist.id, { title: newWishlist.title });
    return { ...newWishlist };
  }

  public togglePropertyInWishlist(wishlistId: string, propertyId: string): Wishlist | null {
    const list = this.wishlists.find(w => w.id === wishlistId);
    if (!list) return null;

    const idx = list.property_ids.indexOf(propertyId);
    if (idx >= 0) {
      list.property_ids.splice(idx, 1);
    } else {
      list.property_ids.push(propertyId);
    }
    list.updated_at = new Date().toISOString();
    this.addAuditLog(list.user_id, "WISHLIST_TOGGLE_ITEM", "wishlist", list.id, { propertyId, inList: idx < 0 });
    return { ...list };
  }

  public deleteWishlist(wishlistId: string): boolean {
    const idx = this.wishlists.findIndex(w => w.id === wishlistId);
    if (idx >= 0) {
      const deleted = this.wishlists.splice(idx, 1)[0];
      this.addAuditLog(deleted.user_id, "WISHLIST_DELETE", "wishlist", wishlistId);
      return true;
    }
    return false;
  }

  public isPropertyFavorited(userId: string, propertyId: string): boolean {
    const userLists = this.wishlists.filter(w => w.user_id === userId);
    return userLists.some(w => w.property_ids.includes(propertyId));
  }

  // --- AUDIT LOGS ---
  public addAuditLog(actorId: string, action: string, entityType?: string, entityId?: string, newValues?: any) {
    const actor = this.getProfileById(actorId);
    this.auditLogs.unshift({
      id: Date.now(),
      actor_id: actorId,
      action,
      entity_type: entityType,
      entity_id: entityId,
      new_values: newValues,
      created_at: new Date().toISOString(),
      actor_name: actor?.full_name || "System",
    });
  }

  public getAuditLogs(): AuditLog[] {
    return [...this.auditLogs];
  }
}

export const db = new NestDatabase();
