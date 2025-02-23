#version 300 es
#ifdef GL_ES
precision mediump float;
#endif

// Attributes provided per vertex
in vec3 aPosition;
in vec3 aNormal;
in vec2 aUV;

// Uniforms for transforms
uniform mat4 uModelViewMatrix;
uniform mat4 uProjectionMatrix;

// Varyings passed to the fragment shader
out vec3 vNormal;
out vec3 vFragPos;
out vec2 vUV;

void main() {
  // Compute eye-space position
  vec4 pos = uModelViewMatrix * vec4(aPosition, 1.0);
  gl_Position = uProjectionMatrix * pos;
  vFragPos = pos.xyz;
  
  // Transform and normalize the normal vector
  vNormal = normalize(mat3(uModelViewMatrix) * aNormal);
  
  vUV = aUV;
}
