// src/engine/Material.ts
import { vec4 } from 'gl-matrix';

/**
 * Abstract base class for materials.
 * Future material types (e.g., textured, reflective) can extend this class.
 */
export abstract class Material {
  
  public isTransparent: boolean = false;
  public shininess: number = 0;

  /**
   * Applies the material-specific uniforms to the given shader program.
   * @param gl The WebGL rendering context.
   * @param program The shader program to which the material data is applied.
   */
  abstract useMaterial(gl: WebGL2RenderingContext, program: WebGLProgram): void;
  abstract debugInfo(): void;

}

/**
 * A basic color material that sets a uniform color.
 */
export class MaterialColor extends Material {
  public color: vec4;

  /**
   * Creates a new ColorMaterial.
   * @param color A vec4 containing RGBA values. Defaults to white (1,1,1,1).
   */
  constructor(color?: vec4) {
    super();
    this.color = color || vec4.fromValues(1, 1, 1, 1);
  }

  /**
   * Applies the color material by setting the 'uMaterialColor' uniform
   * in the active shader program.
   * @param gl The WebGL rendering context.
   * @param program The shader program to which the material data is applied.
   */
  useMaterial(gl: WebGL2RenderingContext, program: WebGLProgram): void {

    //disable all the textures units
    for(let i : number = 0; i < 3; i++) {
      gl.activeTexture(gl.TEXTURE0 + i);
      gl.bindTexture(gl.TEXTURE_2D, null);
    }

    if(this.isTransparent) {
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    } else {
        gl.disable(gl.BLEND);
    }

    const flagsLocation = gl.getUniformLocation(program, 'uUseDiffuseTexture');
    if (flagsLocation !== null) {
      gl.uniform1i(flagsLocation, 0);
    } else {
      throw new Error('Missing uniform locations flag for diffusetexture in this material shader');
    }

    const colorLocation = gl.getUniformLocation(program, 'uMaterialColor');
    if (colorLocation !== null) {
      gl.uniform4fv(colorLocation, this.color);
    } else {
      throw new Error('Missing uniform locations for color in this material shader');
    }

    const shininessUniformLocation  = gl.getUniformLocation(program, 'uMaterialShininess');;
    if (shininessUniformLocation !== null) {
      gl.uniform1f(shininessUniformLocation, this.shininess);
    } 

  }

  debugInfo(): void {
    console.log("MaterialColor Debug Info:");
    console.log('Uniform name: uMaterialColor' );
    console.log("Color:", this.color);
  }  
}

/**
 * A basic textured material that sets a albedo texture.
 */
export class MaterialTexture extends Material {
  private textures: { [key: string]: WebGLTexture | null } = {
    diffuse: null,
    normal: null,
    specular: null,
  };

  private isDirty : boolean = true;

  constructor() {
    super();
  }

  /**
   * Assign a texture to a specific type.
   * @param type - The type of texture (e.g., "diffuse", "normal", "specular").
   * @param texture - The WebGL texture object.
   */
  setTexture(type: "diffuse" | "normal" | "specular" , texture: WebGLTexture | null) {
    this.textures[type] = texture;
    this.isDirty = true;
  }

  /**
   * Bind all textures to their predefined texture units.
   * @param program - The WebGL program to set the uniform locations.
   */
  useMaterial(gl: WebGL2RenderingContext, program: WebGLProgram) {

    const textureUnits = {
        diffuse: 0, // uDiffuse uniform texture sampler
        normal: 1,  // uNormal uniform texture sampler
        specular: 2,  //uSpecular uniform texture sampler
    };

    for (const [type, texture] of Object.entries(this.textures)) {
        if (texture) {
            const textureUnit = textureUnits[type as keyof typeof textureUnits];
            const uniformName = `u${type.charAt(0).toUpperCase() + type.slice(1)}Texture`;
            // uUseSpecularTexture are flags that define what texture to use
            const uniformUseFlagName = `uUse${type.charAt(0).toUpperCase() + type.slice(1)}Texture`;

            // Bind the texture to the assigned texture unit
            gl.activeTexture(gl.TEXTURE0 + textureUnit);
            gl.bindTexture(gl.TEXTURE_2D, texture);

            // Set the uniform to the correct texture unit
            const samplerLocation = gl.getUniformLocation(program, uniformName);
            gl.uniform1i(samplerLocation, textureUnit);

            //enable the corresponding flag
            const useFlagLocation = gl.getUniformLocation(program, uniformUseFlagName);
            gl.uniform1i(useFlagLocation, 1);

        }
    }

    const colorLocation = gl.getUniformLocation(program, 'uMaterialColor');
    if (colorLocation !== null) {
        gl.uniform4fv(colorLocation, vec4.fromValues(1.0, 1.0, 1.0,1.0));
    } else {
        throw new Error('Missing uniform locations for color in this material shader');
    }

    
    const shininessUniformLocation  = gl.getUniformLocation(program, 'uMaterialShininess');;
    if (shininessUniformLocation !== null) {
        gl.uniform1f(shininessUniformLocation, this.shininess);
    } 

    if(this.isTransparent) {
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    } else {
        gl.disable(gl.BLEND);
    }


  }  

  debugInfo(): void {
    console.log("MaterialColor Debug Info:");
    console.log('Uniform color name: uMaterialColor' );
    console.log('Uniform diffuseFlag name: uUseDiffuseTexture' );
    console.log('Sampler2D uniform name: uDiffuseTexture');
  }  
}
