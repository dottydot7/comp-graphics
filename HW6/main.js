// ===================== Shaders =====================
const VERTEX_SHADER = `#version 300 es
in vec3 aPosition;
in vec3 aNormal;
in vec3 aTangent;
in vec2 aTexCoord;

uniform mat4 uModelView;
uniform mat4 uProjection;

out vec3 vPosition;
out vec3 vNormal;
out vec3 vTangent;
out vec2 vTexCoord;

void main() {
  vec4 p = uModelView * vec4(aPosition, 1.0);
  vPosition = p.xyz;

  mat3 mv = mat3(uModelView);
  vNormal = transpose(inverse(mv)) * aNormal;   // inverse transpose, as in the template
  vTangent = mv * aTangent;
  vTexCoord = aTexCoord;
  gl_Position = uProjection * p;
}
`;

// Fragment shader:
//   color   = texture (Week 10-1 "Combine textures with lighting and shading")
//   normal  = bump mapped (height map) or normal mapped (normal map), Week 11-1
//   light   = Phong with two point lights (HW5): the room light + the fire light
const FRAGMENT_SHADER = `#version 300 es
precision mediump float;

in vec3 vPosition;
in vec3 vNormal;
in vec3 vTangent;
in vec2 vTexCoord;

uniform vec3 uLightPos1, uLightColor1;   // room light (eye space)
uniform vec3 uLightPos2, uLightColor2;   // fire light (eye space)

uniform vec3 uColor;                     // material color (tints the texture)
uniform float uKa, uKd, uKs, uAlpha;

uniform bool uUseTexture;
uniform sampler2D uTexture;              // color image        (texture unit 0)
uniform bool uUseNormalMap;
uniform sampler2D uNormalMap;            // normal map         (texture unit 1)
uniform float uNormalStrength;
uniform bool uUseBump;
uniform sampler2D uBumpMap;              // height map         (texture unit 2)
uniform float uBumpStrength;
uniform bool uEmissive;                  // the fire glows by itself: no lighting

out vec4 fragColor;

vec3 calculateLight(vec3 lightPos, vec3 lightColor, vec3 N, vec3 V, vec3 baseColor) {
  float d = length(lightPos - vPosition);
  float fatt = 1.0 / (1.0 + 0.09 * d + 0.032 * d * d);      // attenuation (Week 6-2)

  vec3 L = normalize(lightPos - vPosition);
  vec3 diffuse = uKd * max(dot(N, L), 0.0) * baseColor;

  vec3 R = reflect(-L, N);
  vec3 specular = uKs * pow(max(dot(V, R), 0.0), uAlpha) * vec3(1.0);

  return fatt * lightColor * (diffuse + specular);
}

void main() {
  vec3 baseColor = uUseTexture ? uColor * texture(uTexture, vTexCoord).rgb : uColor;

  if (uEmissive) {                       // fire: show the video frame as it is
    fragColor = vec4(baseColor, 1.0);
    return;
  }

  // Tangent frame: T = u direction, B = v direction, N = surface normal
  vec3 N = normalize(vNormal);
  vec3 T = normalize(vTangent - dot(vTangent, N) * N);
  vec3 B = cross(N, T);
  mat3 TBN = mat3(T, B, N);

  if (uUseBump) {
    // BUMP MAPPING: the image stores HEIGHT. Compare with the neighbors to get the slope.
    float h  = texture(uBumpMap, vTexCoord).r;
    float hu = texture(uBumpMap, vTexCoord + vec2(0.01, 0.0)).r;
    float hv = texture(uBumpMap, vTexCoord + vec2(0.0, 0.01)).r;
    vec3 bumpNormal = vec3(-(hu - h) * uBumpStrength, -(hv - h) * uBumpStrength, 1.0);
    N = normalize(TBN * bumpNormal);
  } else if (uUseNormalMap) {
    // NORMAL MAPPING: the image stores the NORMAL itself as RGB.
    vec3 tangentNormal = texture(uNormalMap, vTexCoord).rgb * 2.0 - 1.0;   // [0, 1] -> [-1, 1]
    tangentNormal.xy *= uNormalStrength;
    N = normalize(TBN * tangentNormal);
  }

  vec3 V = normalize(-vPosition);
  vec3 ambient = uKa * baseColor;
  vec3 light1 = calculateLight(uLightPos1, uLightColor1, N, V, baseColor);
  vec3 light2 = calculateLight(uLightPos2, uLightColor2, N, V, baseColor);
  fragColor = vec4(ambient + light1 + light2, 1.0);
}
`;

// ===================== WebGL setup (template) =====================
const canvas = document.getElementById("glcanvas");
const gl = canvas.getContext("webgl2");

function compile(type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader));
  return shader;
}

const ATTRIBUTES = { aPosition: 0, aNormal: 1, aTexCoord: 2, aTangent: 3 };

function createProgram(vsSource, fsSource) {
  const prog = gl.createProgram();
  gl.attachShader(prog, compile(gl.VERTEX_SHADER, vsSource));
  gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, fsSource));
  for (const name in ATTRIBUTES) gl.bindAttribLocation(prog, ATTRIBUTES[name], name);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
  return prog;
}

const vertEditor = document.getElementById("vertEditor");
const fragEditor = document.getElementById("fragEditor");
const shaderError = document.getElementById("shaderError");
vertEditor.value = VERTEX_SHADER;
fragEditor.value = FRAGMENT_SHADER;

const UNIFORMS = ["uModelView", "uProjection", "uLightPos1", "uLightColor1", "uLightPos2", "uLightColor2",
  "uColor", "uKa", "uKd", "uKs", "uAlpha", "uUseTexture", "uTexture", "uUseNormalMap", "uNormalMap",
  "uNormalStrength", "uUseBump", "uBumpMap", "uBumpStrength", "uEmissive"];
let program, u = {};

function updateProgram() {
  try {
    const prog = createProgram(vertEditor.value, fragEditor.value);
    gl.deleteProgram(program);
    program = prog;
    gl.useProgram(program);
    for (const name of UNIFORMS) u[name] = gl.getUniformLocation(program, name);
    gl.uniform1i(u.uTexture, 0);     // color image  -> unit 0
    gl.uniform1i(u.uNormalMap, 1);   // normal map   -> unit 1
    gl.uniform1i(u.uBumpMap, 2);     // height map   -> unit 2
    shaderError.textContent = "";
  } catch (e) {
    shaderError.textContent = e.message.replace(/\0/g, "");
  }
}
updateProgram();
vertEditor.addEventListener("input", updateProgram);
fragEditor.addEventListener("input", updateProgram);

function bindAttribute(name, data, size) {
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
  gl.vertexAttribPointer(ATTRIBUTES[name], size, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(ATTRIBUTES[name]);
}

function createMesh({ positions, normals, tangents, texCoords, indices }) {
  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  bindAttribute("aPosition", positions, 3);
  bindAttribute("aNormal", normals, 3);
  bindAttribute("aTangent", tangents, 3);
  bindAttribute("aTexCoord", texCoords, 2);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);
  return { vao, count: indices.length };
}

// ===================== Textures (template's loadTexture) =====================
gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);  // images start at the top row, texture coordinates at the bottom

function loadTexture(url) {
  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([128, 128, 255, 255]));

  const image = new Image();
  image.onload = () => {
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);   // tiling
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
  };
  image.onerror = () => console.error("Could not load texture: " + url);
  image.src = url;
  return texture;
}

const brickTex       = loadTexture("textures/brick.jpg");
const brickHeightTex = loadTexture("textures/brick_height.png");   // bump map (height)
const woodTex        = loadTexture("textures/wood.jpg");
const woodNormalTex  = loadTexture("textures/wood_normal.png");    // normal map
const barkTex        = loadTexture("textures/bark.jpg");
const barkNormalTex  = loadTexture("textures/bark_normal.png");    // normal map
const pineTex        = loadTexture("textures/pine.jpg");
const ornRedTex      = loadTexture("textures/ornament_red.png");
const ornBlueTex     = loadTexture("textures/ornament_blue.png");

// ===================== Animated texture: fire video =====================
const fireVideo = document.createElement("video");
fireVideo.src = fireVideo.canPlayType("video/webm") ? "textures/fire.webm" : "textures/fire.mp4";
fireVideo.loop = true;
fireVideo.muted = true;            // browsers only autoplay muted video
fireVideo.playsInline = true;
fireVideo.play().catch(() => {});  // if autoplay is blocked, the first click starts it
document.addEventListener("click", () => { if (fireOn) fireVideo.play(); }, { once: true });
fireVideo.onerror = () => console.error("Could not load video: " + fireVideo.src);

const fireTex = gl.createTexture();
gl.bindTexture(gl.TEXTURE_2D, fireTex);
gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 255]));
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);   // no mipmaps: new picture every frame
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

function updateVideoTexture() {
  if (fireVideo.readyState >= fireVideo.HAVE_CURRENT_DATA) {
    gl.bindTexture(gl.TEXTURE_2D, fireTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, fireVideo);
  }
}

// ===================== Materials =====================
// color tints the texture (white = the image as is); ka, kd, ks, alpha as in HW5
//   texture = color image, bumpMap = height image, normalMap = normal image
const WHITE = [1, 1, 1];
const brickMat  = { color: WHITE, ka: 0.25, kd: 0.9, ks: 0.15, alpha: 16, texture: brickTex, bumpMap: brickHeightTex };
const sootMat   = { ...brickMat, color: [0.45, 0.38, 0.36] };   // darker bricks inside the firebox
const floorMat  = { color: WHITE, ka: 0.25, kd: 0.9, ks: 0.4, alpha: 30, texture: woodTex, normalMap: woodNormalTex };
const mantelMat = { color: [0.8, 0.65, 0.55], ka: 0.25, kd: 0.9, ks: 0.5, alpha: 40, texture: woodTex, normalMap: woodNormalTex };
const logMat    = { color: WHITE, ka: 0.25, kd: 1.0, ks: 0.2, alpha: 10, texture: barkTex, normalMap: barkNormalTex };
const pineMat   = { color: [1.4, 1.4, 1.4], ka: 0.3, kd: 1.0, ks: 0.1, alpha: 8, texture: pineTex };
const ornRedMat = { color: WHITE, ka: 0.25, kd: 0.8, ks: 1.0, alpha: 100, texture: ornRedTex };
const ornBlueMat= { color: WHITE, ka: 0.25, kd: 0.8, ks: 1.0, alpha: 100, texture: ornBlueTex };
const wallMat   = { color: [0.32, 0.1, 0.1], ka: 0.3, kd: 0.8, ks: 0.0, alpha: 1 };
const fireMat   = { color: WHITE, texture: fireTex, emissive: true };

// ===================== Scene (units ~ meters, y up, fireplace front at z = 0) =====================
const BRICK = [0.9, 0.6];   // one brick image covers 0.9 x 0.6 (4 bricks wide, 8 rows tall)
const objects = [];
function add(mesh, material, model) { objects.push({ mesh: createMesh(mesh), material, model }); }
const T = translate;

// Room
add(createBox(7, 0.1, 4.5, 1.2), floorMat, T(0, -0.05, 0.9));                     // wood floor (normal map)
add(createBox(7, 4.4, 0.1), wallMat, T(0, 2.2, -0.65));                          // wall

// Fireplace: brick boxes (bump map)
add(createBox(0.5, 1.6, 0.6, ...BRICK), brickMat, T(-1.05, 0.8, -0.3));           // left pillar
add(createBox(0.5, 1.6, 0.6, ...BRICK), brickMat, T(1.05, 0.8, -0.3));            // right pillar
add(createBox(2.6, 0.55, 0.6, ...BRICK), brickMat, T(0, 1.875, -0.3));           // top
add(createBox(1.6, 1.6, 0.1, ...BRICK), sootMat, T(0, 0.8, -0.55));              // back of the firebox
add(createBox(3.2, 0.12, 0.8, ...BRICK), brickMat, T(0, 0.06, 0.25));            // hearth
add(createBox(3.0, 0.12, 0.8, 1.2), mantelMat, T(0, 2.21, -0.25));               // wooden mantel (normal map)

// Logs: cylinders lying along x (bark texture + normal map)
const lying = rotateZ(Math.PI / 2);
add(createCylinder(0.09, 1.2, 24, 2, 2), logMat, multiply(T(0, 0.21, -0.27), lying));
add(createCylinder(0.09, 1.2, 24, 2, 2), logMat, multiply(T(0, 0.21, -0.07), lying));
add(createCylinder(0.08, 1.0, 24, 2, 2), logMat, multiply(multiply(T(0, 0.36, -0.17), rotateY(0.2)), lying));

// Wreath: torus on the wall (pine texture), ornaments: spheres (pattern textures), mini trees: cones (pine texture)
add(createTorus(0.42, 0.11, 64, 16, 8), pineMat, T(0, 3.05, -0.48));
add(createSphere(0.11), ornRedMat, T(-0.45, 2.38, -0.1));
add(createSphere(0.11), ornBlueMat, T(0, 2.38, -0.1));
add(createSphere(0.11), ornRedMat, T(0.45, 2.38, -0.1));
add(createCone(0.24, 0.7, 32, 8, 2), pineMat, T(-1.15, 2.27, -0.3));
add(createCone(0.24, 0.7, 32, 8, 2), pineMat, T(1.15, 2.27, -0.3));

// Fire: a box with depth 0 (so only a flat front face shows) holding the video; drawn last, added on top
const fire = { mesh: createMesh(createBox(1.3, 1.1, 0, 1.3, 1.1)), material: fireMat, model: T(0, 0.62, -0.44) };
const fireLightLocal = [0, 0.55, -0.12];

// ===================== Controls =====================
gl.enable(gl.DEPTH_TEST);
gl.clearColor(0.02, 0.02, 0.03, 1);
const projection = perspective(Math.PI / 4, canvas.width / canvas.height, 0.1, 100);

let dragRotX = 0.1, dragRotY = 0;       // mouse drag
let camX = 0, camY = 0, camZ = -6;      // arrow keys, w, s (and the mouse wheel)
let sliderAngle = 0;
let spinning = false, spinAngle = 0;

let mouseDown = false, lastX, lastY;
canvas.addEventListener("mousedown", e => { mouseDown = true; lastX = e.clientX; lastY = e.clientY; });
window.addEventListener("mouseup", () => mouseDown = false);
window.addEventListener("mousemove", e => {
  if (!mouseDown) return;
  dragRotY += (e.clientX - lastX) * 0.01;
  dragRotX += (e.clientY - lastY) * 0.01;
  lastX = e.clientX; lastY = e.clientY;
});
canvas.addEventListener("wheel", e => {                       // scroll to zoom
  camZ = Math.min(-1.0, Math.max(-15, camZ - e.deltaY * 0.005));
  e.preventDefault();
}, { passive: false });

document.addEventListener("keydown", e => {
  if (e.target === vertEditor || e.target === fragEditor) return;
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
  e.preventDefault();
});

const axisSelect = document.getElementById("axisSelect");
document.getElementById("slider").addEventListener("input", e => {
  sliderAngle = Number(e.target.value);
  document.getElementById("sliderValue").textContent = sliderAngle;
});
document.getElementById("spinButton").addEventListener("click", () => spinning = !spinning);

const num = id => Number(document.getElementById(id).value);
for (const slider of document.querySelectorAll(".panels input[type=range]")) {
  const label = document.getElementById(slider.id + "Val");
  const show = () => label.textContent = slider.value;
  slider.addEventListener("input", show);
  show();
}

let fireOn = true;
document.getElementById("fireBtn").addEventListener("click", () => {
  fireOn = !fireOn;
  if (fireOn) fireVideo.play(); else fireVideo.pause();
});

// ===================== Drawing =====================
function drawObject({ mesh, material: m, model }, sceneMatrix) {
  gl.uniformMatrix4fv(u.uModelView, false, multiply(sceneMatrix, model));
  gl.uniform3fv(u.uColor, m.color);
  gl.uniform1f(u.uKa, m.ka || 0);
  gl.uniform1f(u.uKd, m.kd || 0);
  gl.uniform1f(u.uKs, m.ks || 0);
  gl.uniform1f(u.uAlpha, m.alpha || 1);
  gl.uniform1i(u.uEmissive, m.emissive ? 1 : 0);

  gl.uniform1i(u.uUseTexture, m.texture ? 1 : 0);
  if (m.texture) { gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, m.texture); }
  gl.uniform1i(u.uUseNormalMap, m.normalMap ? 1 : 0);
  if (m.normalMap) { gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, m.normalMap); }
  gl.uniform1i(u.uUseBump, m.bumpMap ? 1 : 0);
  if (m.bumpMap) { gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, m.bumpMap); }

  gl.bindVertexArray(mesh.vao);
  gl.drawElements(gl.TRIANGLES, mesh.count, gl.UNSIGNED_SHORT, 0);
}

let lastTime = 0;
function render(time) {
  const t = time / 1000;
  if (spinning) spinAngle += t - lastTime;
  lastTime = t;
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  updateVideoTexture();   // copy the current video frame into fireTex

  // Camera (keys/wheel) * rotation (mouse + template slider/spin) * move the fireplace's middle to the center
  const view = translate(camX, camY, camZ);
  const axisRotation = ROTATE[axisSelect.value](sliderAngle * Math.PI / 180 + spinAngle);
  const rotation = multiply(multiply(rotateY(dragRotY), rotateX(dragRotX)), axisRotation);
  const sceneMatrix = multiply(multiply(view, rotation), translate(0, -1.65, 0));

  gl.uniformMatrix4fv(u.uProjection, false, projection);
  gl.uniform1f(u.uBumpStrength, num("bumpStrength"));
  gl.uniform1f(u.uNormalStrength, num("normalStrength"));

  // Light 1: room light, stays put while the scene rotates; the slider slides it left/right
  const roomLight = transformPoint(multiply(view, translate(0, -1.65, 0)), [num("lightX"), 3.2, 3.0]);
  gl.uniform3fv(u.uLightPos1, roomLight);
  gl.uniform3fv(u.uLightColor1, [1, 0.95, 0.85].map(c => c * num("roomLight")));

  // Light 2: a steady orange point light at the fire (same kind of light as the HW5 star light)
  gl.uniform3fv(u.uLightPos2, transformPoint(sceneMatrix, fireLightLocal));
  gl.uniform3fv(u.uLightColor2, [1, 0.5, 0.15].map(c => c * num("fireLight")));

  for (const obj of objects) drawObject(obj, sceneMatrix);

  // Fire last, ADDED on top of what is behind it, so the video's black background disappears
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.ONE, gl.ONE);
  gl.depthMask(false);
  drawObject(fire, sceneMatrix);
  gl.depthMask(true);
  gl.disable(gl.BLEND);

  requestAnimationFrame(render);
}
requestAnimationFrame(render);
