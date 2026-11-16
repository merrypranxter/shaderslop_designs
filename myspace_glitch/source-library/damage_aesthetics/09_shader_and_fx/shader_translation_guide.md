# SHADER TRANSLATION GUIDEThis file documents how to translate DAMAGE taxonomy into shader and real-time graphics implementations.## DefinitionShader translation is the process of converting damage behavior descriptions into GPU-executable code and parameter systems.## Core translation principles### 1. Behavior over appearanceDon't simulate the look—simulate the mechanism.### 2. Parameterize severityExpose controls that map to S0–S5 or continuous equivalents.### 3. Temporal awarenessVideo damage often requires frame history and feedback.### 4. Medium-appropriate mathDifferent artifacts need different mathematical approaches.## Artifact family translations### Noise family**Approach:** Procedural noise with temporal evolution**Techniques:**- Value/gradient noise for film grain- Simplex noise for organic variation- Blue noise for dithered distribution- Cellular noise for sensor speckle**Parameters:**- Scale (grain size)- Intensity (S-level)- Temporal evolution speed- Luminance response (shadow weighting)**Example GLSL structure:**```glslfloat grain = noise(uv * scale + time * evolution);float shadowMask = smoothstep(0.0, 0.5, luminance);float intensity = baseIntensity * shadowMask;return lerp(color, color + grain, intensity);
Smear/bleed family
Approach: Directional blur with signal-dependent spread
Techniques: - Directional blur for chroma bleed - Diffusion kernels for optical smear - Motion vectors for temporal smear - Anisotropic diffusion for controlled spread
Parameters: - Direction (angle) - Spread distance - Brightness threshold - Color channel separation
Tearing/instability family
Approach: Coordinate displacement with temporal variation
Techniques: - UV displacement for position shift - Sine/noise modulation for jitter - Line-by-line offset for scan tearing - Random displacement for sync loss
Parameters: - Displacement amplitude - Temporal frequency - Spatial frequency (banding) - Random seed variation
Compression family
Approach: Block-based processing with quantization
Techniques: - Grid subdivision for macroblocks - DCT approximation for ringing - Quantization simulation for banding - Motion vector field for prediction errors
Parameters: - Block size - Quantization level - Bitrate proxy (quality threshold) - Keyframe interval
Bloom/glow family
Approach: Brightness-thresholded blur with feedback
Techniques: - Threshold + blur for basic bloom - Multi-scale blur for quality - Temporal accumulation for trails - Spectral response for phosphor simulation
Parameters: - Threshold (what brightness blooms) - Radius (how far it spreads) - Intensity (S-level) - Decay (for temporal trails)
Shader types by damage
Vertex shaders
Geometry failure (warping, curvature)
Large-scale displacement
Perspective manipulation
Fragment/pixel shaders
Color manipulation
Noise and texture
Blur and diffusion
Block-based effects
Compute shaders
Complex feedback systems
Temporal buffer management
Particle-based damage (dust, scratches)
Temporal damage systems
Frame buffers
Store previous frames for: - Ghost frames - Phosphor persistence - Motion trails - Feedback loops
Implementation pattern
// Ping-pong buffer setupuniform sampler2D prevFrame;uniform float persistence;vec3 current = renderCurrent();vec3 previous = texture(prevFrame, uv);vec3 output = mix(current, previous, persistence);
Performance considerations
Expensive operations
Large-kernel blur (use separable)
Per-pixel noise (use precomputed or simplex)
Frame buffer reads (minimize texture samples)
Branching (prefer lerp over if)
Optimization strategies
Downsample for coarse effects
Tile noise textures
Use vertex displacement for large warps
LOD for distance-based effects
Parameter mapping to DAMAGE taxonomy
Taxonomy
Shader Parameter
Severity S0–S5
0.0–1.0 intensity
Medium
Effect selection
Artifact family
Algorithm choice
Cause
Modulation source
Stack
Layer blending
Integration with post-FX
Shaders are one component:
Capture → Shader damage → Post-FX damage → Output   ↑           ↑              ↑ Real      Real-time      Compositing source    manipulation   overlays
Know which damage belongs at which stage.
Summary
Shader translation is building the physics of failure in code—mathematical models of optical, electronic, and mechanical damage running at frame rate.
---**FILE: `DAMAGE/09_shader_and_fx/post_fx_vs_shader_vs_composite.md`**```markdown# POST-FX VS SHADER VS COMPOSITEThis file documents the three primary implementation paths for damage effects and when to use each.## DefinitionThe three implementation paths represent different stages and methods of applying damage:- **Shaders:** Real-time, per-pixel GPU operations- **Post-FX:** Render-time or offline image processing- **Compositing:** Layer-based assembly of elements## Shader implementation### When to use- Real-time applications (games, interactive)- Parameter-driven variability- Performance-critical contexts- Procedural or algorithmic damage### Strengths- Frame-rate performance- Interactive parameter control- Infinite variation from seed- Integrated with rendering### Limitations- Limited to algorithmic effects- Harder to achieve specific "found" textures- Memory constraints for history/temporal- Complexity for sophisticated damage### Best for- Noise, grain, bloom- Geometric distortion- Color manipulation- Procedural patterns---## Post-FX implementation### When to use- Video processing pipelines- Render output modification- Quality-focused offline work- Complex temporal operations### Strengths- Higher quality algorithms- Better temporal processing- Access to future frames (lookahead)- Established tool ecosystems (After Effects, Nuke, etc.)### Limitations- Not real-time (usually)- Less interactive- Render-time cost- Pipeline complexity### Best for- Motion blur and temporal smoothing- High-quality blur and diffusion- Color grading integration- Complex keying and matte operations---## Compositing implementation### When to use- Specific texture overlay- Photographic element integration- Layered damage stacks- Artistic control over placement### Strengths- Specific, controllable elements- Photographic authenticity- Easy placement and masking- Non-destructive layering### Limitations- Static or limited variation- Memory intensive (texture storage)- Less procedural flexibility- Can feel "stuck on" if not integrated### Best for- Dust, scratches, hair- Specific stain and damage elements- Light leaks and flares- Frame overlays and mattes---## Hybrid workflows### Typical integration
3D Render → Shader damage (bloom, noise) → Post-FX (temporal, color) → Compositing (specific dust, scratches) → Final output
### Decision treeIs it real-time?├─ Yes → Shader└─ No → Is it specific or procedural?    ├─ Specific → Compositing    └─ Procedural → Post-FX### Example hybrid: "Damaged film look"1. **Shader:** Real-time grain, gate weave, flicker2. **Post-FX:** Color grading, halation glow, temporal smoothing3. **Composite:** Specific scratches, dust hits, light leak overlays## Parameter coherence across methodsEnsure consistent controls:- Severity 0–1 maps across all methods- Same random seed for reproducibility- Matching color space handling- Coherent temporal behavior## Tool-specific notes### Game engines (Unity/Unreal)- Primarily shader-based- Post-process volumes for grading- Limited compositing (decals, UI overlays)### Video tools (After Effects/Premiere)- Primarily post-FX and compositing- Shader-like effects via GPU plugins- Layer-based damage stacks### Compositing (Nuke/Fusion)- Node-based flexibility- Shader integration possible- Heavy compositing strength### Programming (openFrameworks, Processing, TouchDesigner)- Full shader control- Custom post-FX chains- Flexible compositing## SummaryChoose the right tool for the damage:- Shaders for real-time and procedural- Post-FX for quality and temporal- Compositing for specific and layeredMost sophisticated damage uses all three in concert.