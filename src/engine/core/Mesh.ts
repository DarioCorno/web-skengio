// src/engine/Mesh.ts
import { mat4, vec3 } from 'gl-matrix';
import { Entity } from './Entity'
import * as ENGINE from '../ENGINE';
import { UniformLocationCache } from '../utils/UniformLocationCache';
import { Material } from '../materials/Material';

// Note: The Material type will be re‑exported in ENGINE; here we refer to it as ENGINE.Material.
export interface MeshOptions {
  positions: Float32Array;
  normals: Float32Array;
  indices: Uint16Array;
  uv?: Float32Array;
  tangents?: Float32Array;    // Add support for tangents
  bitangents?: Float32Array;  // Add support for bitangents
}

export class Mesh extends Entity {

  // Vertex data
  private positions: Float32Array;
  private normals: Float32Array;
  private indices: Uint16Array;
  private uv?: Float32Array;
  private tangents?: Float32Array;    // Add tangent data
  private bitangents?: Float32Array;  // Add bitangent data

  // WebGL buffers
  public positionsBuffer: WebGLBuffer | null = null;
  public normalBuffer: WebGLBuffer | null = null;
  public uvBuffer: WebGLBuffer | null = null;
  public uv2Buffer: WebGLBuffer | null = null;
  public tangentBuffer: WebGLBuffer | null = null;    // Add tangent buffer
  public bitangentBuffer: WebGLBuffer | null = null;  // Add bitangent buffer
  public indexBuffer: WebGLBuffer | null = null;

  public vertexCount: number;
  public indexCount: number;
  public hasUV: boolean;
  public hasTangents: boolean;  // Track if tangents are available

  // Material - now using the improved Material class
  public material: Material | null = null;

  // Use centralized cache instead of local caching
  private uniformCache: UniformLocationCache;
  private currentProgram: WebGLProgram | null = null;

  private attributes = {
    aPositionLocation: -1,
    aNormalLocation: -1,
    aUVLocation: -1,
    aBitangentLocation: -1,
    aTangentLocation: -1
  }

  constructor(gl : WebGL2RenderingContext, options: MeshOptions) {
    super(gl);
    
    this.positions = options.positions;
    this.normals = options.normals;
    this.indices = options.indices;
    this.uv = options.uv;
    this.tangents = options.tangents;
    this.bitangents = options.bitangents;

    this.vertexCount = this.positions.length / 3;
    this.indexCount = this.indices.length;

    this.hasUV = !!this.uv;
    this.hasTangents = !!this.tangents && !!this.bitangents;

    this.type = Entity.EntityTypes.Mesh;
    
    // Get singleton instance of centralized cache
    this.uniformCache = UniformLocationCache.getInstance();
    if (gl) {
      this.uniformCache.initialize(gl);
    }
    
    // Calculate tangents if we have UVs but no tangents
    if (this.hasUV && !this.hasTangents) {
      this.calculateTangents();
    }
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

    // Optional UV buffer
    if (this.uv) {
      this.uvBuffer = gl.createBuffer();
      if (this.uvBuffer) {
        gl.bindBuffer(gl.ARRAY_BUFFER, this.uvBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, this.uv, gl.STATIC_DRAW);
      }
    }
    
    // Optional tangent buffer
    if (this.tangents) {
      this.tangentBuffer = gl.createBuffer();
      if (this.tangentBuffer) {
        gl.bindBuffer(gl.ARRAY_BUFFER, this.tangentBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, this.tangents, gl.STATIC_DRAW);
      }
    }
    
    // Optional bitangent buffer
    if (this.bitangents) {
      this.bitangentBuffer = gl.createBuffer();
      if (this.bitangentBuffer) {
        gl.bindBuffer(gl.ARRAY_BUFFER, this.bitangentBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, this.bitangents, gl.STATIC_DRAW);
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
   * Calculate tangent and bitangent vectors for normal mapping
   * Based on the method described in "Computing Tangent Space Basis Vectors for an Arbitrary Mesh"
   */
  private calculateTangents(): void {
    if (!this.uv) return;
    
    const vertexCount = this.positions.length / 3;
    this.tangents = new Float32Array(vertexCount * 3);
    this.bitangents = new Float32Array(vertexCount * 3);
    
    // Initialize arrays
    const tan1 = new Float32Array(vertexCount * 3);
    const tan2 = new Float32Array(vertexCount * 3);
    
    // Process each triangle
    for (let i = 0; i < this.indices.length; i += 3) {
      const i1 = this.indices[i];
      const i2 = this.indices[i + 1];
      const i3 = this.indices[i + 2];
      
      // Get vertex positions
      const v1x = this.positions[i1 * 3];
      const v1y = this.positions[i1 * 3 + 1];
      const v1z = this.positions[i1 * 3 + 2];
      
      const v2x = this.positions[i2 * 3];
      const v2y = this.positions[i2 * 3 + 1];
      const v2z = this.positions[i2 * 3 + 2];
      
      const v3x = this.positions[i3 * 3];
      const v3y = this.positions[i3 * 3 + 1];
      const v3z = this.positions[i3 * 3 + 2];
      
      // Get UV coordinates
      const w1u = this.uv[i1 * 2];
      const w1v = this.uv[i1 * 2 + 1];
      
      const w2u = this.uv[i2 * 2];
      const w2v = this.uv[i2 * 2 + 1];
      
      const w3u = this.uv[i3 * 2];
      const w3v = this.uv[i3 * 2 + 1];
      
      // Calculate edges
      const x1 = v2x - v1x;
      const x2 = v3x - v1x;
      const y1 = v2y - v1y;
      const y2 = v3y - v1y;
      const z1 = v2z - v1z;
      const z2 = v3z - v1z;
      
      const s1 = w2u - w1u;
      const s2 = w3u - w1u;
      const t1 = w2v - w1v;
      const t2 = w3v - w1v;
      
      const r = 1.0 / (s1 * t2 - s2 * t1);
      
      const sdirx = (t2 * x1 - t1 * x2) * r;
      const sdiry = (t2 * y1 - t1 * y2) * r;
      const sdirz = (t2 * z1 - t1 * z2) * r;
      
      const tdirx = (s1 * x2 - s2 * x1) * r;
      const tdiry = (s1 * y2 - s2 * y1) * r;
      const tdirz = (s1 * z2 - s2 * z1) * r;
      
      // Accumulate tangents for vertices
      tan1[i1 * 3] += sdirx;
      tan1[i1 * 3 + 1] += sdiry;
      tan1[i1 * 3 + 2] += sdirz;
      
      tan1[i2 * 3] += sdirx;
      tan1[i2 * 3 + 1] += sdiry;
      tan1[i2 * 3 + 2] += sdirz;
      
      tan1[i3 * 3] += sdirx;
      tan1[i3 * 3 + 1] += sdiry;
      tan1[i3 * 3 + 2] += sdirz;
      
      tan2[i1 * 3] += tdirx;
      tan2[i1 * 3 + 1] += tdiry;
      tan2[i1 * 3 + 2] += tdirz;
      
      tan2[i2 * 3] += tdirx;
      tan2[i2 * 3 + 1] += tdiry;
      tan2[i2 * 3 + 2] += tdirz;
      
      tan2[i3 * 3] += tdirx;
      tan2[i3 * 3 + 1] += tdiry;
      tan2[i3 * 3 + 2] += tdirz;
    }
    
    // Orthogonalize and normalize tangents
    for (let i = 0; i < vertexCount; i++) {
      const nx = this.normals[i * 3];
      const ny = this.normals[i * 3 + 1];
      const nz = this.normals[i * 3 + 2];
      
      const tx = tan1[i * 3];
      const ty = tan1[i * 3 + 1];
      const tz = tan1[i * 3 + 2];
      
      // Gram-Schmidt orthogonalize
      const dot = nx * tx + ny * ty + nz * tz;
      const tangentX = tx - nx * dot;
      const tangentY = ty - ny * dot;
      const tangentZ = tz - nz * dot;
      
      // Normalize
      const len = Math.sqrt(tangentX * tangentX + tangentY * tangentY + tangentZ * tangentZ);
      if (len > 0) {
        this.tangents[i * 3] = tangentX / len;
        this.tangents[i * 3 + 1] = tangentY / len;
        this.tangents[i * 3 + 2] = tangentZ / len;
      }
      
      // Calculate bitangent
      const bx = ny * tangentZ - nz * tangentY;
      const by = nz * tangentX - nx * tangentZ;
      const bz = nx * tangentY - ny * tangentX;
      
      // Normalize bitangent
      const blen = Math.sqrt(bx * bx + by * by + bz * bz);
      if (blen > 0) {
        this.bitangents[i * 3] = bx / blen;
        this.bitangents[i * 3 + 1] = by / blen;
        this.bitangents[i * 3 + 2] = bz / blen;
      }
    }
    
    this.hasTangents = true;
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
      this.attributes.aTangentLocation = this.uniformCache.getAttribLocation(program, 'aTangent');
      this.attributes.aBitangentLocation = this.uniformCache.getAttribLocation(program, 'aBitangent');
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
    
    // Bind optional tangent buffer
    if (this.tangentBuffer && this.attributes.aTangentLocation >= 0) {
      gl.bindBuffer(gl.ARRAY_BUFFER, this.tangentBuffer);
      gl.enableVertexAttribArray(this.attributes.aTangentLocation);
      gl.vertexAttribPointer(this.attributes.aTangentLocation, 3, gl.FLOAT, false, 0, 0);
    }
    
    // Bind optional bitangent buffer
    if (this.bitangentBuffer && this.attributes.aBitangentLocation >= 0) {
      gl.bindBuffer(gl.ARRAY_BUFFER, this.bitangentBuffer);
      gl.enableVertexAttribArray(this.attributes.aBitangentLocation);
      gl.vertexAttribPointer(this.attributes.aBitangentLocation, 3, gl.FLOAT, false, 0, 0);
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