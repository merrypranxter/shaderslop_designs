# Shader Preset Bundles

Pre-configured shader combinations for each glitchcore subtype.

## Purpose

This file provides ready-to-use shader preset bundles for each glitchcore subtype.

Each bundle includes:
- Shader family assignments
- Pass order
- Default parameters
- Audio-reactive mappings
- Performance notes

---

## 1. Shader Bundle Structure

### 1.1 Bundle Format

```json
{
  "bundle_id": "string",
  "subtype_alignment": "string",
  "lead_shader_family": "string",
  "support_shader_families": ["string"],
  "optional_trace_families": ["string"],
  "default_pass_order": ["string"],
  "default_parameters": {},
  "audio_mode": "string",
  "audio_mapping": {},
  "performance_tier": "string",
  "notes": "string"
}
```

---

## 2. Subtype Shader Bundles

### 2.1 Candy Broadcast Hallucination

**Bundle ID:** `shader_preset_candy_broadcast`

**Configuration:**
```json
{
  "bundle_id": "shader_preset_candy_broadcast",
  "subtype_alignment": "candy_broadcast_hallucination",
  "lead_shader_family": "channel_displacement",
  "support_shader_families": [
    "bloom_halation",
    "overprint_layers",
    "color_collision"
  ],
  "optional_trace_families": [
    "temporal_feedback_light",
    "sparkle_static"
  ],
  "default_pass_order": [
    "source_input",
    "rgb_displacement",
    "overprint_duplicate_pass",
    "bloom_pass",
    "palette_collision_pass",
    "sparkle_trace_pass",
    "anchor_restore_composite"
  ],
  "default_parameters": {
    "rgb_offset_strength": 0.7,
    "edge_bias": 0.8,
    "overprint_layers": 3,
    "overprint_opacity_falloff": 0.5,
    "bloom_threshold": 0.6,
    "bloom_radius": 0.15,
    "sparkle_density": 0.4
  },
  "audio_mode": "spectrum_reactive",
  "audio_mapping": {
    "bass": "widen_rgb_offset",
    "low_mids": "increase_duplicate_spacing",
    "high_mids": "enhance_edge_chatter",
    "highs": "increase_sparkle_density",
    "transients": "channel_snap_jump"
  },
  "performance_tier": "medium",
  "notes": "Classic hyperpop bright corruption. RGB split leads with bloom and overprint support."
}
```

---

### 2.2 Pastel Identity Smear

**Bundle ID:** `shader_preset_pastel_smear`

**Configuration:**
```json
{
  "bundle_id": "shader_preset_pastel_smear",
  "subtype_alignment": "pastel_identity_smear",
  "lead_shader_family": "overprint_layers",
  "support_shader_families": [
    "soft_channel_displacement",
    "bloom_halation"
  ],
  "optional_trace_families": [
    "temporal_feedback_light"
  ],
  "default_pass_order": [
    "source_input",
    "soft_rgb_displacement",
    "overprint_duplicate_pass",
    "creamy_bloom_pass",
    "palette_softening_pass",
    "anchor_restore_composite"
  ],
  "default_parameters": {
    "rgb_offset_strength": 0.3,
    "edge_bias": 0.4,
    "overprint_layers": 4,
    "overprint_opacity_falloff": 0.6,
    "overprint_blur": 0.2,
    "bloom_threshold": 0.5,
    "bloom_radius": 0.25,
    "bloom_softness": 0.8
  },
  "audio_mode": "trail_reactive",
  "audio_mapping": {
    "pads": "increase_overprint_persistence",
    "low_mids": "soft_echo_trail",
    "amplitude": "bloom_intensity"
  },
  "performance_tier": "low",
  "notes": "Soft dreamy corruption. Overprint leads with gentle bloom and soft split."
}
```

---

### 2.3 RGB Phantom

**Bundle ID:** `shader_preset_rgb_phantom`

**Configuration:**
```json
{
  "bundle_id": "shader_preset_rgb_phantom",
  "subtype_alignment": "rgb_phantom",
  "lead_shader_family": "channel_displacement",
  "support_shader_families": [
    "phase_lag_duplication",
    "edge_emphasis"
  ],
  "optional_trace_families": [
    "soft_bloom"
  ],
  "default_pass_order": [
    "source_input",
    "wide_rgb_displacement",
    "phase_lag_pass",
    "edge_emphasis_pass",
    "soft_bloom_pass",
    "anchor_restore_composite"
  ],
  "default_parameters": {
    "rgb_offset_strength": 0.8,
    "edge_bias": 0.9,
    "phase_lag_amount": 0.5,
    "edge_chatter": 0.7,
    "bloom_strength": 0.3
  },
  "audio_mode": "spectrum_reactive",
  "audio_mapping": {
    "bass": "widen_rgb_offset",
    "low_mids": "increase_phase_lag",
    "high_mids": "enhance_edge_chatter",
    "highs": "fringe_flicker",
    "transients": "channel_snap_jump"
  },
  "performance_tier": "medium",
  "notes": "Electric chromatic separation. Wide RGB split with phase lag and edge emphasis."
}
```

---

### 2.4 Ghost-Frame Body

**Bundle ID:** `shader_preset_ghost_frame`

**Configuration:**
```json
{
  "bundle_id": "shader_preset_ghost_frame",
  "subtype_alignment": "ghost_frame_body",
  "lead_shader_family": "temporal_feedback",
  "support_shader_families": [
    "multi_exposure_stack",
    "bloom_trail_haze"
  ],
  "optional_trace_families": [
    "soft_channel_displacement"
  ],
  "default_pass_order": [
    "source_input",
    "history_buffer_update",
    "temporal_echo_stack",
    "multi_exposure_blend",
    "trail_bloom_pass",
    "anchor_restore_composite"
  ],
  "default_parameters": {
    "echo_count": 5,
    "echo_fade_curve": "exponential",
    "present_frame_weight": 1.0,
    "echo_1_weight": 0.5,
    "echo_2_weight": 0.3,
    "echo_3_weight": 0.15,
    "trail_bloom": 0.4,
    "motion_direction_bias": 0.8
  },
  "audio_mode": "trail_reactive",
  "audio_mapping": {
    "beat": "reinforce_present_frame",
    "low_mids": "increase_echo_count",
    "pads": "increase_trail_persistence",
    "transients": "add_stutter_copy",
    "amplitude": "increase_trail_brightness"
  },
  "performance_tier": "high",
  "notes": "Motion trails and temporal echo. Requires history buffer. High GPU memory."
}
```

---

### 2.5 Text-Screen Heartbreak

**Bundle ID:** `shader_preset_text_screen`

**Configuration:**
```json
{
  "bundle_id": "shader_preset_text_screen",
  "subtype_alignment": "text_screen_heartbreak",
  "lead_shader_family": "text_debris",
  "support_shader_families": [
    "subtitle_ghosting",
    "compression_damage",
    "overprint_layers"
  ],
  "optional_trace_families": [
    "bloom_halation"
  ],
  "default_pass_order": [
    "source_input",
    "text_fragment_generation",
    "subtitle_ghost_pass",
    "compression_haze_pass",
    "overprint_soft_pass",
    "text_blend_composite",
    "anchor_restore_composite"
  ],
  "default_parameters": {
    "text_density": 0.5,
    "text_legibility": 0.4,
    "text_overlap_bias": 0.7,
    "subtitle_layers": 3,
    "compression_strength": 0.3,
    "bloom_softness": 0.5
  },
  "audio_mode": "semantic_reactive",
  "audio_mapping": {
    "speech_presence": "emit_phrase_fragments",
    "emotional_peaks": "increase_face_text_overlap",
    "silence": "linger_ghost_text",
    "amplitude": "adjust_phrase_density",
    "high_mids": "increase_text_clarity"
  },
  "performance_tier": "medium",
  "notes": "Text as emotional debris. Requires font rendering system."
}
```

---

### 2.6 CRT Contour

**Bundle ID:** `shader_preset_crt_contour`

**Configuration:**
```json
{
  "bundle_id": "shader_preset_crt_contour",
  "subtype_alignment": "crt_contour",
  "lead_shader_family": "scanline_raster",
  "support_shader_families": [
    "phosphor_bloom",
    "noise_texture"
  ],
  "optional_trace_families": [
    "subtle_capture_degradation"
  ],
  "default_pass_order": [
    "source_input",
    "contour_detection",
    "scanline_banding_pass",
    "phosphor_bloom_pass",
    "static_veil_pass",
    "anchor_restore_composite"
  ],
  "default_parameters": {
    "scanline_spacing": 4,
    "contour_following": 0.8,
    "phosphor_glow": 0.6,
    "static_amount": 0.15,
    "screen_curvature": 0.1
  },
  "audio_mode": "pulse_reactive",
  "audio_mapping": {
    "bass": "contour_thickness",
    "highs": "scanline_shimmer",
    "sustained_tones": "halo_build",
    "transients": "row_jitter",
    "vocals": "face_contour_emphasis"
  },
  "performance_tier": "low",
  "notes": "Striped signal anatomy. Scanlines follow contours. Retro-futuristic."
}
```

---

### 2.7 Candy-Crash Compression

**Bundle ID:** `shader_preset_candy_crash`

**Configuration:**
```json
{
  "bundle_id": "shader_preset_candy_crash",
  "subtype_alignment": "candy_crash_compression",
  "lead_shader_family": "compression_damage",
  "support_shader_families": [
    "macroblock_artifacts",
    "chroma_smear",
    "quantization_banding"
  ],
  "optional_trace_families": [
    "text_debris_light"
  ],
  "default_pass_order": [
    "source_input",
    "block_quantization_pass",
    "chroma_smear_pass",
    "macroblock_breakup_pass",
    "edge_buzz_pass",
    "anchor_restore_composite"
  ],
  "default_parameters": {
    "block_size": 16,
    "quality": 0.4,
    "chroma_bleed": 0.6,
    "edge_buzz": 0.5,
    "quantization_steps": 8
  },
  "audio_mode": "compression_reactive",
  "audio_mapping": {
    "bass": "increase_block_size",
    "transients": "packet_loss_puncture",
    "high_mids": "edge_buzz_and_chroma_damage",
    "vocals": "face_zone_smear",
    "amplitude": "global_compression_pressure"
  },
  "performance_tier": "medium",
  "notes": "Digital file damage. Macroblocks, chroma bleed, quantization."
}
```

---

### 2.8 Surveillance Apparition

**Bundle ID:** `shader_preset_surveillance`

**Configuration:**
```json
{
  "bundle_id": "shader_preset_surveillance",
  "subtype_alignment": "surveillance_apparition",
  "lead_shader_family": "capture_degradation",
  "support_shader_families": [
    "noise_texture",
    "pixel_matrix"
  ],
  "optional_trace_families": [
    "weak_interface_debris"
  ],
  "default_pass_order": [
    "source_input",
    "noise_generation_pass",
    "feed_degradation_pass",
    "pixel_matrix_pass",
    "weak_signal_composite",
    "anchor_restore_composite"
  ],
  "default_parameters": {
    "noise_intensity": 0.4,
    "feed_weakness": 0.5,
    "pixel_visibility": 0.3,
    "glitch_frequency": 0.1,
    "roll_speed": 0.02
  },
  "audio_mode": "tear_reactive_subtle",
  "audio_mapping": {
    "low_bass": "feed_roll",
    "highs": "hiss_static",
    "transients": "glitch_flash",
    "speech": "monitor_focus_shift",
    "silence": "weak_feed_stillness"
  },
  "performance_tier": "low",
  "notes": "Weak surveillance feed. Institutional coldness. Minimal, eerie."
}
```

---

### 2.9 Glitter-Signal Overprint

**Bundle ID:** `shader_preset_glitter_signal`

**Configuration:**
```json
{
  "bundle_id": "shader_preset_glitter_signal",
  "subtype_alignment": "glitter_signal_overprint",
  "lead_shader_family": "overprint_layers",
  "support_shader_families": [
    "bloom_halation",
    "sparkle_static",
    "soft_channel_displacement"
  ],
  "optional_trace_families": [],
  "default_pass_order": [
    "source_input",
    "overprint_duplicate_pass",
    "bloom_contamination_pass",
    "sparkle_generation_pass",
    "soft_rgb_displacement",
    "anchor_restore_composite"
  ],
  "default_parameters": {
    "overprint_layers": 4,
    "overprint_opacity_falloff": 0.5,
    "bloom_threshold": 0.5,
    "bloom_radius": 0.2,
    "sparkle_density": 0.6,
    "sparkle_size_range": [0.5, 2.0],
    "rgb_offset_strength": 0.3
  },
  "audio_mode": "pulse_reactive",
  "audio_mapping": {
    "highs": "sparkle_density",
    "vocals": "gloss_bloom",
    "bass": "duplicate_drift",
    "chorus": "overprint_expansion",
    "sustained_harmonics": "halo_growth"
  },
  "performance_tier": "medium",
  "notes": "Glamorous overprint with sparkle and bloom. Diva energy."
}
```

---

### 2.10 Composite Fever Dream

**Bundle ID:** `shader_preset_composite_fever`

**Configuration:**
```json
{
  "bundle_id": "shader_preset_composite_fever",
  "subtype_alignment": "composite_fever_dream",
  "lead_shader_family": "overprint_layers",
  "support_shader_families": [
    "channel_displacement",
    "bloom_halation",
    "compression_damage",
    "text_debris",
    "temporal_feedback"
  ],
  "optional_trace_families": [
    "sparkle_static",
    "noise_texture"
  ],
  "default_pass_order": [
    "source_input",
    "overprint_base_pass",
    "rgb_displacement_pass",
    "bloom_layer_pass",
    "compression_trace_pass",
    "text_debris_pass",
    "temporal_haze_pass",
    "sparkle_noise_pass",
    "controlled_pileup_composite",
    "anchor_restore_composite"
  ],
  "default_parameters": {
    "overprint_layers": 3,
    "rgb_offset_strength": 0.5,
    "bloom_strength": 0.6,
    "compression_strength": 0.4,
    "text_density": 0.3,
    "temporal_echo_light": 0.2,
    "sparkle_density": 0.4,
    "controlled_chaos": true
  },
  "audio_mode": "spectrum_reactive",
  "audio_mapping": {
    "bass": "widen_structural_distortion",
    "low_mids": "increase_duplicate_spacing",
    "high_mids": "edge_activity_and_face_glow",
    "highs": "sparkle_static_and_fringe_chatter",
    "transients": "rupture_pops",
    "vocals": "mouth_and_face_emphasis"
  },
  "performance_tier": "very_high",
  "notes": "Maximum layers. All systems active. Requires powerful GPU."
}
```

---

## 3. Performance Tiers

| Tier | Description | Target Hardware |
|------|-------------|-----------------|
| Low | Simple shaders, few passes | Mobile, integrated graphics |
| Medium | Moderate complexity | Mid-range desktop/laptop |
| High | Complex, history buffers | High-end desktop |
| Very High | Maximum everything | Enthusiast/Pro GPUs |

---

## 4. Summary

Shader preset bundles provide:
- Pre-configured shader combinations
- Pass ordering
- Default parameters
- Audio mappings
- Performance guidance

Use these as starting points for implementation.

---

## 5. Short Anchor Rule

Start with a preset, then tune for your hardware and vision.
