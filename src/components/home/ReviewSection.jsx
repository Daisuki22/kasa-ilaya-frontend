import React, { useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { baseClient } from "@/api/baseClient";
import { Star, Quote, ChevronLeft, ChevronRight } from "lucide-react";
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
  const carouselRef = useRef(null);
  const { data: reviews = [] } = useQuery({
    queryKey: ["public-reviews"],
    queryFn: () => baseClient.entities.Review.filter({ is_approved: true }, "-created_date", 6),
  });

  if (reviews.length === 0) return null;

  const moveCarousel = (direction) => {
    const carousel = carouselRef.current;
    const firstCard = carousel?.firstElementChild;
    if (!carousel || !firstCard) return;

    const gap = Number.parseFloat(window.getComputedStyle(carousel).columnGap) || 0;
    carousel.scrollBy({
      left: direction * (firstCard.getBoundingClientRect().width + gap),
      behavior: "smooth",
    });
  };

  return (
    <section className="bg-muted/40 py-24 sm:py-28 lg:py-32">
      <div className="w-full app-content-container px-2 sm:px-3 lg:px-4">
        <div className="mb-16 text-center lg:mb-20">
          <p className="text-secondary font-medium uppercase tracking-widest text-sm mb-2">Guest Stories</p>
          <h2 className="mb-5 font-display text-4xl font-bold text-foreground lg:text-5xl">What Our Guests Say</h2>
          <p className="mx-auto max-w-2xl text-muted-foreground leading-8">
            Real experiences from verified guests who have stayed at Kasa Ilaya Resort & Event Place.
          </p>
        </div>

        <div className="mb-5 flex justify-end gap-2 sm:mb-6">
          <button
            type="button"
            onClick={() => moveCarousel(-1)}
            aria-label="Show previous guest reviews"
            className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-card text-foreground transition hover:border-primary hover:bg-primary hover:text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={() => moveCarousel(1)}
            aria-label="Show next guest reviews"
            className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-card text-foreground transition hover:border-primary hover:bg-primary hover:text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>

        <div
          ref={carouselRef}
          className="flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth pb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:gap-5 lg:gap-6"
          role="region"
          aria-label="Guest reviews carousel"
          tabIndex={0}
        >
          {reviews.map((review) => (
            <Card key={review.id} className="relative w-full shrink-0 snap-start overflow-hidden transition-shadow duration-300 hover:shadow-lg sm:w-[calc((100%-1.25rem)/2)] lg:w-[calc((100%-3rem)/3)]">
              <CardContent className="p-8">
                <Quote className="mb-4 h-8 w-8 text-primary/20" />
                <p className="mb-6 line-clamp-4 text-sm leading-7 text-foreground">
                  "{review.review_text}"
                </p>
                {review.image_url ? (
                  <img
                    src={resolveAssetUrl(review.image_url)}
                    alt={`Photo shared by ${review.guest_name}`}
                    loading="lazy"
                    decoding="async"
                    className="mb-6 max-h-56 w-full rounded-md object-cover"
                  />
                ) : null}
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-foreground text-sm">{review.guest_name}</p>
                    {review.package_name && (
                      <p className="text-xs text-muted-foreground mt-0.5">{review.package_name}</p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-2">
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
      </div>
    </section>
  );
}
