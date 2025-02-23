#version 300 es
precision mediump float;

layout(location = 0) in vec3 aPosition;
layout(location = 1) in vec3 aNormal;
layout(location = 2) in vec2 aUV;

uniform mat4 uModelViewMatrix;
uniform mat4 uProjectionMatrix;

out vec3 vFragPos;
out vec3 vNormal;
out vec2 vUV;

void main() {
  vFragPos = vec3(uModelViewMatrix * vec4(aPosition, 1.0));
  vNormal = normalize(mat3(uModelViewMatrix) * aNormal);
  vUV = aUV;

  gl_Position = uProjectionMatrix * vec4(vFragPos, 1.0);
}