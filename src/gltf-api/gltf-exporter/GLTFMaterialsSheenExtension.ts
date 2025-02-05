
/**
 * Sheen Materials Extension
 *
 * Specification: https://github.com/KhronosGroup/glTF/tree/main/extensions/2.0/Khronos/KHR_materials_sheen
 */
export class GLTFMaterialsSheenExtension {
    public writer: any;
    public name: any;

    constructor(writer: any) {

        this.writer = writer;
        this.name = 'KHR_materials_sheen';

    }

    writeMaterial(material: any, materialDef: any) {

        if (!material.isMeshPhysicalMaterial || material.sheen == 0.0) return;

        const writer = this.writer;
        const extensionsUsed = writer.extensionsUsed;

        const extensionDef: Record<string, any> = {};

        if (material.sheenRoughnessMap) {

            const sheenRoughnessMapDef = {
                index: writer.processTexture(material.sheenRoughnessMap),
                texCoord: material.sheenRoughnessMap.channel
            };
            writer.applyTextureTransform(sheenRoughnessMapDef, material.sheenRoughnessMap);
            extensionDef.sheenRoughnessTexture = sheenRoughnessMapDef;

        }

        if (material.sheenColorMap) {

            const sheenColorMapDef = {
                index: writer.processTexture(material.sheenColorMap),
                texCoord: material.sheenColorMap.channel
            };
            writer.applyTextureTransform(sheenColorMapDef, material.sheenColorMap);
            extensionDef.sheenColorTexture = sheenColorMapDef;

        }

        extensionDef.sheenRoughnessFactor = material.sheenRoughness;
        extensionDef.sheenColorFactor = material.sheenColor.toArray();

        materialDef.extensions = materialDef.extensions || {};
        materialDef.extensions[this.name] = extensionDef;

        extensionsUsed[this.name] = true;

    }

};
