import { useState } from 'react';
import { Landmark } from 'lucide-react';

interface MonasteryBannerImageProps {
  caption?: string;
}

/**
 * Displays the attached St. Anthony Monastery entrance photograph at its exact
 * natural dimensions (960x740) and aspect ratio (960 / 740) without cropping
 * or distortion on both the main landing view and the registration view.
 */
export function MonasteryBannerImage({ caption }: MonasteryBannerImageProps) {
  const [hasError, setHasError] = useState(false);
  const imageSrc = `${import.meta.env.BASE_URL}assets/aistudio/image_6b5e6300.png`;

  return (
    <figure className="mx-auto w-full max-w-[960px]">
      <div className="overflow-hidden rounded-xl border border-[#DFD6C7] bg-[#EFE9DD] shadow-sm">
        {!hasError ? (
          <img
            src={imageSrc}
            alt="بوابة دير القديس العظيم الأنبا أنطونيوس العامر بالبحر الأحمر"
            width={960}
            height={740}
            referrerPolicy="no-referrer"
            onError={() => setHasError(true)}
            className="block h-auto w-full"
            style={{ aspectRatio: '960 / 740' }}
          />
        ) : (
          <div
            className="flex w-full flex-col items-center justify-center gap-3 bg-gradient-to-b from-[#EDE4D3] to-[#DFD3BD] p-8 text-center text-[#5A4329]"
            style={{ aspectRatio: '960 / 740' }}
          >
            <Landmark className="h-12 w-12 opacity-70" />
            <p className="font-display text-xl font-bold">
              دير القديس العظيم الأنبا أنطونيوس العامر
            </p>
            <p className="text-sm opacity-80">البحر الأحمر — اجتماع شباب الثلاث فتية</p>
          </div>
        )}
      </div>
      {caption && (
        <figcaption className="mt-2.5 text-center text-xs text-[#6B6155]">
          {caption}
        </figcaption>
      )}
    </figure>
  );
}
