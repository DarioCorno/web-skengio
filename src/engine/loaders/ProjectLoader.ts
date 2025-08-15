// src/engine/loaders/ProjectLoader.ts
import * as ENGINE from '../ENGINE';
import { vec3 } from 'gl-matrix';
import { PerformancesDebugger } from '../utils/PerformancesDebugger';
import { MaterialManager } from '../materials/MaterialManager';

/**
 * Material definition in project JSON
 */
interface MaterialData {
    id?: string;                // Unique identifier for global materials
    name: string;
    type: 'pbr' | 'unlit' | 'emissive' | 'simple' | 'texture' | 'color';
    
    // Base properties
    baseColor?: number[];          // RGBA color [0-1]
    metallic?: number;              // 0-1
    roughness?: number;             // 0-1
    
    // Emissive properties
    emissive?: number[];            // RGB color [0-1]
    emissiveIntensity?: number;     // Multiplier
    
    // Additional properties
    normalScale?: number;           // Normal map intensity
    occlusionStrength?: number;     // AO map strength
    alphaCutoff?: number;           // Alpha test threshold
    
    // Legacy support
    color?: number[];               // RGBA color [0-1] (fallback for baseColor)
    shininess?: number;             // Specular power (will be converted to roughness)
    
    // Transparency
    transparent?: boolean;          // Enable transparency
    alphaMode?: 'OPAQUE' | 'MASK' | 'BLEND'; // Alpha handling
    
    // Render state
    doubleSided?: boolean;          // Disable backface culling
    unlit?: boolean;                // Skip lighting calculations
    
    // Textures
    textures?: {
        diffuse?: string;
        normal?: string;
        metallicRoughness?: string;
        emissive?: string;
        occlusion?: string;
    };
}

/**
 * Mesh definition in project JSON
 */
interface MeshData {
    name: string;
    geometry: string;
    position: number[];
    rotation: number[];
    scale: number[];
    isStatic?: boolean;
    materialId?: string;        // Reference to material ID
    material?: MaterialData;    // Inline material definition (backward compatibility)
    texturePaths?: {            // Legacy texture paths (backward compatibility)
        diffuse?: string;
        normal?: string;
        metallicRoughness?: string;
        emissive?: string;
        occlusion?: string;
    };
    data?: any;
}

/**
 * Scene definition in project JSON
 */
interface SceneData {
    name: string;
    startTimecode: number;
    endTimecode: number;
    camera: {
        name: string;
        fov: number;
        aspect: number;
        near: number;
        far: number;
        position: number[];
        target: number[];
    };
    lights: {
        name: string;
        position: number[];
        color: number[];
        intensity?: number;
        debug?: boolean;
    }[];
    meshes: MeshData[];
}

/**
 * Project configuration
 */
interface ProjectData {
    scenes: SceneData[];
    materials?: MaterialData[];  // Global materials definition
    transitionDuration?: number;
    canvasSelector: string;
    singleSceneProject?: boolean;
    measureGPUPerformances?: boolean;
    configs: {
        enableGUI: boolean;
        showDebug: boolean;
        useBitmapFontAtlas: boolean;
        debugMode: number;
        enableInput?: boolean;
    };
}

interface ProjectConfigs {
    singleSceneProject: boolean;
    measureGPUPerformances: boolean;
}

/**
 * Callback function types for animation loop
 */
export type InitCallback = (manager: ProjectManager) => void;
export type UpdateCallback = (manager: ProjectManager, deltaTime: number, time: number) => void;

/**
 * ProjectManager handles loading and managing scenes from JSON configuration
 * Now includes MaterialManager integration
 */
export class ProjectManager {
    private wm: ENGINE.WindowManager | null = null;
    private scenes: ENGINE.Scene[] = [];
    private sceneData: SceneData[] = [];
    private textureLoader: ENGINE.Utils.TextureLoader | null = null;
    private gl: WebGL2RenderingContext | null = null;
    private materialManager: MaterialManager;

    private projectData: ProjectData | null = null;
    private currentScene: ENGINE.Scene | null = null;
    private nextScene: ENGINE.Scene | null = null;
    private transitionStartTime: number | null = null;
    private bitmapFontAtlas: ENGINE.Utils.BitmapFontAtlas | null = null;

    private pConfigs: ProjectConfigs = {
        measureGPUPerformances: false,
        singleSceneProject: false
    };
    private firstUpdate: boolean = false;
    private GPUPerfsDebugger: PerformancesDebugger | null = null;

    // Animation loop properties
    private animationFrameId: number | null = null;
    private isAnimating: boolean = false;
    private initCallback: InitCallback | null = null;
    private updateCallback: UpdateCallback | null = null;
    private hasInitialized: boolean = false;

    constructor() {
        console.log('Initializing ProjectManager...');
        // Get MaterialManager singleton instance
        this.materialManager = MaterialManager.getInstance();
    }

    /**
     * Load project from JSON configuration
     * @param {any} projectJson - Project configuration object
     */
    async loadProject(projectJson: any): Promise<void> {
        try {
            this.projectData = projectJson as ProjectData;

            this.pConfigs.measureGPUPerformances = this.projectData.measureGPUPerformances ?? false;
            this.pConfigs.singleSceneProject = this.projectData.singleSceneProject ?? false;

            // Create window manager
            this.wm = new ENGINE.WindowManager(this.projectData.canvasSelector, this.projectData.configs);
            
            this.gl = this.wm.gl;
            if (!this.gl) {
                throw new Error('Cannot create TextureLoader. GL missing');
            }
            
            this.textureLoader = new ENGINE.Utils.TextureLoader(this.gl);
            
            // Initialize MaterialManager
            this.materialManager.initialize(this.gl, this.textureLoader);

            if (this.pConfigs.measureGPUPerformances) {
                this.GPUPerfsDebugger = new PerformancesDebugger(this.gl);
            }

            if (this.projectData.configs.useBitmapFontAtlas) {
                this.bitmapFontAtlas = new ENGINE.Utils.BitmapFontAtlas('Arial', '#fff', '#000', 512, true);
            }

            // Load global materials first
            if (this.projectData.materials) {
                console.log(`Loading ${this.projectData.materials.length} global materials...`);
                await this.loadGlobalMaterials(this.projectData.materials);
            }

            // Load all scenes
            for (const sceneData of this.projectData.scenes) {
                const scene = await this.createScene(sceneData);
                this.scenes.push(scene);
                this.sceneData.push(sceneData);
            }

            console.log(`Loaded ${this.scenes.length} scene(s)`);
            
            // Log material statistics
            const stats = this.materialManager.getStatistics();
            console.log(`Materials loaded: ${stats.materialCount}`);
            console.log(`Textures cached: ${stats.texturesCached}`);
            
            // Handle initial resize
            this.handleResize();
            
            // Set up resize listener
            window.addEventListener('resize', () => this.handleResize());
            
        } catch (error) {
            console.error("Error loading Project:", error);
            console.trace();
            throw new Error("Cannot load project");
        }
    }

    /**
     * Load global materials into MaterialManager
     * @param {MaterialData[]} materials - Array of material definitions
     */
    private async loadGlobalMaterials(materials: MaterialData[]): Promise<void> {
        for (const materialData of materials) {
            if (!materialData.id) {
                console.warn('Material missing ID, skipping:', materialData);
                continue;
            }
            
            try {
                const material = await this.materialManager.createMaterialFromData(materialData);
                this.materialManager.registerMaterial(materialData.id, material);
                console.log(`Loaded material: ${materialData.id} (${materialData.name})`);
            } catch (error) {
                console.error(`Failed to load material ${materialData.id}:`, error);
            }
        }
    }

    /**
     * Create a scene from configuration data
     * @param {SceneData} sceneData - Scene configuration
     * @returns {Promise<ENGINE.Scene>} Created scene
     */
    private async createScene(sceneData: SceneData): Promise<ENGINE.Scene> {
        if (!this.gl) throw new Error('Cannot create scene. GL Missing');

        // Create camera
        const cameraData = sceneData.camera;
        const camera = new ENGINE.Camera(
            this.gl,
            cameraData.fov,
            cameraData.near,
            cameraData.far
        );
        
        // Set camera properties
        camera.aspect = this.gl.drawingBufferWidth / this.gl.drawingBufferHeight;
        camera.name = cameraData.name ?? `Camera_${performance.now()}`;
        camera.setPosition(vec3.fromValues(
            cameraData.position[0],
            cameraData.position[1],
            cameraData.position[2]
        ));
        camera.target = vec3.fromValues(
            cameraData.target[0],
            cameraData.target[1],
            cameraData.target[2]
        );

        // Create scene
        const scene = new ENGINE.Scene(camera, sceneData.startTimecode, sceneData.endTimecode);
        scene.name = sceneData.name ?? `Scene_${performance.now()}`;

        // Add lights
        for (const lightData of sceneData.lights) {
            const light = new ENGINE.Light(
                this.gl,
                vec3.fromValues(lightData.position[0], lightData.position[1], lightData.position[2]),
                vec3.fromValues(lightData.color[0], lightData.color[1], lightData.color[2]),
                lightData.intensity ?? 1.0
            );
            light.name = lightData.name ?? `Light_${performance.now()}`;
            scene.addLight(light);
            
            // Add debug mesh if requested
            if (lightData.debug === true) {
                const debugMesh = light.getDebugMesh(this.gl);
                if (debugMesh) {
                    scene.addMesh(debugMesh);
                }
            }
        }

        // Add meshes
        for (const meshData of sceneData.meshes) {
            const mesh = await this.createMesh(meshData);
            if (mesh) {
                scene.addMesh(mesh);
            }
        }

        return scene;
    }

    /**
     * Create a mesh from configuration data
     * @param {MeshData} meshData - Mesh configuration
     * @returns {Promise<ENGINE.Mesh | null>} Created mesh or null
     */
    private async createMesh(meshData: MeshData): Promise<ENGINE.Mesh | null> {
        if (!this.gl) return null;

        let meshOptions;
        const isStatic = meshData.isStatic ?? false;

        // Generate geometry based on type
        switch (meshData.geometry) {
            case 'cube':
                meshOptions = ENGINE.Utils.GeometryGenerator.generateCube(
                    meshData.data?.width ?? 1.0,
                    meshData.data?.height ?? 1.0,
                    meshData.data?.depth ?? 1.0
                );
                break;
                
            case 'plane':
                meshOptions = ENGINE.Utils.GeometryGenerator.generatePlane(
                    meshData.data?.width ?? 1.0,
                    meshData.data?.height ?? 1.0,
                    meshData.data?.widthSegments ?? 1,
                    meshData.data?.heightSegments ?? 1
                );
                break;
                
            case 'sphere':
                meshOptions = ENGINE.Utils.GeometryGenerator.generateSphere(
                    meshData.data?.radius ?? 1.0,
                    meshData.data?.widthSegments ?? 16,
                    meshData.data?.heightSegments ?? 12
                );
                break;
                
            case 'torus':
                meshOptions = ENGINE.Utils.GeometryGenerator.generateTorus(
                    meshData.data?.radius ?? 1.0,
                    meshData.data?.tubeRadius ?? 0.4,
                    meshData.data?.radialSegments ?? 16,
                    meshData.data?.tubularSegments ?? 16
                );
                break;
                
            case '3Dtext':
                if (!this.bitmapFontAtlas) {
                    throw new Error('Project includes 3Dtext mesh but no font atlas defined');
                }
                meshOptions = ENGINE.Utils.GeometryGenerator.GenerateTextMesh(
                    meshData.data as string,
                    this.bitmapFontAtlas,
                    0,
                    0
                );
                break;
                
            default:
                console.warn(`Unknown geometry type: ${meshData.geometry}`);
                return null;
        }

        // Create mesh
        const mesh = new ENGINE.Mesh(this.gl, meshOptions);
        mesh.name = meshData.name ?? `Mesh_${performance.now()}`;

        // Set transform
        mesh.setPosition(vec3.fromValues(
            meshData.position[0],
            meshData.position[1],
            meshData.position[2]
        ));
        mesh.setRotation(vec3.fromValues(
            meshData.rotation[0],
            meshData.rotation[1],
            meshData.rotation[2]
        ));
        mesh.setScale(vec3.fromValues(
            meshData.scale[0],
            meshData.scale[1],
            meshData.scale[2]
        ));

        // Mark as static if specified
        if (isStatic) {
            mesh.setStatic(true);
        }

        // Initialize mesh buffers
        mesh.init();

        // Get or create material
        let material: ENGINE.Materials.Material | null = null;
        
        // First, check if a materialId is specified
        if (meshData.materialId) {
            material = this.materialManager.getMaterial(meshData.materialId);
            if (material) {
                console.log(`Mesh '${mesh.name}' using material: ${meshData.materialId}`);
            } else {
                console.warn(`Material ID '${meshData.materialId}' not found for mesh '${mesh.name}'`);
            }
        }
        
        // If no material found yet, check for inline material definition (backward compatibility)
        if (!material && meshData.material) {
            console.log(`Creating inline material for mesh '${mesh.name}'`);
            // Merge texturePaths into material data for backward compatibility
            if (meshData.texturePaths) {
                meshData.material.textures = meshData.texturePaths;
            }
            material = await this.materialManager.createMaterialFromData(meshData.material);
            
            // Optionally register this material for reuse
            const inlineId = `inline_${mesh.name}_${performance.now()}`;
            this.materialManager.registerMaterial(inlineId, material);
        }
        
        // If still no material, create a default one
        if (!material) {
            console.warn(`No material specified for mesh '${mesh.name}', using default`);
            material = ENGINE.Materials.Material.createColorMaterial(1.0, 1.0, 1.0, 1.0);
        }
        
        mesh.material = material;

        return mesh;
    }

    /**
     * Start the animation loop with optional callbacks
     * @param {InitCallback} initCallback - Called once after first frame
     * @param {UpdateCallback} updateCallback - Called every frame before render
     */
    public startAnimation(initCallback?: InitCallback, updateCallback?: UpdateCallback): void {
        if (this.isAnimating) {
            console.warn('Animation already running');
            return;
        }
        
        this.initCallback = initCallback || null;
        this.updateCallback = updateCallback || null;
        this.isAnimating = true;
        this.hasInitialized = false;
        
        // Hide loading screen if it exists
        const loading = document.getElementById('loading-screen');
        if (loading) {
            loading.style.display = 'none';
        }
        
        console.log('Starting animation loop');
        this.animate();
    }
    
    /**
     * Stop the animation loop
     */
    public stopAnimation(): void {
        this.isAnimating = false;
        if (this.animationFrameId !== null) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
        console.log('Animation loop stopped');
    }
    
    /**
     * Main animation loop
     */
    private animate = (): void => {
        if (!this.isAnimating) return;
        
        // Request next frame first
        this.animationFrameId = requestAnimationFrame(this.animate);
        
        // Call init callback on first frame
        if (!this.hasInitialized) {
            this.hasInitialized = true;
            if (this.initCallback) {
                this.initCallback(this);
            }
        }
        
        // Update timing
        this.update();
        
        // Get timer for deltaTime and elapsed time
        const timer = this.wm?.timer;
        if (timer) {
            const deltaTime = timer.getDeltaTime() / 1000.0; // Convert to seconds
            const elapsed = timer.getElapsedTime() / 1000.0; // Convert to seconds
            
            // Call update callback if provided
            if (this.updateCallback) {
                this.updateCallback(this, deltaTime, elapsed);
            }
        }
        
        // Start render timing
        if (timer) {
            timer.startRender();
        }
        
        // Render the scene
        this.render();
        
        // End render timing
        if (timer) {
            timer.endRender();
        }
    }

    /**
     * Get window manager instance
     * @returns {ENGINE.WindowManager | null} Window manager or null
     */
    getWM(): ENGINE.WindowManager | null {
        return this.wm;
    }

    /**
     * Get entity by name from any scene
     * @param {string} name - Entity name to search for
     * @returns {any} Found entity or undefined
     */
    getEntityByName(name: string): any {
        for (const scene of this.scenes) {
            if (scene.name === name) {
                return scene;
            }

            if (scene.getCamera().name === name) {
                return scene.getCamera();
            }

            const meshes = scene.getMeshes();
            for (const mesh of meshes) {
                if (mesh.name === name) {
                    return mesh;
                }
                if (mesh.material && mesh.material.name === name) {
                    return mesh.material;
                }
            }

            const lights = scene.getLights();
            for (const light of lights) {
                if (light.name === name) {
                    return light;
                }
            }
        }
        
        return undefined;
    }

    /**
     * Handle window resize
     */
    handleResize(): void {
        const winWidth = window.innerWidth;
        const winHeight = window.innerHeight;
        
        const dpr = window.devicePixelRatio || 1;
        const width = winWidth * dpr;
        const height = winHeight * dpr;

        this.wm?.handleResize(width, height);
        
        for (const scene of this.scenes) {
            scene.getCamera().handleResize(width, height);
        }
    }

    /**
     * Update scene transitions and timing
     */
    update(): void {
        if (!this.wm) return;

        if (this.pConfigs.singleSceneProject && this.firstUpdate) return;

        this.wm.update();
        const time = this.wm.timer.getTime().elapsed / 1000.0;

        let activeScene: ENGINE.Scene | null = null;
        let nextScene: ENGINE.Scene | null = null;

        // Find active scene based on timecode
        for (let i = 0; i < this.scenes.length; i++) {
            const scene = this.scenes[i];
            if (time >= scene.startTimecode && time <= scene.endTimecode) {
                activeScene = scene;
                break;
            } else if (
                time > scene.endTimecode &&
                i < this.scenes.length - 1 &&
                time < this.scenes[i + 1].startTimecode
            ) {
                nextScene = this.scenes[i + 1];
                break;
            }
        }

        // Handle scene transitions
        if (activeScene !== this.currentScene) {
            this.transitionStartTime = time;
        }

        this.currentScene = activeScene;
        this.nextScene = nextScene;

        // Calculate transition opacity
        if (this.transitionStartTime !== null && this.projectData) {
            const transitionDuration = (this.projectData.transitionDuration ?? 1000) / 1000.0;
            const transitionProgress = Math.min(1, (time - this.transitionStartTime) / transitionDuration);
            const transitionComplete = transitionProgress >= 1;

            if (this.currentScene) {
                this.currentScene.opacity = 1 - transitionProgress;
            }

            if (this.nextScene) {
                this.nextScene.opacity = transitionProgress;
            }

            if (transitionComplete) {
                this.transitionStartTime = null;
                if (this.nextScene) {
                    this.currentScene = this.nextScene;
                }
                this.nextScene = null;
            }
        } else if (this.currentScene) {
            this.currentScene.opacity = 1;
        }

        this.firstUpdate = true;
    }

    /**
     * Render current scene
     */
    render(): void {
        if (this.currentScene && this.wm?.isReady()) {
            if (this.pConfigs.measureGPUPerformances && this.GPUPerfsDebugger) {
                this.GPUPerfsDebugger.measureRenderPass(() => {
                    this.wm!.renderer.render(this.currentScene!);
                })
                .then((gpuTimeMs) => {
                    if (gpuTimeMs >= 0) {
                        const fps = 1000 / gpuTimeMs;
                        console.log(`GPU Time: ${gpuTimeMs.toFixed(2)} ms, approx FPS: ${fps.toFixed(2)}`);
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

    /**
     * Get the MaterialManager instance
     * @returns {MaterialManager} The material manager
     */
    public getMaterialManager(): MaterialManager {
        return this.materialManager;
    }
    
    /**
     * Get a material by ID
     * @param {string} id - Material ID
     * @returns {ENGINE.Materials.Material | null} The material or null
     */
    public getMaterial(id: string): ENGINE.Materials.Material | null {
        return this.materialManager.getMaterial(id);
    }

    /**
     * Get current active scene
     * @returns {ENGINE.Scene | null} Current scene or null
     */
    getCurrentScene(): ENGINE.Scene | null {
        return this.currentScene;
    }
    
    /**
     * Get all scenes
     * @returns {ENGINE.Scene[]} Array of all loaded scenes
     */
    getAllScenes(): ENGINE.Scene[] {
        return this.scenes;
    }
    
    /**
     * Check if animation is running
     * @returns {boolean} True if animating
     */
    isRunning(): boolean {
        return this.isAnimating;
    }

    /**
     * Clean up resources
     */
    dispose(): void {
        // Stop animation loop
        this.stopAnimation();
        
        // Clear material manager
        this.materialManager.clear();
        
        // Dispose scenes
        for (const scene of this.scenes) {
            // Scene disposal logic here
        }
        
        // Dispose window manager
        this.wm?.dispose();
        
        // Clear callbacks
        this.initCallback = null;
        this.updateCallback = null;
    }
}