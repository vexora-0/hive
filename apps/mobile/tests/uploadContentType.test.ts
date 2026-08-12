import { describe, it, expect } from 'vitest';

import { normaliseContentType } from '@/features/teacher/hooks/useUpload';

/**
 * Content-type negotiation on the upload path.
 *
 * `mimeType` is optional on `ImagePickerAsset` and Android ContentProviders
 * omit it often enough to matter. The old fallback declared anything unknown
 * `image/jpeg`, which was a coin flip: a PNG announced as JPEG still uploads
 * because the server sniffs magic bytes, but a genuinely unsupported file was
 * smuggled past the client only to be rejected server-side *after* the whole
 * thing had been transferred.
 *
 * The list here must stay in step with the server's `requestUploadSchema` —
 * WebP being accepted at three format gates and refused at a fourth was one of
 * the regressions this round had to fix.
 */
describe('normaliseContentType', () => {
  describe('trusts a supported mime type', () => {
    for (const mime of ['image/jpeg', 'image/png', 'image/heic', 'image/heif', 'image/webp']) {
      it(`${mime} passes through`, () => {
        // The URI deliberately disagrees: a reported type the server accepts
        // wins over whatever the extension says.
        expect(normaliseContentType(mime, 'file:///tmp/IMG_0001.dat')).toBe(mime);
      });
    }
  });

  describe('falls back to the file extension', () => {
    const cases: Array<[uri: string, expected: string]> = [
      ['file:///tmp/IMG_0001.jpg', 'image/jpeg'],
      ['file:///tmp/IMG_0001.jpeg', 'image/jpeg'],
      ['file:///tmp/IMG_0001.png', 'image/png'],
      ['file:///tmp/IMG_0001.heic', 'image/heic'],
      ['file:///tmp/IMG_0001.heif', 'image/heif'],
      ['file:///tmp/IMG_0001.webp', 'image/webp'],
    ];

    for (const [uri, expected] of cases) {
      it(`${uri} with no reported mime → ${expected}`, () => {
        // Both shapes the picker actually produces when it does not know.
        expect(normaliseContentType(undefined, uri)).toBe(expected);
        expect(normaliseContentType(null, uri)).toBe(expected);
      });

      it(`${uri} with an unsupported reported mime → ${expected}`, () => {
        // The case the old code got wrong in the other direction: it kept
        // `application/octet-stream` or blindly said JPEG. The extension is
        // better information than either.
        expect(normaliseContentType('application/octet-stream', uri)).toBe(expected);
      });
    }

    it('is case-insensitive about the extension', () => {
      expect(normaliseContentType(null, 'file:///tmp/IMG_0001.PNG')).toBe('image/png');
      expect(normaliseContentType(null, 'file:///DCIM/PHOTO.HEIC')).toBe('image/heic');
    });

    it('ignores a query string after the extension', () => {
      // Android content:// URIs routinely carry one.
      expect(normaliseContentType(null, 'file:///tmp/a.png?width=100')).toBe('image/png');
    });

    it('rejects an unsupported mime even when it is an image type', () => {
      // GIF and TIFF are images the server does not accept; the extension is
      // what decides, not the fact that it starts with `image/`.
      expect(normaliseContentType('image/gif', 'file:///tmp/IMG_0001.png')).toBe('image/png');
      expect(normaliseContentType('image/tiff', 'file:///tmp/IMG_0001.webp')).toBe('image/webp');
    });
  });

  describe('falls back to jpeg only as a last resort', () => {
    it('for an unknown extension', () => {
      expect(normaliseContentType(null, 'file:///tmp/IMG_0001.gif')).toBe('image/jpeg');
      expect(normaliseContentType(null, 'file:///tmp/IMG_0001.tiff')).toBe('image/jpeg');
      expect(normaliseContentType('application/pdf', 'file:///tmp/doc.pdf')).toBe('image/jpeg');
    });

    it('for a URI with no extension at all', () => {
      expect(normaliseContentType(null, 'content://media/external/images/media/42')).toBe(
        'image/jpeg',
      );
      expect(normaliseContentType(undefined, '')).toBe('image/jpeg');
    });
  });
});
