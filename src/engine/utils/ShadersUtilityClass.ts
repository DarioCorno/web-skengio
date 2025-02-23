export class ShadersUtility {
    private gl: WebGL2RenderingContext;
  
    constructor(gl: WebGL2RenderingContext) {
      this.gl = gl;
    }
  
    /**
     * Loads and compiles vertex and fragment shaders and links them into a program.
     * @param vertexSource The GLSL source code for the vertex shader.
     * @param fragmentSource The GLSL source code for the fragment shader.
     * @returns The linked WebGLProgram.
     * @throws Error if the shaders fail to compile or the program fails to link.
     */
    static createProgram(gl: WebGL2RenderingContext, vertexSource: string, fragmentSource: string): WebGLProgram {
      const vertexShader = ShadersUtility.compileShader(gl, gl.VERTEX_SHADER, vertexSource);
      const fragmentShader = ShadersUtility.compileShader(gl, gl.FRAGMENT_SHADER, fragmentSource);
  
      const program = gl.createProgram();
      if (!program) {
        throw new Error('Failed to create WebGL program.');
      }
  
      gl.attachShader(program, vertexShader);
      gl.attachShader(program, fragmentShader);
      gl.linkProgram(program);
  
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        const log = gl.getProgramInfoLog(program);
        gl.deleteProgram(program);
        throw new Error(`Program link error: ${log}`);
      }
  
      // Detach and delete shaders after linking
      gl.detachShader(program, vertexShader);
      gl.detachShader(program, fragmentShader);
      gl.deleteShader(vertexShader);
      gl.deleteShader(fragmentShader);
  
      return program;
    }
  
    /**
     * Compiles a shader of the given type.
     * @param type The type of shader: `gl.VERTEX_SHADER` or `gl.FRAGMENT_SHADER`.
     * @param source The GLSL source code for the shader.
     * @returns The compiled WebGLShader.
     * @throws Error if the shader fails to compile.
     */
    static compileShader(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader {
      const shader = gl.createShader(type);
      if (!shader) {
        throw new Error(`Failed to create shader of type: ${type}`);
      }
  
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
  
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        const log = gl.getShaderInfoLog(shader);
        gl.deleteShader(shader);
        throw new Error(`Shader compile error (${type === gl.VERTEX_SHADER ? 'VERTEX' : 'FRAGMENT'}): ${log}`);
      }
  
      return shader;
    }
  }
  