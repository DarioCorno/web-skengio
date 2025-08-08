// src/engine/ProjectManager.ts
import * as ENGINE from '../ENGINE'; // Import your engine classes
import { vec3, vec4 } from 'gl-matrix';
import { PerformancesDebugger } from '../Utils';

interface SceneData {
    name: string;
    startTimecode: number;
    endTimecode: number;
    camera: {
        name: string,
        fov: number;
        aspect: number;
        near: number;
        far: number;
        position: number[];
        target: number[];
    };
    lights: {
        name: string,
        position: number[];
        color: number[];
        intensity?: number;
        debug?: boolean;
    }[];
    meshes: {   
        name: string,     
        geometry: string; // "cube", "torus", etc. or path to custom geometry
        position: number[];
        rotation: number[];
        scale: number[];
        isStatic?: boolean; // Optional flag to mark mesh as static (never moves)
        material: {
            name: string,
            type: string; // "texture", "color", etc.
            shininess?: number
        };
        texturePaths?: {
            [key: string]: string;
        };
        data?: any;
    }[];
}

interface ProjectData {
    scenes: SceneData[];
    transitionDuration: number; // Duration of crossfade in milliseconds
    canvasSelector: string;
    singleSceneProject?:boolean;
    measureGPUPerformances?: boolean;
    configs: {
        enableGUI: boolean;
        showDebug: boolean; 
        useBitmapFontAtlas: boolean;  
        debugMode: number; 
    }
}

interface ProjectConfigs {
    singleSceneProject: boolean;
    measureGPUPerformances: boolean;
}

export class ProjectManager {
    private wm: ENGINE.WindowManager | null = null;

    private scenes: ENGINE.Scene[] = [];
    private sceneData: SceneData[] = []; // Store loaded scene data
    private textureLoader: ENGINE.Utils.TextureLoader | null = null;
    private gl: WebGL2RenderingContext | null = null;

    private projectData: ProjectData | null = null;
    private currentScene: ENGINE.Scene | null = null;
    private nextScene: ENGINE.Scene | null = null;
    private transitionStartTime: number | null = null;    
    private bitmapFontAtlas : ENGINE.Utils.BitmapFontAtlas | null = null;

    private pConfigs : ProjectConfigs = {
        measureGPUPerformances: false,
        singleSceneProject: false
    };
    private firstUpdate: boolean = false;   //did at least one update function ran? Used by single scene projects    
    private GPUPerfsDebugger : PerformancesDebugger | null = null;

    constructor() {
        console.log('Initializing project...');
    }

    async loadProject(projectJson: any) : Promise<void> {
        try {
            this.projectData = projectJson as ProjectData; // Type the JSON data

            this.pConfigs.measureGPUPerformances = (this.projectData.measureGPUPerformances ?? false);

            //create a window manager
            this.wm = new ENGINE.WindowManager(this.projectData.canvasSelector, this.projectData.configs);
            
            this.gl = this.wm.gl;
            if(this.gl) {
                this.textureLoader = new ENGINE.Utils.TextureLoader(this.gl);
            } else {
                throw new Error('Cannot create TextureLoader. GL missing');
            }

            if(this.pConfigs.measureGPUPerformances) {
                this.GPUPerfsDebugger = new PerformancesDebugger(this.gl);
            }
    
            if(this.projectData.configs.useBitmapFontAtlas) {
                this.bitmapFontAtlas = new ENGINE.Utils.BitmapFontAtlas('Arial', '#fff', '#000', 512, true);
            }

            for (const sceneData of this.projectData.scenes) {
                const scene = await this.createScene(sceneData);
                this.scenes.push(scene);
            }
            
        } catch(error) {
            console.log("Error loading Project:", error)
            console.trace();
            throw new Error("Cannot load project");            
        }
    }

    getWM() : ENGINE.WindowManager | null {
        return this.wm;
    }

    getEntityByName(name: string) : any {

        for (let i = 0; i < this.scenes.length; i++) {
            const scene = this.scenes[i];
            if(scene.name == name) {
                return this.scenes[i];
            }

            if(scene.getCamera().name == name) {
                return scene.getCamera();
            }

            const meshes = scene.getMeshes();

            for(let u = 0; u < meshes.length; u++) {
                if(meshes[u].name == name) {
                    return meshes[u];
                }
                if(meshes[u].material) {
                    if(meshes[u].material.name == name) {
                        return meshes[u].material;
                    }
                }
            }

            const lights = scene.getLights();
            for(let u = 0; u < lights.length; u++) {
                if(lights[u].name == name) {
                    return lights[u];
                }
            }

        }
    }

    private async createScene(sceneData: SceneData): Promise<ENGINE.Scene> {
        if(!this.gl) throw new Error('Cannot create scene. GL Missing');

        const cameraData = sceneData.camera;
        const camera = new ENGINE.Camera(
            this.gl,
            cameraData.fov,
            cameraData.near,
            cameraData.far
        );
        //JSON can't contain an aspect ratio calculation, so set it now
        camera.aspect = this.gl.drawingBufferWidth / this.gl.drawingBufferHeight;
        camera.name = cameraData.name ?? "Camera" + performance.now().toString();

        vec3.set(camera.position, cameraData.position[0], cameraData.position[1],cameraData.position[2]); // Use gl-matrix to set position
        vec3.set(camera.target, cameraData.target[0], cameraData.target[1],cameraData.target[2]); // Use gl-matrix to set position

        const scene = new ENGINE.Scene(camera, sceneData.startTimecode, sceneData.endTimecode);
        scene.name = sceneData.name ?? "Scene" + performance.now().toString();

        for (const lightData of sceneData.lights) {
            const light = new ENGINE.Light(
                this.gl,
                vec3.fromValues(lightData.position[0], lightData.position[1], lightData.position[2]),
                vec3.fromValues(lightData.color[0], lightData.color[1], lightData.color[2]),
                lightData.intensity ?? 1
            );
            light.name = lightData.name ?? "Light" + performance.now().toString();
            scene.addLight(light);
            if(lightData.debug == true) {
                scene.addMesh( light.getDebugMesh(this.gl) );
            }
        }

        for (const meshData of sceneData.meshes) {
            let meshOptions;
            const isStatic = meshData.isStatic ?? false; // Check if mesh is marked as static

            switch (meshData.geometry) {
                case 'cube':
                    meshOptions = ENGINE.Utils.GeometryGenerator.generateCube();
                    break;
                case 'torus':
                    let torusData = {
                        radius : 0.4, 
                        tubeRadius : 0.3, 
                        radialSegments :32, 
                        tubularSegments : 16
                    }
                    if(meshData.data) {
                        torusData = meshData.data;
                    }                         
                    meshOptions = ENGINE.Utils.GeometryGenerator.generateTorus(
                        torusData.radius, 
                        torusData.tubeRadius,
                        torusData.radialSegments, 
                        torusData.tubularSegments
                    );
                    break;
                case 'sphere':
                    let sphereData = {
                        radius: 0.7,
                        wSegments: 12,
                        hSegments: 12
                    };
                    if(meshData.data) {
                        sphereData = meshData.data;
                    }
                    meshOptions = ENGINE.Utils.GeometryGenerator.generateSphere(
                        sphereData.radius, 
                        sphereData.wSegments, 
                        sphereData.hSegments
                    );
                    break;
                case '3Dtext':
                    if(!this.bitmapFontAtlas) throw new Error('Project includes 3Dtext mesh but no font atlas defined');
                    meshOptions = ENGINE.Utils.GeometryGenerator.GenerateTextMesh(meshData.data as string , this.bitmapFontAtlas , 0, 0);
                    break;
                // Add more cases for other geometries
                default:
                    console.warn(`Unknown geometry type: ${meshData.geometry}`);
                    continue; // Skip this mesh
            }

            const mesh = new ENGINE.Mesh(this.gl, meshOptions);
            mesh.name = meshData.name ?? "Mesh" + performance.now().toString();

            mesh.setPosition(vec3.fromValues( meshData.position[0], meshData.position[1], meshData.position[2] ));
            mesh.setRotation(vec3.fromValues( meshData.rotation[0], meshData.rotation[1], meshData.rotation[2] ));
            mesh.setScale( vec3.fromValues( meshData.scale[0], meshData.scale[1], meshData.scale[2] ));
            
            // Mark as static if specified in the project data
            if (isStatic) {
                mesh.setStatic(true);
            }
            
            mesh.init();
            scene.addMesh(mesh);

            const material = this.createMaterial(meshData.material);
            material.name = meshData.material.name ?? "Material" + performance.now().toString();
            material.shininess = meshData.material.shininess ?? 0.0;
            mesh.material = material;

            if(meshData.texturePaths) {
                for (const textureName in meshData.texturePaths) {
                    const texturePath = meshData.texturePaths[textureName];
                    const texture = await this.textureLoader.loadTexture(texturePath);
                    material.setTexture(textureName, texture);
                }
            } else if (meshData.material.type == 'fontatlas') {
                //this material uses the fontatlas as a texture
                const texture = this.textureLoader.createColoredTransparentTextureFromCanvas(this.bitmapFontAtlas.getCanvas() ,255,0,0);
                material.setTexture('diffuse', texture);
            }
        }

        return scene;
    }

    private createMaterial(materialData: any): ENGINE.Materials.Material {
        switch (materialData.type) {
            case 'texture':
                const matTexture = new ENGINE.Materials.MaterialTexture();
                matTexture.shininess = parseFloat(materialData.shininess) ?? 0.0;
                return matTexture;
            case 'color':
                const matColor =  new ENGINE.Materials.MaterialColor();
                matColor.color = vec4.fromValues(1.0, 0.0, 1.0, 1.0);
                matColor.shininess = parseFloat(materialData.shininess) ?? 0;
                return matColor;
                // Add more cases for other material types
            case 'fontatlas':
                const matAtlas = new ENGINE.Materials.MaterialTexture();
                matAtlas.isTransparent = false;
                matAtlas.shininess = 0.0;
                return matAtlas;
            default:
                console.warn(`Unknown material type: ${materialData.type}`);
                return new ENGINE.Materials.Material(); // Default material
        }
    }

    
    handleResize() {
        // Get the new dimensions
        const winWidth = window.innerWidth;
        const winHeight = window.innerHeight;
        
        // Get the device pixel ratio for high-DPI screens
        const dpr = window.devicePixelRatio || 1;    
        const width = winWidth * dpr;
        const height = winHeight * dpr;        

        this.wm?.handleResize(width, height);
        this.scenes.forEach( (scn) => {
            scn.getCamera().handleResize(width, height);
        })
    }
    

    update() {
        if(!this.wm) return;

        if(this.pConfigs.singleSceneProject && this.firstUpdate == true) return;

        this.wm.update();
        const time = this.wm.timer.getTime().elapsed / 1000.0;

        let activeScene: ENGINE.Scene | null = null;
        let nextScene: ENGINE.Scene | null = null;

        for (let i = 0; i < this.scenes.length; i++) {
            const scene = this.scenes[i];
            if (time >= scene.startTimecode && time <= scene.endTimecode) {
                activeScene = scene;
                break; // One active scene at a time (for now)
            } else if (time > scene.endTimecode && i < this.scenes.length - 1 && time < this.scenes[i + 1].startTimecode) {
                nextScene = this.scenes[i + 1];
                break; // Found the next scene
            }
        }

        if (activeScene !== this.currentScene) {
            this.transitionStartTime = time; // Start transition
        }

        this.currentScene = activeScene;
        this.nextScene = nextScene;

        if (this.transitionStartTime !== null) {
            const transitionProgress = Math.min(1, (time - this.transitionStartTime) / this.projectData!.transitionDuration); // Clamp to 0-1
            const transitionComplete = transitionProgress >= 1;

            if (this.currentScene) {
                this.currentScene.opacity = 1 - transitionProgress;
            }

            if (this.nextScene) {
                this.nextScene.opacity = transitionProgress;
            }

            if (transitionComplete) {
                this.transitionStartTime = null; // End transition
                if(this.nextScene) this.currentScene = this.nextScene;
                this.nextScene = null;
            }
        } else if (this.currentScene) {
            this.currentScene.opacity = 1; // Ensure full opacity if no transition
        }

        this.firstUpdate = true;
    }

    render() {
        if(this.currentScene && this.wm?.isReady()) {
            if(this.pConfigs.measureGPUPerformances && this.GPUPerfsDebugger) {
                this.GPUPerfsDebugger.measureRenderPass(() => {

                    this.wm.renderer.render(this.currentScene);

                })
                .then((gpuTimeMs) => {
                  if (gpuTimeMs >= 0) {
                    // Calculate approximate FPS based solely on the measured GPU time
                    const fps = 1000 / gpuTimeMs;
                    console.log(`GPU Time: ${gpuTimeMs.toFixed(2)} ms, approx FPS: ${fps.toFixed(2)}`);
                  } else {
                    //console.log("GPU timing measurement unavailable due to disjoint event.");
                  }
                })
                .catch((error) => {
                  console.error("Performance measurement error:", error);
                });
            } else {
                this.wm.renderer.render(this.currentScene);
            }
        }
    }

    getCurrentScene(): ENGINE.Scene | null {
        return this.currentScene;
    }
}