/**
 * Clipboard and drag/drop file helpers shared by the chat composer.
 * Text-only clipboard data must be left to the native input paste behavior.
 */
export function transferHasFiles(transfer: Pick<DataTransfer, 'types'> | null): boolean {
  return !!transfer && Array.from(transfer.types).includes('Files')
}

const clipboardExtensions: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/heic': 'heic',
  'image/heif': 'heif',
  'video/mp4': 'mp4',
  'audio/mpeg': 'mp3',
  'application/pdf': 'pdf',
}

function normalizeClipboardName(file: File, index: number, now: Date): File {
  // Files pasted from Finder/Explorer generally include their own names.
  if (/\.[a-z0-9]{1,12}$/i.test(file.name)) return file
  // Screenshots from the clipboard often lack a filename. S3 validation uses
  // the extension as well as MIME; give such images a safe, matching extension.
  const extension = clipboardExtensions[file.type.toLowerCase().split(';')[0].trim()]
  if (!extension) return file
  const stamp = now.toISOString().replace(/[:.]/g, '-')
  return new File([file], `clipboard-${stamp}-${index + 1}.${extension}`, {
    type: file.type,
    lastModified: file.lastModified,
  })
}

export function chatFilesFromClipboard(
  clipboard: Pick<DataTransfer, 'items' | 'files'> | null,
  now = new Date(),
): File[] {
  if (!clipboard) return []
  // ClipboardData.files is inconsistently populated across Chrome/Safari.
  // Prefer getAsFile() for clipboard items; use files as a fallback, not both,
  // because browsers frequently expose the same file in both collections.
  const items = Array.from(clipboard.items ?? [])
  const itemFiles = items
    .filter((item) => item.kind === 'file')
    .map((item) => item.getAsFile())
    .filter((file): file is File => file !== null)
  const files = itemFiles.length ? itemFiles : Array.from(clipboard.files ?? [])
  return files.map((file, index) => normalizeClipboardName(file, index, now))
}
