/**
 * Materials Volume Extension
 *
 * Specification: https://github.com/KhronosGroup/glTF/tree/master/extensions/2.0/Khronos/KHR_materials_volume
 */
export class GLTFMaterialsVolumeExtension {
    public writer: any;
    public name: any;

    constructor(writer: any) {

        this.writer = writer;
        this.name = 'KHR_materials_volume';

    }

    writeMaterial(material: any, materialDef: any) {

        if (!material.isMeshPhysicalMaterial || material.transmission === 0) return;

        const writer = this.writer;
        const extensionsUsed = writer.extensionsUsed;

        const extensionDef: Record<string, any> = {};

        extensionDef.thicknessFactor = material.thickness;

        if (material.thicknessMap) {

            const thicknessMapDef = {
                index: writer.processTexture(material.thicknessMap),
                texCoord: material.thicknessMap.channel
            };
            writer.applyTextureTransform(thicknessMapDef, material.thicknessMap);
            extensionDef.thicknessTexture = thicknessMapDef;

        }

        if (material.attenuationDistance !== Infinity) {

            extensionDef.attenuationDistance = material.attenuationDistance;

        }

        extensionDef.attenuationColor = material.attenuationColor.toArray();

        materialDef.extensions = materialDef.extensions || {};
        materialDef.extensions[this.name] = extensionDef;

        extensionsUsed[this.name] = true;

    }

};
