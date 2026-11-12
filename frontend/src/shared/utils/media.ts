export type MediaAttachment = {
  id?: number
  storageRef: string
  name: string
  sizeBytes: number
  contentType: string
  kind: 'image' | 'video' | 'audio' | 'file'
  url?: string
}

/** Only trusted upload input fields are accepted by strict Go JSON decoders.
 * Public signed URLs and response IDs must never be sent back in API requests. */
export const attachmentRequestBody = ({ storageRef, name, sizeBytes, contentType, kind }: MediaAttachment) =>
  ({ storageRef, name, sizeBytes, contentType, kind })

export type PresignedUpload = {
  uploadUrl: string
  storageRef: string
  key: string
  expiresAt: string
  kind: MediaAttachment['kind']
  downloadUrl: string
}
