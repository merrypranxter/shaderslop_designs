# 16 · Dithering, halftone & print

**What's in here:** Bayer / ordered dithering, halftone dots, Risograph & CMY(K) misregistration, palette quantization.

**The idea in one breath:** Faking many colors with few: arrange dots of limited inks in clever grids (dither, halftone) so your eye blends them.

11 designs. Each is a pair: open the `.html` in any browser (self-contained, no server); the `.js` is the raw sketch source.

| | Design | Renderer | Notes | From |
|---|---|---|---|---|
| <img src="../_thumbs/16_cmy-grain.jpg" width="120"> | [**cmy-grain**](cmy-grain.html) · [js](cmy-grain.js)<br><sub>Mathematical Foundation: 3D Hash &amp; Noise · Medium Scale: Fractal Brownian Motion · The Topology: Mycelial Gyroid Math</sub> | WebGL2 / three.js |  | repo_script_js5_code |
| <img src="../_thumbs/16_cmy-substance_20260709_104234.jpg" width="120"> | [**cmy-substance_20260709_104234**](cmy-substance_20260709_104234.html) · [js](cmy-substance_20260709_104234.js)<br><sub>Hash function for deterministic chaos · Metric Competition: Morphing distance manifold (L0.5 to L2.5) · Guard against pow(0)</sub> | WebGL2 / three.js |  | shaderfiles3<br>shaderfiles3 |
| <img src="../_thumbs/16_cyan_matrix.jpg" width="120"> | [**cyan_matrix**](cyan_matrix.html) · [js](cyan_matrix.js)<br><sub>Hyperbolic manifold projection · XOR-Ghost Manifold: addressable trauma in the matrix · Fluid turbulence</sub> | Canvas 2D |  | repo_script_js5_code |
| <img src="../_thumbs/16_dynamic-art.jpg" width="120"> | [**dynamic-art**](dynamic-art.html) · [js](dynamic-art.js)<br><sub>Bayer 4x4 Dither Matrix (pixel_voxel repo) · Wavelength to RGB Conversion (structural_color repo) · Thin-Film Interference calculation</sub> | WebGL2 / three.js |  | repo_script_js5_code |
| <img src="../_thumbs/16_dynamic-design.jpg" width="120"> | [**dynamic-design**](dynamic-design.html) · [js](dynamic-design.js)<br><sub>Flat array for data locality &amp; performance: [x, y, vx, vy, life, maxLife, ... ] · [REPO GENOME: pixel_voxel] · Generate an offline Bayer 4x4 dither pattern for the &quot;Ditherpunk&quot; overlay</sub> | Canvas 2D |  | repo_script_js5_code |
| <img src="../_thumbs/16_dynamic-git-art.jpg" width="120"> | [**dynamic-git-art**](dynamic-git-art.html) · [js](dynamic-git-art.js)<br><sub>INITIALIZATION · Psychedelic Collage Halftone/Riso Pattern · MATH &amp; PHYSICS</sub> | Canvas 2D |  | repo_script_js5_code |
| <img src="../_thumbs/16_dynamic-interactive.jpg" width="120"> | [**dynamic-interactive**](dynamic-interactive.html) · [js](dynamic-interactive.js)<br><sub>Psychedelic Collage: Displacement Warp (Simplex Noise) · Psychedelic Collage: Kaleidoscope Pattern · Rotational drift</sub> | WebGL2 / three.js |  | repo_script_js5_code |
| <img src="../_thumbs/16_git-art.jpg" width="120"> | [**git-art**](git-art.html) · [js](git-art.js)<br><sub>pxv.technique.bayer_4x4.v1 · Lisa Frank x Voxel Palette · pxv.shader.palette_map_nearest.v1</sub> | WebGL2 / three.js |  | repo_script_js5_code |
| <img src="../_thumbs/16_klein-dither.jpg" width="120"> | [**klein-dither**](klein-dither.html) · [js](klein-dither.js)<br><sub>Complex math for Möbius transformations (from kleinian_groups) · 4x4 Bayer Matrix (from dither repo) · IQ Cosine Palette - Neon Acid (from color_fields)</sub> | WebGL2 / three.js |  | repo_script_js5_code |
| <img src="../_thumbs/16_rainblow-ditherscape.jpg" width="120"> | [**rainblow-ditherscape**](rainblow-ditherscape.html) · [js](rainblow-ditherscape.js)<br><sub>FRACTAL &amp; METRIC COMPETITION LOGIC · DITHER ENGINES · XOR-Ghost Manifold (Bitwise coordinate logic)</sub> | WebGL2 / three.js |  | repo_script_js5_code |
| <img src="../_thumbs/16_RepoFlow.jpg" width="120"> | [**RepoFlow**](RepoFlow.html) · [js](RepoFlow.js)<br><sub>14-Color &quot;Lisa Frank&quot; Acid Palette · Dark Space Purple · Precompute YUV for accurate perceptual color distance</sub> | Canvas 2D |  | repo_script_js5_code |
