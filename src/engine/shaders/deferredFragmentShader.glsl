#version 300 es
precision mediump float;

in vec2 vUV;

uniform sampler2D uPosition;
uniform sampler2D uAlbedo;
uniform sampler2D uNormal;
uniform sampler2D uObjectID;

// ############## Lights section ################
#define MAX_LIGHTS 16

struct Light {
    vec3 uLightPosition;
    vec3 uLightColor;
    mat4 uModelViewMatrix;
    float uLightIntensity;
};

uniform Light uLights [MAX_LIGHTS];
uniform int uNumLights;

uniform int uDebugMode;
uniform float uMaterialShinines;

// #####################à CAMERA UNIFORMS ###################
uniform mat4 uViewMatrix;
uniform float uNearPlane; // Near plane distance
uniform float uFarPlane;

out vec4 fragColor;

void main() {

    if ( uDebugMode == 1) {
        //debug positions
        fragColor = abs(texture(uPosition, vUV));
    } else if ( uDebugMode == 2) {
        //debug albedo
        fragColor = texture(uAlbedo, vUV);
    } else if ( uDebugMode == 3) {
        //debug normals (absolute)
        fragColor = abs(texture(uNormal, vUV));
    } else if ( uDebugMode == 4) {
        //debug objectId
        float red = texture(uObjectID, vUV).r;
        fragColor = vec4(red, 0.0, 0.0, 1.0);
    } else if ( uDebugMode == 5) {
        //debug alpha
        vec4 alb = texture(uAlbedo, vUV);
        fragColor = vec4(alb.a, alb.a, alb.a, 1.0);
    } else if ( uDebugMode == 6) {
        //debug depth
        vec4 pos = texture(uPosition, vUV);
        float linearDepth = -pos.z;
        float normalizedDepth = (linearDepth - uNearPlane) / (uFarPlane - uNearPlane);
        normalizedDepth = clamp(normalizedDepth, 0.0, 1.0);
        fragColor = vec4(normalizedDepth, normalizedDepth, normalizedDepth, 1.0);
    } else {
        // Sample the G-buffer texture and display its contents
        vec3 position = texture(uPosition, vUV).xyz;
        vec4 albedo = texture(uAlbedo, vUV);
        vec3 normal = texture(uNormal, vUV).xyz;
        vec3 ambient = albedo.rgb * vec3(0.1, 0.1, 0.1);
    
        // Compute the direction to the light source
        vec3 fragPos = position;
        vec3 norm = normalize(normal);

        vec3 color = vec3(0.0);
        for(int i = 0; i < uNumLights; i++) {
            //vec3 lightPos = (uLights[i].uModelViewMatrix * vec4(uLights[i].uLightPosition, 1.0)).xyz;
            vec3 lightPos = (uViewMatrix * vec4(uLights[i].uLightPosition, 1.0)).xyz;
            vec3 lightDir = normalize(lightPos - fragPos);
            // Diffuse lighting angle
            float diffAngle = max(dot(norm,lightDir), 0.0);

            vec3 diffuseColor = uLights[i].uLightColor.rgb * albedo.rgb * diffAngle * uLights[i].uLightIntensity; // Use light intensity

            color += diffuseColor; //albedo.rgb;   
        }

        color += ambient;
        fragColor = vec4(color.r, color.g, color.b, albedo.a); 

    }


}