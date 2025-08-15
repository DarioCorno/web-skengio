// src/engine/materials/MaterialManager.ts
import { Material } from './Material';
import * as ENGINE from '../ENGINE';

/**
 * MaterialManager handles centralized material storage and retrieval
 * Allows materials to be defined once and referenced by multiple meshes
 */
export class MaterialManager {
    private static instance: MaterialManager | null = null;
    private materials: Map<string, Material> = new Map();
    private textureLoader: ENGINE.Utils.TextureLoader | null = null;
    private textureCache: Map<string, WebGLTexture> = new Map();
    private gl: WebGL2RenderingContext | null = null;
    
    /**
     * Private constructor for singleton pattern
     */
    private constructor() {}
    
    /**
     * Get singleton instance of MaterialManager
     * @returns {MaterialManager} The singleton instance
     */
    public static getInstance(): MaterialManager {
        if (!MaterialManager.instance) {
            MaterialManager.instance = new MaterialManager();
        }
        return MaterialManager.instance;
    }
    
    /**
     * Initialize the material manager with WebGL context
     * @param {WebGL2RenderingContext} gl - The WebGL context
     * @param {ENGINE.Utils.TextureLoader} textureLoader - Texture loader instance
     */
    public initialize(gl: WebGL2RenderingContext, textureLoader: ENGINE.Utils.TextureLoader): void {
        this.gl = gl;
        this.textureLoader = textureLoader;
    }
    
    /**
     * Register a material with the manager
     * @param {string} id - Unique identifier for the material
     * @param {Material} material - The material to register
     * @returns {boolean} True if registered successfully, false if ID already exists
     */
    public registerMaterial(id: string, material: Material): boolean {
        if (this.materials.has(id)) {
            console.warn(`Material with ID '${id}' already exists. Skipping registration.`);
            return false;
        }
        
        this.materials.set(id, material);
        console.log(`Registered material: ${id}`);
        return true;
    }
    
    /**
     * Get a material by its ID
     * @param {string} id - The material ID
     * @returns {Material | null} The material or null if not found
     */
    public getMaterial(id: string): Material | null {
        const material = this.materials.get(id);
        if (!material) {
            console.warn(`Material with ID '${id}' not found`);
            return null;
        }
        return material;
    }
    
    /**
     * Check if a material exists
     * @param {string} id - The material ID to check
     * @returns {boolean} True if the material exists
     */
    public hasMaterial(id: string): boolean {
        return this.materials.has(id);
    }
    
    /**
     * Remove a material from the manager
     * @param {string} id - The material ID to remove
     * @returns {boolean} True if removed successfully
     */
    public removeMaterial(id: string): boolean {
        return this.materials.delete(id);
    }
    
    /**
     * Create a material from configuration data
     * @param {any} materialData - Material configuration
     * @returns {Promise<Material>} Created material
     */
    public async createMaterialFromData(materialData: any): Promise<Material> {
        const material = new Material();
        material.name = materialData.name ?? `Material_${performance.now()}`;
        
        // Configure material based on type
        switch (materialData.type) {
            case 'pbr':
                this.configurePBRMaterial(material, materialData);
                break;
                
            case 'unlit':
                material.setUnlit(true);
                this.configureBasicProperties(material, materialData);
                break;
                
            case 'emissive':
                material.setUnlit(true);
                this.configureEmissiveMaterial(material, materialData);
                break;
                
            case 'simple':
            case 'texture':
            case 'color':
            default:
                this.configureSimpleMaterial(material, materialData);
                break;
        }
        
        // Load and apply textures if specified
        if (materialData.textures) {
            await this.loadMaterialTextures(material, materialData.textures);
        }
        
        // Apply common properties
        this.applyCommonProperties(material, materialData);
        
        return material;
    }
    
    /**
     * Configure a full PBR material
     * @param {Material} material - Material to configure
     * @param {any} data - Material data
     */
    private configurePBRMaterial(material: Material, data: any): void {
        const baseColor = data.baseColor ?? data.color ?? [1.0, 1.0, 1.0, 1.0];
        material.setBaseColor(baseColor[0], baseColor[1], baseColor[2], baseColor[3] ?? 1.0);
        
        material.setMetallicRoughness(
            data.metallic ?? 0.0,
            data.roughness ?? this.shininessToRoughness(data.shininess)
        );
        
        if (data.emissive) {
            material.setEmissive(
                data.emissive[0],
                data.emissive[1],
                data.emissive[2],
                data.emissiveIntensity ?? 1.0
            );
        }
        
        if (data.normalScale !== undefined) {
            material.normalScale = data.normalScale;
        }
        if (data.occlusionStrength !== undefined) {
            material.occlusionStrength = data.occlusionStrength;
        }
    }
    
    /**
     * Configure an emissive material
     * @param {Material} material - Material to configure
     * @param {any} data - Material data
     */
    private configureEmissiveMaterial(material: Material, data: any): void {
        const emissive = data.emissive ?? data.baseColor ?? data.color ?? [1.0, 1.0, 1.0];
        const intensity = data.emissiveIntensity ?? 2.0;
        
        material.setBaseColor(emissive[0], emissive[1], emissive[2], 1.0);
        material.setEmissive(emissive[0], emissive[1], emissive[2], intensity);
        material.setMetallicRoughness(0.0, 1.0);
    }
    
    /**
     * Configure a simple material
     * @param {Material} material - Material to configure
     * @param {any} data - Material data
     */
    private configureSimpleMaterial(material: Material, data: any): void {
        const color = data.baseColor ?? data.color ?? [1.0, 1.0, 1.0, 1.0];
        material.setBaseColor(color[0], color[1], color[2], color[3] ?? 1.0);
        
        const roughness = data.roughness ?? this.shininessToRoughness(data.shininess);
        material.setMetallicRoughness(data.metallic ?? 0.0, roughness);
        
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
     * @param {Material} material - Material to configure
     * @param {any} data - Material data
     */
    private configureBasicProperties(material: Material, data: any): void {
        const color = data.baseColor ?? data.color ?? [1.0, 1.0, 1.0, 1.0];
        material.setBaseColor(color[0], color[1], color[2], color[3] ?? 1.0);
        material.setMetallicRoughness(0.0, 1.0);
    }
    
    /**
     * Apply common properties to any material
     * @param {Material} material - Material to configure
     * @param {any} data - Material data
     */
    private applyCommonProperties(material: Material, data: any): void {
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
        return 1.0 - (Math.log2(Math.max(1, shininess)) / 7.0);
    }
    
    /**
     * Load textures for a material
     * @param {Material} material - Material to apply textures to
     * @param {any} texturePaths - Object with texture paths
     */
    private async loadMaterialTextures(material: Material, texturePaths: any): Promise<void> {
        if (!this.textureLoader) {
            console.error('TextureLoader not initialized');
            return;
        }
        
        // Load diffuse/base color texture
        if (texturePaths.diffuse) {
            const texture = await this.loadTexture(texturePaths.diffuse);
            if (texture) {
                material.setDiffuseTexture(texture);
                // Don't override base color when using texture
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
        if (texture) {
            console.log(`Using cached texture: ${path}`);
            return texture;
        }
        
        try {
            // Fix path - remove leading slash if present
            let texturePath = path;
            if (texturePath.startsWith('/')) {
                texturePath = texturePath.substring(1);
            }
            
            texture = await this.textureLoader.loadTexture(texturePath);
            this.textureCache.set(path, texture);
            console.log(`Loaded and cached texture: ${texturePath}`);
            return texture;
        } catch (error) {
            console.error(`Failed to load texture ${path}:`, error);
            return null;
        }
    }
    
    /**
     * Get all registered materials
     * @returns {Map<string, Material>} Map of all materials
     */
    public getAllMaterials(): Map<string, Material> {
        return new Map(this.materials);
    }
    
    /**
     * Get list of material IDs
     * @returns {string[]} Array of material IDs
     */
    public getMaterialIds(): string[] {
        return Array.from(this.materials.keys());
    }
    
    /**
     * Clear all materials
     */
    public clear(): void {
        this.materials.clear();
        this.textureCache.clear();
        console.log('MaterialManager cleared');
    }
    
    /**
     * Get statistics about the material manager
     * @returns {Object} Statistics object
     */
    public getStatistics(): {
        materialCount: number;
        texturesCached: number;
        materialIds: string[];
    } {
        return {
            materialCount: this.materials.size,
            texturesCached: this.textureCache.size,
            materialIds: this.getMaterialIds()
        };
    }
    
    /**
     * Debug information
     */
    public debugInfo(): void {
        console.log('--- MaterialManager Debug Info ---');
        console.log('Initialized:', this.gl !== null && this.textureLoader !== null);
        console.log('Materials registered:', this.materials.size);
        console.log('Textures cached:', this.textureCache.size);
        console.log('Material IDs:', this.getMaterialIds());
        
        // Log each material's details
        this.materials.forEach((material, id) => {
            console.log(`  Material '${id}':`);
            console.log(`    Name: ${material.name}`);
            console.log(`    Transparent: ${material.isTransparent}`);
            console.log(`    Unlit: ${material.isUnlit}`);
            console.log(`    Double-sided: ${material.doubleSided}`);
        });
        
        console.log('--- End MaterialManager Debug Info ---');
    }
}