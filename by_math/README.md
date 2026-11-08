# by_math/ — every working shader, sorted by the math behind it

**▶ Start here: open [`index.html`](index.html)** — a thumbnail gallery of all 427 designs, grouped by category, with a search box. Click a tile to run it.

Each design is a **pair** in its category folder:

- `name.html` — self-contained, double-click to open in a browser (sketch is embedded; three.js loads from jsDelivr).
- `name.js` — the raw sketch source (same format RepoScripter produces).

Every category folder also has a `README.md` listing its designs with thumbnails and a one-line "what's inside".

## Categories

| # | Category | Designs | The idea in one breath |
|---|---|---|---|
| [01](01_fractals_escape_time_and_ifs/) | **Fractals: escape-time & IFS** | 32 | Zoom forever, find the same shape. Iterate z → z² + c and color by how fast it runs away (escape-time), or recursively copy-shrink a shape (IFS). |
| [02](02_reaction_diffusion_turing_patterns/) | **Reaction-diffusion & Turing patterns** | 31 | Two chemicals: one makes more of itself, one eats it, and they spread at different speeds. That imbalance self-organizes into leopard spots and fingerprints. |
| [03](03_cellular_automata_lenia_sandpiles/) | **Cellular automata, Lenia & sandpiles** | 23 | Every pixel is a cell that looks at its neighbors and follows a rule. Tiny rules, emergent creatures. Sandpiles: grains pile up until they topple in avalanches. |
| [04](04_agent_systems_slime_mycelium_flocking/) | **Agent systems: slime mold, mycelium, flocking** | 23 | Thousands of dumb little walkers leave trails and follow each other's scent. Together they draw networks that look alive. |
| [05](05_noise_flow_fluid_fields/) | **Noise, flow & fluid fields** | 20 | Smooth random hills stacked at many scales (fBm), then use one noise field to bend the coordinates of another (domain warping) = marble, smoke, liquid. |
| [06](06_tilings_voronoi_weaving/) | **Tilings, Voronoi & weaving** | 15 | Carve the plane into cells (nearest-seed = Voronoi) or interlock repeating tiles and threads. Computational geometry meets the loom. |
| [07](07_quasicrystals_aperiodic_order/) | **Quasicrystals & aperiodic order** | 20 | Ordered but never repeating. Add up waves pointing in 5+ directions and you get a pattern with forbidden symmetry—the math of Penrose tiles. |
| [08](08_waves_interference_moire_cymatics/) | **Waves, interference & moiré** | 23 | Overlay two almost-identical patterns and a third, ghost pattern appears in the mismatch. Same physics as sound beats and vibrating sand plates. |
| [09](09_symmetry_kaleidoscopes_sacred_geometry/) | **Symmetry, kaleidoscopes & sacred geometry** | 12 | Fold space like paper: mirror it N times around a point and anything you draw becomes a mandala. Group theory, but make it stained glass. |
| [10](10_raymarched_3d_sdf_gyroids/) | **Raymarched 3D: SDFs & gyroids** | 27 | Shoot a ray per pixel and step forward by 'how far is the nearest surface?' until you hit something. Gyroids = infinite soap-film sponges. |
| [11](11_hyperbolic_non_euclidean_higher_dimensions/) | **Hyperbolic, non-Euclidean & higher-dimensional** | 23 | Geometry where parallel lines diverge and space has more room than it should—Escher's Circle Limit. Plus shadows of shapes from 4+ dimensions. |
| [12](12_chaos_attractors_time_dynamics/) | **Chaos, attractors & time dynamics** | 12 | Deterministic systems so sensitive they look random, orbiting a 'strange attractor'. Also: pieces that play tricks with time (effects before causes). |
| [13](13_optics_spectral_color_science/) | **Optics, spectra & color science** | 28 | Physics of light: soap-bubble rainbows (thin-film interference), prisms splitting wavelengths, and perceptual color spaces that keep neon from going muddy. |
| [14](14_visual_perception_stereograms_phosphenes/) | **Visual perception: stereograms, phosphenes & illusions** | 23 | Art that hacks the visual system: hidden 3D you cross your eyes for, the shapes you see with eyes closed (mapped the way V1 maps them), illusory contours. |
| [15](15_signal_processing_vhs_crt_glitch/) | **Signal processing & media decay: VHS, CRT, glitch** | 78 | Simulates how analog and digital signals break: tape wobble, sync loss, compression blocks. Signal processing run in reverse for beauty. |
| [16](16_dithering_halftone_print/) | **Dithering, halftone & print** | 11 | Faking many colors with few: arrange dots of limited inks in clever grids (dither, halftone) so your eye blends them. |
| [17](17_typography_text_glyph_systems/) | **Typography, text & glyph systems** | 5 | Letters as material: words with gravity, bubble glyphs, text stamped into fields. |
| [18](18_biomimicry_living_systems/) | **Biomimicry: reefs, colonies & living systems** | 11 | Math borrowed from organisms: golden-angle sunflower spirals, radial radiolarians, glowing coral colonies. |
| [19](19_symbolic_systems_tarot_iching_zodiac/) | **Symbolic systems: tarot, I Ching, zodiac** | 10 | Divination decks are finite combinatorial systems (64 hexagrams = 6 bits). These pieces turn those symbol sets into generative structure. |

## How these were picked & sorted

1. **Collected** all 697 `.js` sketches from `shader_files_2`, `shaderfiles3` and `repo_script_js5_code`.
2. **De-duplicated**: 164 were exact copies (same code, different timestamp/filename), leaving 533 unique sketches. Each unique one appears once here; `catalog.json` lists every original filename it came from.
3. **Tested**: every unique sketch was rendered in headless Chromium (WebGL2) and checked for JS compile errors, GLSL shader compile failures, crashes, and blank canvases. **427 passed** and are here. The 106 that didn't are listed in [`_not_working.md`](_not_working.md) with the reason.
4. **Regenerated the HTML** for each one with the same `convert_js_to_html.py` template the source repos use, so every `.html` is self-contained. (Some older HTML files in the source repos fetched their `.js` from a raw GitHub URL, which breaks when files move.)
5. **Classified** by reading each sketch's code: functions, comments and section headers were scored against the 19 categories (e.g. `grayScott`, `laplacian`, `feed/kill` → reaction-diffusion; `poincare`, `mobius`, `{7,3}` → hyperbolic), with name hints, then hand-checked family by family. Variants of the same design (e.g. 23 versions of `phosphor_reef_engine`) are kept together.

Most of these pieces are maximalist mashups that use 4–6 techniques at once. Each one is filed under its **dominant** math (the engine actually driving the image, not decoration on top). `catalog.json` also lists `runner_up_categories` for each design if you're hunting for, say, every piece that *uses* thin-film interference.

The loose `.html` files at the root of this repo were left exactly where they were.
