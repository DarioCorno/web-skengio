import { vec3, mat4 } from 'gl-matrix'

export class Math {

    static zeros = vec3.create();
    static ones = vec3.fromValues(1,1,1);

    static transformMatrix(xform : mat4, translate: vec3 = Math.zeros, rotate: vec3 = Math.zeros, scale: vec3 = Math.zeros) : void {

        let translateMat : mat4 = mat4.create();
        let rotateXMat : mat4 = mat4.create();
        let rotateYMat : mat4 = mat4.create();
        let rotateZMat : mat4 = mat4.create();
        let scaleMat : mat4 = mat4.create();
        
        translate = translate || Math.zeros;
        rotate = rotate || Math.zeros;
        scale = scale || Math.ones;

        mat4.fromTranslation(translateMat, translate);
        mat4.fromXRotation(rotateXMat, rotate[0]);
        mat4.fromYRotation(rotateYMat, rotate[1]);
        mat4.fromZRotation(rotateZMat, rotate[2]);
        mat4.fromScaling(scaleMat, scale);

        mat4.multiply(xform, rotateXMat, scaleMat);
        mat4.multiply(xform, rotateYMat, xform);
        mat4.multiply(xform, rotateZMat, xform);
        mat4.multiply(xform, translateMat, xform);
    }

}