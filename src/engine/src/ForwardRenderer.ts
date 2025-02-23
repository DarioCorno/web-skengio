// src/engine/Renderer.ts
import vertexSource from '../shaders/forwardVertexShader.glsl?raw';
import fragmentSource from '../shaders/forwardFragmentShader.glsl?raw';

import * as ENGINE from '../ENGINE';
import { mat4 } from 'gl-matrix';

export class ForwardRenderer extends ENGINE.Renderer {
  private program: WebGLProgram | null = null;
  private width : number = 0;  
  private height : number = 0;

  private uModelViewMatrixLocation: WebGLUniformLocation | null = null;
  private uProjectionMatrixLocation: WebGLUniformLocation | null = null;
  private uLightPositionLocation: WebGLUniformLocation | null = null;
  private uLightColorLocation: WebGLUniformLocation | null = null;
  private uMaterialColorLocation: WebGLUniformLocation | null = null;

  constructor(gl: WebGL2RenderingContext, width: number, height: number) {
      super(gl);
      this.width = width;
      this.height = height;
      this.init();
  }

  async init(): Promise<void> {
    // Create shader program using your utility in ENGINE.Utils.ShadersUtility.
    this.program = ENGINE.Utils.ShadersUtility.createProgram(this.gl, vertexSource, fragmentSource);
    this.gl.useProgram(this.program);

    // Get uniform locations.
    this.uModelViewMatrixLocation = this.gl.getUniformLocation(this.program, 'uModelViewMatrix');
    this.uProjectionMatrixLocation = this.gl.getUniformLocation(this.program, 'uProjectionMatrix');
    this.uLightPositionLocation = this.gl.getUniformLocation(this.program, 'uLightPosition');
    this.uLightColorLocation = this.gl.getUniformLocation(this.program, 'uLightColor');
    this.uMaterialColorLocation = this.gl.getUniformLocation(this.program, 'uMaterialColor');

    // Enable depth testing and set clear color.
    this.gl.enable(this.gl.DEPTH_TEST);
    this.gl.clearColor(0, 0, 0, 1);

  }

  setSize(width: number, height: number): void {
    if (!this.gl) return;
    console.log('Renderer resize: ' + width + '-' + height);
    this.gl.viewport(0, 0, width, height);
  }

  setDebugMode(mode: number = 0) : void {
    return;
  }
  /**
   * Renders the provided scene using forward rendering.
   * It iterates over the scene meshes, computes the model-view and projection matrices,
   * applies the mesh's material (if assigned), and draws the mesh.
   */
  render(scene: ENGINE.Scene): void {
    if (!this.gl || !this.program) return;

    const gl = this.gl;

    const meshes = scene.getMeshes();
    const lights = scene.getLights();
    const camera = scene.getCamera();

    camera.handleResize(gl.canvas.width, gl.canvas.height);

    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.useProgram(this.program);

    const viewMatrix = camera.getViewMatrix();
    const projectionMatrix = camera.getProjectionMatrix();

    // Set light uniforms using the first light, if available.
    if (lights.length > 0) {
      gl.uniform3fv(this.uLightPositionLocation, lights[0].position);
      gl.uniform3fv(this.uLightColorLocation, lights[0].color);
    }

    for (const mesh of meshes) {

      //set the uniforms in the shader
      mesh.retrieveAttribsLocations(gl, this.program);    

      // Compute model-view matrix.
      const modelMatrix = mesh.getModelMatrix();
      const modelViewMatrix = mat4.create();
      mat4.multiply(modelViewMatrix, viewMatrix, modelMatrix);

      // Set transformation uniforms.
      gl.uniformMatrix4fv(this.uModelViewMatrixLocation, false, modelViewMatrix);
      gl.uniformMatrix4fv(this.uProjectionMatrixLocation, false, projectionMatrix);

      // If the mesh has an assigned material, apply it.
      if (mesh.material) {
        mesh.material.useMaterial(gl, this.program);
      } else if (this.uMaterialColorLocation) {
        // Fallback to default white.
        gl.uniform4fv(this.uMaterialColorLocation, [1, 1, 1, 1]);
      }

      //assing the positions, colors, normals and uv buffers to shader program
      mesh.bindAttribsBuffers(gl);

      mesh.draw(gl);
    }
  }

  debugInfo(): void {
    console.log("Renderer Debug Info:");
    console.log("Program:", this.program);
  }
}
