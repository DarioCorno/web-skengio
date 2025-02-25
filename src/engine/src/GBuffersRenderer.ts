import vertexShaderSource from '../shaders/deferredVertexShader.glsl?raw';
import fragmentShaderSource from '../shaders/deferredFragmentShader.glsl?raw';
import * as ENGINE from '../ENGINE'
import { mat4 } from 'gl-matrix';

export class GBuffersRenderer {
    private gl: WebGL2RenderingContext;
    private program: WebGLProgram;
    private vao: WebGLVertexArrayObject | null;
    private uniformLocations: { [name: string]: WebGLUniformLocation | null } = {};

    private lightPositionLocations: WebGLUniformLocation[] | null[] = [];
    private lightModelViewLocations: WebGLUniformLocation[] | null[] = [];
    private lightColorLocations: WebGLUniformLocation[] | null[] = [];
    private lightIntensityLocations: WebGLUniformLocation[] | null[] = [];
    private numLightsLocation : WebGLUniformLocation | null = null;

    private uniformsLocationsSet : boolean = false;

    //0 = final render, 1 = position, 2 = albedo, 3 = normal, 4 = objectData, 5 = alpha, 6 = depth
    public debugMode : number = 0;  

    constructor(gl: WebGL2RenderingContext) {
        this.gl = gl;
    
        // Initialize the shader program
        this.program = ENGINE.Utils.ShadersUtility.createProgram(this.gl, vertexShaderSource, fragmentShaderSource);

        // Initialize the quad VAO
        this.vao = this.createQuadVAO();
    }
    
    private retrieveUniformsLocations( lights : ENGINE.Light[]) {

        if(this.uniformsLocationsSet) return;

        const gl = this.gl;

        this.uniformLocations['uPosition'] = gl.getUniformLocation(this.program, "uPosition");
        this.uniformLocations['uAlbedo'] = gl.getUniformLocation(this.program, "uAlbedo");
        this.uniformLocations['uNormal'] = gl.getUniformLocation(this.program, "uNormal");
        this.uniformLocations['uObjectData'] = gl.getUniformLocation(this.program, "uObjectData");
        this.uniformLocations['uViewMatrix'] = gl.getUniformLocation(this.program, "uViewMatrix");
        this.uniformLocations['uNearPlane'] = gl.getUniformLocation(this.program, "uNearPlane");
        this.uniformLocations['uFarPlane'] = gl.getUniformLocation(this.program, "uFarPlane");
        this.uniformLocations['uCameraPosition'] = gl.getUniformLocation(this.program, "uCameraPosition");
        this.uniformLocations['uDebugMode'] = gl.getUniformLocation(this.program, "uDebugMode");

        // Check for null uniform locations
        for (const location in this.uniformLocations) {
            if (this.uniformLocations[location] === null) {
                console.error(`Uniform location ${location} not found. Missing or not used?`);
            }
        }        

        this.retrieveLightsUniformsLocations(lights);

        this.uniformsLocationsSet = true;
    }

    private retrieveLightsUniformsLocations(lights : ENGINE.Light[]) : void {

        const gl = this.gl;

        for (let i = 0; i < lights.length; ++i) {
            this.lightPositionLocations[i] = gl.getUniformLocation(this.program, `uLights[${i}].uLightPosition`);
            this.lightModelViewLocations[i] = gl.getUniformLocation(this.program, `uLights[${i}].uModelViewMatrix`);
            this.lightColorLocations[i] = gl.getUniformLocation(this.program, `uLights[${i}].uLightColor`);
            this.lightIntensityLocations[i] = gl.getUniformLocation(this.program, `uLights[${i}].uLightIntensity`);
        }

        this.numLightsLocation = gl.getUniformLocation(this.program, 'uNumLights');
    }

    private createQuadVAO(): WebGLVertexArrayObject | null {
        const gl = this.gl;
    
        // Quad vertices (position and UV coordinates)
        const vertices = new Float32Array([
            // Position   // UV
            -1.0, -1.0,  0.0, 0.0,
            1.0, -1.0,  1.0, 0.0,
            -1.0,  1.0,  0.0, 1.0,
            1.0,  1.0,  1.0, 1.0,
        ]);
    
        const vao = gl.createVertexArray();
        const vbo = gl.createBuffer();
    
        gl.bindVertexArray(vao);
        gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
        gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
    
        // Enable position attribute (location 0)
        gl.enableVertexAttribArray(0);
        gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 4 * Float32Array.BYTES_PER_ELEMENT, 0);
    
        // Enable UV attribute (location 1)
        gl.enableVertexAttribArray(1);
        gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 4 * Float32Array.BYTES_PER_ELEMENT, 2 * Float32Array.BYTES_PER_ELEMENT);
    
        // Unbind VAO and VBO
        gl.bindVertexArray(null);
        gl.bindBuffer(gl.ARRAY_BUFFER, null);
    
        return vao;
    }
  
    public render(textures: { [key: string]: WebGLTexture }, scene: ENGINE.Scene): void {
        const gl = this.gl;
    

        // Enable the stencil test (if not already enabled)
        gl.enable(gl.STENCIL_TEST);
        // Set stencil function to only pass fragments with a stencil value of 1
        gl.stencilFunc(gl.EQUAL, 1, 0xFF);
        // Disable writing to the stencil buffer during this pass
        gl.stencilMask(0x00);

        // Use the shader program
        gl.useProgram(this.program);
    
        const lights = scene.getLights();    
        this.retrieveUniformsLocations(lights);

        // Bind the quad VAO
        gl.bindVertexArray(this.vao);
    
        // Bind the texture to texture unit 0
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, textures['position']);  
        gl.uniform1i(this.uniformLocations['uPosition'], 0);

        // Bind the texture to texture unit 0
        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, textures['albedo']);  
        gl.uniform1i(this.uniformLocations['uAlbedo'], 1);
    
        // Bind the texture to texture unit 0
        gl.activeTexture(gl.TEXTURE2);
        gl.bindTexture(gl.TEXTURE_2D, textures['normal']);  
        gl.uniform1i(this.uniformLocations['uNormal'], 2);

        // Bind the texture to texture unit 3
        gl.activeTexture(gl.TEXTURE3);
        gl.bindTexture(gl.TEXTURE_2D, textures['objdata']);  
        gl.uniform1i(this.uniformLocations['uObjectData'], 3);


        const camera = scene.getCamera();
        const viewMatrix = camera.getViewMatrix();
        gl.uniform1f(this.uniformLocations['uNearPlane'], scene.getCamera().near);
        gl.uniform1f(this.uniformLocations['uFarPlane'], scene.getCamera().far);
        gl.uniformMatrix4fv(this.uniformLocations['uViewMatrix'], false, viewMatrix);
        gl.uniform3fv(this.uniformLocations['uCameraPosition'], camera.position);

        //bind the lights

        const numLights = lights.length;
        gl.uniform1i(this.numLightsLocation, numLights);

        // Set light uniforms
        for (let i = 0; i < numLights; ++i) {
            gl.uniform3fv(this.lightPositionLocations[i], lights[i].position);
            gl.uniform3fv(this.lightColorLocations[i], lights[i].color);
            gl.uniform1f(this.lightIntensityLocations[i], lights[i].intensity);
        }   

        //set the debugging mode
        gl.uniform1i(this.uniformLocations['uDebugMode'], this.debugMode);

        //debug the buffers
        gl.depthMask(false);
        gl.disable(gl.DEPTH_TEST);
        gl.clear(gl.COLOR_BUFFER_BIT);

        // Draw the quad
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    
        // Unbind VAO
        gl.bindVertexArray(null);
    }
  }
  