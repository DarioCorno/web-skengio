#version 300 es
precision mediump float;

// Varyings from the vertex shader
in vec3 vNormal;
in vec3 vFragPos;
in vec2 vUV;

// Uniforms for lighting and material properties
uniform vec3 uLightPosition;
uniform vec3 uLightColor;

// Texture samplers
uniform sampler2D uDiffuseTexture;
uniform sampler2D uNormalTexture;
uniform sampler2D uSpecularTexture;

// Flags to enable/disable textures
uniform bool uUseDiffuseTexture;
uniform bool uUseNormalTexture;
uniform bool uUseSpecularTexture;

uniform float uMaterialShinines;

out vec4 fragColor;

void main() {
  // Determine the base color (diffuse texture or fallback)
  vec3 baseColor = uUseDiffuseTexture ? texture(uDiffuseTexture, vUV).rgb : vec3(1.0, 0.0, 1.0);

  // Normalize the interpolated normal (or use a normal map if available)
  vec3 norm = uUseNormalTexture ? normalize(texture(uNormalTexture, vUV).rgb * 2.0 - 1.0) : normalize(vNormal);

  // Compute the direction to the light source
  vec3 lightDir = normalize(uLightPosition - vFragPos);

  // Diffuse lighting
  float diff = max(dot(norm, lightDir), 0.0);
  vec3 diffuse = diff * uLightColor * baseColor;

  // Specular lighting
  vec3 viewDir = normalize(-vFragPos);
  vec3 reflectDir = reflect(-lightDir, norm);
  float spec = uUseSpecularTexture
    ? texture(uSpecularTexture, vUV).r
    : pow(max(dot(viewDir, reflectDir), 0.0), 20.0); 

  vec3 specular = spec * uLightColor;

  // Combine lighting
  vec3 ambient = 0.1 * baseColor;
  vec3 finalColor = ambient + diffuse + specular;

  fragColor = vec4(finalColor, 1.0);
}
