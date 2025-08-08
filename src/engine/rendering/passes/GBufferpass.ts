// src/engine/rendering/passes/GBufferPass.ts
import { Pass } from './Pass';
import gbufferVertexShader from '../../shaders/gbufferVertexShader.glsl?raw';
import gbufferFragmentShader from '../../shaders/gbufferFragmentShader.glsl?raw';
import * as ENGINE from '../../ENGINE';
import { mat4 } from 'gl-matrix';
import { Entity } from '../../core/Entity';
import { UniformLocationCache } from '../../utils/UniformLocationCache';

/**
 * GBufferPass generates the G-buffer textures containing geometry information
 * Outputs: position, albedo, normal, and object data textures
 */
export class GBufferPass extends Pass {
    private program: WebGLProgram | null = null;
    private fbo: WebGLFramebuffer | null = null;
    private textures: { [key: string]: WebGLTexture } = {};
    private depthTexture: WebGLTexture | null = null;
    private uniformCache: UniformLocationCache;
    
    /**
     * Creates a new GBufferPass instance
     * @param {WebGL2RenderingContext} gl - The WebGL context
     * @param {number} width - Width of the G-buffer
     * @param {number} height - Height of the G-buffer
     */
    constructor(gl: WebGL2RenderingContext, width: number, height: number) {
        super(gl, width, height, 'GBufferPass');
        
        // Get singleton instance of cache
        this.uniformCache = UniformLocationCache.getInstance();
        this.uniformCache.initialize(gl);
        
        this.init();
    }
    
    /**
     * Initialize the G-buffer pass
     */
    init(): void {
        // Create shader program
        this.program = ENGINE.Utils.ShadersUtility.createProgram(
            this.gl, 
            gbufferVertexShader, 
            gbufferFragmentShader
        );
        
        if (!this.program) {
            throw new Error('Failed to create G-buffer shader program');
        }
        
        // Pre-cache uniform locations
        this.uniformCache.getUniformLocations(this.program, [
            'uModelViewMatrix',
            'uProjectionMatrix',
            'uObjectData',
            'uMaterialColor',
            'uMaterialShininess',
            'uUseDiffuseTexture',
            'uDiffuseTexture'
        ]);
        
        // Create G-buffer resources
        this.createGBuffers();
    }
    
    /**
     * Create G-buffer textures and framebuffer
     */
    private createGBuffers(): void {
        const gl = this.gl;
        
        // Delete existing resources if any
        this.deleteGBuffers();
        
        // Create framebuffer
        this.fbo = gl.createFramebuffer();
        if (!this.fbo) {
            throw new Error('Failed to create G-buffer framebuffer');
        }
        
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo);
        
        // Create position texture
        const positionTexture = gl.createTexture();
        if (!positionTexture) throw new Error('Failed to create position texture');
        gl.bindTexture(gl.TEXTURE_2D, positionTexture);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA16F, this.width, this.height);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, positionTexture, 0);
        this.textures['position'] = positionTexture;
        
        // Create albedo texture
        const albedoTexture = gl.createTexture();
        if (!albedoTexture) throw new Error('Failed to create albedo texture');
        gl.bindTexture(gl.TEXTURE_2D, albedoTexture);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA16F, this.width, this.height);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT1, gl.TEXTURE_2D, albedoTexture, 0);
        this.textures['albedo'] = albedoTexture;
        
        // Create normal texture
        const normalTexture = gl.createTexture();
        if (!normalTexture) throw new Error('Failed to create normal texture');
        gl.bindTexture(gl.TEXTURE_2D, normalTexture);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA16F, this.width, this.height);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT2, gl.TEXTURE_2D, normalTexture, 0);
        this.textures['normal'] = normalTexture;
        
        // Create object data texture
        const objDataTexture = gl.createTexture();
        if (!objDataTexture) throw new Error('Failed to create object data texture');
        gl.bindTexture(gl.TEXTURE_2D, objDataTexture);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA16F, this.width, this.height);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT3, gl.TEXTURE_2D, objDataTexture, 0);
        this.textures['objdata'] = objDataTexture;
        
        // Create depth texture - always create it as it's needed for the framebuffer
        this.depthTexture = gl.createTexture();
        if (!this.depthTexture) throw new Error('Failed to create depth texture');
        gl.bindTexture(gl.TEXTURE_2D, this.depthTexture);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texStorage2D(gl.TEXTURE_2D, 1, gl.DEPTH_COMPONENT32F, this.width, this.height);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, this.depthTexture, 0);
        this.textures['depth'] = this.depthTexture;
        
        // Set draw buffers
        gl.drawBuffers([
            gl.COLOR_ATTACHMENT0,   // position
            gl.COLOR_ATTACHMENT1,   // albedo
            gl.COLOR_ATTACHMENT2,   // normal
            gl.COLOR_ATTACHMENT3    // objectData
        ]);
        
        // Check framebuffer completeness
        const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
        if (status !== gl.FRAMEBUFFER_COMPLETE) {
            throw new Error(`G-buffer framebuffer is incomplete: ${status}`);
        }
        
        // Unbind
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.bindTexture(gl.TEXTURE_2D, null);
    }
    
    /**
     * Delete G-buffer resources
     */
    private deleteGBuffers(): void {
        const gl = this.gl;
        
        if (this.fbo) {
            gl.deleteFramebuffer(this.fbo);
            this.fbo = null;
        }
        
        for (const texture of Object.values(this.textures)) {
            gl.deleteTexture(texture);
        }
        this.textures = {};
        
        if (this.depthTexture) {
            gl.deleteTexture(this.depthTexture);
            this.depthTexture = null;
        }
    }
    
    /**
     * Execute the G-buffer pass
     * @param {ENGINE.Scene} scene - The scene to render
     * @returns {Object} The G-buffer textures
     */
    execute(scene: ENGINE.Scene): { [key: string]: WebGLTexture } {
        if (!this.enabled || !this.program || !this.fbo) {
            console.error('GBufferPass not properly initialized');
            return {};
        }
        
        const gl = this.gl;
        
        // IMPORTANT: Unbind all textures first to avoid feedback loop
        for (let i = 0; i < 8; i++) {
            gl.activeTexture(gl.TEXTURE0 + i);
            gl.bindTexture(gl.TEXTURE_2D, null);
        }
        
        // Bind G-buffer framebuffer
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo);
        gl.viewport(0, 0, this.width, this.height);
        
        // Set draw buffers
        gl.drawBuffers([
            gl.COLOR_ATTACHMENT0,   // position
            gl.COLOR_ATTACHMENT1,   // albedo
            gl.COLOR_ATTACHMENT2,   // normal
            gl.COLOR_ATTACHMENT3    // objectData
        ]);
        
        // Configure render state
        gl.enable(gl.DEPTH_TEST);
        gl.enable(gl.STENCIL_TEST);
        gl.enable(gl.CULL_FACE);
        gl.cullFace(gl.BACK);
        
        // depth buffer already filled by depth prepass
        // clear only color and stencil, preserve depth
        gl.clearStencil(0);
        gl.clearColor(0, 0, 0, 0);
        gl.depthMask(false); // Don't write to depth buffer
        gl.clear(gl.COLOR_BUFFER_BIT | gl.STENCIL_BUFFER_BIT);
        
        // Use EQUAL depth test to render only where depth matches
        gl.depthFunc(gl.EQUAL);
        
        // Configure stencil for marking rendered pixels
        gl.stencilFunc(gl.ALWAYS, 1, 0xFF);
        gl.stencilOp(gl.KEEP, gl.KEEP, gl.REPLACE);
        gl.stencilMask(0xFF);
        
        // Use G-buffer shader
        gl.useProgram(this.program);
        
        // Get camera matrices
        const camera = scene.getCamera();
        const viewMatrix = camera.getViewMatrix();
        const projectionMatrix = camera.getProjectionMatrix();
        
        // Set projection matrix (constant for all meshes)
        const projLocation = this.uniformCache.getUniformLocation(this.program, 'uProjectionMatrix');
        if (projLocation) {
            gl.uniformMatrix4fv(projLocation, false, projectionMatrix);
        }
        
        // Render all meshes
        const meshes = scene.getMeshes();
        
        for (const mesh of meshes) {
            // Skip transparent meshes if using depth prepass
            if (mesh.material && mesh.material.isTransparent) {
                continue;
            }
            
            // Cache attribute locations for this mesh
            mesh.retrieveAttribsLocations(gl, this.program);
            
            // Calculate model-view matrix
            const modelMatrix = mesh.getModelMatrix();
            const modelViewMatrix = mat4.create();
            mat4.multiply(modelViewMatrix, viewMatrix, modelMatrix);
            
            // Set model-view matrix
            const mvLocation = this.uniformCache.getUniformLocation(this.program, 'uModelViewMatrix');
            if (mvLocation) {
                gl.uniformMatrix4fv(mvLocation, false, modelViewMatrix);
            }
            
            // Set object data
            const objDataLocation = this.uniformCache.getUniformLocation(this.program, 'uObjectData');
            if (objDataLocation) {
                const objectId = mesh.type === Entity.EntityTypes.LightDebug ? -mesh.id : mesh.id;
                gl.uniform4fv(objDataLocation, [objectId, 0.0, 0.0, 0.0]);
            }
            
            // Apply material - this will bind textures to TEXTURE0
            if (mesh.material) {
                mesh.material.useMaterial(gl, this.program);
            }
            
            // Bind vertex attributes
            mesh.bindVertexAttribsBuffers(gl);
            
            // Draw the mesh
            mesh.draw(gl);
        }
        
        // Restore render state
        gl.depthFunc(gl.LESS);
        gl.depthMask(true);
        
        // IMPORTANT: Unbind framebuffer AND textures before returning
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        
        // Unbind any bound textures to prevent feedback loop in next pass
        for (let i = 0; i < 8; i++) {
            gl.activeTexture(gl.TEXTURE0 + i);
            gl.bindTexture(gl.TEXTURE_2D, null);
        }
        
        return this.textures;
    }
    
    /**
     * Get the framebuffer object
     * @returns {WebGLFramebuffer | null} The G-buffer framebuffer
     */
    getFramebuffer(): WebGLFramebuffer | null {
        return this.fbo;
    }
    
    /**
     * Get a specific G-buffer texture
     * @param {string} name - Name of the texture (position, albedo, normal, objdata, depth)
     * @returns {WebGLTexture | null} The requested texture
     */
    getTexture(name: string): WebGLTexture | null {
        return this.textures[name] || null;
    }
    
    /**
     * Get all G-buffer textures
     * @returns {Object} All G-buffer textures
     */
    getTextures(): { [key: string]: WebGLTexture } {
        return this.textures;
    }
    
    /**
     * Resize the G-buffer
     * @param {number} width - New width
     * @param {number} height - New height
     */
    resize(width: number, height: number): void {
        this.width = width;
        this.height = height;
        this.createGBuffers();
    }
    
    /**
     * Clean up resources
     */
    dispose(): void {
        this.deleteGBuffers();
        
        if (this.program) {
            this.uniformCache.clearProgramCache(this.program);
            this.gl.deleteProgram(this.program);
            this.program = null;
        }
    }
    
    /**
     * Debug information
     */
    debugInfo(): void {
        super.debugInfo();
        console.log('Textures:', Object.keys(this.textures));
        console.log('Has framebuffer:', !!this.fbo);
        console.log('Has program:', !!this.program);
        console.log(`--- End ${this.name} Debug Info ---`);
    }
}