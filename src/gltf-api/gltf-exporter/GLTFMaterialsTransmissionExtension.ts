

/**
 * Transmission Materials Extension
 *
 * Specification: https://github.com/KhronosGroup/glTF/tree/master/extensions/2.0/Khronos/KHR_materials_transmission
 */
export class GLTFMaterialsTransmissionExtension {
    public writer: any;
    public name: any;

    constructor(writer: any) {

        this.writer = writer;
        this.name = 'KHR_materials_transmission';

    }

    writeMaterial(material: any, materialDef: any) {

        if (!material.isMeshPhysicalMaterial || material.transmission === 0) return;

        const writer = this.writer;
        const extensionsUsed = writer.extensionsUsed;

        const extensionDef: Record<string, any> = {};

        extensionDef.transmissionFactor = material.transmission;

        if (material.transmissionMap) {

            const transmissionMapDef = {
                index: writer.processTexture(material.transmissionMap),
                texCoord: material.transmissionMap.channel
            };
            writer.applyTextureTransform(transmissionMapDef, material.transmissionMap);
            extensionDef.transmissionTexture = transmissionMapDef;

        }

        materialDef.extensions = materialDef.extensions || {};
        materialDef.extensions[this.name] = extensionDef;

        extensionsUsed[this.name] = true;

    }

};
