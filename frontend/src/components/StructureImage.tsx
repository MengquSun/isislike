import { useState } from "react";
import { structureSvgUrl } from "../api/cheminformatics";

interface Props {
  moleculeId: string;
  alt?: string;
  className?: string;
  width?: number;
  height?: number;
}

export default function StructureImage({
  moleculeId,
  alt = "2D chemical structure",
  className = "structure-thumb",
  width = 140,
  height = 105,
}: Props) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div
        className={`${className} structure-thumb-fallback`}
        style={{ width, height }}
        aria-hidden
      >
        No image
      </div>
    );
  }

  return (
    <img
      className={className}
      src={structureSvgUrl(moleculeId)}
      alt={alt}
      width={width}
      height={height}
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
    />
  );
}
