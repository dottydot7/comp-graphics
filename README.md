# HW2 - Diamond Shape Created by Two Triangles
Draws two colored triangles that together form a diamond. The vertex shader uses 2D homogeneous matrices to rotate it continuously and pulse its scale between 0.8× and 1.0×. 
The fragment shader fades its transparency in and out over time.

# HW3 – Christmas Tree in the Wind
Set the **Wind** slider (light <-> strong) and click **Gust of wind!** to blow wind from the left. The tree leans right, the presents slide, and then everything settles back. 

# HW4 – Christmas Tree with Hierarchical Modeling 
A 5-level hierarchical Christmas tree (trunk -> three cones -> star) where each level sways at its own joint, and a gust button, wind-strength slider and bend slider control the chained motion, with a counter-rotation below the root so the wind always blows screen-right.

# HW5 – Hierarchically Modeled Christmas Tree with Lighting and Shading
1. **Geometric primitives & hierarchy:** The scene uses cylinders, cones and cubes in a 6-level hierarchy: trunk (root) -> bottom cone -> middle cone -> top cone -> star, with two cube presents attached to the trunk.

2. **Reflections & shading:**
   - **Diffuse vs. specular:** The trunk and presents are diffuse only (Ks = 0). The tree is diffuse + specular (plastic-like, alpha = 10), and the star is specular (metal-like, alpha = 100).
   - **Flat vs. smooth:** The tree cones use flat shading (one normal per triangle). The trunk uses smooth shading (normals vary around the cylinder).

3. **Multiple lights:** There are two point lights: the template's white light, fixed in the world, and a light at the star that moves with the tree. Both are computed with `calculateLight()` using attenuation `1 / (1 + 0.09d + 0.032d²)`.

4. **Interactive controls:**
   - **Movement:** The *Gust of wind!* button and the *Wind strength* slider lean the trunk, all three cones and the star, and slide the presents.
   - **Lighting/materials:** The *Star light* slider changes the star light's brightness, and the *Tree specular* slider changes the tree's specular reflection.

# HW6 – Texture Mapping: Fireplace

A fireplace scene that shows texture mapping, bump mapping, normal mapping, and an animated video texture.
The brick fireplace is **bump mapped** with a height map, and the wood floor, mantel, and logs are **normal mapped**.
The fire is a looping **video texture**, and a pine-textured wreath (torus), mini trees (cones), and patterned ornaments (spheres) decorate the mantel.
Lighting is per-fragment Phong with two point lights: a movable room light and an orange light at the fire.

**Live demo:** https://dottydot7.github.io/comp-graphics/HW6/

**Controls:** drag to rotate, scroll or `w`/`s` to zoom, arrow keys to move the camera. Use the sliders to change bump and normal-map strength and the lights.
