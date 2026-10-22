const VERTEX_SHADER = `#version 300 es
in vec3 aPosition;
in vec3 aNormal;

uniform mat4 uModelView;
uniform mat4 uProjection;

out vec3 vPosition;
out vec3 vNormal;

void main() {
  vec4 p = uModelView * vec4(aPosition, 1.0);
  vPosition = p.xyz;
  vNormal = mat3(uModelView) * aNormal;
  gl_Position = uProjection * p;
}
`;

// Phong lighting per fragment with two point lights:
//   I_final = Ka*I_a + sum over lights of  f_att * I_L,i * [Kd*cos(theta) + Ks*cos(phi)^alpha]
//   Light 1: the template's white point light, fixed in the world
//   Light 2: a warm point light at the star (it sways with the tree)
const FRAGMENT_SHADER = `#version 300 es
precision mediump float;

in vec3 vPosition;
in vec3 vNormal;

uniform vec3 uLightPos1;      // main light, eye space
uniform vec3 uLightPos2;      // star light, eye space
uniform vec3 uLightColor1;    // incoming light intensity I_L (as a color)
uniform vec3 uLightColor2;

uniform vec3 uColor;
uniform float uKa, uKd, uKs, uAlpha;

out vec4 fragColor;

// Diffuse + specular from one light 
vec3 calculateLight(vec3 lightPos, vec3 lightColor, vec3 normal, vec3 viewDir) {
  // Attenuation: f_att = 1 / (a + b*d + c*d^2)
  float d = length(lightPos - vPosition);
  float fatt = 1.0 / (1.0 + 0.09 * d + 0.032 * d * d);

  // Diffuse
  vec3 lightDir = normalize(lightPos - vPosition);
  float cosTheta = max(dot(normal, lightDir), 0.0);
  vec3 diffuse = uKd * cosTheta * uColor;

  // Specular
  vec3 reflectDir = -reflect(lightDir, normal);
  float spec = pow(max(dot(viewDir, reflectDir), 0.0), uAlpha);
  vec3 specular = uKs * spec * vec3(1.0);

  return fatt * lightColor * (diffuse + specular);
}

void main() {
  vec3 normal = normalize(vNormal);
  vec3 viewDir = normalize(-vPosition);     // camera sits at the origin

  // Ambient (only computed once, not per light)
  vec3 ambient = uKa * uColor;

  // Contribution from both lights
  vec3 light1 = calculateLight(uLightPos1, uLightColor1, normal, viewDir);
  vec3 light2 = calculateLight(uLightPos2, uLightColor2, normal, viewDir);

  vec3 result = ambient + light1 + light2;
  fragColor = vec4(result, 1.0);
}
`;

// WebGL setup
const canvas = document.getElementById("glcanvas");
const gl = canvas.getContext("webgl2");

function compile(type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader));
  return shader;
}

// Fixed attribute slots, so the meshes stay valid when the shaders are recompiled
const ATTRIBUTES = { aPosition: 0, aNormal: 1 };

function createProgram(vsSource, fsSource) {
  const prog = gl.createProgram();
  gl.attachShader(prog, compile(gl.VERTEX_SHADER, vsSource));
  gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, fsSource));
  for (const name in ATTRIBUTES) gl.bindAttribLocation(prog, ATTRIBUTES[name], name);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
  return prog;
}

// Shader editors
const vertEditor = document.getElementById("vertEditor");
const fragEditor = document.getElementById("fragEditor");
const shaderError = document.getElementById("shaderError");
vertEditor.value = VERTEX_SHADER;
fragEditor.value = FRAGMENT_SHADER;

// All uniform locations live in one object: u.uModelView, u.uColor, ...
const UNIFORMS = ["uModelView", "uProjection", "uLightPos1", "uLightPos2", "uLightColor1", "uLightColor2",
  "uColor", "uKa", "uKd", "uKs", "uAlpha"];
let program, u = {};

function updateProgram() {
  try {
    const prog = createProgram(vertEditor.value, fragEditor.value);
    gl.deleteProgram(program);
    program = prog;
    gl.useProgram(program);
    for (const name of UNIFORMS) u[name] = gl.getUniformLocation(program, name);
    shaderError.textContent = "";
  } catch (e) {
    shaderError.textContent = e.message.replace(/\0/g, "");  // some drivers end the log with \0
  }
}
updateProgram();
vertEditor.addEventListener("input", updateProgram);
fragEditor.addEventListener("input", updateProgram);

function bindAttribute(name, data) {
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
  gl.vertexAttribPointer(ATTRIBUTES[name], 3, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(ATTRIBUTES[name]);
}

function createMesh({ positions, normals, indices }) {
  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  bindAttribute("aPosition", positions);
  bindAttribute("aNormal", normals);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);
  return { vao, count: indices.length };
}

// Meshes are built at their real size (r, h), so the shapes are only rotated/translated
// (no uneven scaling) and mat3(uModelView) keeps the normals correct, as in the template.
// FLAT shading:   tree cones and star points (one normal per triangle -> visible facets)
// SMOOTH shading: trunk (normals vary around the cylinder)
const bottomConeMesh = createMesh(toFlat(createCone(1.1, 1.3, 16, 6)));
const middleConeMesh = createMesh(toFlat(createCone(0.85, 1.1, 16, 6)));
const topConeMesh    = createMesh(toFlat(createCone(0.6, 0.9, 16, 6)));
const trunkMesh      = createMesh(createCylinder(0.15, 0.9, 16, 1));
const starPointMesh  = createMesh(toFlat(createCone(0.3, 1, 12, 2)));
const cubeMesh = createMesh(createCube());

gl.enable(gl.DEPTH_TEST);
gl.clearColor(0.02, 0.03, 0.08, 1);              // night sky
const projection = perspective(Math.PI / 4, canvas.width / canvas.height, 0.1, 100);
const lightWorld = [3, 4, 5];

// Interactive controls
let dragRotX = 0.2, dragRotY = 0;       // mouse drag (0.2 = the slight tilt from HW4)
let camX = 0, camY = 0, camZ = -7;      // arrow keys, w, s
let sliderAngle = 0;                    // degrees
let spinning = false, spinAngle = 0;    // Start/Stop button

let mouseDown = false, lastX, lastY;
canvas.addEventListener("mousedown", e => { mouseDown = true; lastX = e.clientX; lastY = e.clientY; });
window.addEventListener("mouseup", () => mouseDown = false);
window.addEventListener("mousemove", e => {
  if (!mouseDown) return;
  dragRotY += (e.clientX - lastX) * 0.01;
  dragRotX += (e.clientY - lastY) * 0.01;
  lastX = e.clientX; lastY = e.clientY;
});

document.addEventListener("keydown", e => {
  if (e.target === vertEditor || e.target === fragEditor) return;  // let the editors use the keys
  const step = 0.2;
  switch (e.key) {
    case "ArrowUp": camY -= step; break;
    case "ArrowDown": camY += step; break;
    case "ArrowLeft": camX += step; break;
    case "ArrowRight": camX -= step; break;
    case "w": camZ += step; break;
    case "s": camZ -= step; break;
    default: return;
  }
  e.preventDefault();  // keep the arrow keys from scrolling the page
});

const axisSelect = document.getElementById("axisSelect");
document.getElementById("slider").addEventListener("input", e => {
  sliderAngle = Number(e.target.value);
  document.getElementById("sliderValue").textContent = sliderAngle;
});
document.getElementById("spinButton").addEventListener("click", () => spinning = !spinning);

// panel controls: read straight from the page every frame
const num = id => Number(document.getElementById(id).value);
const DEG = Math.PI / 180;

// Show each slider's value in the <span> next to it
for (const slider of document.querySelectorAll(".panels input[type=range]")) {
  const label = document.getElementById(slider.id + "Val");
  const show = () => label.textContent = slider.value;
  slider.addEventListener("input", show);
  show();
}

// ---------------- Wind (from HW4) ----------------
// The button starts a gust that blows to the right; the slider sets how strong it is.
let gustStart = -100, gustStrength = 0, now = 0;
document.getElementById("gustBtn").addEventListener("click", () => {
  gustStart = now;
  gustStrength = num("windStrength");
});

// Gust envelope: ramps up over 0.4 s, then slowly dies back to 0
function gustAmount(t) {
  const tau = t - gustStart;
  if (tau < 0) return 0;
  if (tau < 0.4) return gustStrength * (tau / 0.4);
  return gustStrength * Math.exp(-(tau - 0.4) * 1.2);
}

// ---------------- Materials ----------------
// color, ambient (ka), diffuse (kd), specular (ks), shininess exponent (alpha)
// alpha: 5-10 = plastic-like, 100-200 = metal-like (slides)
// DIFFUSE only (ks = 0): trunk, presents
// SPECULAR (shiny highlights): tree (set by the "Tree specular" slider)
const trunkMat    = { color: [0.55, 0.3, 0.1], ka: 0.2, kd: 0.9, ks: 0, alpha: 1 };
const treeMat     = { color: [0.1, 0.65, 0.25], ka: 0.2, kd: 0.8, ks: 0.5, alpha: 10 };   // plastic-like
const starMat     = { color: [1, 0.85, 0], ka: 0.2, kd: 0.6, ks: 0.8, alpha: 100 };       // metal-like
const presentMat1 = { color: [0.6, 0.2, 0.8], ka: 0.2, kd: 0.8, ks: 0, alpha: 1 };
const presentMat2 = { color: [0.2, 0.5, 1], ka: 0.2, kd: 0.8, ks: 0, alpha: 1 };

// ---------------- Scene graph ----------------
// A node = mesh + material + shape (local scale/orientation of the mesh) + joint (transform from its parent)
function createNode(mesh, material, shape) {
  return { mesh, material, shape, joint: translate(0, 0, 0), children: [] };
}

// The cone/cylinder formulas build shapes along +z (HW4), so each tree part is
// drawn with RotateX(-90 deg) to stand it up along +y.
const standUp = rotateX(-Math.PI / 2);

// Hierarchy (6 levels, same tree as HW4):
const trunk        = createNode(trunkMesh, trunkMat, standUp);
const bottomCone   = createNode(bottomConeMesh, treeMat, standUp);
const middleCone   = createNode(middleConeMesh, treeMat, standUp);
const topCone      = createNode(topConeMesh, treeMat, standUp);
const star     = createNode(null, starMat, null);   // no mesh: just a joint the 5 points hang from
const present1 = createNode(cubeMesh, presentMat1, scale(0.2, 0.2, 0.2));
const present2 = createNode(cubeMesh, presentMat2, scale(0.14, 0.14, 0.14));

trunk.children.push(bottomCone, present1, present2);
bottomCone.children.push(middleCone);
middleCone.children.push(topCone);
topCone.children.push(star);

// Star: 5 skinny cones turned 0, 72, 144, 216, 288 degrees (as in HW4)
const starPoints = [];
for (let i = 0; i < 5; i++) {
  const point = createNode(starPointMesh, starMat, null);  // shape set each frame (twinkle)
  point.joint = rotateZ(i * 2 * Math.PI / 5);
  star.children.push(point);
  starPoints.push(point);
}

// Draw one node with its material (template's drawNode + material uniforms)
function drawNode(node, frame) {
  if (!node.mesh) return;                    // nodes without a mesh (the star center) are not drawn
  const m = node.material;
  gl.uniformMatrix4fv(u.uModelView, false, multiply(frame, node.shape));
  gl.uniform3fv(u.uColor, m.color);
  gl.uniform1f(u.uKa, m.ka);
  gl.uniform1f(u.uKd, m.kd);
  gl.uniform1f(u.uKs, m.ks);
  gl.uniform1f(u.uAlpha, m.alpha);
  gl.bindVertexArray(node.mesh.vao);
  gl.drawElements(gl.TRIANGLES, node.mesh.count, gl.UNSIGNED_SHORT, 0);
}

// Template's tree traversal: frame = parent frame * joint
function drawTree(root, rootFrame) {
  const stack = [[root, rootFrame]];
  while (stack.length > 0) {
    const [node, parentFrame] = stack.pop();
    const frame = multiply(parentFrame, node.joint);
    drawNode(node, frame);
    for (const child of node.children) stack.push([child, frame]);
  }
}

// Copy the tree specular slider into the tree material
function updateMaterials() {
  treeMat.ks = num("treeKs");
}

// Render loop
let lastTime = 0;
function render(time) {
  const t = time / 1000;
  if (spinning) spinAngle += t - lastTime;
  lastTime = t;
  now = t;
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  // Camera moves with the keys; the main light stays fixed in the world.
  const view = translate(camX, camY, camZ);
  gl.uniformMatrix4fv(u.uProjection, false, projection);

  // Whole-scene rotation (mouse drag + template slider/spin)
  const axisRotation = ROTATE[axisSelect.value](sliderAngle * DEG + spinAngle);
  const rotation = multiply(multiply(rotateY(dragRotY), rotateX(dragRotX)), axisRotation);

  // Wind (from HW4):
  const g = gustAmount(t);
  const windAngle = (amp, lean) => (amp * Math.sin(t) - lean * g) * DEG;

  // Joints: M_child = M_parent * T_joint * R_joint
  trunk.joint      = multiply(multiply(rotation, translate(0, -1.8, 0)), rotateZ(windAngle(2, 1.5)));
  bottomCone.joint = multiply(translate(0, 0.9, 0), rotateZ(windAngle(3, 2.5)));
  middleCone.joint = multiply(translate(0, 0.8, 0), rotateZ(windAngle(5, 3.5)));
  topCone.joint    = multiply(translate(0, 0.7, 0), rotateZ(windAngle(7, 4.5)));
  star.joint   = multiply(translate(0, 1.05, 0), rotateZ(windAngle(10, 6)));

  // Star points twinkle (from HW4)
  const twinkle = 0.2 * (1 + 0.2 * Math.sin(t * 3));
  for (const point of starPoints)
    point.shape = multiply(standUp, scale(twinkle, twinkle, twinkle));

  // Presents slide right with the gust (from HW4)
  const push = 0.15 * g;
  present1.joint = translate(-0.7 + push, 0.2, 0.3);
  present2.joint = multiply(translate(0.6 + push * 1.5, 0.14, 0.4), rotateY(0.5));

  // Star's frame = product of the joints from the root down to the star (M_child = M_parent * joint)
  const starFrame = multiply(multiply(multiply(multiply(multiply(
    view, trunk.joint), bottomCone.joint), middleCone.joint), topCone.joint), star.joint);

  // Light 1: white point light fixed in the world (from the template)
  // Light 2: warm point light that moves with the star (brightness set by the "Star light" slider)
  const mainColor = [1, 1, 1];
  const starColor = [1, 0.8, 0.45].map(c => c * num("starIntensity"));
  gl.uniform3fv(u.uLightPos1, transformPoint(view, lightWorld));
  gl.uniform3fv(u.uLightPos2, transformPoint(starFrame, [0, 0, 1.5]));  // 1.5 units in front of the star so it hits the front of the tree
  gl.uniform3fv(u.uLightColor1, mainColor);
  gl.uniform3fv(u.uLightColor2, starColor);

  updateMaterials();
  drawTree(trunk, view);
  requestAnimationFrame(render);
}
requestAnimationFrame(render);