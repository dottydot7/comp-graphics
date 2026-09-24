// cube
const positions = new Float32Array([
  -1, -1, -1,  // 0
   1, -1, -1,  // 1
   1,  1, -1,  // 2
  -1,  1, -1,  // 3
  -1, -1,  1,  // 4
   1, -1,  1,  // 5
   1,  1,  1,  // 6
  -1,  1,  1   // 7
]);

const colors = new Float32Array([
  1,0,0,  0,1,0,  0,0,1, 1,1,0, 1,0,1, 0,1,1, 1,1,0, 1,0,1
]);


const indices = new Uint16Array([
  // Front
  4, 5, 6,   4, 6, 7,
  // Back
  1, 0, 3,   1, 3, 2,
  // Top
  3, 7, 6,   3, 6, 2,
  // Bottom
  0, 1, 5,   0, 5, 4,
  // Right
  1, 2, 6,   1, 6, 5,
  // Left
  0, 4, 7,   0, 7, 3,
]);

// ---------------- New primitive 1: cone ----------------
//   u in [0, 2*PI] (longitude), v in [0, 1] (latitude), h = height
//   x = r * (1 - v) * cos(u)
//   y = r * (1 - v) * sin(u)
//   z = h * v
// Vertices and indices are generated the same way as the sphere example.
// rgb = base color; it gets lighter toward the tip so stacked layers stand apart.
function createCone(r, h, uSteps, vSteps, rgb) {
  const pos = [], col = [], idx = [];
  for (let i = 0; i <= vSteps; i++) {
    const v = i / vSteps;
    for (let j = 0; j <= uSteps; j++) {
      const u = j * 2 * Math.PI / uSteps;
      const x = r * (1 - v) * Math.cos(u);
      const y = r * (1 - v) * Math.sin(u);
      const z = h * v;
      pos.push(x, y, z);
      const shade = 0.55 + 0.45 * v;
      col.push(rgb[0] * shade, rgb[1] * shade, rgb[2] * shade);
    }
  }
  for (let i = 0; i < vSteps; i++) {
    for (let j = 0; j < uSteps; j++) {
      const k1 = i * (uSteps + 1) + j;
      const k2 = k1 + uSteps + 1;
      idx.push(k1, k2, k1 + 1);
      idx.push(k2, k2 + 1, k1 + 1);
    }
  }
  return { positions: new Float32Array(pos), colors: new Float32Array(col), indices: new Uint16Array(idx) };
}

// ---------------- New primitive 2: cylinder ----------------
//   u in [0, 2*PI] (longitude), v in [0, 1] (latitude), h = height
//   x = r * cos(u)
//   y = r * sin(u)
//   z = h * v
function createCylinder(r, h, uSteps, vSteps, rgb) {
  const pos = [], col = [], idx = [];
  for (let i = 0; i <= vSteps; i++) {
    const v = i / vSteps;
    for (let j = 0; j <= uSteps; j++) {
      const u = j * 2 * Math.PI / uSteps;
      const x = r * Math.cos(u);
      const y = r * Math.sin(u);
      const z = h * v;
      pos.push(x, y, z);
      col.push(rgb[0], rgb[1], rgb[2]);
    }
  }
  for (let i = 0; i < vSteps; i++) {
    for (let j = 0; j < uSteps; j++) {
      const k1 = i * (uSteps + 1) + j;
      const k2 = k1 + uSteps + 1;
      idx.push(k1, k2, k1 + 1);
      idx.push(k2, k2 + 1, k1 + 1);
    }
  }
  return { positions: new Float32Array(pos), colors: new Float32Array(col), indices: new Uint16Array(idx) };
}
