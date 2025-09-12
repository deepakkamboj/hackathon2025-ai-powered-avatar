import { useEffect, useRef } from 'react';
import Image from 'next/image';
import { useAtom } from 'jotai';

import { avatarIdAtom, mediaStreamActiveAtom, removeBGAtom } from '@/lib/atoms';
import { cn } from '@/lib/utils';

// Azure Avatar Image Mapping
const AZURE_AVATAR_IMAGES: { [key: string]: string } = {
  lisa: '/lisa.png',
  meg: '/meg.png',
  max: '/avatars-002.png',
  // Add more avatar mappings as needed
};

export default function ImageWrap() {
  const [removeBG] = useAtom(removeBGAtom);
  const [mediaStreamActive] = useAtom(mediaStreamActiveAtom);
  const [avatarId, setAvatarId] = useAtom(avatarIdAtom);

  const imageRef = useRef<HTMLImageElement>(null);
  const imageCanvasRef = useRef<HTMLCanvasElement>(null);

  const handleImageLoad = () => {
    if (!removeBG) return;
    const image = imageRef.current;
    const canvas = imageCanvasRef.current;
    if (!canvas || !image) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = image.width;
    canvas.height = image.height;

    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    for (let i = 0; i < data.length; i += 4) {
      const red = data[i];
      const green = data[i + 1];
      const blue = data[i + 2];

      if (isCloseToGreen([red, green, blue])) {
        data[i + 3] = 0; // Set alpha channel to 0 (transparent)
      }
    }

    ctx.putImageData(imageData, 0, 0);
  };
  const isCloseToGreen = (color: any) => {
    const [red, green, blue] = color;
    const th = 90; // Adjust the threshold values for green detection
    return green > th && red < th && blue < th;
  };
  useEffect(() => {
    handleImageLoad();
  }, [removeBG]);

  return (
    <div id="imageWrap" className={cn(mediaStreamActive && 'hidden')}>
      <Image
        src={!avatarId || avatarId === '' ? '/default.png' : AZURE_AVATAR_IMAGES[avatarId] || '/default.png'}
        className={cn('inline-block max-w-full', removeBG ? 'hidden' : 'flex')}
        alt="avatar image"
        ref={imageRef}
        onLoad={handleImageLoad}
        width={500}
        height={500}
        priority={true}
      ></Image>
      <canvas ref={imageCanvasRef} className={cn(!removeBG ? 'hidden' : 'flex')}></canvas>
    </div>
  );
}
