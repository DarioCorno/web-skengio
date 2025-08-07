#version 300 es
precision mediump float;

layout(location = 0) in vec3 aPosition;

uniform mat4 uModelViewMatrix;
uniform mat4 uProjectionMatrix;

void main() {
    vec4 viewPos = uModelViewMatrix * vec4(aPosition, 1.0);
    gl_Position = uProjectionMatrix * viewPos;
}