function createCube() {
  const positions = new Float32Array([
    -1, -1,  1,   1, -1,  1,   1,  1,  1,  -1,  1,  1,   // front
     1, -1, -1,  -1, -1, -1,  -1,  1, -1,   1,  1, -1,   // back
    -1,  1,  1,   1,  1,  1,   1,  1, -1,  -1,  1, -1,   // top
    -1, -1, -1,   1, -1, -1,   1, -1,  1,  -1, -1,  1,   // bottom
     1, -1,  1,   1, -1, -1,   1,  1, -1,   1,  1,  1,   // right
    -1, -1, -1,  -1, -1,  1,  -1,  1,  1,  -1,  1, -1    // left
  ]);
  const faceNormals = [[0, 0, 1], [0, 0, -1], [0, 1, 0], [0, -1, 0], [1, 0, 0], [-1, 0, 0]];
  const normals = new Float32Array(faceNormals.flatMap(n => [...n, ...n, ...n, ...n]));

  const indices = new Uint16Array([
     0,  1,  2,   0,  2,  3,   // front
     4,  5,  6,   4,  6,  7,   // back
     8,  9, 10,   8, 10, 11,   // top
    12, 13, 14,  12, 14, 15,   // bottom
    16, 17, 18,  16, 18, 19,   // right
    20, 21, 22,  20, 22, 23    // left
  ]);
  return { positions, normals, indices };
}

// Shared index pattern for the (u, v) grids below.
// Triangles are wound counter-clockwise seen from OUTSIDE, so the GPU knows
// which side is the front (needed for gl_FrontFacing in the fragment shader).
function gridIndices(uSteps, vSteps) {
  const idx = [];
  for (let i = 0; i < vSteps; i++) {
    for (let j = 0; j < uSteps; j++) {
      const k1 = i * (uSteps + 1) + j;
      const k2 = k1 + uSteps + 1;
      idx.push(k1, k1 + 1, k2);
      idx.push(k2, k1 + 1, k2 + 1);
    }
  }
  return new Uint16Array(idx);
}

// ---------------- Cone (from HW4) ----------------
//   u in [0, 2*PI] (longitude), v in [0, 1] (latitude), h = height
//   x = r * (1 - v) * cos(u)
//   y = r * (1 - v) * sin(u)
//   z = h * v
// Newly added for lighting: a normal per vertex. The side of a cone leans inward,
// so its normal points outward AND a bit up: (h*cos(u), h*sin(u), r), normalized.
function createCone(r, h, uSteps, vSteps) {
  const pos = [], nrm = [];
  const len = Math.hypot(h, r);
  for (let i = 0; i <= vSteps; i++) {
    const v = i / vSteps;
    for (let j = 0; j <= uSteps; j++) {
      const u = j * 2 * Math.PI / uSteps;
      pos.push(r * (1 - v) * Math.cos(u), r * (1 - v) * Math.sin(u), h * v);
      nrm.push(h * Math.cos(u) / len, h * Math.sin(u) / len, r / len);
    }
  }
  return { positions: new Float32Array(pos), normals: new Float32Array(nrm), indices: gridIndices(uSteps, vSteps) };
}

// ---------------- Cylinder (from HW4) ----------------
//   x = r * cos(u),  y = r * sin(u),  z = h * v
// Newly added for lighting: the normal points straight out from the axis: (cos(u), sin(u), 0)
function createCylinder(r, h, uSteps, vSteps) {
  const pos = [], nrm = [];
  for (let i = 0; i <= vSteps; i++) {
    const v = i / vSteps;
    for (let j = 0; j <= uSteps; j++) {
      const u = j * 2 * Math.PI / uSteps;
      pos.push(r * Math.cos(u), r * Math.sin(u), h * v);
      nrm.push(Math.cos(u), Math.sin(u), 0);
    }
  }
  return { positions: new Float32Array(pos), normals: new Float32Array(nrm), indices: gridIndices(uSteps, vSteps) };
}


// ---------------- Flat-shaded copy of any mesh----------------
// Every triangle gets its own 3 vertices, and all 3 share the triangle's face
// normal, so the lighting is constant across each triangle -> flat shading.
function toFlat({ positions, indices }) {
  const pos = [], nrm = [], idx = [];
  for (let t = 0; t < indices.length; t += 3) {
    const [a, b, c] = [indices[t], indices[t + 1], indices[t + 2]].map(i => [
      positions[3 * i], positions[3 * i + 1], positions[3 * i + 2]]);
    const e1 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
    const e2 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    let n = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
    const len = Math.hypot(...n);
    n = n.map(x => x / len);
    for (const p of [a, b, c]) {
      idx.push(pos.length / 3);
      pos.push(...p);
      nrm.push(...n);
    }
  }
  return { positions: new Float32Array(pos), normals: new Float32Array(nrm), indices: new Uint16Array(idx) };
}