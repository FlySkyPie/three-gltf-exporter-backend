/**
 * Unlit Materials Extension
 *
 * Specification: https://github.com/KhronosGroup/glTF/tree/master/extensions/2.0/Khronos/KHR_materials_unlit
 */
export class GLTFMaterialsUnlitExtension {
    public writer: any;
    public name: any;

    constructor(writer: any) {

        this.writer = writer;
        this.name = 'KHR_materials_unlit';

    }

    writeMaterial(material: any, materialDef: any) {

        if (!material.isMeshBasicMaterial) return;

        const writer = this.writer;
        const extensionsUsed = writer.extensionsUsed;

        materialDef.extensions = materialDef.extensions || {};
        materialDef.extensions[this.name] = {};

        extensionsUsed[this.name] = true;

        materialDef.pbrMetallicRoughness.metallicFactor = 0.0;
        materialDef.pbrMetallicRoughness.roughnessFactor = 0.9;

    }

};
