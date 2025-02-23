// src/engine/Mesh.ts
import { mat4, vec3 } from 'gl-matrix';
import { Entity } from './Entity'
import * as ENGINE from '../ENGINE';

// Note: The Material type will be re‑exported in ENGINE; here we refer to it as ENGINE.Material.
export interface MeshOptions {
  positions: Float32Array;
  normals: Float32Array;
  indices: Uint16Array;
  uv?: Float32Array;
}

export class Mesh extends Entity {
  private isDirty: boolean = true;

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

  private attribsLocationsSet: boolean = false;
  
  private uniforms: { [name: string]: WebGLUniformLocation | null } = {};

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

  }

  setDirty(): void {
    this.isDirty = true;
  }

  clearDirty(): void {
    this.isDirty = false;
  }

  getDirty(): boolean {
    return this.isDirty;
  }

  init(): void {
    const gl = this.gl;
    // Create and fill position buffer
    this.positionsBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.positionsBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, this.positions, gl.STATIC_DRAW);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(0);

    // Create and fill normal buffer
    this.normalBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.normalBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, this.normals, gl.STATIC_DRAW);
    gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(1);

    // Optional UV buffers
    if (this.uv) {
      this.uvBuffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, this.uvBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, this.uv, gl.STATIC_DRAW);
      gl.vertexAttribPointer(2, 2, gl.FLOAT, false, 0, 0);
      gl.enableVertexAttribArray(2);      
    }

    // Create and fill index buffer
    this.indexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, this.indices, gl.STATIC_DRAW);
  }


  //given a shaderPrograms finds the uniforms needed to render this mesh
  retrieveAttribsLocations(gl: WebGL2RenderingContext, program: WebGLProgram) {
    if(this.attribsLocationsSet) return;

    this.attributes.aPositionLocation = gl.getAttribLocation(program, 'aPosition');
    this.attributes.aNormalLocation   = gl.getAttribLocation(program, 'aNormal');
    this.attributes.aUVLocation       = gl.getAttribLocation(program, 'aUV'); 

    this.attribsLocationsSet = true;
  }

  bindAttribsBuffers(gl: WebGL2RenderingContext) {
      // Bind and enable position buffer.
      gl.bindBuffer(gl.ARRAY_BUFFER, this.positionsBuffer);
      gl.enableVertexAttribArray(this.attributes.aPositionLocation);
      gl.vertexAttribPointer(this.attributes.aPositionLocation, 3, gl.FLOAT, false, 0, 0);

      // Bind and enable normal buffer.
      gl.bindBuffer(gl.ARRAY_BUFFER, this.normalBuffer);
      gl.enableVertexAttribArray(this.attributes.aNormalLocation);
      gl.vertexAttribPointer(this.attributes.aNormalLocation, 3, gl.FLOAT, false, 0, 0);

      // Bind optional UV buffer.
      if (this.uvBuffer) {
        gl.bindBuffer(gl.ARRAY_BUFFER, this.uvBuffer);
        gl.enableVertexAttribArray(this.attributes.aUVLocation);
        gl.vertexAttribPointer(this.attributes.aUVLocation, 2, gl.FLOAT, false, 0, 0);
      }
  }

  draw(gl: WebGL2RenderingContext) {
      // Bind the index buffer and draw the mesh using indexed rendering.
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indexBuffer);
      gl.drawElements(gl.TRIANGLES, this.indexCount, gl.UNSIGNED_SHORT, 0);
  }

  debugInfo(): void {
    console.log("Mesh Debug Info:");
    console.log("Position:", this.position);
    console.log("Rotation:", this.rotation);
    console.log("Scale:", this.scale);
    console.log(`Vertex Count: ${this.vertexCount}, Index Count: ${this.indexCount}`);
    console.log("Dirty:", this.getDirty());
    if (this.material) {
      console.log("Material Debug Info:");
      this.material.debugInfo();
    }
  }  
}
