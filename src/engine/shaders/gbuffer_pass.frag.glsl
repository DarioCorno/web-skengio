#version 300 es
precision mediump float;

in vec3 vFragPos;
in vec3 vNormal;
in vec2 vUV;
in vec3 vTangent;
in vec3 vBitangent;
in mat3 vTBN;

// Textures
uniform sampler2D uDiffuseTexture;
uniform int uUseDiffuseTexture;
uniform sampler2D uNormalTexture;
uniform int uUseNormalTexture;

// Material properties
uniform vec4 uMaterialColor;
uniform float uMaterialShininess;

// PBR uniforms that Material.useMaterial() sets
uniform vec4 uBaseColor;
uniform vec3 uEmissiveFactor;
uniform float uEmissiveIntensity;
uniform float uNormalScale;
uniform int uIsUnlit;

uniform vec4 uObjectData; 

layout(location = 0) out vec4 gPosition;  // G-buffer position
layout(location = 1) out vec4 gAlbedo;    // G-buffer albedo (RGB) + alpha (A)
layout(location = 2) out vec4 gNormal;    // G-buffer normal (RGB) + emissive intensity (A)
layout(location = 3) out vec4 gObjectData; // Object ID (R), shininess (G), material flags (B), unused (A)

void main() {
    // Fill G-buffers
    gPosition = vec4(vFragPos, 1.0);
    
    // Get base color
    vec4 baseColor;
    if(uUseDiffuseTexture == 1) {
        baseColor = texture(uDiffuseTexture, vUV);
    } else {
        baseColor = uMaterialColor;
    }

    if(baseColor.a < 0.1) discard;

    // Store albedo - for emissive materials, this will be the emissive color
    if(uIsUnlit == 1 && length(uEmissiveFactor) > 0.001) {
        // For emissive materials, store the emissive color as albedo
        gAlbedo = vec4(uEmissiveFactor * uEmissiveIntensity, baseColor.a);
    } else {
        gAlbedo = baseColor;
    }

    // Calculate final normal
    vec3 finalNormal = vNormal;
    
    // Apply normal mapping if texture is available
    if(uUseNormalTexture == 1) {
        // Sample normal map
        vec3 normalMapSample = texture(uNormalTexture, vUV).rgb;
        
        // Convert from [0,1] to [-1,1] range
        normalMapSample = normalMapSample * 2.0 - 1.0;
        
        // Scale the normal by normalScale (controls intensity)
        normalMapSample.xy *= uNormalScale;
        
        // Ensure the normal is normalized
        normalMapSample = normalize(normalMapSample);
        
        // Transform from tangent space to view space using TBN matrix
        finalNormal = normalize(vTBN * normalMapSample);
    }

    // Store normal and emissive intensity
    gNormal = vec4(finalNormal, uEmissiveIntensity);
    
    // Store object data with material flags
    float materialFlags = 0.0;
    if(uIsUnlit == 1) materialFlags = 1.0; // Flag for unlit/emissive material
    
    gObjectData = vec4(
        uObjectData.r,        // Object ID
        uMaterialShininess,   // Shininess
        materialFlags,        // Material flags (1.0 = unlit/emissive)
        0.0                   // Reserved for future use
    );
}