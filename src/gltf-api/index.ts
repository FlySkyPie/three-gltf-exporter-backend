import type { Request, Response } from "express";
import path from 'path';
import * as THREE from 'three';
import { init, addThreeHelpers } from '3d-core-raub';

import { GLTFExporter } from './gltf-exporter/GLTFExporter';

const { gl, } = init({
    isGles3: true, vsync: true, autoEsc: true, autoFullscreen: false, title: 'Crate', isVisible: false,
});
addThreeHelpers(THREE, gl);

const exporter = new GLTFExporter();

const exportScene = (scene: THREE.Scene) => {
    return new Promise<Buffer>((resolve, reject) => {
        exporter.parse(
            scene,
            (gltf: any) => {
                const buffer = Buffer.from(new Uint8Array(gltf));
                resolve(buffer);

            },
            (error: any) => {
                reject(error);
            },
            { binary: true }
        );

    })
}

export const creactGLTFAPI = () => async (_: Request, res: Response) => {
    const scene = new THREE.Scene();
    const loader = new THREE.TextureLoader();

    const loadTexture = (path: string) => new Promise<THREE.Texture>((resolve, reject) => {
        loader.load(path, resolve, undefined, reject);
    });

    const texture = await loadTexture(path.resolve(__dirname, "./assets/crate.gif"));
    texture.colorSpace = THREE.SRGBColorSpace;
    const geometry = new THREE.BoxGeometry();
    const material = new THREE.MeshBasicMaterial({ map: texture });
    const mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);

    const buffer = await exportScene(scene);

    res.setHeader('Content-Type', 'model/gltf-binary')
        .setHeader('Access-Control-Expose-Headers', 'Content-Disposition')
        .setHeader("Content-Disposition", "attachment; filename=" + "crate.glb")
        .send(buffer);
};
