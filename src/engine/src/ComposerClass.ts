// src/engine/ComposerClass.ts
import * as ENGINE from '../ENGINE';

export class ComposerClass {
  private gl: WebGL2RenderingContext;
  private program: WebGLProgram | null = null;
  private quadVAO: WebGLVertexArrayObject | null = null;
  private quadVBO: WebGLBuffer | null = null;
  private vaoExt: OES_vertex_array_object | null = null;
  private buffersCount: number = 0;
  private framebuffers: WebGLFramebuffer[] = [];
  private textures: WebGLTexture[] = [];

  // Array to store textures (buffers) to composite
  private buffers: WebGLTexture[] = [];

  constructor(gl: WebGL2RenderingContext) {
    this.gl = gl;
    // Try to get the VAO extension if native VAOs aren't available (WebGL1)
    this.vaoExt = this.gl.getExtension('OES_vertex_array_object');
    if (!this.gl.createVertexArray && !this.vaoExt) {
      throw new Error("Vertex Array Objects not supported and OES_vertex_array_object extension is not available.");
    }
  }

  /**
   * Initializes the composer by compiling the provided vertex and fragment shader sources,
   * linking them into a program, and setting up a fullscreen quad using a VAO.
   * @param vertexShaderSource GLSL source for the vertex shader.
   * @param fragmentShaderSource GLSL source for the fragment shader.
   */
  async init(buffersCount: number, vertexShaderSource: string, fragmentShaderSource: string): Promise<void> {

    if(buffersCount == 0) return;

    this.buffersCount = buffersCount;

    // Use ENGINE.Utils.ShadersUtility to create the shader program.
    this.program = ENGINE.Utils.ShadersUtility.createProgram(this.gl, vertexShaderSource, fragmentShaderSource);
    if (!this.program) {
      throw new Error('Failed to create composer shader program.');
    }
    this.gl.useProgram(this.program);

    // Create and bind a Vertex Array Object (VAO) for the fullscreen quad.
    if (this.gl.createVertexArray) {
      // WebGL2 (or polyfilled)
      this.quadVAO = this.gl.createVertexArray();
      this.gl.bindVertexArray(this.quadVAO);
    } else if (this.vaoExt) {
      // WebGL1 with OES_vertex_array_object extension
      this.quadVAO = this.vaoExt.createVertexArrayOES();
      this.vaoExt.bindVertexArrayOES(this.quadVAO);
    }

    // Define the fullscreen quad vertices: position (x, y) and UV (u, v)
    const quadVertices = new Float32Array([
      -1, -1,  0, 0,  // Bottom-left
       1, -1,  1, 0,  // Bottom-right
       1,  1,  1, 1,  // Top-right
      -1,  1,  0, 1   // Top-left
    ]);

    this.quadVBO = this.gl.createBuffer();
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.quadVBO);
    this.gl.bufferData(this.gl.ARRAY_BUFFER, quadVertices, this.gl.STATIC_DRAW);

    const aPositionLocation = this.gl.getAttribLocation(this.program, 'aPosition');
    const aUVLocation = this.gl.getAttribLocation(this.program, 'aUV');
    const stride = 4 * Float32Array.BYTES_PER_ELEMENT;
    // Set up position attribute (first 2 floats)
    this.gl.vertexAttribPointer(aPositionLocation, 2, this.gl.FLOAT, false, stride, 0);
    this.gl.enableVertexAttribArray(aPositionLocation);
    // Set up UV attribute (next 2 floats)
    this.gl.vertexAttribPointer(aUVLocation, 2, this.gl.FLOAT, false, stride, 2 * Float32Array.BYTES_PER_ELEMENT);
    this.gl.enableVertexAttribArray(aUVLocation);

    // Unbind VAO and buffer
    if (this.gl.bindVertexArray) {
      this.gl.bindVertexArray(null);
    } else if (this.vaoExt) {
      this.vaoExt.bindVertexArrayOES(null);
    }
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, null);
  }

  createBuffers() {
    for (let i = 0; i < this.buffersCount; i++) {
      const fb = this.gl.createFramebuffer();
      if (!fb) throw new Error('Failed to create framebuffer');
      this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, fb);
  
      console.log('Composer creating buffers: ' + this.gl.canvas.width + ' x ' + this.gl.canvas.height);

      const tex = this.gl.createTexture();
      if (!tex) throw new Error('Failed to create texture');
      this.gl.bindTexture(this.gl.TEXTURE_2D, tex);
      // Create an empty texture with canvas dimensions.
      this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGBA, this.gl.canvas.width, this.gl.canvas.height, 0, this.gl.RGBA, this.gl.UNSIGNED_BYTE, null);
      this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.LINEAR);
      this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.LINEAR);
      this.gl.framebufferTexture2D(this.gl.FRAMEBUFFER, this.gl.COLOR_ATTACHMENT0, this.gl.TEXTURE_2D, tex, 0);
  
      // Check framebuffer completeness.
      if (this.gl.checkFramebufferStatus(this.gl.FRAMEBUFFER) !== this.gl.FRAMEBUFFER_COMPLETE) {
        throw new Error('Framebuffer not complete');
      }
  
      this.framebuffers.push(fb);
      this.textures.push(tex);
    }
    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, null);  
  }
  
  unbindBuffer() {
    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, null);    
  }

  bindBuffer(i: number) {
    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, this.framebuffers[i]);    
  }
  /**
   * Adds a texture buffer to the composer.
   * @param buffer The WebGLTexture to add.
   */
  addBuffer(buffer: WebGLTexture): void {
    this.buffers.push(buffer);
  }

  /**
   * Clears all texture buffers.
   */
  clearBuffers(): void {
    this.buffers = [];
  }

  /**
   * Renders the composition by binding each texture to a texture unit and drawing a fullscreen quad.
   */
  render(): void {
    
    // Clear any previous buffers from the composer and add the 4 rendered textures.
    this.clearBuffers();
    for (const tex of this.textures) {
      this.addBuffer(tex);
    }

    if (!this.program) {
      throw new Error('Composer program not initialized.');
    }

    this.gl.disable(this.gl.DEPTH_TEST);
    this.gl.depthMask(false);
    this.gl.clear(this.gl.COLOR_BUFFER_BIT | this.gl.DEPTH_BUFFER_BIT);

    this.gl.useProgram(this.program);
    if (this.gl.bindVertexArray) {
      this.gl.bindVertexArray(this.quadVAO);
    } else if (this.vaoExt) {
      this.vaoExt.bindVertexArrayOES(this.quadVAO);
    }

    // Bind each texture in the buffers array to consecutive texture units and set its uniform.
    for (let i = 0; i < this.buffers.length; i++) {
      this.gl.activeTexture(this.gl.TEXTURE0 + i);
      this.gl.bindTexture(this.gl.TEXTURE_2D, this.buffers[i]);
      const uniformLocation = this.gl.getUniformLocation(this.program, `uBuffer${i}`);
      this.gl.uniform1i(uniformLocation, i);
    }

    // Draw the fullscreen quad
    this.gl.drawArrays(this.gl.TRIANGLE_FAN, 0, 4);

    // Unbind VAO and program.
    if (this.gl.bindVertexArray) {
      this.gl.bindVertexArray(null);
    } else if (this.vaoExt) {
      this.vaoExt.bindVertexArrayOES(null);
    }
    this.gl.useProgram(null);

    this.gl.depthMask(true);
    this.gl.enable(this.gl.DEPTH_TEST);    
  }
}
