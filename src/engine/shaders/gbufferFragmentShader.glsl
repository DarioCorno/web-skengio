#version 300 es
precision mediump float;

in vec3 vFragPos;
in vec3 vNormal;
in vec2 vUV;

uniform sampler2D uDiffuseTexture;
uniform int uUseDiffuseTexture;
uniform vec4 uMaterialColor;
uniform float uObjectID;

layout(location = 0) out vec4 gPosition;  // G-buffer position
layout(location = 1) out vec4 gAlbedo;    // G-buffer albedo
layout(location = 2) out vec4 gNormal;    // G-buffer normal
layout(location = 3) out vec4 gUV;  // G-buffer gUV
layout(location = 4) out float gObjectID; //g-buffer object id

void main() {
  // Fill G-buffers with fixed values for debugging
  gPosition = vec4(vFragPos, 1.0);  // Red
  if(uUseDiffuseTexture == 1) {
    gAlbedo = texture(uDiffuseTexture, vUV);
  } else {
    gAlbedo = uMaterialColor;
  }

  if(gAlbedo.a < 0.1) discard;

  gNormal = vec4(vNormal, 1.0);   
  //debug only
  //gAlbedo = vec4(vNormal, 1.0);
  gUV = vec4(vUV, 0.0, 1.0);  
  gObjectID = uObjectID;
}
