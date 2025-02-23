// src/engine/Camera.ts
import { mat4, vec3 } from 'gl-matrix';
import { Entity } from './Entity'

export class Camera extends Entity {
  public name : string = "";
  // Transform fields
  //public position = vec3.fromValues(0.0, 0.0, 5.0 );
  //public rotation = vec3.fromValues( 0, 0, 0 );
  //// Typically scale is not used on cameras, but included for completeness
  //public scale = vec3.fromValues(1,1,1);

  public target = vec3.create();

  // Projection settings
  public fieldOfView: number; // in degrees
  public aspect: number;
  public near: number;
  public far: number;

  constructor(gl: WebGL2RenderingContext, fieldOfView = 45, near = 0.1, far = 100) {
    super(gl);
    this.fieldOfView = fieldOfView;
    this.aspect = 1;
    this.near = near;
    this.far = far;
    this.type = Entity.EntityTypes.Camera;
  }

  getProjectionMatrix(): mat4 {
    const out = mat4.create();
    // Convert FOV to radians
    const fovRad = (this.fieldOfView * Math.PI) / 180;
    mat4.perspective(out, fovRad, this.aspect, this.near, this.far);
    return out;
  }

  getViewMatrix() : mat4 {
    var viewMatrix = mat4.create();
    mat4.lookAt(viewMatrix, this.position, this.target, vec3.fromValues(0, 1, 0));
    return viewMatrix;   
  }

  handleResize(width: number, height: number) {
    this.aspect = width / height;
  }

  debugInfo(): void {
    console.log("Camera Debug Info:");
    console.log("Position:", this.position);
    console.log("Rotation:", this.rotation);
    console.log("Scale:", this.scale);
    console.log(`FOV: ${this.fieldOfView}, Aspect: ${this.aspect}, Near: ${this.near}, Far: ${this.far}`);
  }  
}
