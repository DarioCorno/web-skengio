// src/engine/loaders/ProjectLoader.ts
import * as ENGINE from '../ENGINE';
import { vec3 } from 'gl-matrix';
import { PerformancesDebugger } from '../utils/PerformancesDebugger';

/**
 * Material definition in project JSON
 */
interface MaterialData {
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
    meshes: {
        name: string;
        geometry: string;
        position: number[];
        rotation: number[];
        scale: number[];
        isStatic?: boolean;
        material: MaterialData;
        texturePaths?: {
            diffuse?: string;
            normal?: string;
            metallicRoughness?: string;
            emissive?: string;
            occlusion?: string;
        };
        data?: any; // Geometry-specific data
    }[];
}

/**
 * Project configuration
 */
interface ProjectData {
    scenes: SceneData[];
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
 * ProjectManager handles loading and managing scenes from JSON configuration
 */
export class ProjectManager {
    private wm: ENGINE.WindowManager | null = null;
    private scenes: ENGINE.Scene[] = [];
    private sceneData: SceneData[] = [];
    private textureLoader: ENGINE.Utils.TextureLoader | null = null;
    private gl: WebGL2RenderingContext | null = null;

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

    // Texture cache to avoid loading duplicates
    private textureCache: Map<string, WebGLTexture> = new Map();

    constructor() {
        console.log('Initializing ProjectManager...');
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

            if (this.pConfigs.measureGPUPerformances) {
                this.GPUPerfsDebugger = new PerformancesDebugger(this.gl);
            }

            if (this.projectData.configs.useBitmapFontAtlas) {
                this.bitmapFontAtlas = new ENGINE.Utils.BitmapFontAtlas('Arial', '#fff', '#000', 512, true);
            }

            // Load all scenes
            for (const sceneData of this.projectData.scenes) {
                const scene = await this.createScene(sceneData);
                this.scenes.push(scene);
                this.sceneData.push(sceneData);
            }

            console.log(`Loaded ${this.scenes.length} scene(s)`);
            
        } catch (error) {
            console.error("Error loading Project:", error);
            console.trace();
            throw new Error("Cannot load project");
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
     * @param {any} meshData - Mesh configuration
     * @returns {Promise<ENGINE.Mesh | null>} Created mesh or null
     */
    private async createMesh(meshData: any): Promise<ENGINE.Mesh | null> {
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

        // Create and apply material
        const material = await this.createMaterial(meshData.material, meshData.texturePaths);
        mesh.material = material;

        return mesh;
    }

    /**
     * Create a material from configuration data with full PBR support
     * @param {MaterialData} materialData - Material configuration
     * @param {any} texturePaths - Texture paths object
     * @returns {Promise<ENGINE.Materials.Material>} Created material
     */
    private async createMaterial(
        materialData: MaterialData,
        texturePaths?: any
    ): Promise<ENGINE.Materials.Material> {
        const material = new ENGINE.Materials.Material();
        material.name = materialData.name ?? `Material_${performance.now()}`;
        
        // Determine material type and configure accordingly
        switch (materialData.type) {
            case 'pbr':
                // Full PBR material
                this.configurePBRMaterial(material, materialData);
                break;
                
            case 'unlit':
                // Unlit material (no lighting)
                material.setUnlit(true);
                this.configureBasicProperties(material, materialData);
                break;
                
            case 'emissive':
                // Emissive material (glows)
                material.setUnlit(true);
                this.configureEmissiveMaterial(material, materialData);
                break;
                
            case 'simple':
            case 'texture':
            case 'color':
            default:
                // Simple/legacy material
                this.configureSimpleMaterial(material, materialData);
                break;
        }
        
        // Load and apply textures
        if (texturePaths) {
            await this.loadMaterialTextures(material, texturePaths);
        }
        
        // Apply common properties
        this.applyCommonProperties(material, materialData);
        
        return material;
    }
    
    /**
     * Configure a full PBR material
     * @param {ENGINE.Materials.Material} material - Material to configure
     * @param {MaterialData} data - Material data
     */
    private configurePBRMaterial(material: ENGINE.Materials.Material, data: MaterialData): void {
        // Base color
        const baseColor = data.baseColor ?? data.color ?? [1.0, 1.0, 1.0, 1.0];
        material.setBaseColor(baseColor[0], baseColor[1], baseColor[2], baseColor[3] ?? 1.0);
        
        // Metallic and roughness
        material.setMetallicRoughness(
            data.metallic ?? 0.0,
            data.roughness ?? this.shininessToRoughness(data.shininess)
        );
        
        // Emissive
        if (data.emissive) {
            material.setEmissive(
                data.emissive[0],
                data.emissive[1],
                data.emissive[2],
                data.emissiveIntensity ?? 1.0
            );
        }
        
        // Additional PBR properties
        if (data.normalScale !== undefined) {
            material.normalScale = data.normalScale;
        }
        if (data.occlusionStrength !== undefined) {
            material.occlusionStrength = data.occlusionStrength;
        }
    }
    
    /**
     * Configure an emissive material
     * @param {ENGINE.Materials.Material} material - Material to configure
     * @param {MaterialData} data - Material data
     */
    private configureEmissiveMaterial(material: ENGINE.Materials.Material, data: MaterialData): void {
        // For emissive materials, use emissive color as base color too
        const emissive = data.emissive ?? data.baseColor ?? data.color ?? [1.0, 1.0, 1.0];
        const intensity = data.emissiveIntensity ?? 2.0;
        
        material.setBaseColor(emissive[0], emissive[1], emissive[2], 1.0);
        material.setEmissive(emissive[0], emissive[1], emissive[2], intensity);
        material.setMetallicRoughness(0.0, 1.0);
    }
    
    /**
     * Configure a simple material (backward compatibility)
     * @param {ENGINE.Materials.Material} material - Material to configure
     * @param {MaterialData} data - Material data
     */
    private configureSimpleMaterial(material: ENGINE.Materials.Material, data: MaterialData): void {
        // Base color
        const color = data.baseColor ?? data.color ?? [1.0, 1.0, 1.0, 1.0];
        material.setBaseColor(color[0], color[1], color[2], color[3] ?? 1.0);
        
        // Convert shininess to roughness if provided
        const roughness = data.roughness ?? this.shininessToRoughness(data.shininess);
        material.setMetallicRoughness(data.metallic ?? 0.0, roughness);
        
        // Check for emissive
        if (data.emissive) {
            material.setEmissive(
                data.emissive[0],
                data.emissive[1],
                data.emissive[2],
                data.emissiveIntensity ?? 1.0
            );
        }
    }
    
    /**
     * Configure basic properties for any material
     * @param {ENGINE.Materials.Material} material - Material to configure
     * @param {MaterialData} data - Material data
     */
    private configureBasicProperties(material: ENGINE.Materials.Material, data: MaterialData): void {
        const color = data.baseColor ?? data.color ?? [1.0, 1.0, 1.0, 1.0];
        material.setBaseColor(color[0], color[1], color[2], color[3] ?? 1.0);
        material.setMetallicRoughness(0.0, 1.0);
    }
    
    /**
     * Apply common properties to any material
     * @param {ENGINE.Materials.Material} material - Material to configure
     * @param {MaterialData} data - Material data
     */
    private applyCommonProperties(material: ENGINE.Materials.Material, data: MaterialData): void {
        // Transparency
        if (data.transparent || data.alphaMode) {
            const alphaMode = data.alphaMode ?? (data.transparent ? 'BLEND' : 'OPAQUE');
            switch (alphaMode) {
                case 'MASK':
                    material.setBlendMode(ENGINE.Materials.BlendMode.ALPHA_TEST);
                    material.alphaCutoff = data.alphaCutoff ?? 0.5;
                    break;
                case 'BLEND':
                    material.setBlendMode(ENGINE.Materials.BlendMode.ALPHA_BLEND);
                    break;
                case 'OPAQUE':
                default:
                    material.setBlendMode(ENGINE.Materials.BlendMode.OPAQUE);
                    break;
            }
        }
        
        // Render state
        if (data.doubleSided) {
            material.setDoubleSided(true);
        }
        
        if (data.unlit) {
            material.setUnlit(true);
        }
    }
    
    /**
     * Convert shininess to roughness
     * @param {number | undefined} shininess - Shininess value (1-128)
     * @returns {number} Roughness value (0-1)
     */
    private shininessToRoughness(shininess?: number): number {
        if (shininess === undefined) return 0.8;
        // Convert shininess (1-128) to roughness (1-0)
        // Using logarithmic scale for better distribution
        return 1.0 - (Math.log2(Math.max(1, shininess)) / 7.0);
    }
    
    /**
     * Load textures for a material
     * @param {ENGINE.Materials.Material} material - Material to apply textures to
     * @param {any} texturePaths - Object with texture paths
     */
    private async loadMaterialTextures(material: ENGINE.Materials.Material, texturePaths: any): Promise<void> {
        if (!this.textureLoader) return;
        
        // Load diffuse/base color texture
        if (texturePaths.diffuse) {
            const texture = await this.loadTexture(texturePaths.diffuse);
            if (texture) {
                material.setDiffuseTexture(texture);
                // Set base color to white when using texture
                material.setBaseColor(1.0, 1.0, 1.0, 1.0);
            }
        }
        
        // Load normal map
        if (texturePaths.normal) {
            const texture = await this.loadTexture(texturePaths.normal);
            if (texture) {
                material.normalTexture = texture;
            }
        }
        
        // Load metallic/roughness map
        if (texturePaths.metallicRoughness) {
            const texture = await this.loadTexture(texturePaths.metallicRoughness);
            if (texture) {
                material.metallicRoughnessTexture = texture;
            }
        }
        
        // Load emissive map
        if (texturePaths.emissive) {
            const texture = await this.loadTexture(texturePaths.emissive);
            if (texture) {
                material.emissiveTexture = texture;
            }
        }
        
        // Load occlusion map
        if (texturePaths.occlusion) {
            const texture = await this.loadTexture(texturePaths.occlusion);
            if (texture) {
                material.occlusionTexture = texture;
            }
        }
    }
    
    /**
     * Load a single texture with caching
     * @param {string} path - Texture path
     * @returns {Promise<WebGLTexture | null>} Loaded texture or null
     */
    private async loadTexture(path: string): Promise<WebGLTexture | null> {
        if (!this.textureLoader) return null;
        
        // Check cache
        let texture = this.textureCache.get(path);
        if (texture) return texture;
        
        try {
            // Fix path - remove leading slash if present
            let texturePath = path;
            if (texturePath.startsWith('/')) {
                texturePath = texturePath.substring(1);
            }
            
            texture = await this.textureLoader.loadTexture(texturePath);
            this.textureCache.set(path, texture);
            console.log(`Loaded texture: ${texturePath}`);
            return texture;
        } catch (error) {
            console.error(`Failed to load texture ${path}:`, error);
            return null;
        }
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
     * Get current active scene
     * @returns {ENGINE.Scene | null} Current scene or null
     */
    getCurrentScene(): ENGINE.Scene | null {
        return this.currentScene;
    }

    /**
     * Clean up resources
     */
    dispose(): void {
        // Clear texture cache
        this.textureCache.clear();
        
        // Dispose scenes
        for (const scene of this.scenes) {
            // Scene disposal logic here
        }
        
        // Dispose window manager
        this.wm?.dispose();
    }
}