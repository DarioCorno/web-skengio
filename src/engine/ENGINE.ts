// src/engine/ENGINE.ts
/*
import { Scene as SceneClass } from './src/Scene';
import { Mesh as MeshClass } from './src/Mesh';
import { Light as LightClass } from './src/Light';
import { Camera as CameraClass } from './src/Camera';
import { Renderer as RendererClass } from './src/Renderer';
import { WindowManager as WindowManagerClass } from './src/WIndowManager'
import * as MaterialModule from './src/Material'
import { ComposerClass as ComposerClassClass } from './src/ComposerClass';
import { ShadersUtility as ShadersUtilityClass } from './utils/ShadersUtilityClass'
import { GeometryGenerator as GeometryGeneratorClass} from './utils/GeometryGenerator';

export namespace ENGINE {
  export import Material = MaterialModule.Material;
  export import MaterialBasic = MaterialModule.MaterialBasic;

  export class Scene extends SceneClass {}
  export class Camera extends CameraClass {}
  export class Renderer extends RendererClass {}
  export class Light extends LightClass {}
  export class Mesh extends MeshClass {}
  export class WindowManager extends WindowManagerClass {}
  export class ComposerClass extends ComposerClassClass {}

  export namespace Utils {
    export class ShadersUtility extends ShadersUtilityClass {}
    export class GeometryGenerator extends GeometryGeneratorClass {}
  }  
}
  */

import { Scene } from './src/Scene';
import { Mesh } from './src/Mesh';
import { Light } from './src/Light';
import { Camera } from './src/Camera';
import { Renderer } from './src/Renderer';
import { ForwardRenderer } from './src/ForwardRenderer';
import { DeferredRenderer } from './src/DeferredRenderer';
import { WindowManager } from './src/WIndowManager'
import { ComposerClass } from './src/ComposerClass';
import { ProjectManager } from './src/ProjectManager';

import * as Utils from './Utils'
import * as Materials from './Materials'

export {
  Scene, 
  Mesh, 
  Light, 
  Camera, 
  Renderer, 
  ForwardRenderer,
  DeferredRenderer,
  WindowManager, 
  ComposerClass,
  ProjectManager,
  Materials,  
  Utils
}

