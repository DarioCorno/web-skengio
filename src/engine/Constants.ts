//attributes
export const attributes = {
    PositionAttributeName : 'aPosition',
    NormalAttributeName : 'aNormal',
    UVAttributeName : 'aUV'
}

//uniforms
export const uniforms = {
    ModelViewMatrixUniformName : 'uModelViewMatrix',
    ProjectionMatrixUniformName : 'uProjectionMatrix',

    //boolean used to enable or disable diffuse texture lookup
    UseDiffuseFlagUniformName : 'uUseDiffuseTexture',
    DiffuseTextureUniformName : 'uDiffuseTexture',

    MaterialColorUniformName : 'uMaterialColor',
    ObjectDataUniformName : 'uObjectData',

    //gBuffers the final fragment shader receives
    gBufferPositionName : 'uPosition',
    gBufferAlbedoName : 'uAlbedo',
    gBufferNormalName : 'uNormal',
    gBufferObjectDataName : 'uObjectData',

    //light uniforms
    LightPositionUniformName: 'uLightPosition',
    LightColorUniformName: 'uLightColor',
    LightModelViewUniformName: 'uModelViewMatrix',
    LightIntensityUniformName: 'uLightIntensity',    
    
}
