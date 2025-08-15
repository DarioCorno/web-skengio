#version 300 es
precision highp float;

// Vertex attributes
layout(location = 0) in vec3 aPosition;
layout(location = 1) in vec3 aNormal;
layout(location = 2) in vec2 aUV;
layout(location = 3) in vec3 aTangent;
layout(location = 4) in vec3 aBitangent;

// Transformation matrices
uniform mat4 uModelViewMatrix;
uniform mat4 uProjectionMatrix;

// Outputs to fragment shader
out vec3 vFragPos;
out vec3 vNormal;
out vec2 vUV;
out vec3 vTangent;
out vec3 vBitangent;
out mat3 vTBN; // Tangent-Bitangent-Normal matrix for normal mapping

void main() {
    // Transform position to view space
    vec4 viewPos = uModelViewMatrix * vec4(aPosition, 1.0);
    vFragPos = viewPos.xyz;
    
    // Calculate normal matrix (inverse transpose of upper 3x3 of model-view)
    // For now, we'll just use the upper 3x3 of the model-view matrix
    // This works correctly if there's no non-uniform scaling
    mat3 normalMatrix = mat3(uModelViewMatrix);
    
    // Transform normal, tangent, and bitangent to view space
    vNormal = normalize(normalMatrix * aNormal);
    vTangent = normalize(normalMatrix * aTangent);
    vBitangent = normalize(normalMatrix * aBitangent);
    
    // Create TBN matrix for transforming from tangent space to view space
    // Gram-Schmidt orthogonalization to ensure orthogonal basis
    vec3 T = normalize(vTangent - dot(vTangent, vNormal) * vNormal);
    vec3 B = cross(vNormal, T);
    vTBN = mat3(T, B, vNormal);
    
    // Pass through UV coordinates
    vUV = aUV;
    
    // Project position to clip space
    gl_Position = uProjectionMatrix * viewPos;
}