import { RefObject, useEffect, useRef, useState } from 'react';
import { useAtom } from 'jotai';

import { mediaCanvasRefAtom, mediaStreamActiveAtom, mediaStreamRefAtom, removeBGAtom } from '@/lib/atoms';
import { cn } from '@/lib/utils';

export default function VideoWrap() {
  const [removeBG] = useAtom(removeBGAtom);
  const [mediaStreamActive] = useAtom(mediaStreamActiveAtom);
  const [mediaStreamRef, setMediaStreamRef] = useAtom(mediaStreamRefAtom) as [
    RefObject<HTMLVideoElement> | undefined,
    (value: RefObject<HTMLVideoElement> | undefined) => void,
  ];
  const [mediaCanvasRef, setMediaCanvasRef] = useAtom(mediaCanvasRefAtom) as [
    RefObject<HTMLCanvasElement> | undefined,
    (value: RefObject<HTMLCanvasElement> | undefined) => void,
  ];

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    setMediaStreamRef(videoRef);
    setMediaCanvasRef(canvasRef);
  }, [setMediaStreamRef, setMediaCanvasRef]);

  // Background processing is now handled by useAzureAvatarV2 hook  // Check if Azure Avatar video exists
  const [hasAzureVideo, setHasAzureVideo] = useState(false);

  useEffect(() => {
    const checkAzureVideo = () => {
      const azureVideo = document.getElementById('azure-avatar-video');
      setHasAzureVideo(!!azureVideo);
    };

    // Check immediately and then periodically
    checkAzureVideo();
    const interval = setInterval(checkAzureVideo, 500);

    return () => clearInterval(interval);
  }, [mediaStreamActive]);

  return (
    <div id="videoWrap" className={cn(!mediaStreamActive && 'hidden')}>
      {/* Container for Azure Avatar WebRTC video - following official pattern */}
      <div id="remoteVideo" className="max-h-[500px] w-full">
        {/* Azure Avatar video elements will be dynamically inserted here by WebRTC */}
      </div>

      {/* Canvas for background removal - Azure Avatar processing happens here */}
      <canvas id="canvas" ref={canvasRef} className="max-h-[500px] w-full" hidden={true}></canvas>

      {/* Regular video element for fallback streams - COMPLETELY HIDDEN */}
      <video
        id="video"
        playsInline
        autoPlay
        muted
        ref={videoRef}
        className="max-h-[500px] w-full"
        style={{ display: 'none', visibility: 'hidden', position: 'absolute', left: '-9999px' }}
        onLoadedMetadata={() => {
          console.log('Video metadata loaded');
        }}
        onError={(e) => {
          console.error('Video error:', e);
        }}
      ></video>
    </div>
  );
}
