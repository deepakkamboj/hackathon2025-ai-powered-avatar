import { useEffect } from 'react';
import { useAtom } from 'jotai';
import { avatarIdAtom, qualityAtom, voiceIdAtom } from '@/lib/atoms';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';

const AZURE_AVATARS = [
  { pose_id: 'lisa', pose_name: 'Lisa', gender: 'Female' },
  { pose_id: 'meg', pose_name: 'Meg', gender: 'Female' },
  { pose_id: 'max', pose_name: 'Max', gender: 'Male' },
];

const AZURE_VOICES = [
  { voice_id: 'en-US-JennyNeural', name: 'Jenny', gender: 'Female' },
  { voice_id: 'en-US-GuyNeural', name: 'Guy', gender: 'Male' },
  { voice_id: 'en-GB-LibbyNeural', name: 'Libby', gender: 'Female' },
];

export function Session() {
  const [quality, setQuality] = useAtom(qualityAtom);
  const [avatarId, setAvatarId] = useAtom(avatarIdAtom);
  const [voiceId, setVoiceId] = useAtom(voiceIdAtom);

  // Optionally, set default voice when avatar changes (if you want to link them)
  useEffect(() => {
    if (avatarId) {
      // Example: set default voice based on avatar (customize as needed)
      if (avatarId === 'lisa') setVoiceId('en-US-JennyNeural');
      else if (avatarId === 'meg') setVoiceId('en-GB-LibbyNeural');
      else if (avatarId === 'max') setVoiceId('en-US-GuyNeural');
    }
  }, [avatarId, setVoiceId]);

  return (
    <fieldset className="grid gap-6 p-4 border rounded-md">
      <div className="grid gap-3">
        <Label htmlFor="avatar">Avatar</Label>
        <Select onValueChange={(value: string) => setAvatarId(value)} value={avatarId}>
          <SelectTrigger id="avatar" className="items-start [&_[data-description]]:hidden">
            <SelectValue placeholder="Select an avatar" />
          </SelectTrigger>
          <SelectContent>
            {AZURE_AVATARS.map((avatar) => (
              <SelectItem value={avatar.pose_id} key={avatar.pose_id} className="cursor-pointer">
                <div className="flex items-start gap-3 text-muted-foreground">
                  <div className="grid gap-0.5">
                    <p>
                      <span className="pr-2 font-medium text-foreground">{avatar.pose_name}</span>
                      {avatar.gender}
                    </p>
                    <p className="text-xs" data-description>
                      {avatar.pose_id}
                    </p>
                  </div>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-3">
        <Label htmlFor="voice">Voice</Label>
        <Select onValueChange={(value: string) => setVoiceId(value)} value={voiceId}>
          <SelectTrigger id="voice" className="items-start [&_[data-description]]:hidden">
            <SelectValue placeholder="Select a voice" />
          </SelectTrigger>
          <SelectContent>
            {AZURE_VOICES.map((voice) => (
              <SelectItem value={voice.voice_id} key={voice.voice_id} className="cursor-pointer">
                <div className="flex items-start gap-3 text-muted-foreground">
                  <div className="grid gap-0.5">
                    <p>
                      <span className="pr-2 font-medium text-foreground">{voice.name}</span>
                      {voice.gender}
                    </p>
                    <p className="text-xs" data-description>
                      {voice.voice_id}
                    </p>
                  </div>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-3">
        <Label htmlFor="bitrate">Bitrate</Label>
        <Select onValueChange={(value: string) => setQuality(value)} value={quality}>
          <SelectTrigger id="bitrate" className="items-start [&_[data-description]]:hidden">
            <SelectValue placeholder="Select bitrate" />
          </SelectTrigger>
          <SelectContent>
            {['high', 'medium', 'low'].map((q) => (
              <SelectItem value={q} key={q} className="cursor-pointer">
                <div className="flex items-start gap-3 text-muted-foreground">
                  <div className="grid gap-0.5">
                    <p>
                      <span className="pr-2 font-medium capitalize text-foreground">{q}</span>
                    </p>
                  </div>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </fieldset>
  );
}
