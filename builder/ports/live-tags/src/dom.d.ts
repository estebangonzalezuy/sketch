interface VideoFrameCallbackMetadata {
  mediaTime: number;
  presentedFrames: number;
}

type VideoFrameRequestCallback = (now: number, meta: VideoFrameCallbackMetadata) => void;

interface HTMLVideoElement {
  requestVideoFrameCallback(callback: VideoFrameRequestCallback): number;
  cancelVideoFrameCallback(handle: number): void;
}

interface VideoEncoderEncodeOptions {
  keyFrame?: boolean;
}

interface VideoEncoderConfig {
  avc?: { format: "avc" | "annexb" };
  hardwareAcceleration?: "no-preference" | "prefer-hardware" | "prefer-software";
}
