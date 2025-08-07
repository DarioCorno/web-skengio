#version 300 es
precision mediump float;

// Depth prepass fragment shader
// No output needed - we only write to the depth buffer
void main() {
    // Fragment shader does nothing - we only need depth writes
    // The GPU will automatically write to the depth buffer
}