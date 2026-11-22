export interface JpegSegment {
  marker: number;
  name: string;
  offset: number;
  length: number;
  kind?: 'exif' | 'xmp' | 'otro';
}
export interface JpegReport {
  valid: boolean;
  startsWithSOI: boolean;
  endsWithEOI: boolean;
  reachedSOS: boolean;
  segments: JpegSegment[];
  app1: JpegSegment[];
  hasExifString: boolean;
}
export function containsAscii(bytes: Uint8Array, text: string): boolean;
export function inspectJpeg(input: Uint8Array | ArrayBuffer): JpegReport;
export function buildJpegWithExif(
  jpeg: Uint8Array | ArrayBuffer,
  options?: { orientation?: number; marker?: string }
): Uint8Array;
export function listPngChunks(input: Uint8Array | ArrayBuffer): string[];