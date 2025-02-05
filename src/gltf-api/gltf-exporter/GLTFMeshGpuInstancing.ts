import { BufferAttribute, Matrix4, Quaternion, Vector3 } from "three";

/**
 * GPU Instancing Extension
 *
 * Specification: https://github.com/KhronosGroup/glTF/tree/master/extensions/2.0/Vendor/EXT_mesh_gpu_instancing
 */
export class GLTFMeshGpuInstancing {
    public writer: any;
    public name: any;

    constructor(writer: any) {

        this.writer = writer;
        this.name = 'EXT_mesh_gpu_instancing';

    }

    writeNode(object: any, nodeDef: any) {

        if (!object.isInstancedMesh) return;

        const writer = this.writer;

        const mesh = object;

        const translationAttr = new Float32Array(mesh.count * 3);
        const rotationAttr = new Float32Array(mesh.count * 4);
        const scaleAttr = new Float32Array(mesh.count * 3);

        const matrix = new Matrix4();
        const position = new Vector3();
        const quaternion = new Quaternion();
        const scale = new Vector3();

        for (let i = 0; i < mesh.count; i++) {

            mesh.getMatrixAt(i, matrix);
            matrix.decompose(position, quaternion, scale);

            position.toArray(translationAttr, i * 3);
            quaternion.toArray(rotationAttr, i * 4);
            scale.toArray(scaleAttr, i * 3);

        }

        const attributes: Record<string, any> = {
            TRANSLATION: writer.processAccessor(new BufferAttribute(translationAttr, 3)),
            ROTATION: writer.processAccessor(new BufferAttribute(rotationAttr, 4)),
            SCALE: writer.processAccessor(new BufferAttribute(scaleAttr, 3)),
        };

        if (mesh.instanceColor)
            attributes._COLOR_0 = writer.processAccessor(mesh.instanceColor);

        nodeDef.extensions = nodeDef.extensions || {};
        nodeDef.extensions[this.name] = { attributes };

        writer.extensionsUsed[this.name] = true;
        writer.extensionsRequired[this.name] = true;

    }

};
