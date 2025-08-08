// src/engine/Mesh.ts
import { mat4, vec3 } from 'gl-matrix';
import { Entity } from './Entity'
import * as ENGINE from '../ENGINE';
import { UniformLocationCache } from '../utils/UniformLocationCache';

// Note: The Material type will be re‑exported in ENGINE; here we refer to it as ENGINE.Material.
export interface MeshOptions {
  positions: Float32Array;
  normals: Float32Array;
  indices: Uint16Array;
  uv?: Float32Array;
}

export class Mesh extends Entity {
  private _isDirty: boolean = true;

  // Vertex data
  private positions: Float32Array;
  private normals: Float32Array;
  private indices: Uint16Array;
  private uv?: Float32Array;

  // WebGL buffers
  public positionsBuffer: WebGLBuffer | null = null;
  public normalBuffer: WebGLBuffer | null = null;
  public uvBuffer: WebGLBuffer | null = null;
  public uv2Buffer: WebGLBuffer | null = null;
  public indexBuffer: WebGLBuffer | null = null;

  public vertexCount: number;
  public indexCount: number;
  public hasUV: boolean;

  // Material (if assigned) – using ENGINE.Material type.
  public material: ENGINE.Materials.MaterialTexture | ENGINE.Materials.MaterialColor | null = null;

  // Use centralized cache instead of local caching
  private uniformCache: UniformLocationCache;
  private currentProgram: WebGLProgram | null = null;

  private attributes = {
    aPositionLocation: -1,
    aNormalLocation: -1,
    aUVLocation: -1,
  }

  constructor(gl : WebGL2RenderingContext, options: MeshOptions) {
    super(gl);
    
    this.positions = options.positions;
    this.normals = options.normals;
    this.indices = options.indices;
    this.uv = options.uv;

    this.vertexCount = this.positions.length / 3;
    this.indexCount = this.indices.length;

    this.hasUV = !!this.uv;

    this.type = Entity.EntityTypes.Mesh;
    
    // Get singleton instance of centralized cache
    this.uniformCache = UniformLocationCache.getInstance();
    if (gl) {
      this.uniformCache.initialize(gl);
    }
  }

  /**
   * Marks the mesh as needing updates
   */
  setDirty(): void {
    this._isDirty = true;
  }

  /**
   * Marks the mesh as up to date
   */
  clearDirty(): void {
    this._isDirty = false;
  }

  /**
   * Returns whether the mesh needs updates
   */
  isDirty(): boolean {
    return this._isDirty;
  }

  /**
   * Initialize WebGL buffers for this mesh
   */
  init(): void {
    if(!this.gl) return;

    const gl = this.gl;
    
    // Create and fill position buffer
    this.positionsBuffer = gl.createBuffer();
    if (this.positionsBuffer) {
      gl.bindBuffer(gl.ARRAY_BUFFER, this.positionsBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, this.positions, gl.STATIC_DRAW);
    }

    // Create and fill normal buffer
    this.normalBuffer = gl.createBuffer();
    if (this.normalBuffer) {
      gl.bindBuffer(gl.ARRAY_BUFFER, this.normalBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, this.normals, gl.STATIC_DRAW);
    }

    // Optional UV buffers
    if (this.uv) {
      this.uvBuffer = gl.createBuffer();
      if (this.uvBuffer) {
        gl.bindBuffer(gl.ARRAY_BUFFER, this.uvBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, this.uv, gl.STATIC_DRAW);
      }
    }

    // Create and fill index buffer
    this.indexBuffer = gl.createBuffer();
    if (this.indexBuffer) {
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indexBuffer);
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, this.indices, gl.STATIC_DRAW);
    }

    // Unbind buffers
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
  }

  /**
   * Cache attribute locations for a given shader program using centralized cache
   * @param {WebGL2RenderingContext} gl - WebGL rendering context
   * @param {WebGLProgram} program - Shader program to get locations from
   */
  retrieveAttribsLocations(gl: WebGL2RenderingContext, program: WebGLProgram): void {
    // Only update if program changed
    if (this.currentProgram !== program) {
      this.currentProgram = program;
      
      // Use centralized cache to get attribute locations
      this.attributes.aPositionLocation = this.uniformCache.getAttribLocation(program, 'aPosition');
      this.attributes.aNormalLocation = this.uniformCache.getAttribLocation(program, 'aNormal');
      this.attributes.aUVLocation = this.uniformCache.getAttribLocation(program, 'aUV');
    }
  }

  /**
   * Bind vertex attribute buffers with improved error handling
   * @param {WebGL2RenderingContext} gl - WebGL rendering context
   */
  bindVertexAttribsBuffers(gl: WebGL2RenderingContext): void {
    // Bind and enable position buffer
    if (this.positionsBuffer && this.attributes.aPositionLocation >= 0) {
      gl.bindBuffer(gl.ARRAY_BUFFER, this.positionsBuffer);
      gl.enableVertexAttribArray(this.attributes.aPositionLocation);
      gl.vertexAttribPointer(this.attributes.aPositionLocation, 3, gl.FLOAT, false, 0, 0);
    }

    // Bind and enable normal buffer
    if (this.normalBuffer && this.attributes.aNormalLocation >= 0) {
      gl.bindBuffer(gl.ARRAY_BUFFER, this.normalBuffer);
      gl.enableVertexAttribArray(this.attributes.aNormalLocation);
      gl.vertexAttribPointer(this.attributes.aNormalLocation, 3, gl.FLOAT, false, 0, 0);
    }

    // Bind optional UV buffer
    if (this.uvBuffer && this.attributes.aUVLocation >= 0) {
      gl.bindBuffer(gl.ARRAY_BUFFER, this.uvBuffer);
      gl.enableVertexAttribArray(this.attributes.aUVLocation);
      gl.vertexAttribPointer(this.attributes.aUVLocation, 2, gl.FLOAT, false, 0, 0);
    }
  }

  /**
   * Draw the mesh using indexed rendering
   * @param {WebGL2RenderingContext} gl - WebGL rendering context
   */
  draw(gl: WebGL2RenderingContext): void {
    if (this.indexBuffer) {
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indexBuffer);
      gl.drawElements(gl.TRIANGLES, this.indexCount, gl.UNSIGNED_SHORT, 0);
    }
  }

  /**
   * Clean up WebGL resources
   */
  dispose(): void {
    if (!this.gl) return;

    const gl = this.gl;
    
    if (this.positionsBuffer) {
      gl.deleteBuffer(this.positionsBuffer);
      this.positionsBuffer = null;
    }
    
    if (this.normalBuffer) {
      gl.deleteBuffer(this.normalBuffer);
      this.normalBuffer = null;
    }
    
    if (this.uvBuffer) {
      gl.deleteBuffer(this.uvBuffer);
      this.uvBuffer = null;
    }
    
    if (this.uv2Buffer) {
      gl.deleteBuffer(this.uv2Buffer);
      this.uv2Buffer = null;
    }
    
    if (this.indexBuffer) {
      gl.deleteBuffer(this.indexBuffer);
      this.indexBuffer = null;
    }

    // Reset current program reference
    this.currentProgram = null;
  }

  /**
   * Get a uniform location for a given program using centralized cache
   * @param {WebGL2RenderingContext} gl - WebGL rendering context
   * @param {WebGLProgram} program - Shader program
   * @param {string} uniformName - Name of the uniform
   * @returns {WebGLUniformLocation | null} Uniform location or null if not found
   */
  getUniformLocation(gl: WebGL2RenderingContext, program: WebGLProgram, uniformName: string): WebGLUniformLocation | null {
    return this.uniformCache.getUniformLocation(program, uniformName);
  }

  /**
   * Update vertex data and mark for re-upload
   * @param {Float32Array} [positions] - New position data
   * @param {Float32Array} [normals] - New normal data  
   * @param {Uint16Array} [indices] - New index data
   * @param {Float32Array} [uv] - Optional new UV data
   */
  updateVertexData(positions?: Float32Array, normals?: Float32Array, indices?: Uint16Array, uv?: Float32Array): void {
    if (positions) {
      this.positions = positions;
      this.vertexCount = positions.length / 3;
    }
    
    if (normals) {
      this.normals = normals;
    }
    
    if (indices) {
      this.indices = indices;
      this.indexCount = indices.length;
    }
    
    if (uv) {
      this.uv = uv;
      this.hasUV = true;
    }
    
    this.setDirty();
  }

  /**
   * Upload updated vertex data to GPU buffers
   */
  uploadVertexData(): void {
    if (!this.gl || !this._isDirty) return;

    const gl = this.gl;

    // Update position buffer
    if (this.positionsBuffer) {
      gl.bindBuffer(gl.ARRAY_BUFFER, this.positionsBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, this.positions, gl.STATIC_DRAW);
    }

    // Update normal buffer  
    if (this.normalBuffer) {
      gl.bindBuffer(gl.ARRAY_BUFFER, this.normalBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, this.normals, gl.STATIC_DRAW);
    }

    // Update UV buffer if present
    if (this.uvBuffer && this.uv) {
      gl.bindBuffer(gl.ARRAY_BUFFER, this.uvBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, this.uv, gl.STATIC_DRAW);
    }

    // Update index buffer
    if (this.indexBuffer) {
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indexBuffer);
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, this.indices, gl.STATIC_DRAW);
    }

    // Unbind buffers
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);

    this.clearDirty();
  }

  debugInfo(): void {
    console.log("Mesh Debug Info:");
    console.log("Name:", this.name);
    console.log("Position:", this.position);
    console.log("Rotation:", this.rotation);
    console.log("Scale:", this.scale);
    console.log(`Vertex Count: ${this.vertexCount}, Index Count: ${this.indexCount}`);
    console.log("Has UV:", this.hasUV);
    console.log("Dirty:", this.getDirty());
    console.log("Buffers created:", {
      positions: !!this.positionsBuffer,
      normals: !!this.normalBuffer,
      uvs: !!this.uvBuffer,
      indices: !!this.indexBuffer
    });
    
    if (this.material) {
      console.log("Material Debug Info:");
      this.material.debugInfo();
    }
  }  
}