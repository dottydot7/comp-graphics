// Every shape returns: positions, normals, tangents, texCoords, indices
//   texCoords (u, v): where each vertex samples the image 
//   tangent T: the direction u grows on the surface (needed for bump / normal mapping)
//   the shader builds the bitangent B = cross(N, T), the direction v grows
// All shapes are centered at the origin with +y up.

function pack(pos, nrm, tan, uv, idx) {
  return {
    positions: new Float32Array(pos), normals: new Float32Array(nrm), tangents: new Float32Array(tan),
    texCoords: new Float32Array(uv), indices: new Uint16Array(idx)
  };
}

// Shared index pattern for (u, v) grids: rows of (uSteps + 1) vertices
function gridIndices(uSteps, vSteps, offset = 0) {
  const idx = [];
  for (let i = 0; i < vSteps; i++) {
    for (let j = 0; j < uSteps; j++) {
      const k1 = offset + i * (uSteps + 1) + j, k2 = k1 + uSteps + 1;
      idx.push(k1, k1 + 1, k2, k2, k1 + 1, k2 + 1);
    }
  }
  return idx;
}

const cross3 = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

// ---------------- Box (w x h x d) ----------------
// Like the template's cube, but texture coordinates are measured in "tiles":
//   u = (distance along the face) / tileW,  v = (distance up the face) / tileH
// so the bricks/planks keep the same size on every face, however big the box is (REPEAT wrapping).
function createBox(w, h, d, tileW = 1, tileH = tileW) {
  const pos = [], nrm = [], tan = [], uv = [], idx = [];
  const half = [w / 2, h / 2, d / 2];
  //            normal       tangent (u direction)
  const faces = [[[0, 0, 1], [1, 0, 0]], [[0, 0, -1], [-1, 0, 0]],   // front, back
                 [[1, 0, 0], [0, 0, -1]], [[-1, 0, 0], [0, 0, 1]],   // right, left
                 [[0, 1, 0], [1, 0, 0]], [[0, -1, 0], [1, 0, 0]]];   // top, bottom
  for (const [n, t] of faces) {
    const b = cross3(n, t);                                         // v direction on this face
    const size = v => Math.abs(v[0]) * half[0] + Math.abs(v[1]) * half[1] + Math.abs(v[2]) * half[2];
    const hu = size(t), hv = size(b), hn = size(n);
    const start = pos.length / 3;
    for (const [su, sv] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
      for (let k = 0; k < 3; k++) pos.push(n[k] * hn + t[k] * su * hu + b[k] * sv * hv);
      nrm.push(...n);
      tan.push(...t);
      uv.push((su + 1) * hu / tileW, (sv + 1) * hv / tileH);
    }
    idx.push(start, start + 1, start + 2, start, start + 2, start + 3);
  }
  return pack(pos, nrm, tan, uv, idx);
}

// ---------------- Cylinder (radius r, height h, axis = y) ----------------
//   side: x = r sin(theta), y = h (v - 0.5), z = r cos(theta)
//   texture (slide's simpler mapping): u = uRepeat * theta / 2PI, v = vRepeat * y / height
//   tangent = (cos(theta), 0, -sin(theta));  caps: flat disks, planar mapping
function createCylinder(r, h, segments = 32, uRepeat = 1, vRepeat = 1) {
  const pos = [], nrm = [], tan = [], uv = [], idx = [];
  for (let i = 0; i <= 1; i++) {
    for (let j = 0; j <= segments; j++) {
      const th = 2 * Math.PI * j / segments, s = Math.sin(th), c = Math.cos(th);
      pos.push(r * s, h * (i - 0.5), r * c);
      nrm.push(s, 0, c);
      tan.push(c, 0, -s);
      uv.push(uRepeat * j / segments, vRepeat * i);
    }
  }
  idx.push(...gridIndices(segments, 1));
  for (const y of [1, -1]) {                       // caps
    const center = pos.length / 3;
    pos.push(0, y * h / 2, 0); nrm.push(0, y, 0); tan.push(1, 0, 0); uv.push(0.5, 0.5);
    for (let j = 0; j <= segments; j++) {
      const th = 2 * Math.PI * j / segments, s = Math.sin(th), c = Math.cos(th);
      pos.push(r * s, y * h / 2, r * c); nrm.push(0, y, 0); tan.push(1, 0, 0);
      uv.push(0.5 + 0.5 * s, 0.5 - 0.5 * y * c);
      if (j > 0) idx.push(center, center + j, center + j + 1);
    }
  }
  return pack(pos, nrm, tan, uv, idx);
}

// ---------------- Cone (base radius r, height h, base at y = 0, tip at y = h) ----------------
//   x = r(1 - v) sin(theta), y = h v, z = r(1 - v) cos(theta)
//   normal = (h sin(theta), r, h cos(theta)) / len,  tangent = (cos(theta), 0, -sin(theta))
//   texture (slide's simpler mapping): u = uRepeat * theta / 2PI, v = y / height
function createCone(r, h, segments = 32, vSteps = 8, uRepeat = 1) {
  const pos = [], nrm = [], tan = [], uv = [];
  const len = Math.hypot(h, r);
  for (let i = 0; i <= vSteps; i++) {
    const v = i / vSteps;
    for (let j = 0; j <= segments; j++) {
      const th = 2 * Math.PI * j / segments, s = Math.sin(th), c = Math.cos(th);
      pos.push(r * (1 - v) * s, h * v, r * (1 - v) * c);
      nrm.push(h * s / len, r / len, h * c / len);
      tan.push(c, 0, -s);
      uv.push(uRepeat * j / segments, v);
    }
  }
  return pack(pos, nrm, tan, uv, gridIndices(segments, vSteps));
}

// ---------------- Sphere ----------------
//   x = r sin(phi) cos(theta), y = r cos(phi), z = r sin(phi) sin(theta)
//   texture (slide's lat/long mapping): u = 1 - j / slices, v = 1 - i / stacks
//   tangent = (sin(theta), 0, -cos(theta))
function createSphere(r, stacks = 16, slices = 32) {
  const pos = [], nrm = [], tan = [], uv = [];
  for (let i = 0; i <= stacks; i++) {
    const phi = Math.PI * i / stacks;
    for (let j = 0; j <= slices; j++) {
      const th = 2 * Math.PI * j / slices;
      const x = Math.sin(phi) * Math.cos(th), y = Math.cos(phi), z = Math.sin(phi) * Math.sin(th);
      pos.push(r * x, r * y, r * z);
      nrm.push(x, y, z);
      tan.push(Math.sin(th), 0, -Math.cos(th));
      uv.push(1 - j / slices, 1 - i / stacks);
    }
  }
  return pack(pos, nrm, tan, uv, gridIndices(slices, stacks));
}

// ---------------- Torus (facing +z, like a wreath on a wall) ----------------
//   R = ring radius, r = tube radius
//   x = (R + r cos(phi)) cos(theta), y = (R + r cos(phi)) sin(theta), z = r sin(phi)
//   texture (slide's simpler mapping): u = uRepeat * theta / 2PI, v = phi / 2PI
//   tangent = (-sin(theta), cos(theta), 0)
function createTorus(R, r, segments = 64, sides = 16, uRepeat = 1) {
  const pos = [], nrm = [], tan = [], uv = [];
  for (let i = 0; i <= sides; i++) {
    const phi = 2 * Math.PI * i / sides, cp = Math.cos(phi), sp = Math.sin(phi);
    for (let j = 0; j <= segments; j++) {
      const th = 2 * Math.PI * j / segments, ct = Math.cos(th), st = Math.sin(th);
      pos.push((R + r * cp) * ct, (R + r * cp) * st, r * sp);
      nrm.push(cp * ct, cp * st, sp);
      tan.push(-st, ct, 0);
      uv.push(uRepeat * j / segments, i / sides);
    }
  }
  return pack(pos, nrm, tan, uv, gridIndices(segments, sides));
}
