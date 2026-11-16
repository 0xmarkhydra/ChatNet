// Cross-browser recording MIME selection. Safari typically supports MP4,
// Chromium commonly supports Opus/WebM. Match the backend's upload allowlist.
const MIME_PREFERENCES = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/webm', 'audio/ogg']

export function preferredVoiceMime(isSupported: (value: string) => boolean): string {
  return MIME_PREFERENCES.find((type) => isSupported(type)) || ''
}

export function voiceFileType(mime: string): { contentType: string; extension: string } | null {
  const contentType = mime.toLowerCase().split(';')[0].trim()
  switch (contentType) {
    case 'audio/webm': return { contentType, extension: 'webm' }
    case 'audio/mp4': case 'audio/x-m4a': return { contentType: 'audio/mp4', extension: 'm4a' }
    case 'audio/ogg': return { contentType, extension: 'ogg' }
    case 'audio/aac': return { contentType, extension: 'aac' }
    case 'audio/mpeg': return { contentType, extension: 'mp3' }
    case 'audio/wav': return { contentType, extension: 'wav' }
    default: return null
  }
}
