import React, { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowDownRight, ChevronLeft, ChevronRight, Images } from "lucide-react";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import { resolveAssetUrl } from "@/lib/assetUrls";

const FALLBACK_IMAGES = [
  { src: "/img/room_Resort%20View.webp", title: "Resort View", subtitle: "Unwind in a calm space surrounded by open skies and greenery." },
  { src: "/img/room_eventplace.webp", title: "Event Place", subtitle: "A welcoming venue for celebrations, reunions, and special days." },
  { src: "/img/room_EntireHouse_EventPlace.webp", title: "Private Stay", subtitle: "Make room for family time, group getaways, and slow mornings." },
  { src: "/img/room_kubo.webp", title: "Kubo Area", subtitle: "Find a quiet corner to relax between swims and shared meals." },
  { src: "/img/kubo_accomodation.webp", title: "Kubo Accommodation", subtitle: "Enjoy a relaxed stay with the comforts of the resort close by." },
];

const wrapIndex = (index, length) => (index + length) % length;

export default function ResortGallerySlider() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [slideDirection, setSlideDirection] = useState(1);
  const [failedImages, setFailedImages] = useState(() => new Set());
  const { settings } = useSiteSettings();
  const prefersReducedMotion = useReducedMotion();

  const slides = useMemo(() => {
    const customSlides = Array.isArray(settings?.resort_gallery)
      ? settings.resort_gallery
          .filter((slide) => slide?.src)
          .map((slide) => ({
            src: slide.src,
            title: slide.title || "A look around the resort",
            subtitle: slide.subtitle || "Discover the spaces and details that make every stay memorable.",
          }))
      : [];

    return customSlides.length ? customSlides : FALLBACK_IMAGES;
  }, [settings?.resort_gallery]);

  useEffect(() => {
    setActiveIndex((current) => (current < slides.length ? current : 0));
    setFailedImages(new Set());
  }, [slides]);

  useEffect(() => {
    if (slides.length < 2) return undefined;
    const intervalId = window.setInterval(() => {
      setSlideDirection(1);
      setActiveIndex((current) => wrapIndex(current + 1, slides.length));
    }, 6000);
    return () => window.clearInterval(intervalId);
  }, [slides.length]);

  if (!slides.length) return null;

  const activeSlide = slides[activeIndex];
  const nextIndex = wrapIndex(activeIndex + 1, slides.length);
  const nextSlide = slides[nextIndex];
  const moveToSlide = (index, direction = 1) => {
    setSlideDirection(direction);
    setActiveIndex(index);
  };
  const imageFor = (slide, index) => (
    failedImages.has(index) ? FALLBACK_IMAGES[index % FALLBACK_IMAGES.length].src : resolveAssetUrl(slide.src)
  );
  const markImageFailed = (index) => setFailedImages((current) => new Set(current).add(index));

  return (
    <section className="relative overflow-hidden bg-[#0E2024] py-16 text-white sm:py-20 lg:py-24">
      <div className="pointer-events-none absolute -left-36 top-0 h-96 w-96 rounded-full bg-[#096164]/25 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-48 right-0 h-[32rem] w-[32rem] rounded-full bg-[#659EA7]/15 blur-3xl" />

      <div className="relative mx-auto w-full max-w-[1240px] px-5 sm:px-8 lg:px-10">
        <div id="resort-gallery-slides" className="grid gap-4 md:grid-cols-[minmax(0,1.65fr)_minmax(250px,0.8fr)] lg:gap-5">
          <article className="group relative min-h-[23rem] overflow-hidden rounded-2xl border border-white/10 bg-[#26383A] sm:min-h-[28rem] lg:min-h-[31rem]">
            <AnimatePresence mode="wait" initial={false}>
              <motion.img
                key={activeSlide.src}
                src={imageFor(activeSlide, activeIndex)}
                alt={activeSlide.title}
                loading="lazy"
                decoding="async"
                onError={() => markImageFailed(activeIndex)}
                initial={prefersReducedMotion ? false : { opacity: 0, x: `${slideDirection * 5}%` }}
                animate={{ opacity: 1, x: 0 }}
                exit={prefersReducedMotion ? undefined : { opacity: 0, x: `${slideDirection * -5}%` }}
                transition={{ duration: prefersReducedMotion ? 0 : 0.65, ease: [0.22, 1, 0.36, 1] }}
                className="absolute inset-0 h-full w-full object-cover"
              />
            </AnimatePresence>
            <div className="absolute inset-0 bg-gradient-to-t from-[#071315]/90 via-[#071315]/25 to-transparent" />

            <div className="absolute left-4 top-4 rounded-full border border-white/15 bg-[#0E2024]/55 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/85 backdrop-blur sm:left-6 sm:top-6 sm:text-xs">
              Featured space
            </div>

            {slides.length > 1 ? (
              <div className="absolute right-4 top-4 flex gap-2 sm:right-6 sm:top-6">
                <button
                  type="button"
                  onClick={() => moveToSlide(wrapIndex(activeIndex - 1, slides.length), -1)}
                  aria-label="Previous resort photo"
                  className="flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-[#0E2024]/55 text-white backdrop-blur transition hover:bg-white hover:text-[#0E2024] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <button
                  type="button"
                  onClick={() => moveToSlide(nextIndex, 1)}
                  aria-label="Next resort photo"
                  className="flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-[#0E2024]/55 text-white backdrop-blur transition hover:bg-white hover:text-[#0E2024] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
              </div>
            ) : null}

            <div className="absolute inset-x-0 bottom-0 p-5 sm:p-8 lg:p-10">
              <p className="mb-2 text-xs font-medium uppercase tracking-[0.18em] text-[#BFCBC0]">
                {String(activeIndex + 1).padStart(2, "0")} <span className="text-white/45">/ {String(slides.length).padStart(2, "0")}</span>
              </p>
              <h3 className="max-w-2xl font-display text-2xl font-semibold sm:text-3xl lg:text-4xl">
                {activeSlide.title}
              </h3>
              <p className="mt-2 max-w-xl text-sm leading-6 text-white/75 sm:text-base">
                {activeSlide.subtitle}
              </p>
            </div>
          </article>

          {slides.length > 1 ? (
            <button
              type="button"
              onClick={() => moveToSlide(nextIndex, 1)}
              aria-label={`Show ${nextSlide.title}`}
              className="group relative hidden min-h-[28rem] overflow-hidden rounded-2xl border border-white/10 bg-[#26383A] text-left md:block lg:min-h-[31rem]"
            >
              <img
                src={imageFor(nextSlide, nextIndex)}
                alt={nextSlide.title}
                loading="lazy"
                decoding="async"
                onError={() => markImageFailed(nextIndex)}
                className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#071315]/90 via-[#071315]/20 to-[#071315]/10" />
              <div className="absolute left-5 top-5 rounded-full border border-white/15 bg-[#0E2024]/55 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/85 backdrop-blur">
                Up next
              </div>
              <div className="absolute inset-x-0 bottom-0 p-5 sm:p-7">
                <h3 className="font-display text-xl font-semibold sm:text-2xl">{nextSlide.title}</h3>
                <p className="mt-2 line-clamp-3 text-sm leading-6 text-white/70">{nextSlide.subtitle}</p>
                <span className="mt-5 inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/20 transition group-hover:bg-white group-hover:text-[#0E2024]">
                  <ArrowDownRight className="h-4 w-4" />
                </span>
              </div>
            </button>
          ) : null}
        </div>

        {slides.length > 1 ? (
          <div className="mt-5 flex items-center gap-4 sm:mt-6">
            <div className="flex gap-2" role="group" aria-label="Choose resort photo">
              {slides.map((slide, index) => (
                <button
                  key={`${slide.src}-${index}`}
                  type="button"
                  onClick={() => moveToSlide(index, index >= activeIndex ? 1 : -1)}
                  aria-label={`Show photo ${index + 1}: ${slide.title}`}
                  aria-current={index === activeIndex ? "true" : undefined}
                  className={`h-1.5 rounded-full transition-all duration-300 ${index === activeIndex ? "w-9 bg-[#A3CBD8]" : "w-3 bg-white/30 hover:bg-white/60"}`}
                />
              ))}
            </div>
            <span className="text-xs tabular-nums text-white/55">{String(activeIndex + 1).padStart(2, "0")} / {String(slides.length).padStart(2, "0")}</span>
          </div>
        ) : null}

        <div className="mt-10 flex flex-col justify-between gap-5 border-t border-white/10 pt-6 sm:mt-12 sm:flex-row sm:items-end sm:gap-8">
          <div className="max-w-2xl">
            <div className="mb-3 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.24em] text-[#A3CBD8]">
              <Images className="h-4 w-4" />
              Resort Gallery
            </div>
            <h2 className="font-display text-3xl font-semibold leading-tight sm:text-4xl lg:text-5xl">
              Step inside Kasa Ilaya
            </h2>
            <p className="mt-3 max-w-xl text-sm leading-6 text-white/65 sm:text-base sm:leading-7">
              Explore the spaces made for restful stays, easy gatherings, and moments worth remembering.
            </p>
          </div>

          <a
            href="#resort-gallery-slides"
            className="hidden shrink-0 items-center gap-2 pb-1 text-sm font-medium text-[#BFCBC0] transition-colors hover:text-white sm:inline-flex"
          >
            Explore the resort <ArrowDownRight className="h-4 w-4" />
          </a>
        </div>
      </div>
    </section>
  );
}
