import { encode } from '@jsquash/webp';

// eslint-disable-next-line no-restricted-globals
self.addEventListener('message', async (e) => {
  const { id, width, height, data, quality } = e.data;
  
  try {
    const imageData = new ImageData(new Uint8ClampedArray(data), width, height);
    const webpBuffer = await encode(imageData, { quality });

    // eslint-disable-next-line no-restricted-globals
    self.postMessage({
      id,
      type: 'SUCCESS',
      data: webpBuffer
    }, [webpBuffer]);
  } catch (err) {
    // eslint-disable-next-line no-restricted-globals
    self.postMessage({
      id,
      type: 'ERROR',
      error: err.message
    });
  }
});
