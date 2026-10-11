import { useEffect, useState } from "react";
import { resolveAssetUrl } from "@/lib/assetUrls";

const DEFAULT_LOGO_URL = "/img/Logo.webp";

export default function SiteLogo({ src, alt, className, loading = "eager" }) {
  const primarySrc = resolveAssetUrl(src?.trim() || DEFAULT_LOGO_URL);
  const fallbackSrc = resolveAssetUrl(DEFAULT_LOGO_URL);
  const [useFallback, setUseFallback] = useState(false);
  const [fallbackFailed, setFallbackFailed] = useState(false);

  useEffect(() => {
    setUseFallback(false);
    setFallbackFailed(false);
  }, [primarySrc]);

  if (fallbackFailed) return null;

  const imageSrc = useFallback ? fallbackSrc : primarySrc;

  return (
    <img
      src={imageSrc}
      alt={alt}
      loading={loading}
      decoding="async"
      onError={() => {
        if (!useFallback && primarySrc !== fallbackSrc) {
          setUseFallback(true);
        } else {
          setFallbackFailed(true);
        }
      }}
      className={className}
    />
  );
}
