import type { Object3D, Texture, } from 'three';

import type { GLTFExporterPlugin, GLTFExporterOptions } from 'three/addons/exporters/GLTFExporter.js';

import { GLTFWriter } from './GLTFWriter';
import { GLTFLightExtension } from './GLTFLightExtension';
import { GLTFExporterUtils } from './GLTFExporterUtils';
import { GLTFMaterialsUnlitExtension } from './GLTFMaterialsUnlitExtension';
import { GLTFMaterialsTransmissionExtension } from './GLTFMaterialsTransmissionExtension';
import { GLTFMaterialsVolumeExtension } from './GLTFMaterialsVolumeExtension';
import { GLTFMaterialsClearcoatExtension } from './GLTFMaterialsClearcoatExtension';
import { GLTFMaterialsDispersionExtension } from './GLTFMaterialsDispersionExtension';
import { GLTFMaterialsIridescenceExtension } from './GLTFMaterialsIridescenceExtension';
import { GLTFMaterialsIorExtension } from './GLTFMaterialsIorExtension';
import { GLTFMaterialsSpecularExtension } from './GLTFMaterialsSpecularExtension';
import { GLTFMaterialsSheenExtension } from './GLTFMaterialsSheenExtension';
import { GLTFMaterialsAnisotropyExtension } from './GLTFMaterialsAnisotropyExtension';
import { GLTFMaterialsEmissiveStrengthExtension } from './GLTFMaterialsEmissiveStrengthExtension';
import { GLTFMaterialsBumpExtension } from './GLTFMaterialsBumpExtension';
import { GLTFMeshGpuInstancing } from './GLTFMeshGpuInstancing';

type TextureUtils = {
	decompress:
	| ((texture: Texture, maxTextureSize?: number) => Promise<void>)
	| ((texture: Texture, maxTextureSize?: number) => void);
};



class GLTFExporter {

	static Utils: GLTFExporterUtils;

	textureUtils: TextureUtils | null = null;

	public pluginCallbacks: any;

	constructor() {

		this.pluginCallbacks = [];

		this.register(function (writer) {

			return new GLTFLightExtension(writer);

		});

		this.register(function (writer) {

			return new GLTFMaterialsUnlitExtension(writer) as any;

		});

		this.register(function (writer) {

			return new GLTFMaterialsTransmissionExtension(writer) as any;

		});

		this.register(function (writer) {

			return new GLTFMaterialsVolumeExtension(writer) as any;

		});

		this.register(function (writer) {

			return new GLTFMaterialsIorExtension(writer) as any;

		});

		this.register(function (writer) {

			return new GLTFMaterialsSpecularExtension(writer) as any;

		});

		this.register(function (writer) {

			return new GLTFMaterialsClearcoatExtension(writer) as any;

		});

		this.register(function (writer) {

			return new GLTFMaterialsDispersionExtension(writer) as any;

		});

		this.register(function (writer) {

			return new GLTFMaterialsIridescenceExtension(writer) as any;

		});

		this.register(function (writer) {

			return new GLTFMaterialsSheenExtension(writer) as any;

		});

		this.register(function (writer) {

			return new GLTFMaterialsAnisotropyExtension(writer) as any;

		});

		this.register(function (writer) {

			return new GLTFMaterialsEmissiveStrengthExtension(writer) as any;

		});

		this.register(function (writer) {

			return new GLTFMaterialsBumpExtension(writer) as any;

		});

		this.register(function (writer) {

			return new GLTFMeshGpuInstancing(writer);

		});

	}

	register(callback: (writer: GLTFWriter) => GLTFExporterPlugin) {

		if (this.pluginCallbacks.indexOf(callback) === - 1) {

			this.pluginCallbacks.push(callback);

		}

		return this;

	}

	unregister(callback: (writer: GLTFWriter) => GLTFExporterPlugin) {

		if (this.pluginCallbacks.indexOf(callback) !== - 1) {

			this.pluginCallbacks.splice(this.pluginCallbacks.indexOf(callback), 1);

		}

		return this;

	}

	/**
	 * Parse scenes and generate GLTF output
	 * @param  {Scene or [THREE.Scenes]} input   Scene or Array of THREE.Scenes
	 * @param  {Function} onDone  Callback on completed
	 * @param  {Function} onError  Callback on errors
	 * @param  {Object} options options
	 */
	parse(
		input: Object3D | Object3D[],
		onDone: (gltf: ArrayBuffer | { [key: string]: unknown }) => void,
		onError: (error: ErrorEvent) => void,
		options?: GLTFExporterOptions,) {

		const writer = new GLTFWriter();
		const plugins = [];

		for (let i = 0, il = this.pluginCallbacks.length; i < il; i++) {

			plugins.push(this.pluginCallbacks[i](writer));

		}

		writer.setPlugins(plugins);
		writer.write(input as any, onDone, options).catch(onError);

	}

	parseAsync(
		input: Object3D | Object3D[],
		options?: GLTFExporterOptions,
	): Promise<ArrayBuffer | { [key: string]: unknown }> {

		const scope = this;

		return new Promise(function (resolve, reject) {

			scope.parse(input, resolve, reject, options);

		});

	}

}

export { GLTFExporter };
