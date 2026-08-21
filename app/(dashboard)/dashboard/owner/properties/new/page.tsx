"use client";

import { useState } from "react";
import { redirect } from "next/navigation";
import { getUser } from "@/app/lib/auth";
import { createClient } from "@/app/lib/supabase/server";

export default function OwnerPropertiesNewPage() {
  const { user, profile } = getUser();
  const supabase = createClient();

  if (!user || !profile) {
    redirect("/login");
  }

  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);

    const formData = new FormData(e.target as HTMLFormElement);
    const title = formData.get("title") as string;
    const description = formData.get("description") as string | null;
    const basePrice = formData.get("base_price") as string;
    const cleaningFee = formData.get("cleaning_fee") as string | null;
    const currency = formData.get("currency") as string || "USD";
    const bedrooms = Number(formData.get("bedrooms"));
    const bathrooms = Number(formData.get("bathrooms"));
    const maxGuests = Number(formData.get("max_guests"));

    if (!title || !basePrice || isNaN(bedrooms) || isNaN(bathrooms) || isNaN(maxGuests)) {
      alert("Please fill in all required fields");
      setSubmitting(false);
      return;
    }

    const basePriceMinor = BigInt(basePrice) * 100n;
    const cleaningFeeMinor = cleaningFee ? BigInt(cleaningFee) * 100n : 0n;

    const { error } = await supabase.from("properties").insert({
      owner_id: user.id,
      title,
      description,
      base_price_minor: basePriceMinor,
      min_price_minor: basePriceMinor,
      max_price_minor: basePriceMinor,
      currency,
      bedrooms,
      bathrooms,
      max_guests,
      status: "draft" as const,
      photos: [],
      cover_photo: null,
    });

    if (error) {
      console.error("Error creating property:", error);
      alert("Failed to create property. Please try again.");
      setSubmitting(false);
      return;
    }

    redirect("/dashboard/owner/properties");
  }

  return (
    <div className="max-w-2xl mx-auto py-12">
      <div className="bg-card rounded-2xl border border-divider p-8">
        <h1 className="text-2xl font-semibold tracking-tight mb-6">List New Property</h1>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Property Title
              </label>
              <input
                type="text"
                name="title"
                required
                className="w-full rounded-lg border border-divider px-4 py-3 bg-void text-void placeholder-foreground-muted focus:outline-none focus:ring-2 focus:ring-ember-500/20"
                placeholder="e.g. Modern Downtown Apartment"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Description
              </label>
              <textarea
                name="description"
                rows={3}
                className="w-full rounded-lg border border-divider px-4 py-3 bg-void text-void placeholder-foreground-muted focus:outline-none focus:ring-2 focus:ring-ember-500/20"
                placeholder="Describe your property..."
              ></textarea>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Nightly Price (USD)
              </label>
              <input
                type="number"
                name="base_price"
                min="1"
                required
                className="w-full rounded-lg border border-divider px-4 py-3 bg-void text-void placeholder-foreground-muted focus:outline-none focus:ring-2 focus:ring-ember-500/20"
                placeholder="e.g. 150"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Cleaning Fee (USD)
              </label>
              <input
                type="number"
                name="cleaning_fee"
                min="0"
                className="w-full rounded-lg border border-divider px-4 py-3 bg-void text-void placeholder-foreground-muted focus:outline-none focus:ring-2 focus:ring-ember-500/20"
                placeholder="e.g. 25"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Bedrooms
              </label>
              <input
                type="number"
                name="bedrooms"
                min="1"
                required
                className="w-full rounded-lg border border-divider px-4 py-3 bg-void text-void placeholder-foreground-muted focus:outline-none focus:ring-2 focus:ring-ember-500/20"
                defaultValue="1"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Bathrooms
              </label>
              <input
                type="number"
                name="bathrooms"
                min="1"
                required
                className="w-full rounded-lg border border-divider px-4 py-3 bg-void text-void placeholder-foreground-muted focus:outline-none focus:ring-2 focus:ring-ember-500/20"
                defaultValue="1"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Max Guests
              </label>
              <input
                type="number"
                name="max_guests"
                min="1"
                required
                className="w-full rounded-lg border border-divider px-4 py-3 bg-void text-void placeholder-foreground-muted focus:outline-none focus:ring-2 focus:ring-ember-500/20"
                defaultValue="2"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Currency
              </label>
              <select
                name="currency"
                className="w-full rounded-lg border border-divider px-4 py-3 bg-void text-void placeholder-foreground-muted focus:outline-none focus:ring-2 focus:ring-ember-500/20"
              >
                <option value="USD">USD ($)</option>
                <option value="EUR">EUR (€)</option>
                <option value="GBP">GBP (£)</option>
                <option value="CAD">CAD (C$)</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Status
              </label>
              <select
                name="status"
                className="w-full rounded-lg border border-divider px-4 py-3 bg-void text-void placeholder-foreground-muted focus:outline-none focus:ring-2 focus:ring-ember-500/20"
              >
                <option value="draft">Draft</option>
                <option value="listed">Listed</option>
              </select>
            </div>

            <div></div>
          </div>

          <div>
            <button
              type="submit"
              className="w-full rounded-lg bg-gradient-to-r from-ember-500 to-teal-500 px-6 py-3 text-base font-semibold text-void transition-colors hover:opacity-90"
              disabled={submitting}
            >
              {submitting ? "Creating..." : "Publish Property"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}