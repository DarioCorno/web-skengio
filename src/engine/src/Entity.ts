import { vec3, vec4, mat4 } from 'gl-matrix';
import * as ENGINE from '../ENGINE';
import { MaterialColor } from './Material';

export class Entity {
    private gl : WebGL2RenderingContext | null = null;
    public name : string = "";
    private _id : number = 0;   // ObjectId
    public _position: vec3 = vec3.fromValues(0.0, 0.0, 0.0);
    public _rotation: vec3 = vec3.fromValues(0.0, 0.0, 0.0);
    public _scale: vec3 = vec3.fromValues(1.0, 1.0, 1.0);

    public static EntityTypes = {
        Undefined: -1,
        Mesh: 0,
        Light: 1,
        Camera: 2,
        LightDebug: 3
    }

    public type : number = Entity.EntityTypes.Undefined;
    private debugMesh : ENGINE.Mesh | null = null;

    constructor(gl : WebGL2RenderingContext) {
        this.gl = gl;
    }

    public set id(id: number) {
        this._id = id;
    }

    public get id() : number {
        return this._id;
    }

    public get position() : vec3 {
        return this._position;
    }
    public set position(position: vec3) {
        this._position = position;
        if(this.debugMesh != null) {
            this.debugMesh.position = position;
        }
    }

    public get rotation() : vec3 {
        return this._rotation;
    }
    public set rotation(rotation: vec3) {
        this._rotation = rotation;
    }    

    public get scale() : vec3 {
        return this._scale;
    }
    public set scale(scale: vec3) {
        this._scale = scale;
    }    


    getDebugMesh(gl : WebGL2RenderingContext) {
        let mesh = null;
        switch(this.type) {
            case Entity.EntityTypes.Light:
                const sData = ENGINE.Utils.GeometryGenerator.generateSphere(0.1, 8, 8);
                mesh = new ENGINE.Mesh(gl, sData);
                const light : ENGINE.Light = this as ENGINE.Light;
                const color = vec4.fromValues(light.color[0], light.color[1], light.color[2], 1.0)
                mesh.material = new MaterialColor( color );
                mesh.material.name = 'LightDebugMaterial';
                mesh.material.shininess = 0.0;
                mesh.position = light.position;
                mesh.type = Entity.EntityTypes.LightDebug;
                mesh.init();
                break;
        }

        if(mesh == null) throw new Error('Cannot create debug mesh for:' + this.name);
        return mesh;
    }

    /**
     * Computes and returns the model matrix for this mesh using its position, rotation, and scale.
     */
    getModelMatrix(): mat4 {
        const model = mat4.create();
        mat4.translate(model, model, [this.position[0], this.position[1], this.position[2]]);
        mat4.rotateX(model, model, this.rotation[0]);
        mat4.rotateY(model, model, this.rotation[1]);
        mat4.rotateZ(model, model, this.rotation[2]);
        mat4.scale(model, model, [this.scale[0], this.scale[1], this.scale[2]]);
        return model;
    }    
}