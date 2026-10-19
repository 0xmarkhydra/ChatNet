// ChatNet Web media transport. Model selection, API credentials and provider routing
// are exclusively managed by our backend.
export type InterpreterUpdate = { speakerId: string; original?: string; translated?: string }
export type InterpreterOptions = {
  speakerId: string
  track: MediaStreamTrack
  callId: string
  targetLanguage: string
  apiBase: string
  request: (path: string, init?: RequestInit) => Promise<Response>
  onUpdate: (item: InterpreterUpdate) => void
  onError: (message: string) => void
  onReady: () => void
}
export type InterpreterSession = { stop: () => void }
const maxBufferedBytes = 200_000

function playback(context: AudioContext, output: GainNode, data: string, state: { at: number }) {
  const binary = atob(data)
  if (!binary.length || binary.length % 2 !== 0 || binary.length > 256 * 1024) return
  const frames = binary.length / 2
  const buffer = context.createBuffer(1, frames, 24000)
  const floats = buffer.getChannelData(0)
  for (let i = 0; i < frames; i++) {
    let sample = binary.charCodeAt(i * 2) | (binary.charCodeAt(i * 2 + 1) << 8)
    if (sample >= 32768) sample -= 65536
    floats[i] = sample / 32768
  }
  const node = context.createBufferSource()
  node.buffer = buffer
  node.connect(output)
  state.at = Math.max(context.currentTime + 0.05, Math.min(state.at, context.currentTime + 0.35))
  node.start(state.at)
  state.at += buffer.duration
  node.onended = () => node.disconnect()
}

export async function startCallMediaInterpreter(options: InterpreterOptions): Promise<InterpreterSession> {
  const response = await options.request('/api/calls/' + encodeURIComponent(options.callId) + '/translation-session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ targetLanguage: options.targetLanguage, speakerId: options.speakerId }),
  })
  if (!response.ok) {
    const reason = response.status === 503 ? 'Máy chủ phiên dịch chưa sẵn sàng.'
      : response.status === 429 ? 'Quá nhiều phiên dịch đang hoạt động.'
      : response.status === 403 ? 'Bạn hoặc người nói đã rời cuộc gọi.'
      : 'Không thể bắt đầu dịch trực tiếp (' + response.status + ').'
    throw new Error(reason)
  }
  const { ticket } = await response.json() as { ticket?: string }
  if (!ticket) throw new Error('Máy chủ chưa cấp phiên dịch.')
  if (options.track.readyState !== 'live') throw new Error('Người nói đã tắt kết nối âm thanh.')

  const endpoint = new URL(options.apiBase)
  endpoint.protocol = endpoint.protocol === 'https:' ? 'wss:' : 'ws:'
  endpoint.pathname = '/api/calls/' + encodeURIComponent(options.callId) + '/translation-stream'
  endpoint.search = ''
  const socket = new WebSocket(endpoint.toString())
  let disposed = false
  let ready = false
  let resolved = false
  let timeoutID = 0
  let source: MediaStreamAudioSourceNode | undefined
  let capture: AudioWorkletNode | undefined
  let silent: GainNode | undefined
  const timeline = { at: 0 }
  const audio = new AudioContext({ latencyHint: 'interactive' })
  const translated = audio.createGain()
  translated.gain.value = 1
  translated.connect(audio.destination)

  const stop = () => {
    if (disposed) return
    disposed = true
    window.clearTimeout(timeoutID)
    if (capture) { capture.port.onmessage = null; capture.disconnect() }
    source?.disconnect()
    silent?.disconnect()
    translated.disconnect()
    if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) socket.close()
    void audio.close().catch(() => undefined)
  }
  const session: InterpreterSession = { stop }

  try {
    await new Promise<void>((resolve, reject) => {
      const fail = (message: string) => {
        if (!resolved) { resolved = true; reject(new Error(message)) }
        else if (!disposed) { options.onError(message); stop() }
      }
      timeoutID = window.setTimeout(() => fail('Hết thời gian kết nối phiên dịch.'), 20000)
      socket.onopen = () => socket.send(JSON.stringify({ ticket }))
      socket.onerror = () => fail('Không thể kết nối tới máy chủ phiên dịch.')
      socket.onclose = () => { if (!disposed) fail('Phiên dịch bị ngắt kết nối.') }
      socket.onmessage = async (event) => {
        if (disposed) return
        try {
          const message = JSON.parse(event.data as string) as { type?: string; text?: string; data?: string; message?: string }
          if (message.type === 'error') { fail(message.message || 'Có lỗi phiên dịch.'); return }
          if (message.type === 'ready' && !ready) {
            ready = true
            window.clearTimeout(timeoutID)
            await audio.audioWorklet.addModule('/call-audio-processor.js')
            if (disposed) return
            source = audio.createMediaStreamSource(new MediaStream([options.track]))
            capture = new AudioWorkletNode(audio, 'chatnet-media-translation')
            silent = audio.createGain()
            silent.gain.value = 0
            capture.port.onmessage = ({ data }: MessageEvent<ArrayBuffer>) => {
              if (socket.readyState === WebSocket.OPEN && socket.bufferedAmount < maxBufferedBytes) socket.send(data)
            }
            source.connect(capture)
            capture.connect(silent)
            silent.connect(audio.destination)
            await audio.resume()
            options.onReady()
            if (!resolved) { resolved = true; resolve() }
          }
          if (message.type === 'original' && message.text) {
            options.onUpdate({ speakerId: options.speakerId, original: message.text })
          }
          if (message.type === 'translated' && message.text) {
            options.onUpdate({ speakerId: options.speakerId, translated: message.text })
          }
          if (message.type === 'audio' && message.data) playback(audio, translated, message.data, timeline)
        } catch {
          fail('Không đọc được dữ liệu dịch.')
        }
      }
    })
    if (disposed) throw new Error('Phiên dịch đã kết thúc.')
    return session
  } catch (err) {
    stop()
    throw err
  }
}
