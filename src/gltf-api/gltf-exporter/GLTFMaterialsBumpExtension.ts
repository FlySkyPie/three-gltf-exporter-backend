/**
 * Materials bump Extension
 *
 * Specification: https://github.com/KhronosGroup/glTF/tree/master/extensions/2.0/Khronos/EXT_materials_bump
 */
export class GLTFMaterialsBumpExtension {
    public writer: any;
    public name: any;

    constructor(writer: any) {

        this.writer = writer;
        this.name = 'EXT_materials_bump';

    }

    writeMaterial(material: any, materialDef: any) {

        if (!material.isMeshStandardMaterial || (
            material.bumpScale === 1 &&
            !material.bumpMap)) return;

        const writer = this.writer;
        const extensionsUsed = writer.extensionsUsed;

        const extensionDef: Record<string, any> = {};

        if (material.bumpMap) {

            const bumpMapDef = {
                index: writer.processTexture(material.bumpMap),
                texCoord: material.bumpMap.channel
            };
            writer.applyTextureTransform(bumpMapDef, material.bumpMap);
            extensionDef.bumpTexture = bumpMapDef;

        }

        extensionDef.bumpFactor = material.bumpScale;

        materialDef.extensions = materialDef.extensions || {};
        materialDef.extensions[this.name] = extensionDef;

        extensionsUsed[this.name] = true;

    }

};
