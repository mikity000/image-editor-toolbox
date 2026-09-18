/// <reference types="react-scripts" />

declare module 'file-saver' {
  export function saveAs(data: Blob | string, filename?: string, options?: any): void;
}

declare module '@upscalerjs/esrgan-slim/2x' {
  const model: any;
  export default model;
}

declare module '@upscalerjs/esrgan-slim/4x' {
  const model: any;
  export default model;
}

declare module '@upscalerjs/default-model' {
  const model: any;
  export default model;
}

