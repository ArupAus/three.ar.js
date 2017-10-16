/*
 * Copyright 2017 Google Inc. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the 'License');
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an 'AS IS' BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import {
  DoubleSide,
  Color,
  Object3D,
  RawShaderMaterial,
  Geometry,
  Vector3,
  Face3,
  Mesh,
} from 'three';

import { getRandomPaletteColor } from './ARUtils';
import vertexShader from './shaders/arplanes.vert';
import fragmentShader from './shaders/arplanes.frag';

const DEFAULT_MATERIAL = new RawShaderMaterial({
  side: DoubleSide,
  transparent: true,
  uniforms: {
    dotColor: {
      value: new Color(0xffffff),
    },
    lineColor: {
      value: new Color(0x707070),
    },
    backgroundColor: {
      value: new Color(0x404040),
    },
    dotRadius: {
      value: 0.006666666667,
    },
    alpha: {
      value: 0.4,
    },
  },
  vertexShader,
  fragmentShader,
});

/**
 * The ARDebugRow subclass for displaying planes information
 * by wrapping polling getPlanes, and rendering.
 */
class ARPlanes extends Object3D {
  /**
   * @param {VRDisplay} vrDisplay
   */
  constructor(vrDisplay) {
    super();
    this.vrDisplay = vrDisplay;
    this.planes = new Map();

    // A mapping of plane IDs to colors, so that we can reuse the same
    // color everytime we update for the same plane rather than randomizing
    // @TODO When we have plane removal events, clear this map so we don't
    // have a leak
    this.materialMap = new Map();

    const addPlane = (plane) => {
      let planeObj = this.createPlane(plane);
      if (planeObj) {
        this.add(planeObj);
        this.planes.set(plane.identifier, planeObj);
      }
    }

    const removePlane = (identifier) => {
      let existing = this.planes.get(identifier);
      if (existing) {
        this.remove(existing);
      }
      this.planes.delete(identifier);
    }
  
    vrDisplay.addEventListener('planesadded', (event) => {
      console.log(event.planes);
      event.planes.forEach(addPlane);
    });

    vrDisplay.addEventListener('planesupdated', (event) => {
      for (let plane of event.planes) {
        removePlane(plane.identifier);
        addPlane(plane);
      }
    });

    vrDisplay.addEventListener('planesremoved', (event) => {
      for (let plane of event.planes) {
        removePlane(plane.identifier);
      }
    });
  }

  createPlane(plane) {
    if (plane.vertices.length == 0) {
      return null;
    }

    const id = plane.identifier;
    const planeObj = new Object3D();
    const mm = plane.modelMatrix;
    planeObj.matrixAutoUpdate = false;
    planeObj.matrix.set(
      mm[0],
      mm[4],
      mm[8],
      mm[12],
      mm[1],
      mm[5],
      mm[9],
      mm[13],
      mm[2],
      mm[6],
      mm[10],
      mm[14],
      mm[3],
      mm[7],
      mm[11],
      mm[15]
    );

    const geo = new Geometry();
    // generate vertices
    for (let pt = 0; pt < plane.vertices.length / 3; pt++) {
      geo.vertices.push(
        new Vector3(
          plane.vertices[pt * 3],
          plane.vertices[pt * 3 + 1],
          plane.vertices[pt * 3 + 2]
        )
      );
    }

    // generate faces
    for (let face = 0; face < geo.vertices.length - 2; face++) {
      // this makes a triangle fan, from the first +Y point around
      geo.faces.push(new Face3(0, face + 1, face + 2));
    }

    let material;
    if (this.materialMap.has(id)) {
      // If we have a material stored for this plane already, reuse it
      material = this.materialMap.get(id);
    } else {
      // Otherwise, generate a new color, and assign the color to
      // this plane's ID
      const color = getRandomPaletteColor();
      material = DEFAULT_MATERIAL.clone();
      material.uniforms.backgroundColor.value = color;
      this.materialMap.set(id, material);
    }

    const planeMesh = new Mesh(geo, material);
    planeObj.add(planeMesh);

    return planeObj;
  }

  /**
   * Polling callback while enabled, used to fetch and orchestrate
   * plane rendering. If successful, returns the number of planes found.
   *
   * @return {number?}
   */
  update() {
    return this.planes.size;
  }
}

export default ARPlanes;
