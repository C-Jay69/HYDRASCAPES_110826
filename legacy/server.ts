import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";
import { db } from "./src/lib/db.js";
import { analyzePropertyVision } from "./src/lib/ai/vision.js";
import { computePriceSuggestion } from "./src/lib/pricing/engine.js";
import { matchHostAndProperty } from "./src/lib/ai/matching.js";
import { assessDispute } from "./src/lib/ai/arbitration.js";
import { dollarsToCents } from "./src/lib/money.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: "10mb" }));

  // --- API ROUTES FIRST ---

  // 1. PERSONA / AUTH
  app.get("/api/me", (req, res) => {
    const profile = db.getActiveProfile();
    res.json({ activeUserId: db.getActiveUserId(), profile });
  });

  // Google OAuth URL endpoint
  app.get("/api/auth/google/url", (req, res) => {
    const appUrl = process.env.APP_URL || "https://ais-dev-yzawe4ozg2pgalbdwi3jpm-22932357557.us-east1.run.app";
    const redirectUri = `${appUrl}/auth/callback`;
    const clientId = process.env.GOOGLE_CLIENT_ID || "YOUR_GOOGLE_CLIENT_ID";

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: "openid email profile",
      access_type: "offline",
      prompt: "select_account",
    });

    const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
    res.json({
      url: googleAuthUrl,
      redirectUri,
      configured: Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_ID !== "YOUR_GOOGLE_CLIENT_ID"),
    });
  });

  // OAuth Callback Route
  app.get(["/auth/callback", "/auth/callback/"], (req, res) => {
    const { code } = req.query;
    res.send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Google OAuth Authorization Complete</title>
          <style>
            body { font-family: system-ui, sans-serif; background: #0B0F14; color: #F5F7FA; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; text-align: center; }
            .card { background: #1C242F; border: 1px solid #14B8A6; padding: 2rem; border-radius: 1rem; max-width: 400px; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5); }
            h2 { color: #5EEAD4; margin-bottom: 0.5rem; font-size: 1.25rem; }
            p { color: #B4BCC8; font-size: 0.875rem; }
          </style>
        </head>
        <body>
          <div class="card">
            <h2>Google OAuth Complete</h2>
            <p>Authentication authorization verified. Closing popup window...</p>
          </div>
          <script>
            if (window.opener) {
              window.opener.postMessage({ type: 'OAUTH_AUTH_SUCCESS', code: ${JSON.stringify(code || '')} }, '*');
              setTimeout(() => window.close(), 1200);
            } else {
              window.location.href = '/';
            }
          </script>
        </body>
      </html>
    `);
  });

  app.post("/api/me/switch-role", (req, res) => {
    const { userId } = req.body;
    if (userId) {
      db.setActiveUserId(userId);
    }
    res.json({ activeUserId: db.getActiveUserId(), profile: db.getActiveProfile() });
  });

  app.get("/api/profiles", (req, res) => {
    res.json(db.getAllProfiles());
  });

  // 2. PROPERTIES
  app.get("/api/properties", (req, res) => {
    const { city, maxPrice, bedrooms, hostAvailable } = req.query;
    const properties = db.getProperties({
      city: city as string,
      maxPrice: maxPrice ? Number(maxPrice) : undefined,
      bedrooms: bedrooms ? Number(bedrooms) : undefined,
      hostAvailable: hostAvailable === "true",
    });
    res.json(properties);
  });

  app.get("/api/properties/:id", (req, res) => {
    const property = db.getPropertyById(req.params.id);
    if (!property) return res.status(404).json({ error: "Property not found" });
    res.json(property);
  });

  app.post("/api/properties", (req, res) => {
    try {
      const property = db.createProperty(req.body);
      res.status(201).json(property);
    } catch (err: any) {
      res.status(400).json({ error: err?.message || "Failed to create property" });
    }
  });

  // Property Reviews
  app.get("/api/properties/:id/reviews", (req, res) => {
    const reviews = db.getReviewsForProperty(req.params.id);
    res.json(reviews);
  });

  app.post("/api/properties/:id/reviews", (req, res) => {
    try {
      const review = db.createReview({
        ...req.body,
        target_id: req.params.id,
        target_type: "property",
      });
      res.status(201).json(review);
    } catch (err: any) {
      res.status(400).json({ error: err?.message || "Failed to create review" });
    }
  });

  // 3. WISHLISTS & FAVORITES
  app.get("/api/wishlists", (req, res) => {
    const userId = (req.query.userId as string) || db.getActiveUserId();
    const wishlists = db.getWishlists(userId);
    res.json(wishlists);
  });

  app.post("/api/wishlists", (req, res) => {
    try {
      const { title, description, initialPropertyId } = req.body;
      const userId = db.getActiveUserId();
      const wishlist = db.createWishlist(userId, title, description, initialPropertyId);
      res.status(201).json(wishlist);
    } catch (err: any) {
      res.status(400).json({ error: err?.message || "Failed to create wishlist" });
    }
  });

  app.post("/api/wishlists/:id/toggle", (req, res) => {
    try {
      const { propertyId } = req.body;
      const updated = db.togglePropertyInWishlist(req.params.id, propertyId);
      if (!updated) return res.status(404).json({ error: "Wishlist not found" });
      res.json(updated);
    } catch (err: any) {
      res.status(400).json({ error: err?.message || "Failed to update wishlist" });
    }
  });

  app.delete("/api/wishlists/:id", (req, res) => {
    const success = db.deleteWishlist(req.params.id);
    if (!success) return res.status(404).json({ error: "Wishlist not found" });
    res.json({ status: "deleted" });
  });

  // Async Property Vision Analysis
  app.post("/api/properties/:id/analyze-vision", async (req, res) => {
    const property = db.getPropertyById(req.params.id);
    if (!property) return res.status(404).json({ error: "Property not found" });

    // Mark pending
    db.updateProperty(property.id, { vision_status: "processing" });

    try {
      const visionResult = await analyzePropertyVision(
        property.title,
        property.description,
        property.photos
      );

      const updated = db.updateProperty(property.id, {
        vision_analysis: visionResult,
        vision_status: "complete",
        vision_analyzed_at: new Date().toISOString(),
        vision_model: "gemini-3.6-flash",
      });

      res.json({ success: true, vision: visionResult, property: updated });
    } catch (err: any) {
      db.updateProperty(property.id, { vision_status: "failed" });
      res.status(500).json({ error: "Vision processing failed: " + err.message });
    }
  });

  // 3. PRICING QUOTE & REASONING TRACE
  app.post("/api/bookings/quote", async (req, res) => {
    const { propertyId, checkin, checkout } = req.body;
    const property = db.getPropertyById(propertyId);
    if (!property) return res.status(404).json({ error: "Property not found" });

    try {
      const suggestion = await computePriceSuggestion(property, checkin || new Date().toISOString().split("T")[0]);
      res.json({
        propertyId,
        checkin,
        checkout,
        suggestion,
        quote: {
          perNightRateMinor: suggestion.suggested_price_minor,
          cleaningFeeMinor: property.cleaning_fee_minor,
          basePriceMinor: property.base_price_minor,
          minPriceMinor: property.min_price_minor,
          maxPriceMinor: property.max_price_minor,
        }
      });
    } catch (err: any) {
      res.status(500).json({ error: "Pricing quote failed: " + err.message });
    }
  });

  // 4. BOOKINGS
  app.get("/api/bookings", (req, res) => {
    const bookings = db.getBookingsForUser(db.getActiveUserId());
    res.json(bookings);
  });

  app.post("/api/bookings", (req, res) => {
    try {
      const booking = db.createBooking(req.body);
      res.status(201).json(booking);
    } catch (err: any) {
      res.status(400).json({ error: err?.message || "Booking failed" });
    }
  });

  // Inspections
  app.post("/api/bookings/:id/inspections", (req, res) => {
    try {
      const insp = db.addInspection({
        ...req.body,
        booking_id: req.params.id,
        submitted_by: db.getActiveUserId(),
      });
      res.status(201).json(insp);
    } catch (err: any) {
      res.status(400).json({ error: err?.message || "Failed to submit inspection" });
    }
  });

  app.get("/api/bookings/:id/inspections", (req, res) => {
    const inspections = db.getInspectionsForBooking(req.params.id);
    res.json(inspections);
  });

  // 5. DISPUTES & AI ARBITRATION
  app.get("/api/disputes", (req, res) => {
    res.json(db.getDisputes());
  });

  app.post("/api/disputes", (req, res) => {
    try {
      const dispute = db.createDispute(req.body);
      res.status(201).json(dispute);
    } catch (err: any) {
      res.status(400).json({ error: err?.message || "Failed to open dispute" });
    }
  });

  app.post("/api/disputes/:id/assess", async (req, res) => {
    const disputes = db.getDisputes();
    const dispute = disputes.find(d => d.id === req.params.id);
    if (!dispute) return res.status(404).json({ error: "Dispute not found" });

    const inspections = db.getInspectionsForBooking(dispute.booking_id);
    const checkIn = inspections.find(i => i.kind === "check_in");
    const checkOut = inspections.find(i => i.kind === "check_out");

    try {
      const assessment = await assessDispute(
        checkIn?.photos || [],
        checkOut?.photos || [],
        dispute.description,
        dispute.amount_claimed_minor
      );

      dispute.ai_assessment = assessment;
      dispute.ai_model = "gemini-3.6-flash";
      dispute.ai_assessed_at = new Date().toISOString();

      res.json({ dispute, assessment });
    } catch (err: any) {
      res.status(500).json({ error: "AI Dispute Assessment failed: " + err.message });
    }
  });

  app.post("/api/disputes/:id/resolve", (req, res) => {
    const { decision, awardClaimantMinor } = req.body;
    try {
      const resolved = db.resolveDispute(req.params.id, decision || "Settled by Admin", awardClaimantMinor || 0);
      res.json(resolved);
    } catch (err: any) {
      res.status(400).json({ error: err?.message || "Failed to resolve dispute" });
    }
  });

  // 6. HOST APPLICATIONS & AI MATCHING
  app.get("/api/host-applications", (req, res) => {
    const { propertyId } = req.query;
    res.json(db.getHostApplications(propertyId as string));
  });

  app.post("/api/host-applications", (req, res) => {
    try {
      const app = db.applyToHost(req.body);
      res.status(201).json(app);
    } catch (err: any) {
      res.status(400).json({ error: err?.message || "Application failed" });
    }
  });

  app.post("/api/host-applications/:id/evaluate", async (req, res) => {
    const apps = db.getHostApplications();
    const application = apps.find(a => a.id === req.params.id);
    if (!application) return res.status(404).json({ error: "Application not found" });

    const host = db.getProfileById(application.host_id);
    const property = db.getPropertyById(application.property_id);
    if (!host || !property) return res.status(400).json({ error: "Invalid host or property" });

    try {
      const match = await matchHostAndProperty(
        host,
        property,
        application.proposed_fee_pct,
        application.pitch_text || ""
      );

      application.ai_match_score = match.score;
      application.ai_match_reasoning = match.reasoning;
      application.ai_model = "gemini-3.6-flash";
      application.ai_scored_at = new Date().toISOString();

      res.json({ application, match });
    } catch (err: any) {
      res.status(500).json({ error: "AI host evaluation failed: " + err.message });
    }
  });

  // 7. PAYOUTS & AUDIT LOGS
  app.get("/api/payouts", (req, res) => {
    res.json(db.getPayouts());
  });

  app.get("/api/admin/audit-logs", (req, res) => {
    res.json(db.getAuditLogs());
  });

  app.get("/api/admin/workflows", (req, res) => {
    res.json(db.getN8nWorkflows());
  });

  app.post("/api/admin/workflows/run", (req, res) => {
    const { workflowId } = req.body;
    db.addAuditLog(db.getActiveUserId(), "N8N_WORKFLOW_TRIGGERED", "workflow", workflowId);
    res.json({ success: true, message: `Workflow ${workflowId} executed successfully` });
  });

  // 8. STRIPE WEBHOOK SIMULATION
  app.post("/api/webhooks/stripe", (req, res) => {
    const event = req.body;
    db.addAuditLog("system", "STRIPE_WEBHOOK_RECEIVED", "webhook", event.id || "evt_mock");
    res.json({ received: true });
  });

  // --- VITE MIDDLEWARE FOR DEV / PRODUCTION SERVING ---
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Nest Marketplace Server running on http://localhost:${PORT}`);
  });
}

startServer();
