# Hydrascapes Marketplace External Infrastructure Costs Documentation

Last Verified: August 2026

## Service Cost Matrix

| Service | Free Tier Allowance | Trigger for Charges | Usage Alerts | Fallback Behavior |
| :--- | :--- | :--- | :--- | :--- |
| **Cloud Run / Host** | 2 Million requests / mo | High CPU/Memory bandwidth | Container autoscaling limits | Graceful HTTP 503 retry |
| **Gemini AI API** | Generous Developer Tier | High token throughput | Google AI Studio budget threshold | Fallback to deterministic pricing & matching |
| **Stripe Connect** | Pay-as-you-go test mode | 2.9% + 30¢ per transaction | Stripe Account Dashboard alerts | Queue retry & webhook reconciliation |
| **n8n Automation** | Self-hosted instance | Node execution CPU/RAM | Internal execution monitoring | Fail-safe retry queue |
| **Leaflet / OSM Tiles** | Free tile policy compliance | High map request volume | Tile server cache headers | Fallback fallback raster map render |
