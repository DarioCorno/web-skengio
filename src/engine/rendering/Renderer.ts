// Renderer.ts
import * as EGNINE from '../ENGINE'

export abstract class Renderer {
  protected gl: WebGL2RenderingContext;

  constructor(gl: WebGL2RenderingContext) {
    this.gl = gl;
  }

  // Render the scene using the given camera
  abstract render(scene: EGNINE.Scene): void;

  abstract init(): void;
  
  abstract setDebugMode(debugMode: number): void;

  // Handle canvas resize
  abstract setSize(width: number, height: number): void;
}