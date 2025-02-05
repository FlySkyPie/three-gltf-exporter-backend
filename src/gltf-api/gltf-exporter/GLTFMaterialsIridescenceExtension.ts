/**
 * Iridescence Materials Extension
 *
 * Specification: https://github.com/KhronosGroup/glTF/tree/master/extensions/2.0/Khronos/KHR_materials_iridescence
 */
export class GLTFMaterialsIridescenceExtension {
    public writer: any;
    public name: any;

    constructor(writer: any) {

        this.writer = writer;
        this.name = 'KHR_materials_iridescence';

    }

    writeMaterial(material: any, materialDef: any) {

        if (!material.isMeshPhysicalMaterial || material.iridescence === 0) return;

        const writer = this.writer;
        const extensionsUsed = writer.extensionsUsed;

        const extensionDef: Record<string, any> = {};

        extensionDef.iridescenceFactor = material.iridescence;

        if (material.iridescenceMap) {

            const iridescenceMapDef = {
                index: writer.processTexture(material.iridescenceMap),
                texCoord: material.iridescenceMap.channel
            };
            writer.applyTextureTransform(iridescenceMapDef, material.iridescenceMap);
            extensionDef.iridescenceTexture = iridescenceMapDef;

        }

        extensionDef.iridescenceIor = material.iridescenceIOR;
        extensionDef.iridescenceThicknessMinimum = material.iridescenceThicknessRange[0];
        extensionDef.iridescenceThicknessMaximum = material.iridescenceThicknessRange[1];

        if (material.iridescenceThicknessMap) {

            const iridescenceThicknessMapDef = {
                index: writer.processTexture(material.iridescenceThicknessMap),
                texCoord: material.iridescenceThicknessMap.channel
            };
            writer.applyTextureTransform(iridescenceThicknessMapDef, material.iridescenceThicknessMap);
            extensionDef.iridescenceThicknessTexture = iridescenceThicknessMapDef;

        }

        materialDef.extensions = materialDef.extensions || {};
        materialDef.extensions[this.name] = extensionDef;

        extensionsUsed[this.name] = true;

    }

};
