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
    ObjectIDUniformName : 'uObjectID',

    //gBuffers the final fragment shader receives
    gBufferPositionName : 'uPosition',
    gBufferAlbedoName : 'uAlbedo',
    gBufferNormalName : 'uNormal',
    gBufferObjectIDName : 'uObjectID',

    //light uniforms
    LightPositionUniformName: 'uLightPosition',
    LightColorUniformName: 'uLightColor',
    LightModelViewUniformName: 'uModelViewMatrix',
    LightIntensityUniformName: 'uLightIntensity',    
    
}
