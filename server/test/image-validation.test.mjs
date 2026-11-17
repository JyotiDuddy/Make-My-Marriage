import { describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const {
  MAX_DESCRIPTION_LENGTH,
  validateAltText,
  validateImageFile,
  validateOurStoryDescription,
} = require('../src/modules/wedding/image.validation.js');

const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/t7cAAAAASUVORK5CYII=',
  'base64',
);

function expectValidationError(callback) {
  try {
    callback();
    throw new Error('Expected validation to fail.');
  } catch (error) {
    expect(error.code).toBe('VALIDATION_ERROR');
  }
}

describe('M5 image and Our Story validation', () => {
  it('accepts a PNG when the detected content matches its declared MIME type', async () => {
    await expect(validateImageFile({ buffer: png, mimetype: 'image/png' }))
      .resolves.toMatchObject({ mime: 'image/png', ext: 'png' });
  });

  it('rejects unknown image content and MIME/signature mismatches', async () => {
    await expect(validateImageFile({ buffer: Buffer.from('not an image'), mimetype: 'image/png' }))
      .rejects.toMatchObject({ statusCode: 415, code: 'UNSUPPORTED_MEDIA_TYPE' });
    await expect(validateImageFile({ buffer: png, mimetype: 'image/jpeg' }))
      .rejects.toMatchObject({ statusCode: 415, code: 'UNSUPPORTED_MEDIA_TYPE' });
  });

  it('requires an uploaded image file', async () => {
    await expect(validateImageFile(undefined))
      .rejects.toMatchObject({ statusCode: 400, code: 'VALIDATION_ERROR' });
  });

  it('accepts description text up to 1,000 characters and permits clearing it', () => {
    expect(validateOurStoryDescription({ description: 'x'.repeat(MAX_DESCRIPTION_LENGTH) }))
      .toHaveLength(MAX_DESCRIPTION_LENGTH);
    expect(validateOurStoryDescription({ description: '' })).toBe('');
    expect(validateOurStoryDescription({ description: '  ' })).toBe('');
  });

  it('rejects descriptions over 1,000 characters and unexpected fields', () => {
    expectValidationError(() => validateOurStoryDescription({ description: 'x'.repeat(MAX_DESCRIPTION_LENGTH + 1) }));
    expectValidationError(() => validateOurStoryDescription({ description: 'Story', images: [] }));
  });

  it('requires non-empty alt text and rejects extra multipart fields', () => {
    expect(validateAltText({ altText: ' Couple together ' })).toBe('Couple together');
    expectValidationError(() => validateAltText({ altText: '  ' }));
    expectValidationError(() => validateAltText({ altText: 'Story', publicId: 'client-controlled' }));
  });
});
