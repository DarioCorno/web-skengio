export class TextureLoader {
    private gl: WebGL2RenderingContext;
  
    constructor(gl: WebGL2RenderingContext) {
      this.gl = gl;
    }
  
    /**
     * Load an image and create a WebGL texture.
     * @param {string} url - The URL of the image to load.
     * @returns {Promise<WebGLTexture>} - A promise that resolves to the created texture.
     */
    async loadTexture(url: string): Promise<WebGLTexture> {
      const image = await this.loadImage(url);
      const texture = this.createTexture(image);
      if(!texture) {
        throw new Error('Cannot create texture');
      }
      return texture;
    }
  
    /**
     * Load an image file.
     * @param {string} url - The URL of the image to load.
     * @returns {Promise<HTMLImageElement>} - A promise that resolves to the loaded image.
     */
    private loadImage(url: string): Promise<HTMLImageElement> {
      return new Promise((resolve, reject) => {
        const image = new Image();
        image.crossOrigin = "anonymous"; // To handle CORS if the image is from another domain
        image.onload = () => {
          console.log('TextureLoader.loadImage: loaded ' + url);
          resolve(image);
        }
        image.onerror = (error) => {
          console.log('TextureLoader loadImage ERROR:' + error);
          reject(`Failed to load image at ${url}: ${error}`);
        }
        image.src = url;
      });
    }
  
    /**
     * Create a WebGL texture from an image.
     * @param {HTMLImageElement} image - The image element to use for the texture.
     * @returns {WebGLTexture} - The created WebGL texture.
     */
    private createTexture(image: HTMLImageElement): WebGLTexture {
        const gl = this.gl;
        const texture = gl.createTexture();
        if (!texture) {
            throw new Error("Failed to create WebGL texture.");
        }
  
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);

        // Upload the image to the GPU
        gl.texImage2D(
            gl.TEXTURE_2D,
            0,
            gl.RGBA,
            gl.RGBA,
            gl.UNSIGNED_BYTE,
            image
        );
  
        // Generate mipmaps for the texture
        gl.generateMipmap(gl.TEXTURE_2D);
    
        // Set texture parameters
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
    
        // Unbind the texture
        gl.bindTexture(gl.TEXTURE_2D, null);
    
        return texture;
    }

    /**
     * Create a WebGL texture from a given canvas element or canvas ID.
     * @param {HTMLCanvasElement | string} canvas - The canvas element or its ID.
     * @returns {WebGLTexture} - The created WebGL texture.
     */
    createTextureFromCanvas(canvas: HTMLCanvasElement | string): WebGLTexture {
        const gl = this.gl;

        // Get the canvas element if an ID is provided
        let canvasElement: HTMLCanvasElement;
        if (typeof canvas === "string") {
            canvasElement = document.getElementById(canvas) as HTMLCanvasElement;
            if (!canvasElement) {
                throw new Error(`Canvas with ID "${canvas}" not found.`);
            }
        } else {
            canvasElement = canvas;
        }

        // Ensure the canvas has a valid context
        const ctx = canvasElement.getContext("2d");
        if (!ctx) {
            throw new Error("Failed to get 2D context from the canvas.");
        }

        // Create a new WebGL texture
        const texture = gl.createTexture();
        if (!texture) {
            throw new Error("Failed to create WebGL texture.");
        }

        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);

        // Upload the canvas image to the texture
        gl.texImage2D(
            gl.TEXTURE_2D,
            0,
            gl.RGBA,
            gl.RGBA,
            gl.UNSIGNED_BYTE,
            canvasElement
        );

        // Generate mipmaps for better scaling (optional)
        gl.generateMipmap(gl.TEXTURE_2D);

        // Set texture parameters
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

        // Unbind the texture
        gl.bindTexture(gl.TEXTURE_2D, null);

        canvasElement.style.display = 'none';
        return texture;
    }    

    /**
     * Create a WebGL texture from a given canvas, making black pixels transparent 
     * and replacing white pixels with the given RGB color.
     * @param {HTMLCanvasElement | string} canvas - The canvas element or its ID.
     * @param {number} r - Red component (0-255) for replacing white pixels.
     * @param {number} g - Green component (0-255) for replacing white pixels.
     * @param {number} b - Blue component (0-255) for replacing white pixels.
     * @returns {WebGLTexture} - The created WebGL texture.
     */
    createColoredTransparentTextureFromCanvas(
        canvas: HTMLCanvasElement | string,
        r: number,
        g: number,
        b: number
      ): WebGLTexture {
        const gl = this.gl;

        // Get the canvas element if an ID is provided
        let canvasElement: HTMLCanvasElement;
        if (typeof canvas === "string") {
            canvasElement = document.getElementById(canvas) as HTMLCanvasElement;
            if (!canvasElement) {
                throw new Error(`Canvas with ID "${canvas}" not found.`);
            }
        } else {
            canvasElement = canvas;
        }

        // Ensure the canvas has a valid context
        const ctx = canvasElement.getContext("2d");
        if (!ctx) {
            throw new Error("Failed to get 2D context from the canvas.");
        }

        const width = canvasElement.width;
        const height = canvasElement.height;

        // Get pixel data from the canvas
        const imageData = ctx.getImageData(0, 0, width, height);
        const data = imageData.data;

        // Process pixels: Replace white with color, black with transparency
        for (let i = 0; i < data.length; i += 4) {
            const red = data[i];
            const green = data[i + 1];
            const blue = data[i + 2];

            // Calculate brightness as a value between 0 (black) and 1 (white)
            const brightness = (red + green + blue) / (255 * 3);

            // Set alpha value based on brightness
            data[i + 3] = Math.round(brightness * 255);

            if (red === 0 && green === 0 && blue === 0) {
                // Black -> Fully transparent
                data[i + 3] = 0;
            } else {
                // White -> Replace with input RGB color
                data[i] = r;
                data[i + 1] = g;
                data[i + 2] = b;
            }
        }

        // Put modified pixels back on the canvas
        ctx.putImageData(imageData, 0, 0);

        // Create a WebGL texture
        const texture = gl.createTexture();
        if (!texture) {
            throw new Error("Failed to create WebGL texture.");
        }

        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);

        // Upload the modified canvas image to the texture
        gl.texImage2D(
            gl.TEXTURE_2D,
            0,
            gl.RGBA,
            gl.RGBA,
            gl.UNSIGNED_BYTE,
            canvasElement
        );

        // Generate mipmaps for better scaling (optional)
        gl.generateMipmap(gl.TEXTURE_2D);

        // Set texture parameters
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

        // Unbind the texture
        gl.bindTexture(gl.TEXTURE_2D, null);

        canvasElement.style.display = 'none';
        return texture;
    }

  }
  