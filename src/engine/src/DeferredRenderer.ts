import gbufferVertexShader from '../shaders/gbufferVertexShader.glsl?raw'
import gbufferFragmentShader from '../shaders/gbufferFragmentShader.glsl?raw'
import * as ENGINE from '../ENGINE';
import { mat4 } from 'gl-matrix';

import { GBufferDebugger } from './GBufferDebugger';

export class DeferredRenderer extends ENGINE.Renderer{
    private fbo: WebGLFramebuffer | null;
    private textures: { [key: string]: WebGLTexture }; // Map of buffer names to textures
    private depthTexture: WebGLTexture | null;
    private width: number;
    private height: number;

    private program: WebGLProgram | null = null;
    private uModelViewMatrixLocation: WebGLUniformLocation | null = null;
    private uProjectionMatrixLocation: WebGLUniformLocation | null = null;
    //private uLightPositionLocation: WebGLUniformLocation | null = null;
    //private uLightColorLocation: WebGLUniformLocation | null = null;
    //private uMaterialColorLocation: WebGLUniformLocation | null = null;
    private uObjectIdLocation : WebGLUniformLocation | null = null;

    private gbufDebugger: GBufferDebugger | null = null;

    constructor(gl: WebGL2RenderingContext, width: number, height: number) {
        super(gl);
        this.gl = gl;
        this.width = width;
        this.height = height;
        this.textures = {};
        this.fbo = null;
        this.depthTexture = null;
    
        this.init();

        this.gbufDebugger = new GBufferDebugger(this.gl);
    }

    init(): void {
        const gl = this.gl;
    
        //setup gbuffer shader
        this.program = ENGINE.Utils.ShadersUtility.createProgram(this.gl, gbufferVertexShader, gbufferFragmentShader);
        if(!this.program)
            throw new Error('Cannot compile gbuffer vertex program');

        this.gl.useProgram(this.program);

        // Get uniform locations.
        this.uModelViewMatrixLocation = this.gl.getUniformLocation(this.program, 'uModelViewMatrix');
        this.uProjectionMatrixLocation = this.gl.getUniformLocation(this.program, 'uProjectionMatrix');
        //this.uLightPositionLocation = this.gl.getUniformLocation(this.program, 'uLightPosition');
        //this.uLightColorLocation = this.gl.getUniformLocation(this.program, 'uLightColor');
        //this.uMaterialColorLocation = this.gl.getUniformLocation(this.program, 'uMaterialColor');
        this.uObjectIdLocation = this.gl.getUniformLocation(this.program, 'uObjectID');

        this.buildGBuffer();

    }


    setDebugMode(mode: number = 0) : void {
        if(this.gbufDebugger) {
            this.gbufDebugger.debugMode = mode;
        } else {
            throw new Error('GBufDebugger not initialized. Cannot set debugMode');
        }
    }

    buildGBuffer() {
        const gl = this.gl;

        if(this.fbo != null) {
          //delete framebuffer if any
          gl.deleteFramebuffer(this.fbo);

          // delete all textures if set
          for (const texture of Object.values(this.textures)) {
              gl.bindTexture(gl.TEXTURE_2D, texture);
              gl.deleteTexture(texture);
          }          

          gl.bindTexture(gl.TEXTURE_2D, null);
        }

        //build framebuffer textures
        this.fbo = gl.createFramebuffer();
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo);

        gl.activeTexture(gl.TEXTURE0);

        var positionTarget = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, positionTarget);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA16F, gl.drawingBufferWidth, gl.drawingBufferHeight);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, positionTarget, 0);
        this.textures['position'] = positionTarget;

        var albedoTarget = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, albedoTarget);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA16F, gl.drawingBufferWidth, gl.drawingBufferHeight);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT1, gl.TEXTURE_2D, albedoTarget, 0);
        this.textures['albedo'] = albedoTarget;

        var normalTarget = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, normalTarget);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA16F, gl.drawingBufferWidth, gl.drawingBufferHeight);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT2, gl.TEXTURE_2D, normalTarget, 0);
        this.textures['normal'] = normalTarget;

        /*
        var uvTarget = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, uvTarget);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RG16F, gl.drawingBufferWidth, gl.drawingBufferHeight);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT3, gl.TEXTURE_2D, uvTarget, 0);
        this.textures['uv'] = uvTarget;
        */

        // Create an additional texture for Object IDs
        var gBufferObjectID = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, gBufferObjectID);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.R32F, gl.drawingBufferWidth, gl.drawingBufferHeight, 0, gl.RED, gl.FLOAT, null);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);      
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT3, gl.TEXTURE_2D, gBufferObjectID, 0);          
        this.textures['objid'] = gBufferObjectID;

        var depthTexture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, depthTexture);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texStorage2D(gl.TEXTURE_2D, 1, gl.DEPTH_COMPONENT16, gl.drawingBufferWidth, gl.drawingBufferHeight);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, depthTexture, 0);
        this.textures['depth'] = depthTexture;
        
        gl.drawBuffers([
            gl.COLOR_ATTACHMENT0,   //position
            gl.COLOR_ATTACHMENT1,   //albedo
            gl.COLOR_ATTACHMENT2,   //normal
            gl.COLOR_ATTACHMENT3    //objectId
        ]);

        const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
        if (status !== gl.FRAMEBUFFER_COMPLETE) {
          throw new Error("Framebuffer is incomplete:" + status);
        }        
        // Unbind the framebuffer
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);      
    }
  

    setSize(width: number, height: number): void {
        if (!this.gl) return;
        const gl = this.gl;

        console.log('Renderer resize: ' + width + '-' + height);
        gl.viewport(0, 0, width, height);

        this.buildGBuffer();

    }
  
    public bind(): void {
      this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, this.fbo);
      this.gl.drawBuffers(Object.keys(this.textures).map((_, i) => this.gl.COLOR_ATTACHMENT0 + i));
    }
  
    public unbind(): void {
      this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, null);
    }
  
    public getBufferTexture(name: string): WebGLTexture | null {
      return this.textures[name] || null;
    }

    public render(scene: ENGINE.Scene): void {
        if(!this.program) {
            throw new Error('GBuffer program not present');
        }
        const gl = this.gl;
    
        const meshes = scene.getMeshes();
        const camera = scene.getCamera();

        // Bind the framebuffer for deferred rendering
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo);
    
        // Set the draw buffers for multiple render targets
        gl.drawBuffers(Object.keys(this.textures).map((_, i) => gl.COLOR_ATTACHMENT0 + i));
    
        // Clear all the buffers
        gl.enable(gl.DEPTH_TEST);
        gl.cullFace(gl.BACK);
        gl.depthMask(true);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        const viewMatrix = camera.getViewMatrix();
        const projectionMatrix = camera.getProjectionMatrix();
    
        gl.useProgram(this.program);

        let meshIdx = 0;
        for (const mesh of meshes) {

            //set the uniforms in the shader
            mesh.retrieveAttribsLocations(gl, this.program);          

            // Compute model-view matrix.
            const modelMatrix = mesh.getModelMatrix();
            const modelViewMatrix = mat4.create();
            mat4.multiply(modelViewMatrix, viewMatrix, modelMatrix);
      
            // Set shaders uniforms.
            gl.uniformMatrix4fv(this.uModelViewMatrixLocation, false, modelViewMatrix);
            gl.uniformMatrix4fv(this.uProjectionMatrixLocation, false, projectionMatrix);
            gl.uniform1f(this.uObjectIdLocation, meshIdx);
      
            gl.disable(gl.BLEND);
            
            // If the mesh has an assigned material, apply it.
            if (mesh.material) {
                mesh.material.useMaterial(gl, this.program);

                //set the color if we found the uMaterialColor uniform
                //if (this.uMaterialColorLocation) {
                //    // Fallback to default white.
                //    gl.uniform4fv(this.uMaterialColorLocation, [1, 1, 1, 1]);
                //}                
            } 

            //assing the positions, indexes, colors, normals and uv buffers to shader program
            mesh.bindAttribsBuffers(gl);    
            mesh.draw(gl);

            meshIdx++;
        }
    
        // Unbind the framebuffer
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);

        this.gbufDebugger?.render(this.textures, scene);
        
      }    
  }
  