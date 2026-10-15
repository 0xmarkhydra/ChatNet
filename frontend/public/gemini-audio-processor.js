class ChatNetCallAudioProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.phase = 0;
    this.sum = 0;
    this.samples = 0;
    this.output = new Int16Array(1600);
    this.offset = 0;
  }
  process(inputs, outputs) {
    const samples = inputs[0]?.[0];
    if (samples) {
      const rate = 16000 / sampleRate;
      for (let i = 0; i < samples.length; i++) {
        this.sum += samples[i];
        this.samples += 1;
        this.phase += rate;
        if (this.phase >= 1) {
          const value = Math.max(-1, Math.min(1, this.sum / this.samples));
          this.output[this.offset++] = Math.round(value < 0 ? value * 32768 : value * 32767);
          this.sum = 0;
          this.samples = 0;
          this.phase -= 1;
          if (this.offset === 1600) {
            this.port.postMessage(this.output.buffer, [this.output.buffer]);
            this.output = new Int16Array(1600);
            this.offset = 0;
          }
        }
      }
    }
    for (const output of outputs) for (const channel of output) channel.fill(0);
    return true;
  }
}
registerProcessor('chatnet-call-audio', ChatNetCallAudioProcessor);