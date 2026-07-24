/**
 * Optional ambient modules for SolenOS TTS soft-fail path.
 * Real SDKs are installed in environments that enable Polly / Google Cloud TTS.
 */

declare module "@aws-sdk/client-polly" {
  export class PollyClient {
    constructor(config?: { region?: string });
    send(command: unknown): Promise<{ AudioStream?: AsyncIterable<Uint8Array> | null }>;
  }
  export class SynthesizeSpeechCommand {
    constructor(input: Record<string, unknown>);
  }
}

declare module "@google-cloud/text-to-speech" {
  export class TextToSpeechClient {
    constructor(config?: { credentials?: object; projectId?: string });
    synthesizeSpeech(request: Record<string, unknown>): Promise<
      [{ audioContent?: string | Uint8Array | null }]
    >;
  }
}
