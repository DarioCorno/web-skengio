// src/engine/Scene.ts
import * as ENGINE from '../ENGINE';

export class Scene {
  public name : string = "";
  private meshes: ENGINE.Mesh[] = [];
  private lights: ENGINE.Light[] = [];
  private camera: ENGINE.Camera;
  //transitions parameters
  public startTimecode : number = 0;
  public endTimecode : number = 0;
  public opacity: number = 1;

  constructor(camera: ENGINE.Camera, start: number, end: number) {
    this.camera = camera;
    this.startTimecode = start;
    this.endTimecode = end;
  }

  addMesh(mesh: ENGINE.Mesh): void {
    this.meshes.push(mesh);
  }

  addLight(light: ENGINE.Light): void {
    this.lights.push(light);
  }

  getMeshes(): ENGINE.Mesh[] {
    return this.meshes;
  }

  getLights(): ENGINE.Light[] {
    return this.lights;
  }

  getCamera(): ENGINE.Camera {
    return this.camera;
  }

  debugInfo(): void {
    console.log("Scene Debug Info:");
    console.log(`Meshes count: ${this.meshes.length}`);
    console.log(`Lights count: ${this.lights.length}`);
    console.log("Camera:");
    this.camera.debugInfo();
    for (let i = 0; i < this.meshes.length; i++) {
      console.log(`Mesh ${i} Debug Info:`);
      this.meshes[i].debugInfo();
    }
    for (let i = 0; i < this.lights.length; i++) {
      console.log(`Light ${i} Debug Info:`);
      this.lights[i].debugInfo();
    }
  }  
}
