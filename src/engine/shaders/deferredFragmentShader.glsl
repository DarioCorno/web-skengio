#version 300 es
precision mediump float;

in vec2 vUV;

uniform sampler2D uPosition;
uniform sampler2D uAlbedo;
uniform sampler2D uNormal;
uniform sampler2D uObjectData;

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

// ##################### CAMERA UNIFORMS ###################
uniform mat4 uViewMatrix;
uniform float uNearPlane; // Near plane distance
uniform float uFarPlane;
uniform vec3 uCameraPosition;      // Needed to compute view direction

out vec4 fragColor;

vec3 getObjectColor(float id) {
    // Simple hash function to generate pseudo-random values
    uint h = uint(id);
    h = (h ^ 61u) ^ (h >> 16u);
    h *= 9u;
    h = h ^ (h >> 4u);
    h *= 0x27d4eb2du;
    h = h ^ (h >> 15u);

    // Map the hash to RGB color components, making them brighter
    float r = float((h >> 16u) & 255u) / 255.0;
    float g = float((h >> 8u) & 255u) / 255.0;
    float b = float(h & 255u) / 255.0;

    // Adjust brightness by scaling and clamping
    vec3 color = vec3(r, g, b);
    color = color * 1.5; // Increase brightness (adjust the multiplier)
    color = clamp(color, 0.0, 1.0); // Clamp to prevent overflow

    return color;
}

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
        //debug objectData
        float objId = texture(uObjectData, vUV).r;
        float alpha = texture(uAlbedo, vUV).a;
        fragColor = vec4(getObjectColor(objId), alpha);
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
        vec3 ambient = albedo.rgb * vec3(0.2, 0.2, 0.2);
    
        // Compute the direction to the light source
        vec3 fragPos = position;
        vec3 norm = normalize(normal);

        vec4 objData = texture(uObjectData, vUV);
        float objId = objData.r;
        float matShininess = objData.g;
        vec3 color = vec3(0.0);

        //if objeId is negative, it's a debug mesh
        if(objId >= 0.0) {
            
            vec3 viewDir = normalize(uCameraPosition - fragPos);

            for(int i = 0; i < uNumLights; i++) {
                //vec3 lightPos = (uLights[i].uModelViewMatrix * vec4(uLights[i].uLightPosition, 1.0)).xyz;
                vec3 lightPos = (uViewMatrix * vec4(uLights[i].uLightPosition, 1.0)).xyz;
                vec3 lightDir = normalize(lightPos - fragPos);
                // Diffuse lighting angle
                float diffAngle = max(dot(norm,lightDir), 0.0);

                vec3 diffuseColor = uLights[i].uLightColor.rgb * albedo.rgb * diffAngle * uLights[i].uLightIntensity; // Use light intensity

                // Specular term using Blinn-Phong:
                vec3 halfwayDir = normalize(lightDir + viewDir);
                float spec = pow(max(dot(norm, halfwayDir), 0.0), matShininess);   //default global shininess, will use material shininess

                color += (diffuseColor * spec);
            }

            color += ambient;
        } else {
            //debug mesh, render it white without lighting for now
            color = albedo.rgb;
        }
        fragColor = vec4(color.r, color.g, color.b, albedo.a); 

    }


}