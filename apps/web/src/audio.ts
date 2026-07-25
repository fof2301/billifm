export function createRecorder(): { start(): Promise<void>; stop(): Promise<Blob> } {
  let recorder: MediaRecorder | null = null
  let stream: MediaStream | null = null
  const chunks: Blob[] = []
  return {
    async start() {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      recorder = new MediaRecorder(stream as MediaStream)
      recorder.ondataavailable = (e) => chunks.push(e.data)
      recorder.start()
    },
    stop() {
      return new Promise<Blob>((resolve, reject) => {
        if (!recorder) return reject(new Error('not recording'))
        recorder.onstop = () => {
          stream?.getTracks().forEach((t) => t.stop())
          resolve(new Blob(chunks, { type: 'audio/webm' }))
        }
        recorder.stop()
      })
    },
  }
}

export function playBase64Mp3(b64: string): void {
  void new Audio(`data:audio/mpeg;base64,${b64}`).play().catch(() => {})
}
