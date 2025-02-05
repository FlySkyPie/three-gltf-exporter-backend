/**
 * Anisotropy Materials Extension
 *
 * Specification: https://github.com/KhronosGroup/glTF/tree/main/extensions/2.0/Khronos/KHR_materials_anisotropy
 */
export class GLTFMaterialsAnisotropyExtension {
    public writer: any;
    public name: any;

    constructor(writer: any) {

        this.writer = writer;
        this.name = 'KHR_materials_anisotropy';

    }

    writeMaterial(material: any, materialDef: any) {

        if (!material.isMeshPhysicalMaterial || material.anisotropy == 0.0) return;

        const writer = this.writer;
        const extensionsUsed = writer.extensionsUsed;

        const extensionDef: Record<string, any> = {};

        if (material.anisotropyMap) {

            const anisotropyMapDef = { index: writer.processTexture(material.anisotropyMap) };
            writer.applyTextureTransform(anisotropyMapDef, material.anisotropyMap);
            extensionDef.anisotropyTexture = anisotropyMapDef;

        }

        extensionDef.anisotropyStrength = material.anisotropy;
        extensionDef.anisotropyRotation = material.anisotropyRotation;

        materialDef.extensions = materialDef.extensions || {};
        materialDef.extensions[this.name] = extensionDef;

        extensionsUsed[this.name] = true;

    }

};
