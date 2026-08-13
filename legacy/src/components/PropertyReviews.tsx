import React, { useState, useEffect } from 'react';
import { Star, MessageSquare, CheckCircle2, User, Send, ThumbsUp, Sparkles } from 'lucide-react';
import { Review } from '../types/nest.js';

interface PropertyReviewsProps {
  propertyId: string;
  propertyTitle?: string;
  onReviewAdded?: () => void;
}

export const PropertyReviews: React.FC<PropertyReviewsProps> = ({
  propertyId,
  propertyTitle,
  onReviewAdded,
}) => {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [rating, setRating] = useState(5);
  const [hoverRating, setHoverRating] = useState<number | null>(null);
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const fetchReviews = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/properties/${propertyId}/reviews`);
      if (res.ok) {
        const data = await res.json();
        setReviews(data);
      }
    } catch (err) {
      console.error('Failed to load reviews:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (propertyId) {
      fetchReviews();
    }
  }, [propertyId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!comment.trim()) return;

    try {
      setIsSubmitting(true);
      const res = await fetch(`/api/properties/${propertyId}/reviews`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rating,
          comment,
        }),
      });

      if (res.ok) {
        setComment('');
        setRating(5);
        setShowSuccess(true);
        setTimeout(() => setShowSuccess(false), 4000);
        await fetchReviews();
        if (onReviewAdded) onReviewAdded();
      }
    } catch (err) {
      console.error('Failed to submit review:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Compute stats
  const totalReviews = reviews.length;
  const avgRating = totalReviews > 0
    ? (reviews.reduce((acc, r) => acc + r.rating, 0) / totalReviews).toFixed(1)
    : '5.0';

  const ratingCounts = [5, 4, 3, 2, 1].map(star => {
    const count = reviews.filter(r => Math.round(r.rating) === star).length;
    const pct = totalReviews > 0 ? (count / totalReviews) * 100 : star === 5 ? 100 : 0;
    return { star, count, pct };
  });

  const ratingLabels: Record<number, string> = {
    5: 'Exceptional — Highly Recommended',
    4: 'Great — Very Satisfied',
    3: 'Average — Meets Expectations',
    2: 'Below Average — Minor Issues',
    1: 'Unsatisfactory — Major Concerns',
  };

  return (
    <div className="bg-[#1C242F] p-6 rounded-2xl border border-[#2A3441] space-y-6">
      {/* Header & Overall Summary */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-[#2A3441]">
        <div>
          <div className="flex items-center gap-2">
            <Star className="w-5 h-5 text-[#F5B841] fill-[#F5B841]" />
            <h3 className="font-bold text-lg text-[#F5F7FA]">Guest Reviews & Ratings</h3>
          </div>
          <p className="text-xs text-[#B4BCC8] mt-0.5">
            Verified post-stay guest feedback for {propertyTitle || 'this property'}
          </p>
        </div>

        {/* Overall Score Badge */}
        <div className="flex items-center gap-3 bg-[#0B0F14] px-4 py-2.5 rounded-xl border border-[#2A3441]">
          <div className="text-2xl font-black text-[#F5F7FA]">{avgRating}</div>
          <div>
            <div className="flex items-center gap-0.5">
              {[1, 2, 3, 4, 5].map(s => (
                <Star
                  key={s}
                  className={`w-3.5 h-3.5 ${
                    s <= Math.round(Number(avgRating))
                      ? 'text-[#F5B841] fill-[#F5B841]'
                      : 'text-[#2A3441]'
                  }`}
                />
              ))}
            </div>
            <div className="text-[11px] text-[#B4BCC8]">{totalReviews} {totalReviews === 1 ? 'review' : 'reviews'}</div>
          </div>
        </div>
      </div>

      {/* Rating Breakdown Bars */}
      {totalReviews > 0 && (
        <div className="bg-[#0B0F14] p-4 rounded-xl border border-[#2A3441] space-y-2">
          {ratingCounts.map(({ star, count, pct }) => (
            <div key={star} className="flex items-center gap-3 text-xs">
              <span className="w-12 text-[#B4BCC8] font-medium flex items-center gap-1">
                {star} <Star className="w-3 h-3 text-[#F5B841] fill-[#F5B841]" />
              </span>
              <div className="flex-1 bg-[#1C242F] h-2 rounded-full overflow-hidden">
                <div
                  className="bg-[#F5B841] h-full rounded-full transition-all duration-500"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className="w-8 text-right text-[11px] text-[#7A8494]">{count}</span>
            </div>
          ))}
        </div>
      )}

      {/* Write a Review Section */}
      <form onSubmit={handleSubmit} className="bg-[#0B0F14] p-5 rounded-xl border border-[#14B8A6]/30 space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="font-bold text-sm text-[#F5F7FA] flex items-center gap-1.5">
            <MessageSquare className="w-4 h-4 text-[#14B8A6]" />
            Leave a Guest Stay Review
          </h4>
          <span className="text-[11px] px-2 py-0.5 rounded bg-[#14B8A6]/20 text-[#5EEAD4] font-medium flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" /> Verified Guest
          </span>
        </div>

        {/* Star Rating Picker */}
        <div>
          <label className="text-xs text-[#B4BCC8] block mb-2 font-medium">Your Overall Rating</label>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map(s => {
                const currentRating = hoverRating !== null ? hoverRating : rating;
                const isFilled = s <= currentRating;
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setRating(s)}
                    onMouseEnter={() => setHoverRating(s)}
                    onMouseLeave={() => setHoverRating(null)}
                    className="p-1 hover:scale-110 transition-transform focus:outline-none"
                  >
                    <Star
                      className={`w-6 h-6 transition-colors ${
                        isFilled ? 'text-[#F5B841] fill-[#F5B841]' : 'text-[#2A3441] hover:text-[#F5B841]/50'
                      }`}
                    />
                  </button>
                );
              })}
            </div>
            <span className="text-xs text-[#FFB067] font-semibold ml-2">
              {ratingLabels[hoverRating !== null ? hoverRating : rating]}
            </span>
          </div>
        </div>

        {/* Text Review Comment */}
        <div>
          <label className="text-xs text-[#B4BCC8] block mb-1.5 font-medium">Review & Stay Experience</label>
          <textarea
            rows={3}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Describe your stay, property cleanliness, amenities, comfort, and host response time..."
            required
            className="w-full bg-[#1C242F] border border-[#2A3441] text-[#F5F7FA] text-xs rounded-xl p-3 focus:border-[#14B8A6] focus:outline-none transition-colors leading-relaxed placeholder-[#7A8494]"
          />
        </div>

        {showSuccess && (
          <div className="p-3 bg-[#14B8A6]/20 border border-[#14B8A6]/40 text-[#5EEAD4] rounded-xl text-xs flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[#14B8A6]" />
            Thank you! Your guest review has been published successfully.
          </div>
        )}

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={isSubmitting || !comment.trim()}
            className="px-5 py-2.5 bg-[#14B8A6] hover:bg-[#0D9488] text-black text-xs font-bold rounded-xl transition-all shadow-md shadow-[#14B8A6]/20 flex items-center gap-2 disabled:opacity-50"
          >
            <Send className="w-3.5 h-3.5" />
            {isSubmitting ? 'Publishing Review...' : 'Submit Review'}
          </button>
        </div>
      </form>

      {/* Review List */}
      <div className="space-y-3">
        <h4 className="text-xs font-bold text-[#FFB067] uppercase tracking-wider">Guest Feedback ({totalReviews})</h4>
        
        {loading ? (
          <div className="text-center py-6 text-xs text-[#7A8494]">Loading reviews...</div>
        ) : reviews.length === 0 ? (
          <div className="bg-[#0B0F14] p-6 rounded-xl border border-[#2A3441] text-center text-xs text-[#7A8494]">
            No reviews yet for this property. Be the first verified guest to leave feedback!
          </div>
        ) : (
          reviews.map(rev => (
            <div key={rev.id} className="bg-[#0B0F14] p-4 rounded-xl border border-[#2A3441] space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  {rev.reviewer_avatar ? (
                    <img
                      src={rev.reviewer_avatar}
                      alt={rev.reviewer_name}
                      className="w-7 h-7 rounded-full object-cover border border-[#2A3441]"
                    />
                  ) : (
                    <div className="w-7 h-7 rounded-full bg-[#14B8A6]/20 border border-[#14B8A6]/30 flex items-center justify-center text-[#5EEAD4] text-xs font-bold">
                      {rev.reviewer_name?.charAt(0) || 'G'}
                    </div>
                  )}
                  <div>
                    <div className="text-xs font-bold text-[#F5F7FA]">{rev.reviewer_name || 'Verified Guest'}</div>
                    <div className="text-[10px] text-[#7A8494]">
                      {new Date(rev.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1 bg-[#1C242F] px-2.5 py-1 rounded-lg border border-[#2A3441]">
                  {[1, 2, 3, 4, 5].map(s => (
                    <Star
                      key={s}
                      className={`w-3 h-3 ${
                        s <= rev.rating ? 'text-[#F5B841] fill-[#F5B841]' : 'text-[#2A3441]'
                      }`}
                    />
                  ))}
                  <span className="text-[11px] font-bold text-[#F5F7FA] ml-1">{rev.rating}.0</span>
                </div>
              </div>

              <p className="text-xs text-[#B4BCC8] leading-relaxed pl-9">{rev.comment}</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
