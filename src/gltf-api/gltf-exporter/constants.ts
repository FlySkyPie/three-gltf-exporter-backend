import {
    ClampToEdgeWrapping,
    Color,
    LinearFilter,
    LinearMipmapLinearFilter,
    LinearMipmapNearestFilter,
    MirroredRepeatWrapping,
    NearestFilter,
    NearestMipmapLinearFilter,
    NearestMipmapNearestFilter,
    RepeatWrapping,
} from 'three';

/**
 * The KHR_mesh_quantization extension allows these extra attribute component types
 *
 * @see https://github.com/KhronosGroup/glTF/blob/main/extensions/2.0/Khronos/KHR_mesh_quantization/README.md#extending-mesh-attributes
 */
export const KHR_mesh_quantization_ExtraAttrTypes = {
    POSITION: [
        'byte',
        'byte normalized',
        'unsigned byte',
        'unsigned byte normalized',
        'short',
        'short normalized',
        'unsigned short',
        'unsigned short normalized',
    ],
    NORMAL: [
        'byte normalized',
        'short normalized',
    ],
    TANGENT: [
        'byte normalized',
        'short normalized',
    ],
    TEXCOORD: [
        'byte',
        'byte normalized',
        'unsigned byte',
        'short',
        'short normalized',
        'unsigned short',
    ],
};


//------------------------------------------------------------------------------
// Constants
//------------------------------------------------------------------------------

export const WEBGL_CONSTANTS = {
    POINTS: 0x0000,
    LINES: 0x0001,
    LINE_LOOP: 0x0002,
    LINE_STRIP: 0x0003,
    TRIANGLES: 0x0004,
    TRIANGLE_STRIP: 0x0005,
    TRIANGLE_FAN: 0x0006,

    BYTE: 0x1400,
    UNSIGNED_BYTE: 0x1401,
    SHORT: 0x1402,
    UNSIGNED_SHORT: 0x1403,
    INT: 0x1404,
    UNSIGNED_INT: 0x1405,
    FLOAT: 0x1406,

    ARRAY_BUFFER: 0x8892,
    ELEMENT_ARRAY_BUFFER: 0x8893,

    NEAREST: 0x2600,
    LINEAR: 0x2601,
    NEAREST_MIPMAP_NEAREST: 0x2700,
    LINEAR_MIPMAP_NEAREST: 0x2701,
    NEAREST_MIPMAP_LINEAR: 0x2702,
    LINEAR_MIPMAP_LINEAR: 0x2703,

    CLAMP_TO_EDGE: 33071,
    MIRRORED_REPEAT: 33648,
    REPEAT: 10497
};

export const KHR_MESH_QUANTIZATION = 'KHR_mesh_quantization';

export const THREE_TO_WEBGL: Record<string, any> = {};

THREE_TO_WEBGL[NearestFilter] = WEBGL_CONSTANTS.NEAREST;
THREE_TO_WEBGL[NearestMipmapNearestFilter] = WEBGL_CONSTANTS.NEAREST_MIPMAP_NEAREST;
THREE_TO_WEBGL[NearestMipmapLinearFilter] = WEBGL_CONSTANTS.NEAREST_MIPMAP_LINEAR;
THREE_TO_WEBGL[LinearFilter] = WEBGL_CONSTANTS.LINEAR;
THREE_TO_WEBGL[LinearMipmapNearestFilter] = WEBGL_CONSTANTS.LINEAR_MIPMAP_NEAREST;
THREE_TO_WEBGL[LinearMipmapLinearFilter] = WEBGL_CONSTANTS.LINEAR_MIPMAP_LINEAR;

THREE_TO_WEBGL[ClampToEdgeWrapping] = WEBGL_CONSTANTS.CLAMP_TO_EDGE;
THREE_TO_WEBGL[RepeatWrapping] = WEBGL_CONSTANTS.REPEAT;
THREE_TO_WEBGL[MirroredRepeatWrapping] = WEBGL_CONSTANTS.MIRRORED_REPEAT;

export const PATH_PROPERTIES = {
    scale: 'scale',
    position: 'translation',
    quaternion: 'rotation',
    morphTargetInfluences: 'weights'
};

export const DEFAULT_SPECULAR_COLOR = new Color();

// GLB constants
// https://github.com/KhronosGroup/glTF/blob/master/specification/2.0/README.md#glb-file-format-specification

export const GLB_HEADER_BYTES = 12;
export const GLB_HEADER_MAGIC = 0x46546C67;
export const GLB_VERSION = 2;

export const GLB_CHUNK_PREFIX_BYTES = 8;
export const GLB_CHUNK_TYPE_JSON = 0x4E4F534A;
export const GLB_CHUNK_TYPE_BIN = 0x004E4942;
