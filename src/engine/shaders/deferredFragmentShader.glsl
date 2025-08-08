#version 300 es
precision highp float;

in vec2 vUV;

// G-Buffer textures
uniform sampler2D uPosition;
uniform sampler2D uAlbedo;
uniform sampler2D uNormal;
uniform sampler2D uObjectData;

// Lights
#define MAX_LIGHTS 16
struct Light {
    vec3 position;
    vec3 color;
    float intensity;
};
uniform Light uLights[MAX_LIGHTS];
uniform int uNumLights;

// Camera uniforms
uniform mat4 uViewMatrix;
uniform float uNearPlane;
uniform float uFarPlane;
uniform vec3 uCameraPosition;

// Debug mode
uniform int uDebugMode;

// Output
out vec4 fragColor;

void main() {
    // Sample G-buffer
    vec4 positionData = texture(uPosition, vUV);
    vec4 albedoData = texture(uAlbedo, vUV);
    vec4 normalData = texture(uNormal, vUV);
    vec4 objectData = texture(uObjectData, vUV);
    
    // Early exit for empty pixels
    if (albedoData.a < 0.01) {
        discard;
    }
    
    // Unpack G-buffer data
    vec3 fragPos = positionData.xyz; // Position in view space
    vec3 albedo = albedoData.rgb;
    float alpha = albedoData.a;
    vec3 normal = normalize(normalData.xyz);
    float emissiveIntensity = normalData.w; // Emissive intensity stored in normal.w
    
    float objectId = objectData.r;
    float shininess = objectData.g;
    float materialFlags = objectData.b; // 1.0 = unlit/emissive
    
    // Debug modes
    if (uDebugMode == 1) {
        // Position
        fragColor = vec4(abs(fragPos), 1.0);
        return;
    } else if (uDebugMode == 2) {
        // Albedo
        fragColor = vec4(albedo, alpha);
        return;
    } else if (uDebugMode == 3) {
        // Normal
        fragColor = vec4(normal * 0.5 + 0.5, 1.0);
        return;
    } else if (uDebugMode == 4) {
        // Object ID
        float id = objectId / 10.0;
        fragColor = vec4(fract(id), fract(id * 7.0), fract(id * 13.0), 1.0);
        return;
    } else if (uDebugMode == 5) {
        // Emissive intensity
        fragColor = vec4(vec3(emissiveIntensity), 1.0);
        return;
    } else if (uDebugMode == 6) {
        // Material flags (unlit = white, lit = black)
        fragColor = vec4(vec3(materialFlags), 1.0);
        return;
    }
    
    // Check if material is unlit/emissive
    if (materialFlags > 0.5) {
        // For emissive/unlit materials, output the albedo directly
        // The albedo already contains emissive color * intensity from G-buffer
        fragColor = vec4(albedo, alpha);
        return;
    }
    
    // For lit materials, perform lighting calculations
    vec3 viewDir = normalize(-fragPos);
    
    // Ambient lighting
    vec3 ambient = vec3(0.1) * albedo;
    vec3 color = ambient;
    
    // Accumulate lighting from all lights
    for (int i = 0; i < uNumLights && i < MAX_LIGHTS; i++) {
        // Transform light position to view space
        vec3 lightPosWorld = uLights[i].position;
        vec3 lightPosView = (uViewMatrix * vec4(lightPosWorld, 1.0)).xyz;
        
        // Calculate light direction
        vec3 lightDir = normalize(lightPosView - fragPos);
        
        // Distance attenuation
        float distance = length(lightPosView - fragPos);
        float attenuation = 1.0 / (1.0 + 0.09 * distance + 0.032 * distance * distance);
        
        // Diffuse lighting
        float diff = max(dot(normal, lightDir), 0.0);
        vec3 diffuse = diff * albedo * uLights[i].color;
        
        // Specular lighting (Blinn-Phong)
        vec3 halfwayDir = normalize(lightDir + viewDir);
        float spec = pow(max(dot(normal, halfwayDir), 0.0), shininess);
        vec3 specular = spec * uLights[i].color;
        
        // Add this light's contribution
        color += (diffuse + specular) * uLights[i].intensity * attenuation;
    }
    
    // Add emissive contribution for materials that have some emissive but aren't fully unlit
    if (emissiveIntensity > 0.0 && materialFlags < 0.5) {
        color += albedo * emissiveIntensity;
    }
    
    // Simple tone mapping
    color = color / (color + vec3(1.0));
    
    // Gamma correction
    color = pow(color, vec3(1.0/0.8));
    
    fragColor = vec4(color, alpha);
}