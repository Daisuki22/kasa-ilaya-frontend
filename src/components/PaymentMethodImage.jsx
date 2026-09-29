import React from "react";
import { resolveAssetUrl } from "@/lib/assetUrls";

export default function PaymentMethodImage({ src, alt, className, loading = "lazy" }) {
  const handleError = (event) => {
    const image = event.currentTarget;
    if (image.dataset.fallbackApplied) return;
    image.dataset.fallbackApplied = "true";
    image.src = `${import.meta.env.BASE_URL}img/payment-method-unavailable.svg`;
  };

  return (
    <img
      src={resolveAssetUrl(src)}
      alt={alt}
      loading={loading}
      decoding="async"
      className={className}
      onError={handleError}
    />
  );
}
