const { v2: cloudinary } = require('cloudinary');
const config = require('../../config/env');

if (config.cloudinary) {
  cloudinary.config({
    cloud_name: config.cloudinary.cloudName,
    api_key: config.cloudinary.apiKey,
    api_secret: config.cloudinary.apiSecret,
    secure: true,
  });
}

const cloudinaryAdapter = {
  get isConfigured() {
    return Boolean(config.cloudinary);
  },

  async uploadImage({ buffer, folder }) {
    if (!config.cloudinary) {
      throw new Error('Cloudinary is not configured.');
    }

    return new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          resource_type: 'image',
          folder,
          unique_filename: true,
          overwrite: false,
        },
        (error, result) => {
          if (error) {
            reject(error);
            return;
          }
          if (!result?.secure_url || !result?.public_id) {
            reject(new Error('Cloudinary returned incomplete upload metadata.'));
            return;
          }
          resolve({ url: result.secure_url, publicId: result.public_id });
        },
      );

      stream.end(buffer);
    });
  },

  async deleteImage(publicId) {
    if (!config.cloudinary) {
      throw new Error('Cloudinary is not configured.');
    }

    const result = await cloudinary.uploader.destroy(publicId, { resource_type: 'image' });
    if (!['ok', 'not found'].includes(result?.result)) {
      throw new Error('Cloudinary did not confirm asset deletion.');
    }
  },
};

module.exports = cloudinaryAdapter;
