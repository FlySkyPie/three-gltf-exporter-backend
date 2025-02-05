import { DEFAULT_SPECULAR_COLOR } from "./constants";

/**
 * Materials specular Extension
 *
 * Specification: https://github.com/KhronosGroup/glTF/tree/master/extensions/2.0/Khronos/KHR_materials_specular
 */
export class GLTFMaterialsSpecularExtension {
	public writer: any;
	public name: any;

	constructor(writer: any) {

		this.writer = writer;
		this.name = 'KHR_materials_specular';

	}

	writeMaterial(material: any, materialDef: any) {

		if (!material.isMeshPhysicalMaterial || (material.specularIntensity === 1.0 &&
			material.specularColor.equals(DEFAULT_SPECULAR_COLOR) &&
			!material.specularIntensityMap && !material.specularColorMap)) return;

		const writer = this.writer;
		const extensionsUsed = writer.extensionsUsed;

		const extensionDef: Record<string, any> = {};

		if (material.specularIntensityMap) {

			const specularIntensityMapDef = {
				index: writer.processTexture(material.specularIntensityMap),
				texCoord: material.specularIntensityMap.channel
			};
			writer.applyTextureTransform(specularIntensityMapDef, material.specularIntensityMap);
			extensionDef.specularTexture = specularIntensityMapDef;

		}

		if (material.specularColorMap) {

			const specularColorMapDef = {
				index: writer.processTexture(material.specularColorMap),
				texCoord: material.specularColorMap.channel
			};
			writer.applyTextureTransform(specularColorMapDef, material.specularColorMap);
			extensionDef.specularColorTexture = specularColorMapDef;

		}

		extensionDef.specularFactor = material.specularIntensity;
		extensionDef.specularColorFactor = material.specularColor.toArray();

		materialDef.extensions = materialDef.extensions || {};
		materialDef.extensions[this.name] = extensionDef;

		extensionsUsed[this.name] = true;

	}

};
