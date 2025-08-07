// src/engine/Light.ts
import { vec3, mat4 } from 'gl-matrix';
import { Entity } from './Entity'

export class Light extends Entity{
  public color: vec3;
  public intensity: number = 1;

  constructor(gl: WebGL2RenderingContext, position: vec3 = vec3.fromValues(0, 3, 3), color: vec3 = vec3.fromValues(1, 1, 1), intensity : number = 1) {
    super(gl);
    this.position = position;
    this.color = color;
    this.intensity = intensity;
    this.type = Entity.EntityTypes.Light;

  }


  /*
  getModelMatrix(): mat4 {
    const model = mat4.create();
    mat4.translate(model, model, [this.position[0], this.position[1], this.position[2]]);
    return model;
  }
    */

  debugInfo(): void {
    console.log("Light Debug Info:");
    console.log("Position:", this.position);
    console.log("Color:", this.color);
  }  
}
