"use client";

import { Star, StarHalf } from "lucide-react";
import { useState } from "react";

interface StarRatingProps {
  rating: number; // Current rating (0-5)
  maxStars?: number;
  size?: number;
  interactive?: boolean; // If true, allows user to select rating
  onRatingChange?: (rating: number) => void;
  showCount?: boolean; // Show the numeric rating value?
}

export default function StarRating({ 
  rating, 
  maxStars = 5, 
  size = 16, 
  interactive = false, 
  onRatingChange,
  showCount = false
}: StarRatingProps) {
  const [hoverRating, setHoverRating] = useState<number | null>(null);

  const displayRating = hoverRating !== null ? hoverRating : rating;

  return (
    <div className="flex items-center gap-1">
      {showCount && (
        <span className="text-sm font-bold text-gray-900 mr-1">{rating.toFixed(1)}</span>
      )}
      <div className="flex">
        {[...Array(maxStars)].map((_, index) => {
          const starValue = index + 1;
          const isFull = displayRating >= starValue;
          const isHalf = !isFull && displayRating >= starValue - 0.5;

          return (
            <button
              key={index}
              type="button"
              disabled={!interactive}
              className={`${interactive ? 'cursor-pointer' : 'cursor-default'} focus:outline-none transition-transform ${interactive && hoverRating === starValue ? 'scale-110' : ''}`}
              onClick={() => interactive && onRatingChange?.(starValue)}
              onMouseEnter={() => interactive && setHoverRating(starValue)}
              onMouseLeave={() => interactive && setHoverRating(null)}
            >
              {isFull ? (
                <Star 
                  size={size} 
                  className="fill-primary text-primary" 
                />
              ) : isHalf ? (
                <div className="relative">
                    <Star size={size} className="text-gray-200" />
                    <div className="absolute top-0 left-0 w-1/2 overflow-hidden">
                         <Star size={size} className="fill-primary text-primary" />
                    </div>
                </div>
              ) : (
                <Star 
                  size={size} 
                  className="text-gray-200" 
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
