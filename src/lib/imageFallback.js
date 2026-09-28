export const RESORT_IMAGE_FALLBACK = "/img/room_Resort%20View.jpg";
export const LOGO_IMAGE_FALLBACK = "/img/apple-touch-icon.png";

export const handleImageFallback = (event, fallback = RESORT_IMAGE_FALLBACK) => {
  const image = event.currentTarget;

  if (image.dataset.fallbackApplied === "true") {
    image.hidden = true;
    return;
  }

  image.dataset.fallbackApplied = "true";
  image.src = fallback;
};
