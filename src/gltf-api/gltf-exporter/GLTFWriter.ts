import type { Object3D, Texture, Material, BufferGeometry, Mesh, Camera, AnimationClip } from 'three';
import type { Canvas } from 'canvas';
import {
    BufferAttribute,
    DoubleSide,
    InterpolateDiscrete,
    NoColorSpace,
    MathUtils,
    Matrix4,
    PropertyBinding,
    RGBAFormat,
    Scene,
    Source,
    SRGBColorSpace,
    CompressedTexture,
    Vector3,
    REVISION,

} from 'three';
import { decompress } from 'three/addons/utils/WebGLTextureUtils.js';
import { createCanvas, createImageData } from 'canvas';

import { FileReader } from '../libs/FileReader';

import {
    GLB_CHUNK_PREFIX_BYTES,
    GLB_CHUNK_TYPE_BIN,
    GLB_CHUNK_TYPE_JSON,
    GLB_HEADER_BYTES,
    GLB_HEADER_MAGIC,
    GLB_VERSION,
    KHR_MESH_QUANTIZATION,
    KHR_mesh_quantization_ExtraAttrTypes,
    PATH_PROPERTIES,
    THREE_TO_WEBGL,
    WEBGL_CONSTANTS
} from './constants';
import { GLTFExporterUtils } from './GLTFExporterUtils';

/**
 * Compare two arrays
 * @param  {Array} array1 Array 1 to compare
 * @param  {Array} array2 Array 2 to compare
 * @return {Boolean}        Returns true if both arrays are equal
 */
function equalArray<T>(array1: T[], array2: T[]): boolean {

    return (array1.length === array2.length) && array1.every(function (element, index) {

        return element === array2[index];

    });

}

/**
 * Converts a string to an ArrayBuffer.
 * @param  {string} text
 * @return {ArrayBuffer}
 */
function stringToArrayBuffer(text: string) {

    return new TextEncoder().encode(text).buffer;

}

/**
 * Is identity matrix
 *
 * @param {Matrix4} matrix
 * @returns {Boolean} Returns true, if parameter is identity matrix
 */
function isIdentityMatrix(matrix: Matrix4) {

    return equalArray(matrix.elements, [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);

}

/**
 * Get the min and max vectors from the given attribute
 * @param  {BufferAttribute} attribute Attribute to find the min/max in range from start to start + count
 * @param  {Integer} start
 * @param  {Integer} count
 * @return {Object} Object containing the `min` and `max` values (As an array of attribute.itemSize components)
 */
function getMinMax(attribute: BufferAttribute, start: number, count: number) {

    const output = {

        min: new Array(attribute.itemSize).fill(Number.POSITIVE_INFINITY),
        max: new Array(attribute.itemSize).fill(Number.NEGATIVE_INFINITY)

    };

    for (let i = start; i < start + count; i++) {

        for (let a = 0; a < attribute.itemSize; a++) {

            let value;

            if (attribute.itemSize > 4) {

                // no support for interleaved data for itemSize > 4

                value = attribute.array[i * attribute.itemSize + a];

            } else {

                if (a === 0) value = attribute.getX(i);
                else if (a === 1) value = attribute.getY(i);
                else if (a === 2) value = attribute.getZ(i);
                else if (a === 3) value = attribute.getW(i);

                if (attribute.normalized === true) {

                    value = MathUtils.normalize(value!, attribute.array as any);

                }

            }

            output.min[a] = Math.min(output.min[a], value!);
            output.max[a] = Math.max(output.max[a], value!);

        }

    }

    return output;

}

/**
 * Get the required size + padding for a buffer, rounded to the next 4-byte boundary.
 * https://github.com/KhronosGroup/glTF/tree/master/specification/2.0#data-alignment
 *
 * @param {Integer} bufferSize The size the original buffer.
 * @returns {Integer} new buffer size with required padding.
 *
 */
function getPaddedBufferSize(bufferSize: number) {

    return Math.ceil(bufferSize / 4) * 4;

}

/**
 * Returns a buffer aligned to 4-byte boundary.
 *
 * @param {ArrayBuffer} arrayBuffer Buffer to pad
 * @param {Integer} paddingByte (Optional)
 * @returns {ArrayBuffer} The same buffer if it's already aligned to 4-byte boundary or a new buffer
 */
function getPaddedArrayBuffer(arrayBuffer: ArrayBuffer, paddingByte = 0) {

    const paddedLength = getPaddedBufferSize(arrayBuffer.byteLength);

    if (paddedLength !== arrayBuffer.byteLength) {

        const array = new Uint8Array(paddedLength);
        array.set(new Uint8Array(arrayBuffer));

        if (paddingByte !== 0) {

            for (let i = arrayBuffer.byteLength; i < paddedLength; i++) {

                array[i] = paddingByte;

            }

        }

        return array.buffer;

    }

    return arrayBuffer;

}

function getCanvas(): Canvas {
    return createCanvas(1, 1);
}

async function getToBlobPromise(canvas: Canvas, mimeType: string): Promise<Blob | null> {
    if (mimeType === 'image/jpeg') {
        const buffer = canvas.toBuffer('image/jpeg');
        const blob = new Blob([buffer], {
            type: 'image/jpeg',
        });
        return blob;
    }

    if (mimeType === 'image/png') {
        const buffer = canvas.toBuffer('image/png');
        const blob = new Blob([buffer], {
            type: 'image/png',
        });
        return blob;
    }

    throw new Error(`Unexpected mimeType: ${mimeType}`);
}



/**
 * Writer
 */
export class GLTFWriter {
    public plugins: any;
    public options: any;
    public pending: any;
    public buffers: any;
    public byteOffset: any;
    public nodeMap: any;
    public skins: any;
    public extensionsUsed: any;
    public extensionsRequired: any;
    public uids: any;
    public uid: any;
    public json: any;
    public cache: any;

    constructor() {

        this.plugins = [];

        this.options = {};
        this.pending = [];
        this.buffers = [];

        this.byteOffset = 0;
        this.buffers = [];
        this.nodeMap = new Map();
        this.skins = [];

        this.extensionsUsed = {};
        this.extensionsRequired = {};

        this.uids = new Map();
        this.uid = 0;

        this.json = {
            asset: {
                version: '2.0',
                generator: 'THREE.GLTFExporter r' + REVISION
            }
        };

        this.cache = {
            meshes: new Map(),
            attributes: new Map(),
            attributesNormalized: new Map(),
            materials: new Map(),
            textures: new Map(),
            images: new Map()
        };

    }

    setPlugins(plugins: any) {

        this.plugins = plugins;

    }

    /**
     * Parse scenes and generate GLTF output
     * @param  {Scene or [THREE.Scenes]} input   Scene or Array of THREE.Scenes
     * @param  {Function} onDone  Callback on completed
     * @param  {Object} options options
     */
    async write(input: Scene, onDone: Function, options: Record<string, any> = {}) {

        this.options = Object.assign({
            // default options
            binary: false,
            trs: false,
            onlyVisible: true,
            maxTextureSize: Infinity,
            animations: [],
            includeCustomExtensions: false
        }, options);

        if (this.options.animations.length > 0) {

            // Only TRS properties, and not matrices, may be targeted by animation.
            this.options.trs = true;

        }

        this.processInput(input);

        await Promise.all(this.pending);

        const writer = this;
        const buffers = writer.buffers;
        const json = writer.json;
        options = writer.options;

        const extensionsUsed = writer.extensionsUsed;
        const extensionsRequired = writer.extensionsRequired;

        // Merge buffers.
        const blob = new Blob(buffers, { type: 'application/octet-stream' });

        // Declare extensions.
        const extensionsUsedList = Object.keys(extensionsUsed);
        const extensionsRequiredList = Object.keys(extensionsRequired);

        if (extensionsUsedList.length > 0) json.extensionsUsed = extensionsUsedList;
        if (extensionsRequiredList.length > 0) json.extensionsRequired = extensionsRequiredList;

        // Update bytelength of the single buffer.
        if (json.buffers && json.buffers.length > 0) json.buffers[0].byteLength = blob.size;

        if (options.binary === true) {

            // https://github.com/KhronosGroup/glTF/blob/master/specification/2.0/README.md#glb-file-format-specification

            blob.arrayBuffer().then((result => {
                // Binary chunk.
                const binaryChunk = getPaddedArrayBuffer(result as any);
                const binaryChunkPrefix = new DataView(new ArrayBuffer(GLB_CHUNK_PREFIX_BYTES));
                binaryChunkPrefix.setUint32(0, binaryChunk.byteLength, true);
                binaryChunkPrefix.setUint32(4, GLB_CHUNK_TYPE_BIN, true);

                // JSON chunk.
                const jsonChunk = getPaddedArrayBuffer(stringToArrayBuffer(JSON.stringify(json)), 0x20);
                const jsonChunkPrefix = new DataView(new ArrayBuffer(GLB_CHUNK_PREFIX_BYTES));
                jsonChunkPrefix.setUint32(0, jsonChunk.byteLength, true);
                jsonChunkPrefix.setUint32(4, GLB_CHUNK_TYPE_JSON, true);

                // GLB header.
                const header = new ArrayBuffer(GLB_HEADER_BYTES);
                const headerView = new DataView(header);
                headerView.setUint32(0, GLB_HEADER_MAGIC, true);
                headerView.setUint32(4, GLB_VERSION, true);
                const totalByteLength = GLB_HEADER_BYTES
                    + jsonChunkPrefix.byteLength + jsonChunk.byteLength
                    + binaryChunkPrefix.byteLength + binaryChunk.byteLength;
                headerView.setUint32(8, totalByteLength, true);

                const glbBlob = new Blob([
                    header,
                    jsonChunkPrefix,
                    jsonChunk,
                    binaryChunkPrefix,
                    binaryChunk
                ], { type: 'application/octet-stream' });

                glbBlob.arrayBuffer().then((buffer => {
                    onDone(buffer);
                }));
            }));
        } else {

            if (json.buffers && json.buffers.length > 0) {
                blob.arrayBuffer().then(buffer => {
                    const base64data = Buffer.from(buffer).toString('base64');
                    json.buffers[0].uri = base64data;
                    onDone(json);
                })
            } else {

                onDone(json);

            }

        }


    }

    /**
     * Serializes a userData.
     *
     * @param {THREE.Object3D|THREE.Material} object
     * @param {Object} objectDef
     */
    serializeUserData(object: Object3D | Material, objectDef: any) {

        if (Object.keys(object.userData).length === 0) return;

        const options = this.options;
        const extensionsUsed = this.extensionsUsed;

        try {

            const json = JSON.parse(JSON.stringify(object.userData));

            if (options.includeCustomExtensions && json.gltfExtensions) {

                if (objectDef.extensions === undefined) objectDef.extensions = {};

                for (const extensionName in json.gltfExtensions) {

                    objectDef.extensions[extensionName] = json.gltfExtensions[extensionName];
                    extensionsUsed[extensionName] = true;

                }

                delete json.gltfExtensions;

            }

            if (Object.keys(json).length > 0) objectDef.extras = json;

        } catch (error: any) {

            console.warn('THREE.GLTFExporter: userData of \'' + object.name + '\' ' +
                'won\'t be serialized because of JSON.stringify error - ' + error.message);

        }

    }

    /**
     * Returns ids for buffer attributes.
     * @param  {Object} object
     * @return {Integer}
     */
    getUID(attribute: any, isRelativeCopy = false) {

        if (this.uids.has(attribute) === false) {

            const uids = new Map();

            uids.set(true, this.uid++);
            uids.set(false, this.uid++);

            this.uids.set(attribute, uids);

        }

        const uids = this.uids.get(attribute);

        return uids.get(isRelativeCopy);

    }

    /**
     * Checks if normal attribute values are normalized.
     *
     * @param {BufferAttribute} normal
     * @returns {Boolean}
     */
    isNormalizedNormalAttribute(normal: BufferAttribute) {

        const cache = this.cache;

        if (cache.attributesNormalized.has(normal)) return false;

        const v = new Vector3();

        for (let i = 0, il = normal.count; i < il; i++) {

            // 0.0005 is from glTF-validator
            if (Math.abs(v.fromBufferAttribute(normal, i).length() - 1.0) > 0.0005) return false;

        }

        return true;

    }

    /**
     * Creates normalized normal buffer attribute.
     *
     * @param {BufferAttribute} normal
     * @returns {BufferAttribute}
     *
     */
    createNormalizedNormalAttribute(normal: BufferAttribute) {

        const cache = this.cache;

        if (cache.attributesNormalized.has(normal)) return cache.attributesNormalized.get(normal);

        const attribute = normal.clone();
        const v = new Vector3();

        for (let i = 0, il = attribute.count; i < il; i++) {

            v.fromBufferAttribute(attribute, i);

            if (v.x === 0 && v.y === 0 && v.z === 0) {

                // if values can't be normalized set (1, 0, 0)
                v.setX(1.0);

            } else {

                v.normalize();

            }

            attribute.setXYZ(i, v.x, v.y, v.z);

        }

        cache.attributesNormalized.set(normal, attribute);

        return attribute;

    }

    /**
     * Applies a texture transform, if present, to the map definition. Requires
     * the KHR_texture_transform extension.
     *
     * @param {Object} mapDef
     * @param {THREE.Texture} texture
     */
    applyTextureTransform(mapDef: any, texture: Texture) {

        let didTransform = false;
        const transformDef: Record<string, any> = {};

        if (texture.offset.x !== 0 || texture.offset.y !== 0) {

            transformDef.offset = texture.offset.toArray();
            didTransform = true;

        }

        if (texture.rotation !== 0) {

            transformDef.rotation = texture.rotation;
            didTransform = true;

        }

        if (texture.repeat.x !== 1 || texture.repeat.y !== 1) {

            transformDef.scale = texture.repeat.toArray();
            didTransform = true;

        }

        if (didTransform) {

            mapDef.extensions = mapDef.extensions || {};
            mapDef.extensions['KHR_texture_transform'] = transformDef;
            this.extensionsUsed['KHR_texture_transform'] = true;

        }

    }

    buildMetalRoughTexture(metalnessMap: any, roughnessMap: any) {

        if (metalnessMap === roughnessMap) return metalnessMap;

        function getEncodingConversion(map: any) {

            if (map.colorSpace === SRGBColorSpace) {

                return function SRGBToLinear(c: any) {

                    return (c < 0.04045) ? c * 0.0773993808 : Math.pow(c * 0.9478672986 + 0.0521327014, 2.4);

                };

            }

            return function LinearToLinear(c: any) {

                return c;

            };

        }

        console.warn('THREE.GLTFExporter: Merged metalnessMap and roughnessMap textures.');

        if (metalnessMap instanceof CompressedTexture) {

            metalnessMap = decompress(metalnessMap);

        }

        if (roughnessMap instanceof CompressedTexture) {

            roughnessMap = decompress(roughnessMap);

        }

        const metalness = metalnessMap ? metalnessMap.image : null;
        const roughness = roughnessMap ? roughnessMap.image : null;

        const width = Math.max(metalness ? metalness.width : 0, roughness ? roughness.width : 0);
        const height = Math.max(metalness ? metalness.height : 0, roughness ? roughness.height : 0);

        const canvas = getCanvas();
        canvas.width = width;
        canvas.height = height;

        const context: CanvasRenderingContext2D = canvas.getContext('2d', {
            // willReadFrequently: true,
        }) as any;
        context.fillStyle = '#00ffff';
        context.fillRect(0, 0, width, height);

        const composite = context.getImageData(0, 0, width, height);

        if (metalness) {

            context.drawImage(metalness, 0, 0, width, height);

            const convert = getEncodingConversion(metalnessMap);
            const data = context.getImageData(0, 0, width, height).data;

            for (let i = 2; i < data.length; i += 4) {

                composite.data[i] = convert(data[i] / 256) * 256;

            }

        }

        if (roughness) {

            context.drawImage(roughness, 0, 0, width, height);

            const convert = getEncodingConversion(roughnessMap);
            const data = context.getImageData(0, 0, width, height).data;

            for (let i = 1; i < data.length; i += 4) {

                composite.data[i] = convert(data[i] / 256) * 256;

            }

        }

        context.putImageData(composite, 0, 0);

        //

        const reference = metalnessMap || roughnessMap;

        const texture = reference.clone();

        texture.source = new Source(canvas);
        texture.colorSpace = NoColorSpace;
        texture.channel = (metalnessMap || roughnessMap).channel;

        if (metalnessMap && roughnessMap && metalnessMap.channel !== roughnessMap.channel) {

            console.warn('THREE.GLTFExporter: UV channels for metalnessMap and roughnessMap textures must match.');

        }

        return texture;

    }

    /**
     * Process a buffer to append to the default one.
     * @param  {ArrayBuffer} buffer
     * @return {Integer}
     */
    processBuffer(buffer: ArrayBuffer) {

        const json = this.json;
        const buffers = this.buffers;

        if (!json.buffers) json.buffers = [{ byteLength: 0 }];

        // All buffers are merged before export.
        buffers.push(buffer);

        return 0;

    }

    /**
     * Process and generate a BufferView
     * @param  {BufferAttribute} attribute
     * @param  {number} componentType
     * @param  {number} start
     * @param  {number} count
     * @param  {number} target (Optional) Target usage of the BufferView
     * @return {Object}
     */
    processBufferView(
        attribute: BufferAttribute,
        componentType: number,
        start: number,
        count: number,
        target: number) {

        const json = this.json;

        if (!json.bufferViews) json.bufferViews = [];

        // Create a new dataview and dump the attribute's array into it

        let componentSize;

        switch (componentType) {

            case WEBGL_CONSTANTS.BYTE:
            case WEBGL_CONSTANTS.UNSIGNED_BYTE:

                componentSize = 1;

                break;

            case WEBGL_CONSTANTS.SHORT:
            case WEBGL_CONSTANTS.UNSIGNED_SHORT:

                componentSize = 2;

                break;

            default:

                componentSize = 4;

        }

        let byteStride = attribute.itemSize * componentSize;

        if (target === WEBGL_CONSTANTS.ARRAY_BUFFER) {

            // Each element of a vertex attribute MUST be aligned to 4-byte boundaries
            // inside a bufferView
            byteStride = Math.ceil(byteStride / 4) * 4;

        }

        const byteLength = getPaddedBufferSize(count * byteStride);
        const dataView = new DataView(new ArrayBuffer(byteLength));
        let offset = 0;

        for (let i = start; i < start + count; i++) {

            for (let a = 0; a < attribute.itemSize; a++) {

                let value;

                if (attribute.itemSize > 4) {

                    // no support for interleaved data for itemSize > 4

                    value = attribute.array[i * attribute.itemSize + a];

                } else {

                    if (a === 0) value = attribute.getX(i);
                    else if (a === 1) value = attribute.getY(i);
                    else if (a === 2) value = attribute.getZ(i);
                    else if (a === 3) value = attribute.getW(i);

                    if (attribute.normalized === true) {

                        value = MathUtils.normalize(value!, attribute.array as any);

                    }

                }

                if (componentType === WEBGL_CONSTANTS.FLOAT) {

                    dataView.setFloat32(offset, value!, true);

                } else if (componentType === WEBGL_CONSTANTS.INT) {

                    dataView.setInt32(offset, value!, true);

                } else if (componentType === WEBGL_CONSTANTS.UNSIGNED_INT) {

                    dataView.setUint32(offset, value!, true);

                } else if (componentType === WEBGL_CONSTANTS.SHORT) {

                    dataView.setInt16(offset, value!, true);

                } else if (componentType === WEBGL_CONSTANTS.UNSIGNED_SHORT) {

                    dataView.setUint16(offset, value!, true);

                } else if (componentType === WEBGL_CONSTANTS.BYTE) {

                    dataView.setInt8(offset, value!);

                } else if (componentType === WEBGL_CONSTANTS.UNSIGNED_BYTE) {

                    dataView.setUint8(offset, value!);

                }

                offset += componentSize;

            }

            if ((offset % byteStride) !== 0) {

                offset += byteStride - (offset % byteStride);

            }

        }

        const bufferViewDef: Record<string, any> = {

            buffer: this.processBuffer(dataView.buffer),
            byteOffset: this.byteOffset,
            byteLength: byteLength

        };

        if (target !== undefined) bufferViewDef.target = target;

        if (target === WEBGL_CONSTANTS.ARRAY_BUFFER) {

            // Only define byteStride for vertex attributes.
            bufferViewDef.byteStride = byteStride;

        }

        this.byteOffset += byteLength;

        json.bufferViews.push(bufferViewDef);

        // @TODO Merge bufferViews where possible.
        const output = {

            id: json.bufferViews.length - 1,
            byteLength: 0

        };

        return output;

    }

    /**
     * Process and generate a BufferView from an image Blob.
     * @param {Blob} blob
     * @return {Promise<Integer>}
     */
    processBufferViewImage(blob: Blob) {

        const writer = this;
        const json = writer.json;

        if (!json.bufferViews) json.bufferViews = [];

        return new Promise(function (resolve) {
            blob.arrayBuffer().then((result => {
                const buffer = getPaddedArrayBuffer(result);
                const bufferViewDef = {
                    buffer: writer.processBuffer(buffer),
                    byteOffset: writer.byteOffset,
                    byteLength: buffer.byteLength
                };

                writer.byteOffset += buffer.byteLength;
                resolve(json.bufferViews.push(bufferViewDef) - 1);
            }));

            // const reader = new FileReader();
            // reader.readAsArrayBuffer(blob);
            // reader.onloadend = function () {

            //     const buffer = getPaddedArrayBuffer(reader.result as any);

            //     const bufferViewDef = {
            //         buffer: writer.processBuffer(buffer),
            //         byteOffset: writer.byteOffset,
            //         byteLength: buffer.byteLength
            //     };

            //     writer.byteOffset += buffer.byteLength;
            //     resolve(json.bufferViews.push(bufferViewDef) - 1);

            // };

        });

    }

    /**
     * Process attribute to generate an accessor
     * @param  {BufferAttribute} attribute Attribute to process
     * @param  {THREE.BufferGeometry} geometry (Optional) Geometry used for truncated draw range
     * @param  {Integer} start (Optional)
     * @param  {Integer} count (Optional)
     * @return {Integer|null} Index of the processed accessor on the "accessors" array
     */
    processAccessor(
        attribute: BufferAttribute,
        geometry?: BufferGeometry,
        start?: number,
        count?: number) {

        const json = this.json;

        const types: Record<number, any> = {

            1: 'SCALAR',
            2: 'VEC2',
            3: 'VEC3',
            4: 'VEC4',
            9: 'MAT3',
            16: 'MAT4'

        };

        let componentType;

        // Detect the component type of the attribute array
        if (attribute.array.constructor === Float32Array) {

            componentType = WEBGL_CONSTANTS.FLOAT;

        } else if (attribute.array.constructor === Int32Array) {

            componentType = WEBGL_CONSTANTS.INT;

        } else if (attribute.array.constructor === Uint32Array) {

            componentType = WEBGL_CONSTANTS.UNSIGNED_INT;

        } else if (attribute.array.constructor === Int16Array) {

            componentType = WEBGL_CONSTANTS.SHORT;

        } else if (attribute.array.constructor === Uint16Array) {

            componentType = WEBGL_CONSTANTS.UNSIGNED_SHORT;

        } else if (attribute.array.constructor === Int8Array) {

            componentType = WEBGL_CONSTANTS.BYTE;

        } else if (attribute.array.constructor === Uint8Array) {

            componentType = WEBGL_CONSTANTS.UNSIGNED_BYTE;

        } else {

            throw new Error('THREE.GLTFExporter: Unsupported bufferAttribute component type: ' + attribute.array.constructor.name);

        }

        if (start === undefined) start = 0;
        if (count === undefined || count === Infinity) count = attribute.count;

        // Skip creating an accessor if the attribute doesn't have data to export
        if (count === 0) return null;

        const minMax = getMinMax(attribute, start, count);
        let bufferViewTarget;

        // If geometry isn't provided, don't infer the target usage of the bufferView. For
        // animation samplers, target must not be set.
        if (geometry !== undefined) {

            bufferViewTarget = attribute === geometry.index ? WEBGL_CONSTANTS.ELEMENT_ARRAY_BUFFER : WEBGL_CONSTANTS.ARRAY_BUFFER;

        }

        const bufferView: Record<string, any> = this.processBufferView(
            attribute,
            componentType,
            start,
            count,
            bufferViewTarget!);

        const accessorDef: Record<string, any> = {

            bufferView: bufferView.id,
            byteOffset: bufferView.byteOffset,
            componentType: componentType,
            count: count,
            max: minMax.max,
            min: minMax.min,
            type: types[attribute.itemSize]

        };

        if (attribute.normalized === true) accessorDef.normalized = true;
        if (!json.accessors) json.accessors = [];

        return json.accessors.push(accessorDef) - 1;

    }

    /**
     * Process image
     * @param  {Image} image to process
     * @param  {Integer} format of the image (RGBAFormat)
     * @param  {Boolean} flipY before writing out the image
     * @param  {String} mimeType export format
     * @return {Integer}     Index of the processed texture in the "images" array
     */
    processImage(image: any, format: number, flipY: boolean, mimeType = 'image/png') {

        if (image !== null) {

            const writer = this;
            const cache = writer.cache;
            const json = writer.json;
            const options = writer.options;
            const pending = writer.pending;

            if (!cache.images.has(image)) cache.images.set(image, {});

            const cachedImages = cache.images.get(image);

            const key = mimeType + ':flipY/' + flipY.toString();

            if (cachedImages[key] !== undefined) return cachedImages[key];

            if (!json.images) json.images = [];

            const imageDef: Record<string, any> = { mimeType: mimeType };

            const canvas: HTMLCanvasElement = getCanvas() as any;

            canvas.width = Math.min(image.width, options.maxTextureSize);
            canvas.height = Math.min(image.height, options.maxTextureSize);

            const ctx: CanvasRenderingContext2D = canvas.getContext('2d', {
                willReadFrequently: true,
            }) as any;

            if (flipY === true) {

                ctx.translate(0, canvas.height);
                ctx.scale(1, - 1);

            }

            if (image.data !== undefined) { // THREE.DataTexture

                if (format !== RGBAFormat) {

                    console.error('GLTFExporter: Only RGBAFormat is supported.', format);

                }

                if (image.width > options.maxTextureSize || image.height > options.maxTextureSize) {

                    console.warn('GLTFExporter: Image size is bigger than maxTextureSize', image);

                }

                const data = new Uint8ClampedArray(image.height * image.width * 4);

                for (let i = 0; i < data.length; i += 4) {

                    data[i + 0] = image.data[i + 0];
                    data[i + 1] = image.data[i + 1];
                    data[i + 2] = image.data[i + 2];
                    data[i + 3] = image.data[i + 3];

                }

                ctx.putImageData(createImageData(data, image.width, image.height) as any, 0, 0);

            } else {

                if ((typeof HTMLImageElement !== 'undefined' && image instanceof HTMLImageElement) ||
                    (typeof HTMLCanvasElement !== 'undefined' && image instanceof HTMLCanvasElement) ||
                    (typeof ImageBitmap !== 'undefined' && image instanceof ImageBitmap) ||
                    (typeof OffscreenCanvas !== 'undefined' && image instanceof OffscreenCanvas)) {

                    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

                } else {

                    throw new Error('THREE.GLTFExporter: Invalid image type. Use HTMLImageElement, HTMLCanvasElement, ImageBitmap or OffscreenCanvas.');

                }

            }

            if (options.binary === true) {

                pending.push(

                    getToBlobPromise(canvas as any, mimeType)
                        .then((blob) => writer.processBufferViewImage(blob!))
                        .then(bufferViewIndex => {

                            imageDef.bufferView = bufferViewIndex;

                        })

                );

            } else {

                if (canvas.toDataURL !== undefined) {

                    imageDef.uri = canvas.toDataURL(mimeType);

                } else {

                    pending.push(

                        getToBlobPromise(canvas as any, mimeType)
                            .then(blob => new FileReader().readAsDataURL(blob!))
                            .then(dataURL => {

                                imageDef.uri = dataURL;

                            })

                    );

                }

            }

            const index = json.images.push(imageDef) - 1;
            cachedImages[key] = index;
            return index;

        } else {

            throw new Error('THREE.GLTFExporter: No valid image data found. Unable to process texture.');

        }

    }

    /**
     * Process sampler
     * @param  {Texture} map Texture to process
     * @return {Integer}     Index of the processed texture in the "samplers" array
     */
    processSampler(map: Texture) {

        const json = this.json;

        if (!json.samplers) json.samplers = [];

        const samplerDef = {
            magFilter: THREE_TO_WEBGL[map.magFilter],
            minFilter: THREE_TO_WEBGL[map.minFilter],
            wrapS: THREE_TO_WEBGL[map.wrapS],
            wrapT: THREE_TO_WEBGL[map.wrapT]
        };

        return json.samplers.push(samplerDef) - 1;

    }

    /**
     * Process texture
     * @param  {Texture} map Map to process
     * @return {Integer} Index of the processed texture in the "textures" array
     */
    processTexture(map: Texture) {

        const writer = this;
        const options = writer.options;
        const cache = this.cache;
        const json = this.json;

        if (cache.textures.has(map)) return cache.textures.get(map);

        if (!json.textures) json.textures = [];

        // make non-readable textures (e.g. CompressedTexture) readable by blitting them into a new texture
        if (map instanceof CompressedTexture) {

            map = decompress(map, options.maxTextureSize);

        }

        let mimeType = map.userData.mimeType;

        if (mimeType === 'image/webp') mimeType = 'image/png';

        const textureDef: Record<string, any> = {
            sampler: this.processSampler(map),
            source: this.processImage(map.image, map.format, map.flipY, mimeType)
        };

        if (map.name) textureDef.name = map.name;

        this._invokeAll(function (ext: any) {

            ext.writeTexture && ext.writeTexture(map, textureDef);

        });

        const index = json.textures.push(textureDef) - 1;
        cache.textures.set(map, index);
        return index;

    }

    /**
     * Process material
     * @param  {THREE.Material} material Material to process
     * @return {Integer|null} Index of the processed material in the "materials" array
     */
    processMaterial(material: Material & Record<string, any>) {

        const cache = this.cache;
        const json = this.json;

        if (cache.materials.has(material)) return cache.materials.get(material);

        if (material.isShaderMaterial) {

            console.warn('GLTFExporter: THREE.ShaderMaterial not supported.');
            return null;

        }

        if (!json.materials) json.materials = [];

        // @QUESTION Should we avoid including any attribute that has the default value?
        const materialDef: Record<string, any> = { pbrMetallicRoughness: {} };

        if (material.isMeshStandardMaterial !== true && material.isMeshBasicMaterial !== true) {

            console.warn('GLTFExporter: Use MeshStandardMaterial or MeshBasicMaterial for best results.');

        }

        // pbrMetallicRoughness.baseColorFactor
        const color = material.color.toArray().concat([material.opacity]);

        if (!equalArray(color, [1, 1, 1, 1])) {

            materialDef.pbrMetallicRoughness.baseColorFactor = color;

        }

        if (material.isMeshStandardMaterial) {

            materialDef.pbrMetallicRoughness.metallicFactor = material.metalness;
            materialDef.pbrMetallicRoughness.roughnessFactor = material.roughness;

        } else {

            materialDef.pbrMetallicRoughness.metallicFactor = 0.5;
            materialDef.pbrMetallicRoughness.roughnessFactor = 0.5;

        }

        // pbrMetallicRoughness.metallicRoughnessTexture
        if (material.metalnessMap || material.roughnessMap) {

            const metalRoughTexture = this.buildMetalRoughTexture(material.metalnessMap, material.roughnessMap);

            const metalRoughMapDef = {
                index: this.processTexture(metalRoughTexture),
                channel: metalRoughTexture.channel
            };
            this.applyTextureTransform(metalRoughMapDef, metalRoughTexture);
            materialDef.pbrMetallicRoughness.metallicRoughnessTexture = metalRoughMapDef;

        }

        // pbrMetallicRoughness.baseColorTexture
        if (material.map) {

            const baseColorMapDef = {
                index: this.processTexture(material.map),
                texCoord: material.map.channel
            };
            this.applyTextureTransform(baseColorMapDef, material.map);
            materialDef.pbrMetallicRoughness.baseColorTexture = baseColorMapDef;

        }

        if (material.emissive) {

            const emissive = material.emissive;
            const maxEmissiveComponent = Math.max(emissive.r, emissive.g, emissive.b);

            if (maxEmissiveComponent > 0) {

                materialDef.emissiveFactor = material.emissive.toArray();

            }

            // emissiveTexture
            if (material.emissiveMap) {

                const emissiveMapDef = {
                    index: this.processTexture(material.emissiveMap),
                    texCoord: material.emissiveMap.channel
                };
                this.applyTextureTransform(emissiveMapDef, material.emissiveMap);
                materialDef.emissiveTexture = emissiveMapDef;

            }

        }

        // normalTexture
        if (material.normalMap) {

            const normalMapDef: Record<string, any> = {
                index: this.processTexture(material.normalMap),
                texCoord: material.normalMap.channel
            };

            if (material.normalScale && material.normalScale.x !== 1) {

                // glTF normal scale is univariate. Ignore `y`, which may be flipped.
                // Context: https://github.com/mrdoob/three.js/issues/11438#issuecomment-507003995
                normalMapDef.scale = material.normalScale.x;

            }

            this.applyTextureTransform(normalMapDef, material.normalMap);
            materialDef.normalTexture = normalMapDef;

        }

        // occlusionTexture
        if (material.aoMap) {

            const occlusionMapDef: Record<string, any> = {
                index: this.processTexture(material.aoMap),
                texCoord: material.aoMap.channel
            };

            if (material.aoMapIntensity !== 1.0) {

                occlusionMapDef.strength = material.aoMapIntensity;

            }

            this.applyTextureTransform(occlusionMapDef, material.aoMap);
            materialDef.occlusionTexture = occlusionMapDef;

        }

        // alphaMode
        if (material.transparent) {

            materialDef.alphaMode = 'BLEND';

        } else {

            if (material.alphaTest > 0.0) {

                materialDef.alphaMode = 'MASK';
                materialDef.alphaCutoff = material.alphaTest;

            }

        }

        // doubleSided
        if (material.side === DoubleSide) materialDef.doubleSided = true;
        if (material.name !== '') materialDef.name = material.name;

        this.serializeUserData(material, materialDef);

        this._invokeAll(function (ext: any) {

            ext.writeMaterial && ext.writeMaterial(material, materialDef);

        });

        const index = json.materials.push(materialDef) - 1;
        cache.materials.set(material, index);
        return index;

    }

    /**
     * Process mesh
     * @param  {THREE.Mesh} mesh Mesh to process
     * @return {Integer|null} Index of the processed mesh in the "meshes" array
     */
    processMesh(mesh: Mesh & Record<string, any>) {

        const cache = this.cache;
        const json = this.json;

        const meshCacheKeyParts = [mesh.geometry.uuid];

        if (Array.isArray(mesh.material)) {

            for (let i = 0, l = mesh.material.length; i < l; i++) {

                meshCacheKeyParts.push(mesh.material[i].uuid);

            }

        } else {

            meshCacheKeyParts.push(mesh.material.uuid);

        }

        const meshCacheKey = meshCacheKeyParts.join(':');

        if (cache.meshes.has(meshCacheKey)) return cache.meshes.get(meshCacheKey);

        const geometry = mesh.geometry;

        let mode;

        // Use the correct mode
        if (mesh.isLineSegments) {

            mode = WEBGL_CONSTANTS.LINES;

        } else if (mesh.isLineLoop) {

            mode = WEBGL_CONSTANTS.LINE_LOOP;

        } else if (mesh.isLine) {

            mode = WEBGL_CONSTANTS.LINE_STRIP;

        } else if (mesh.isPoints) {

            mode = WEBGL_CONSTANTS.POINTS;

        } else {

            mode = (mesh.material as any).wireframe ? WEBGL_CONSTANTS.LINES : WEBGL_CONSTANTS.TRIANGLES;

        }

        const meshDef: Record<string, any> = {};
        const attributes: Record<string, any> = {};
        const primitives = [];
        const targets = [];

        // Conversion between attributes names in threejs and gltf spec
        const nameConversion: Record<string, any> = {
            uv: 'TEXCOORD_0',
            uv1: 'TEXCOORD_1',
            uv2: 'TEXCOORD_2',
            uv3: 'TEXCOORD_3',
            color: 'COLOR_0',
            skinWeight: 'WEIGHTS_0',
            skinIndex: 'JOINTS_0'
        };

        const originalNormal = geometry.getAttribute('normal');

        if (originalNormal !== undefined && !this.isNormalizedNormalAttribute(originalNormal as any)) {

            console.warn('THREE.GLTFExporter: Creating normalized normal attribute from the non-normalized one.');

            geometry.setAttribute('normal', this.createNormalizedNormalAttribute(originalNormal as any));

        }

        // @QUESTION Detect if .vertexColors = true?
        // For every attribute create an accessor
        let modifiedAttribute = null;

        for (let attributeName in geometry.attributes) {

            // Ignore morph target attributes, which are exported later.
            if (attributeName.slice(0, 5) === 'morph') continue;

            const attribute = geometry.attributes[attributeName];
            attributeName = nameConversion[attributeName] || attributeName.toUpperCase();

            // Prefix all geometry attributes except the ones specifically
            // listed in the spec; non-spec attributes are considered custom.
            const validVertexAttributes =
                /^(POSITION|NORMAL|TANGENT|TEXCOORD_\d+|COLOR_\d+|JOINTS_\d+|WEIGHTS_\d+)$/;

            if (!validVertexAttributes.test(attributeName)) attributeName = '_' + attributeName;

            if (cache.attributes.has(this.getUID(attribute))) {

                attributes[attributeName] = cache.attributes.get(this.getUID(attribute));
                continue;

            }

            // JOINTS_0 must be UNSIGNED_BYTE or UNSIGNED_SHORT.
            modifiedAttribute = null;
            const array = attribute.array;

            if (attributeName === 'JOINTS_0' &&
                !(array instanceof Uint16Array) &&
                !(array instanceof Uint8Array)) {

                console.warn('GLTFExporter: Attribute "skinIndex" converted to type UNSIGNED_SHORT.');
                modifiedAttribute = new BufferAttribute(new Uint16Array(array), attribute.itemSize, attribute.normalized);

            }

            const accessor = this.processAccessor((modifiedAttribute || attribute) as any, geometry);

            if (accessor !== null) {

                if (!attributeName.startsWith('_')) {

                    this.detectMeshQuantization(attributeName, attribute as any);

                }

                attributes[attributeName] = accessor;
                cache.attributes.set(this.getUID(attribute), accessor);

            }

        }

        if (originalNormal !== undefined) geometry.setAttribute('normal', originalNormal);

        // Skip if no exportable attributes found
        if (Object.keys(attributes).length === 0) return null;

        // Morph targets
        if (mesh.morphTargetInfluences !== undefined && mesh.morphTargetInfluences.length > 0) {

            const weights = [];
            const targetNames = [];
            const reverseDictionary: Record<string, any> = {};

            if (mesh.morphTargetDictionary !== undefined) {

                for (const key in mesh.morphTargetDictionary) {

                    reverseDictionary[mesh.morphTargetDictionary[key]] = key;

                }

            }

            for (let i = 0; i < mesh.morphTargetInfluences.length; ++i) {

                const target: Record<string, any> = {};
                let warned = false;

                for (const attributeName in geometry.morphAttributes) {

                    // glTF 2.0 morph supports only POSITION/NORMAL/TANGENT.
                    // Three.js doesn't support TANGENT yet.

                    if (attributeName !== 'position' && attributeName !== 'normal') {

                        if (!warned) {

                            console.warn('GLTFExporter: Only POSITION and NORMAL morph are supported.');
                            warned = true;

                        }

                        continue;

                    }

                    const attribute = geometry.morphAttributes[attributeName][i];
                    const gltfAttributeName = attributeName.toUpperCase();

                    // Three.js morph attribute has absolute values while the one of glTF has relative values.
                    //
                    // glTF 2.0 Specification:
                    // https://github.com/KhronosGroup/glTF/tree/master/specification/2.0#morph-targets

                    const baseAttribute = geometry.attributes[attributeName];

                    if (cache.attributes.has(this.getUID(attribute, true))) {

                        target[gltfAttributeName] = cache.attributes.get(this.getUID(attribute, true));
                        continue;

                    }

                    // Clones attribute not to override
                    const relativeAttribute = attribute.clone();

                    if (!geometry.morphTargetsRelative) {

                        for (let j = 0, jl = attribute.count; j < jl; j++) {

                            for (let a = 0; a < attribute.itemSize; a++) {

                                if (a === 0) relativeAttribute.setX(j, attribute.getX(j) - baseAttribute.getX(j));
                                if (a === 1) relativeAttribute.setY(j, attribute.getY(j) - baseAttribute.getY(j));
                                if (a === 2) relativeAttribute.setZ(j, attribute.getZ(j) - baseAttribute.getZ(j));
                                if (a === 3) relativeAttribute.setW(j, attribute.getW(j) - baseAttribute.getW(j));

                            }

                        }

                    }

                    target[gltfAttributeName] = this.processAccessor(relativeAttribute, geometry);
                    cache.attributes.set(this.getUID(baseAttribute, true), target[gltfAttributeName]);

                }

                targets.push(target);

                weights.push(mesh.morphTargetInfluences[i]);

                if (mesh.morphTargetDictionary !== undefined) targetNames.push(reverseDictionary[i]);

            }

            meshDef.weights = weights;

            if (targetNames.length > 0) {

                meshDef.extras = {};
                meshDef.extras.targetNames = targetNames;

            }

        }

        const isMultiMaterial = Array.isArray(mesh.material);

        if (isMultiMaterial && geometry.groups.length === 0) return null;

        let didForceIndices = false;

        if (isMultiMaterial && geometry.index === null) {

            const indices = [];

            for (let i = 0, il = geometry.attributes.position.count; i < il; i++) {

                indices[i] = i;

            }

            geometry.setIndex(indices);

            didForceIndices = true;

        }

        const materials = isMultiMaterial ? mesh.material : [mesh.material];
        const groups = isMultiMaterial ? geometry.groups : [{ materialIndex: 0, start: undefined, count: undefined }];

        for (let i = 0, il = groups.length; i < il; i++) {

            const primitive: Record<string, any> = {
                mode: mode,
                attributes: attributes,
            };

            this.serializeUserData(geometry as any, primitive);

            if (targets.length > 0) primitive.targets = targets;

            if (geometry.index !== null) {

                let cacheKey = this.getUID(geometry.index);

                if (groups[i].start !== undefined || groups[i].count !== undefined) {

                    cacheKey += ':' + groups[i].start + ':' + groups[i].count;

                }

                if (cache.attributes.has(cacheKey)) {

                    primitive.indices = cache.attributes.get(cacheKey);

                } else {

                    primitive.indices = this.processAccessor(geometry.index, geometry, groups[i].start, groups[i].count);
                    cache.attributes.set(cacheKey, primitive.indices);

                }

                if (primitive.indices === null) delete primitive.indices;

            }

            const material = this.processMaterial((materials as any)[groups[i].materialIndex!]);

            if (material !== null) primitive.material = material;

            primitives.push(primitive);

        }

        if (didForceIndices === true) {

            geometry.setIndex(null);

        }

        meshDef.primitives = primitives;

        if (!json.meshes) json.meshes = [];

        this._invokeAll(function (ext: any) {

            ext.writeMesh && ext.writeMesh(mesh, meshDef);

        });

        const index = json.meshes.push(meshDef) - 1;
        cache.meshes.set(meshCacheKey, index);
        return index;

    }

    /**
     * If a vertex attribute with a
     * [non-standard data type](https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html#meshes-overview)
     * is used, it is checked whether it is a valid data type according to the
     * [KHR_mesh_quantization](https://github.com/KhronosGroup/glTF/blob/main/extensions/2.0/Khronos/KHR_mesh_quantization/README.md)
     * extension.
     * In this case the extension is automatically added to the list of used extensions.
     *
     * @param {string} attributeName
     * @param {THREE.BufferAttribute} attribute
     */
    detectMeshQuantization(attributeName: string, attribute: BufferAttribute) {

        if (this.extensionsUsed[KHR_MESH_QUANTIZATION]) return;

        let attrType = undefined;

        switch (attribute.array.constructor) {

            case Int8Array:

                attrType = 'byte';

                break;

            case Uint8Array:

                attrType = 'unsigned byte';

                break;

            case Int16Array:

                attrType = 'short';

                break;

            case Uint16Array:

                attrType = 'unsigned short';

                break;

            default:

                return;

        }

        if (attribute.normalized) attrType += ' normalized';

        const attrNamePrefix = attributeName.split('_', 1)[0];

        //@ts-ignore
        if (KHR_mesh_quantization_ExtraAttrTypes[attrNamePrefix] &&
            //@ts-ignore
            KHR_mesh_quantization_ExtraAttrTypes[attrNamePrefix].includes(attrType)) {

            this.extensionsUsed[KHR_MESH_QUANTIZATION] = true;
            this.extensionsRequired[KHR_MESH_QUANTIZATION] = true;

        }

    }

    /**
     * Process camera
     * @param  {THREE.Camera} camera Camera to process
     * @return {Integer}      Index of the processed mesh in the "camera" array
     */
    processCamera(camera: Camera & Record<string, any>) {

        const json = this.json;

        if (!json.cameras) json.cameras = [];

        const isOrtho = camera.isOrthographicCamera;

        const cameraDef: Record<string, any> = {
            type: isOrtho ? 'orthographic' : 'perspective'
        };

        if (isOrtho) {

            cameraDef.orthographic = {
                xmag: camera.right * 2,
                ymag: camera.top * 2,
                zfar: camera.far <= 0 ? 0.001 : camera.far,
                znear: camera.near < 0 ? 0 : camera.near
            };

        } else {

            cameraDef.perspective = {
                aspectRatio: camera.aspect,
                yfov: MathUtils.degToRad(camera.fov),
                zfar: camera.far <= 0 ? 0.001 : camera.far,
                znear: camera.near < 0 ? 0 : camera.near
            };

        }

        // Question: Is saving "type" as name intentional?
        if (camera.name !== '') cameraDef.name = camera.type;

        return json.cameras.push(cameraDef) - 1;

    }

    /**
     * Creates glTF animation entry from AnimationClip object.
     *
     * Status:
     * - Only properties listed in PATH_PROPERTIES may be animated.
     *
     * @param {THREE.AnimationClip} clip
     * @param {THREE.Object3D} root
     * @return {number|null}
     */
    processAnimation(clip: AnimationClip, root: Object3D) {

        const json = this.json;
        const nodeMap = this.nodeMap;

        if (!json.animations) json.animations = [];

        clip = GLTFExporterUtils.mergeMorphTargetTracks(clip.clone(), root);

        const tracks = clip.tracks;
        const channels = [];
        const samplers = [];

        for (let i = 0; i < tracks.length; ++i) {

            const track = tracks[i];
            const trackBinding = PropertyBinding.parseTrackName(track.name);
            let trackNode = PropertyBinding.findNode(root, trackBinding.nodeName);
            //@ts-ignore
            const trackProperty = PATH_PROPERTIES[trackBinding.propertyName];

            if (trackBinding.objectName === 'bones') {

                if (trackNode.isSkinnedMesh === true) {

                    trackNode = trackNode.skeleton.getBoneByName(trackBinding.objectIndex);

                } else {

                    trackNode = undefined;

                }

            }

            if (!trackNode || !trackProperty) {

                console.warn('THREE.GLTFExporter: Could not export animation track "%s".', track.name);
                continue;

            }

            const inputItemSize = 1;
            let outputItemSize = track.values.length / track.times.length;

            if (trackProperty === PATH_PROPERTIES.morphTargetInfluences) {

                outputItemSize /= trackNode.morphTargetInfluences.length;

            }

            let interpolation;

            // @TODO export CubicInterpolant(InterpolateSmooth) as CUBICSPLINE

            // Detecting glTF cubic spline interpolant by checking factory method's special property
            // GLTFCubicSplineInterpolant is a custom interpolant and track doesn't return
            // valid value from .getInterpolation().
            // @ts-ignore
            if (track.createInterpolant.isInterpolantFactoryMethodGLTFCubicSpline === true) {

                interpolation = 'CUBICSPLINE';

                // itemSize of CUBICSPLINE keyframe is 9
                // (VEC3 * 3: inTangent, splineVertex, and outTangent)
                // but needs to be stored as VEC3 so dividing by 3 here.
                outputItemSize /= 3;

            } else if (track.getInterpolation() === InterpolateDiscrete) {

                interpolation = 'STEP';

            } else {

                interpolation = 'LINEAR';

            }

            samplers.push({
                input: this.processAccessor(new BufferAttribute(track.times, inputItemSize)),
                output: this.processAccessor(new BufferAttribute(track.values, outputItemSize)),
                interpolation: interpolation
            });

            channels.push({
                sampler: samplers.length - 1,
                target: {
                    node: nodeMap.get(trackNode),
                    path: trackProperty
                }
            });

        }

        json.animations.push({
            name: clip.name || 'clip_' + json.animations.length,
            samplers: samplers,
            channels: channels
        });

        return json.animations.length - 1;

    }

    /**
     * @param {THREE.Object3D} object
     * @return {number|null}
     */
    processSkin(object: Object3D & Record<string, any>) {

        const json = this.json;
        const nodeMap = this.nodeMap;

        const node = json.nodes[nodeMap.get(object)];

        const skeleton = object.skeleton;

        if (skeleton === undefined) return null;

        const rootJoint = object.skeleton.bones[0];

        if (rootJoint === undefined) return null;

        const joints = [];
        const inverseBindMatrices = new Float32Array(skeleton.bones.length * 16);
        const temporaryBoneInverse = new Matrix4();

        for (let i = 0; i < skeleton.bones.length; ++i) {

            joints.push(nodeMap.get(skeleton.bones[i]));
            temporaryBoneInverse.copy(skeleton.boneInverses[i]);
            temporaryBoneInverse.multiply(object.bindMatrix).toArray(inverseBindMatrices, i * 16);

        }

        if (json.skins === undefined) json.skins = [];

        json.skins.push({
            inverseBindMatrices: this.processAccessor(new BufferAttribute(inverseBindMatrices, 16)),
            joints: joints,
            skeleton: nodeMap.get(rootJoint)
        });

        const skinIndex = node.skin = json.skins.length - 1;

        return skinIndex;

    }

    /**
     * Process Object3D node
     * @param  {THREE.Object3D} node Object3D to processNode
     * @return {Integer} Index of the node in the nodes list
     */
    processNode(object: Object3D & Record<string, any>) {

        const json = this.json;
        const options = this.options;
        const nodeMap = this.nodeMap;

        if (!json.nodes) json.nodes = [];

        const nodeDef: Record<string, any> = {};

        if (options.trs) {

            const rotation = object.quaternion.toArray();
            const position = object.position.toArray();
            const scale = object.scale.toArray();

            if (!equalArray(rotation, [0, 0, 0, 1])) {

                nodeDef.rotation = rotation;

            }

            if (!equalArray(position, [0, 0, 0])) {

                nodeDef.translation = position;

            }

            if (!equalArray(scale, [1, 1, 1])) {

                nodeDef.scale = scale;

            }

        } else {

            if (object.matrixAutoUpdate) {

                object.updateMatrix();

            }

            if (isIdentityMatrix(object.matrix) === false) {

                nodeDef.matrix = object.matrix.elements;

            }

        }

        // We don't export empty strings name because it represents no-name in Three.js.
        if (object.name !== '') nodeDef.name = String(object.name);

        this.serializeUserData(object, nodeDef);

        if (object.isMesh || object.isLine || object.isPoints) {

            const meshIndex = this.processMesh(object as any);

            if (meshIndex !== null) nodeDef.mesh = meshIndex;

        } else if (object.isCamera) {

            nodeDef.camera = this.processCamera(object as any);

        }

        if (object.isSkinnedMesh) this.skins.push(object);

        if (object.children.length > 0) {

            const children = [];

            for (let i = 0, l = object.children.length; i < l; i++) {

                const child = object.children[i];

                if (child.visible || options.onlyVisible === false) {

                    const nodeIndex = this.processNode(child);

                    if (nodeIndex !== null) children.push(nodeIndex);

                }

            }

            if (children.length > 0) nodeDef.children = children;

        }

        this._invokeAll(function (ext: any) {

            ext.writeNode && ext.writeNode(object, nodeDef);

        });

        const nodeIndex = json.nodes.push(nodeDef) - 1;
        nodeMap.set(object, nodeIndex);
        return nodeIndex;

    }

    /**
     * Process Scene
     * @param  {Scene} node Scene to process
     */
    processScene(scene: Scene) {

        const json = this.json;
        const options = this.options;

        if (!json.scenes) {

            json.scenes = [];
            json.scene = 0;

        }

        const sceneDef: Record<string, any> = {};

        if (scene.name !== '') sceneDef.name = scene.name;

        json.scenes.push(sceneDef);

        const nodes = [];

        for (let i = 0, l = scene.children.length; i < l; i++) {

            const child = scene.children[i];

            if (child.visible || options.onlyVisible === false) {

                const nodeIndex = this.processNode(child);

                if (nodeIndex !== null) nodes.push(nodeIndex);

            }

        }

        if (nodes.length > 0) sceneDef.nodes = nodes;

        this.serializeUserData(scene, sceneDef);

    }

    /**
     * Creates a Scene to hold a list of objects and parse it
     * @param  {Array} objects List of objects to process
     */
    processObjects(objects: any[]) {

        const scene = new Scene();
        scene.name = 'AuxScene';

        for (let i = 0; i < objects.length; i++) {

            // We push directly to children instead of calling `add` to prevent
            // modify the .parent and break its original scene and hierarchy
            scene.children.push(objects[i]);

        }

        this.processScene(scene);

    }

    /**
     * @param {THREE.Object3D|Array<THREE.Object3D>} input
     */
    processInput(input: Object3D | Object3D[]) {

        const options = this.options;

        input = input instanceof Array ? input : [input];

        this._invokeAll(function (ext: any) {

            ext.beforeParse && ext.beforeParse(input);

        });

        const objectsWithoutScene = [];

        for (let i = 0; i < input.length; i++) {

            if (input[i] instanceof Scene) {

                this.processScene(input[i] as any);

            } else {

                objectsWithoutScene.push(input[i]);

            }

        }

        if (objectsWithoutScene.length > 0) this.processObjects(objectsWithoutScene);

        for (let i = 0; i < this.skins.length; ++i) {

            this.processSkin(this.skins[i]);

        }

        for (let i = 0; i < options.animations.length; ++i) {

            this.processAnimation(options.animations[i], input[0]);

        }

        this._invokeAll(function (ext: any) {

            ext.afterParse && ext.afterParse(input);

        });

    }

    _invokeAll(func: Function) {

        for (let i = 0, il = this.plugins.length; i < il; i++) {

            func(this.plugins[i]);

        }

    }

};
