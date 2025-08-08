// src/engine/materials/Material.ts
import { vec3, vec4 } from 'gl-matrix';

/**
 * Material feature flags for shader variants
 */
export enum MaterialFeatures {
    NONE = 0,
    USE_VERTEX_COLOR = 1 << 0,
    USE_DIFFUSE_MAP = 1 << 1,
    USE_NORMAL_MAP = 1 << 2,
    USE_METALLIC_ROUGHNESS_MAP = 1 << 3,
    USE_EMISSIVE_MAP = 1 << 4,
    USE_OCCLUSION_MAP = 1 << 5,
    ALPHA_TEST = 1 << 6,
    ALPHA_BLEND = 1 << 7,
    DOUBLE_SIDED = 1 << 8,
    UNLIT = 1 << 9,
}

/**
 * Blend modes for transparency
 */
export enum BlendMode {
    OPAQUE = 0,
    ALPHA_TEST = 1,
    ALPHA_BLEND = 2,
    ADDITIVE = 3,
    MULTIPLY = 4,
}

/**
 * PBR Material class
 */
export class Material {
    public name: string = "";
    
    // PBR properties
    public baseColor: vec4 = vec4.fromValues(1.0, 1.0, 1.0, 1.0);
    public metallic: number = 0.0;
    public roughness: number = 1.0;
    public emissiveFactor: vec3 = vec3.fromValues(0.0, 0.0, 0.0);
    public emissiveIntensity: number = 1.0;
    public normalScale: number = 1.0;
    public occlusionStrength: number = 1.0;
    public alphaCutoff: number = 0.5;
    
    // Textures
    public diffuseTexture: WebGLTexture | null = null;
    public normalTexture: WebGLTexture | null = null;
    public metallicRoughnessTexture: WebGLTexture | null = null;
    public emissiveTexture: WebGLTexture | null = null;
    public occlusionTexture: WebGLTexture | null = null;
    
    // Features and state
    private features: MaterialFeatures = MaterialFeatures.NONE;
    private blendMode: BlendMode = BlendMode.OPAQUE;
    public isTransparent: boolean = false;
    public isUnlit: boolean = false;
    public doubleSided: boolean = false;
    
    constructor() {
        this.updateFeatures();
    }
    
    /**
     * Set base color (albedo)
     * @param {number} r - Red component (0-1)
     * @param {number} g - Green component (0-1)
     * @param {number} b - Blue component (0-1)
     * @param {number} a - Alpha component (0-1)
     */
    public setBaseColor(r: number, g: number, b: number, a: number = 1.0): void {
        vec4.set(this.baseColor, r, g, b, a);
        this.isTransparent = a < 1.0;
        if (this.isTransparent && this.blendMode === BlendMode.OPAQUE) {
            this.setBlendMode(BlendMode.ALPHA_BLEND);
        }
    }
    
    /**
     * Set PBR metallic and roughness values
     * @param {number} metallic - Metallic value (0-1)
     * @param {number} roughness - Roughness value (0-1)
     */
    public setMetallicRoughness(metallic: number, roughness: number): void {
        this.metallic = Math.max(0, Math.min(1, metallic));
        this.roughness = Math.max(0, Math.min(1, roughness));
    }
    
    /**
     * Set emissive color and intensity
     * @param {number} r - Red component (0-1)
     * @param {number} g - Green component (0-1)
     * @param {number} b - Blue component (0-1)
     * @param {number} intensity - Emissive intensity multiplier
     */
    public setEmissive(r: number, g: number, b: number, intensity: number = 1.0): void {
        vec3.set(this.emissiveFactor, r, g, b);
        this.emissiveIntensity = intensity;
    }
    
    /**
     * Set blend mode for transparency
     * @param {BlendMode} mode - Blend mode to use
     */
    public setBlendMode(mode: BlendMode): void {
        this.blendMode = mode;
        this.isTransparent = (mode !== BlendMode.OPAQUE);
        this.updateFeatures();
    }
    
    /**
     * Set whether material is unlit
     * @param {boolean} unlit - True for unlit shading
     */
    public setUnlit(unlit: boolean): void {
        this.isUnlit = unlit;
        if (unlit) {
            this.features |= MaterialFeatures.UNLIT;
        } else {
            this.features &= ~MaterialFeatures.UNLIT;
        }
    }
    
    /**
     * Set whether to use double-sided rendering
     * @param {boolean} doubleSided - True for double-sided
     */
    public setDoubleSided(doubleSided: boolean): void {
        this.doubleSided = doubleSided;
        if (doubleSided) {
            this.features |= MaterialFeatures.DOUBLE_SIDED;
        } else {
            this.features &= ~MaterialFeatures.DOUBLE_SIDED;
        }
    }
    
    /**
     * Set diffuse/base color texture
     * @param {WebGLTexture | null} texture - Texture or null
     */
    public setDiffuseTexture(texture: WebGLTexture | null): void {
        this.diffuseTexture = texture;
        this.updateFeatures();
    }
    
    /**
     * Update feature flags based on current state
     */
    private updateFeatures(): void {
        // Clear texture features
        this.features &= ~(
            MaterialFeatures.USE_DIFFUSE_MAP |
            MaterialFeatures.USE_NORMAL_MAP |
            MaterialFeatures.USE_METALLIC_ROUGHNESS_MAP |
            MaterialFeatures.USE_EMISSIVE_MAP |
            MaterialFeatures.USE_OCCLUSION_MAP
        );
        
        // Set texture features
        if (this.diffuseTexture) this.features |= MaterialFeatures.USE_DIFFUSE_MAP;
        if (this.normalTexture) this.features |= MaterialFeatures.USE_NORMAL_MAP;
        if (this.metallicRoughnessTexture) this.features |= MaterialFeatures.USE_METALLIC_ROUGHNESS_MAP;
        if (this.emissiveTexture) this.features |= MaterialFeatures.USE_EMISSIVE_MAP;
        if (this.occlusionTexture) this.features |= MaterialFeatures.USE_OCCLUSION_MAP;
        
        // Set blend features
        if (this.blendMode === BlendMode.ALPHA_TEST) {
            this.features |= MaterialFeatures.ALPHA_TEST;
            this.features &= ~MaterialFeatures.ALPHA_BLEND;
        } else if (this.blendMode === BlendMode.ALPHA_BLEND || this.blendMode === BlendMode.ADDITIVE) {
            this.features |= MaterialFeatures.ALPHA_BLEND;
            this.features &= ~MaterialFeatures.ALPHA_TEST;
        } else {
            this.features &= ~(MaterialFeatures.ALPHA_TEST | MaterialFeatures.ALPHA_BLEND);
        }
    }
    
    /**
     * Apply material to shader program
     * @param {WebGL2RenderingContext} gl - WebGL context
     * @param {WebGLProgram} program - Shader program
     */
    public useMaterial(gl: WebGL2RenderingContext, program: WebGLProgram): void {
        // Set base color
        const baseColorLoc = gl.getUniformLocation(program, 'uBaseColor');
        if (baseColorLoc) {
            gl.uniform4fv(baseColorLoc, this.baseColor);
        }
        
        // Set PBR properties
        const metallicLoc = gl.getUniformLocation(program, 'uMetallic');
        if (metallicLoc) {
            gl.uniform1f(metallicLoc, this.metallic);
        }
        
        const roughnessLoc = gl.getUniformLocation(program, 'uRoughness');
        if (roughnessLoc) {
            gl.uniform1f(roughnessLoc, this.roughness);
        }
        
        // Set emissive
        const emissiveLoc = gl.getUniformLocation(program, 'uEmissiveFactor');
        if (emissiveLoc) {
            gl.uniform3fv(emissiveLoc, this.emissiveFactor);
        }
        
        const emissiveIntensityLoc = gl.getUniformLocation(program, 'uEmissiveIntensity');
        if (emissiveIntensityLoc) {
            gl.uniform1f(emissiveIntensityLoc, this.emissiveIntensity);
        }
        
        // Set other properties
        const normalScaleLoc = gl.getUniformLocation(program, 'uNormalScale');
        if (normalScaleLoc) {
            gl.uniform1f(normalScaleLoc, this.normalScale);
        }
        
        const useNormalLoc = gl.getUniformLocation(program, 'uUseNormalTexture');
        if (useNormalLoc) {
            gl.uniform1i(useNormalLoc, this.normalTexture ? 1 : 0);
        }
                
        const occlusionStrengthLoc = gl.getUniformLocation(program, 'uOcclusionStrength');
        if (occlusionStrengthLoc) {
            gl.uniform1f(occlusionStrengthLoc, this.occlusionStrength);
        }
        
        const alphaCutoffLoc = gl.getUniformLocation(program, 'uAlphaCutoff');
        if (alphaCutoffLoc) {
            gl.uniform1f(alphaCutoffLoc, this.alphaCutoff);
        }
        
        // Set textures
        let textureUnit = 0;
        
        // Diffuse texture
        const useDiffuseLoc = gl.getUniformLocation(program, 'uUseDiffuseTexture');
        if (useDiffuseLoc) {
            gl.uniform1i(useDiffuseLoc, this.diffuseTexture ? 1 : 0);
        }
        
        if (this.diffuseTexture) {
            gl.activeTexture(gl.TEXTURE0 + textureUnit);
            gl.bindTexture(gl.TEXTURE_2D, this.diffuseTexture);
            const diffuseLoc = gl.getUniformLocation(program, 'uDiffuseTexture');
            if (diffuseLoc) {
                gl.uniform1i(diffuseLoc, textureUnit);
            }
            textureUnit++;
        }
        
        // Normal texture
        if (this.normalTexture) {
            gl.activeTexture(gl.TEXTURE0 + textureUnit);
            gl.bindTexture(gl.TEXTURE_2D, this.normalTexture);
            const normalLoc = gl.getUniformLocation(program, 'uNormalTexture');
            if (normalLoc) {
                gl.uniform1i(normalLoc, textureUnit);
            }
            textureUnit++;
        }
        
        // Metallic/Roughness texture
        if (this.metallicRoughnessTexture) {
            gl.activeTexture(gl.TEXTURE0 + textureUnit);
            gl.bindTexture(gl.TEXTURE_2D, this.metallicRoughnessTexture);
            const mrLoc = gl.getUniformLocation(program, 'uMetallicRoughnessTexture');
            if (mrLoc) {
                gl.uniform1i(mrLoc, textureUnit);
            }
            textureUnit++;
        }
        
        // Emissive texture
        if (this.emissiveTexture) {
            gl.activeTexture(gl.TEXTURE0 + textureUnit);
            gl.bindTexture(gl.TEXTURE_2D, this.emissiveTexture);
            const emissiveLoc = gl.getUniformLocation(program, 'uEmissiveTexture');
            if (emissiveLoc) {
                gl.uniform1i(emissiveLoc, textureUnit);
            }
            textureUnit++;
        }
        
        // Occlusion texture
        if (this.occlusionTexture) {
            gl.activeTexture(gl.TEXTURE0 + textureUnit);
            gl.bindTexture(gl.TEXTURE_2D, this.occlusionTexture);
            const occlusionLoc = gl.getUniformLocation(program, 'uOcclusionTexture');
            if (occlusionLoc) {
                gl.uniform1i(occlusionLoc, textureUnit);
            }
            textureUnit++;
        }
        
        // Set material features
        const featuresLoc = gl.getUniformLocation(program, 'uMaterialFeatures');
        if (featuresLoc) {
            gl.uniform1i(featuresLoc, this.features);
        }
        
        // Set unlit flag
        const unlitLoc = gl.getUniformLocation(program, 'uIsUnlit');
        if (unlitLoc) {
            gl.uniform1i(unlitLoc, this.isUnlit ? 1 : 0);
        }
        
        // Configure render state
        if (this.doubleSided) {
            gl.disable(gl.CULL_FACE);
        } else {
            gl.enable(gl.CULL_FACE);
            gl.cullFace(gl.BACK);
        }
        
        // Configure blending
        switch (this.blendMode) {
            case BlendMode.OPAQUE:
            case BlendMode.ALPHA_TEST:
                gl.disable(gl.BLEND);
                gl.depthMask(true);
                break;
                
            case BlendMode.ALPHA_BLEND:
                gl.enable(gl.BLEND);
                gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
                gl.depthMask(false);
                break;
                
            case BlendMode.ADDITIVE:
                gl.enable(gl.BLEND);
                gl.blendFunc(gl.ONE, gl.ONE);
                gl.depthMask(false);
                break;
                
            case BlendMode.MULTIPLY:
                gl.enable(gl.BLEND);
                gl.blendFunc(gl.DST_COLOR, gl.ZERO);
                gl.depthMask(false);
                break;
        }
        
        // For G-buffer compatibility, also set old uniforms
        const materialColorLoc = gl.getUniformLocation(program, 'uMaterialColor');
        if (materialColorLoc) {
            gl.uniform4fv(materialColorLoc, this.baseColor);
        }
        
        const shininessLoc = gl.getUniformLocation(program, 'uMaterialShininess');
        if (shininessLoc) {
            // Convert roughness to shininess (inverse relationship)
            const shininess = (1.0 - this.roughness) * 128.0;
            gl.uniform1f(shininessLoc, shininess);
        }
    }
    
    /**
     * Create a simple colored PBR material
     * @param {number} r - Red component (0-1)
     * @param {number} g - Green component (0-1)
     * @param {number} b - Blue component (0-1)
     * @param {number} a - Alpha component (0-1)
     * @returns {Material} Configured material
     */
    public static createColorMaterial(r: number, g: number, b: number, a: number = 1.0): Material {
        const mat = new Material();
        mat.setBaseColor(r, g, b, a);
        mat.setMetallicRoughness(0.0, 0.8);
        return mat;
    }
    
    /**
     * Create a textured PBR material
     * @param {WebGLTexture} texture - Diffuse texture
     * @param {number} metallic - Metallic value
     * @param {number} roughness - Roughness value
     * @returns {Material} Configured material
     */
    public static createTexturedMaterial(texture: WebGLTexture, metallic: number = 0.0, roughness: number = 0.8): Material {
        const mat = new Material();
        mat.setDiffuseTexture(texture);
        mat.setMetallicRoughness(metallic, roughness);
        return mat;
    }
    
    /**
     * Create an emissive material (for light debug meshes)
     * @param {number} r - Red component (0-1)
     * @param {number} g - Green component (0-1)
     * @param {number} b - Blue component (0-1)
     * @param {number} intensity - Emissive intensity
     * @returns {Material} Configured material
     */
    public static createEmissiveMaterial(r: number, g: number, b: number, intensity: number = 2.0): Material {
        const mat = new Material();
        mat.setBaseColor(r, g, b, 1.0);
        mat.setEmissive(r, g, b, intensity);
        mat.setMetallicRoughness(0.0, 1.0);
        mat.setUnlit(true); // Make it unlit so it always shows the color
        return mat;
    }
    
    /**
     * Clone this material
     * @returns {Material} Deep copy of this material
     */
    public clone(): Material {
        const newMat = new Material();
        newMat.name = this.name + "_clone";
        
        vec4.copy(newMat.baseColor, this.baseColor);
        newMat.metallic = this.metallic;
        newMat.roughness = this.roughness;
        vec3.copy(newMat.emissiveFactor, this.emissiveFactor);
        newMat.emissiveIntensity = this.emissiveIntensity;
        newMat.normalScale = this.normalScale;
        newMat.occlusionStrength = this.occlusionStrength;
        newMat.alphaCutoff = this.alphaCutoff;
        
        newMat.diffuseTexture = this.diffuseTexture;
        newMat.normalTexture = this.normalTexture;
        newMat.metallicRoughnessTexture = this.metallicRoughnessTexture;
        newMat.emissiveTexture = this.emissiveTexture;
        newMat.occlusionTexture = this.occlusionTexture;
        
        newMat.features = this.features;
        newMat.blendMode = this.blendMode;
        newMat.isTransparent = this.isTransparent;
        newMat.isUnlit = this.isUnlit;
        newMat.doubleSided = this.doubleSided;
        
        return newMat;
    }
    
    /**
     * Debug information
     */
    public debugInfo(): void {
        console.log("Material Debug Info:");
        console.log("Name:", this.name);
        console.log("Base Color:", this.baseColor);
        console.log("Metallic:", this.metallic);
        console.log("Roughness:", this.roughness);
        console.log("Emissive:", this.emissiveFactor, "Intensity:", this.emissiveIntensity);
        console.log("Features:", this.features.toString(2));
        console.log("Blend Mode:", BlendMode[this.blendMode]);
        console.log("Is Transparent:", this.isTransparent);
        console.log("Is Unlit:", this.isUnlit);
        console.log("Double Sided:", this.doubleSided);
        console.log("Textures:", {
            diffuse: !!this.diffuseTexture,
            normal: !!this.normalTexture,
            metallicRoughness: !!this.metallicRoughnessTexture,
            emissive: !!this.emissiveTexture,
            occlusion: !!this.occlusionTexture
        });
    }
}