// Live translation is a separate, opt-in processor of already-decrypted LiveKit audio.
// It never holds the call E2EE key and never publishes audio to another participant.
export type InterpreterUpdate = {
  speakerId: string
  original?: string
  translated?: string
}
export type InterpreterOptions = {
  speakerId: string
  track: MediaStreamTrack
  callId: string
  targetLanguage: string
  request: (path: string, init?: RequestInit) => Promise<Response>
  onUpdate: (item: InterpreterUpdate) => void
  onError: (error: string) => void
  onReady: () => void
}
export type InterpreterSession = {
  stop: () => void
  setVolume: (value: number) => void
}
type TokenReply = { token: string; model: string }
const liveWebsocket = 'wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContentConstrained'
const maxBufferedBytes = 512 * 1024
const liveGenerationConfig = (targetLanguage: string) => ({
  responseModalities: ['AUDIO'],
  inputAudioTranscription: {},
  outputAudioTranscription: {},
  translationConfig: { targetLanguageCode: targetLanguage, echoTargetLanguage: false },
})
function toBase64(data: ArrayBuffer): string {
  const bytes = new Uint8Array(data)
  let string = ''
  for (let i = 0; i < bytes.length; i++) string += String.fromCharCode(bytes[i])
  return btoa(string)
}
function playPCM(context: AudioContext, output: GainNode, data: string, playAt: { time: number }) {
  const binary = atob(data)
  const samples = Math.floor(binary.length / 2)
  if (!samples) return
  const buffer = context.createBuffer(1, samples, 24000)
  const channel = buffer.getChannelData(0)
  for (let i = 0; i < samples; i++) {
    let value = binary.charCodeAt(i * 2) | (binary.charCodeAt(i * 2 + 1) << 8)
    if (value >= 32768) value -= 65536
    channel[i] = value / 32768
  }
  const source = context.createBufferSource()
  source.buffer = buffer
  source.connect(output)
  // Enforce a small playback buffer but do not accumulate unlimited latency.
  playAt.time = Math.max(context.currentTime + 0.06, Math.min(playAt.time, context.currentTime + 0.35))
  source.start(playAt.time)
  playAt.time += buffer.duration
  source.onended = () => source.disconnect()
}

export async function startGeminiInterpreter(options: InterpreterOptions): Promise<InterpreterSession> {
  const response = await options.request('/api/calls/' + encodeURIComponent(options.callId) + '/translation-token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ targetLanguage: options.targetLanguage }),
  })
  if (!response.ok) {
    if (response.status === 503) throw new Error('Chưa cấu hình GEMINI_API_KEY cho dịch cuộc gọi.')
    if (response.status === 429) throw new Error('Đã đạt giới hạn khởi tạo phiên dịch, hãy thử lại sau.')
    throw new Error('Không thể xin quyền dịch cuộc gọi (' + response.status + ').')
  }
  const token = await response.json() as TokenReply
  if (!token.token || !token.model) throw new Error('Token Gemini không hợp lệ.')
  if (options.track.readyState !== 'live') throw new Error('Âm thanh người gọi đã ngắt.')

  const context = new AudioContext({ latencyHint: 'interactive' })
  const output = context.createGain()
  output.gain.value = 0 // Phụ đề mặc định, chỉ phát tiếng dịch khi người dùng bật.
  output.connect(context.destination)
  const cursor = { time: 0 }
  const socket = new WebSocket(liveWebsocket + '?access_token=' + encodeURIComponent(token.token))
  let stopped = false
  let ready = false
  let audioNode: AudioWorkletNode | undefined
  let sourceNode: MediaStreamAudioSourceNode | undefined
  let silenceNode: GainNode | undefined
  let settled = false
  let setupTimeout = 0

  const teardown = () => {
    if (stopped) return
    stopped = true
    window.clearTimeout(setupTimeout)
    if (audioNode) { audioNode.port.onmessage = null; audioNode.disconnect() }
    sourceNode?.disconnect()
    silenceNode?.disconnect()
    output.disconnect()
    if (socket.readyState === WebSocket.CONNECTING || socket.readyState === WebSocket.OPEN) socket.close()
    void context.close().catch(() => undefined)
  }
  const session: InterpreterSession = {
    stop: teardown,
    setVolume: (level) => { if (!stopped) output.gain.value = Math.max(0, Math.min(1, level)) },
  }
  try {
    await new Promise<void>((resolve, reject) => {
      const fail = (error: string) => {
        if (settled) { if (!stopped) { options.onError(error); teardown() } return }
        settled = true
        reject(new Error(error))
      }
      setupTimeout = window.setTimeout(() => fail('Gemini không phản hồi khi mở phiên dịch.'), 14000)
      socket.onopen = () => {
        socket.send(JSON.stringify({
          setup: {
            model: 'models/' + token.model.replace(/^models\//, ''),
            generationConfig: liveGenerationConfig(options.targetLanguage),
          },
        }))
      }
      socket.onerror = () => fail('Kết nối Gemini Live bị lỗi.')
      socket.onclose = () => { if (!stopped) fail('Phiên dịch Gemini đã ngắt kết nối.') }
      socket.onmessage = async (event) => {
        if (stopped) return
        try {
          const message = JSON.parse(typeof event.data === 'string' ? event.data : await (event.data as Blob).text())
          if (message.setupComplete && !ready) {
            ready = true
            window.clearTimeout(setupTimeout)
            await context.audioWorklet.addModule('/gemini-audio-processor.js')
            if (stopped) return
            sourceNode = context.createMediaStreamSource(new MediaStream([options.track]))
            audioNode = new AudioWorkletNode(context, 'chatnet-call-audio')
            silenceNode = context.createGain()
            silenceNode.gain.value = 0
            audioNode.port.onmessage = ({ data }: MessageEvent<ArrayBuffer>) => {
              if (stopped || socket.readyState !== WebSocket.OPEN || socket.bufferedAmount > maxBufferedBytes) return
              socket.send(JSON.stringify({
                realtimeInput: { audio: { data: toBase64(data), mimeType: 'audio/pcm;rate=16000' } },
              }))
            }
            sourceNode.connect(audioNode)
            audioNode.connect(silenceNode)
            silenceNode.connect(context.destination)
            await context.resume()
            options.onReady()
            if (!settled) { settled = true; resolve() }
          }
          const content = message.serverContent
          if (content?.inputTranscription?.text) options.onUpdate({ speakerId: options.speakerId, original: content.inputTranscription.text })
          if (content?.outputTranscription?.text) options.onUpdate({ speakerId: options.speakerId, translated: content.outputTranscription.text })
          for (const part of content?.modelTurn?.parts || []) {
            if (part.inlineData?.data && String(part.inlineData.mimeType || '').startsWith('audio/pcm')) {
              playPCM(context, output, part.inlineData.data, cursor)
            }
          }
        } catch (error) {
          const description = error instanceof Error ? error.message : 'Không đọc được dữ liệu dịch.'
          fail(description)
        }
      }
    })
    if (stopped) throw new Error('Đã dừng phiên dịch.')
    return session
  } catch (error) {
    teardown()
    throw error
  }
}
