import React from "react";
import { useQuery } from "@tanstack/react-query";
import { baseClient } from "@/api/baseClient";
import { Star, Quote } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { resolveAssetUrl } from "@/lib/assetUrls";

function StarRating({ rating }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={`h-4 w-4 ${star <= rating ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/30"}`}
        />
      ))}
    </div>
  );
}

export default function ReviewsSection() {
  const { data: reviews = [] } = useQuery({
    queryKey: ["public-reviews"],
    queryFn: () => baseClient.entities.Review.filter({ is_approved: true }, "-created_date", 6),
  });

  if (reviews.length === 0) return null;

  const reviewCopies = Array.from({ length: 6 }, (_, copyIndex) => copyIndex);

  return (
    <section className="bg-muted/40 py-24 sm:py-28 lg:py-32">
      <div className="w-full app-content-container px-2 sm:px-3 lg:px-4">
        <div className="mb-12 text-center sm:mb-14 lg:mb-16">
          <p className="text-secondary font-medium uppercase tracking-widest text-sm mb-2">Guest Stories</p>
          <h2 className="mb-5 font-display text-4xl font-bold text-foreground lg:text-5xl">What Our Guests Say</h2>
          <p className="mx-auto max-w-2xl text-muted-foreground leading-8">
            Real experiences from verified guests who have stayed at Kasa Ilaya Resort & Event Place.
          </p>
        </div>

        <div
          className="reviews-marquee-mask"
          role="region"
          aria-label="Guest reviews carousel"
          tabIndex={0}
        >
          <div className="reviews-marquee-track">
            {reviewCopies.map((copyIndex) => (
              <div key={`review-copy-${copyIndex}`} className="reviews-marquee-group" aria-hidden={copyIndex > 0}>
                {reviews.map((review, reviewIndex) => (
                  <Card key={`${copyIndex}-${review.id}`} className="relative w-[min(84vw,22rem)] shrink-0 overflow-hidden transition-shadow duration-300 hover:shadow-lg sm:w-[22rem]">
                    <CardContent className="flex h-full flex-col p-6 sm:p-7">
                      <Quote className="mb-4 h-7 w-7 shrink-0 text-primary/20" />
                      <p className="mb-5 line-clamp-4 min-h-20 text-sm leading-7 text-foreground">
                        “{review.review_text}”
                      </p>
                      {review.image_url ? (
                        <img
                          src={resolveAssetUrl(review.image_url)}
                          alt={`Photo shared by ${review.guest_name}`}
                          loading={copyIndex === 0 && reviewIndex < 3 ? "eager" : "lazy"}
                          decoding="async"
                          className="mb-5 max-h-44 w-full rounded-md object-cover"
                        />
                      ) : null}
                      <div className="mt-auto flex items-center justify-between gap-3 border-t border-border/70 pt-4">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-foreground">{review.guest_name}</p>
                          {review.package_name ? (
                            <p className="mt-0.5 truncate text-xs text-muted-foreground">{review.package_name}</p>
                          ) : null}
                        </div>
                        <div className="flex shrink-0 flex-col items-end gap-2">
                          <StarRating rating={review.rating} />
                          <span className="rounded-full bg-primary/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-primary">
                            Verified Stay
                          </span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
