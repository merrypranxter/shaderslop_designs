# Not working (excluded from by_math/)

106 unique sketches failed the headless render test. Breakdown:

- **blank canvas** — 38
- **compile error** — 33
- **GLSL shader failed to compile** — 29
- **runtime error** — 6

Notes:
- *Blank canvas* is mostly the old JS5 **ASCII/character-grid** sketches: they `return` text for the JS5 player (`grid.cols/rows`), and the standalone HTML wrapper has no text renderer, so the canvas stays black. They still work inside the JS5 player in `repo_script_js5_code`.
- *Unexpected token 'export'* / *'canvas' has already been declared* = the sketch was written as a module or standalone page, not as a RepoScripter function body.
- *GLSL shader failed to compile* = the fragment shader has a GLSL error; three.js shows nothing.

| Source file(s) | Reason |
|---|---|
| repo_script_js5_code/acid-neon-fractal.js | GLSL shader failed to compile |
| repo_script_js5_code/astral_doctrine.js | blank canvas (flat color, mean=0) |
| repo_script_js5_code/bold-interactive.js | blank canvas (flat color, mean=9) |
| repo_script_js5_code/cthulhu-awakens.js<br>repo_script_js5_code/cthulu-awakens.js | blank canvas (flat color, mean=0) |
| repo_script_js5_code/cthulhu.js | blank canvas (flat color, mean=0) |
| repo_script_js5_code/dmt.js | blank canvas (flat color, mean=0) |
| repo_script_js5_code/do-it-sizes.js | blank canvas (flat color, mean=0) |
| repo_script_js5_code/doit.js | blank canvas (flat color, mean=0) |
| repo_script_js5_code/dynamic-mashup.js | blank canvas (flat color, mean=0) |
| repo_script_js5_code/dynamic-repos.js | blank canvas (flat color, mean=0) |
| repo_script_js5_code/git-interactive.js | runtime error: Cannot set properties of undefined (setting &#x27;NaN&#x27;) |
| repo_script_js5_code/hey_dirk.js | blank canvas (flat color, mean=0) |
| repo_script_js5_code/lv426.js | blank canvas (flat color, mean=0) |
| repo_script_js5_code/mckenna-mushroom.js | blank canvas (flat color, mean=0) |
| repo_script_js5_code/mckenna-nouveau.js | blank canvas (flat color, mean=0) |
| repo_script_js5_code/neon-tentacle.js | blank canvas (flat color, mean=0) |
| repo_script_js5_code/neon_sierpinski_hologram.js | GLSL shader failed to compile |
| repo_script_js5_code/noneuclidean.js | runtime error: ctx.drawImage is not a function |
| repo_script_js5_code/novelty.js | blank canvas (flat color, mean=0) |
| repo_script_js5_code/repo-ascii.js | blank canvas (flat color, mean=0) |
| repo_script_js5_code/repo-design.js | blank canvas (flat color, mean=0) |
| repo_script_js5_code/sierpinski-neon.js | GLSL shader failed to compile |
| repo_script_js5_code/slime-party.js | blank canvas (flat color, mean=0) |
| repo_script_js5_code/thoth-atlantis.js | blank canvas (flat color, mean=0) |
| repo_script_js5_code/timewave.js | blank canvas (flat color, mean=0) |
| repo_script_js5_code/vivid-spectral-shader.js | compile error: Unexpected token &#x27;catch&#x27; |
| shader_files_2/amazing_20260618_105319.js<br>shader_files_2/chromatic_bloom_casket_20260618_105105.js | GLSL shader failed to compile |
| shader_files_2/amazing_20260618_110042.js<br>shader_files_2/amazing_20260618_110217.js | GLSL shader failed to compile |
| shader_files_2/amazing_20260618_111120.js | compile error: Unexpected token &#x27;catch&#x27; |
| shader_files_2/art_20260620_193100.js<br>shader_files_2/art_20260620_194005.js<br>shader_files_2/art_20260620_194228.js<br>shader_files_2/github_20260621_181248.js | compile error: Unexpected token &#x27;}&#x27; |
| shader_files_2/art_20260620_193134.js | compile error: Unexpected token &#x27;}&#x27; |
| shader_files_2/beautiful_20260617_151200.js | compile error: Unexpected token &#x27;export&#x27; |
| shader_files_2/beautiful_20260617_151801.js | blank canvas (flat color, mean=0) |
| shader_files_2/cheaper_20260620_204751.js | compile error: Identifier &#x27;canvas&#x27; has already been declared |
| shader_files_2/chimeric_prism_cathedral_20260625_093138.js | GLSL shader failed to compile |
| shader_files_2/chroma-arcana_20260612_214035.js<br>shader_files_2/chromatic-tarot_20260612_214012.js | compile error: Identifier &#x27;canvas&#x27; has already been declared |
| shader_files_2/chroma-soup_20260701_224031.js | compile error: Unexpected token &#x27;export&#x27; |
| shader_files_2/chromatic-reef-surge_20260624_214223.js | blank canvas (flat color, mean=0) |
| shader_files_2/chromatic-reef-surge_20260624_220151.js | compile error: Identifier &#x27;canvas&#x27; has already been declared |
| shader_files_2/chromatophore_codec_shrine_20260618_184028.js | compile error: Unexpected token &#x27;export&#x27; |
| shader_files_2/colorful-mycelium_20260617_093208.js | blank canvas (flat color, mean=0) |
| shader_files_2/colorful-mycelium_20260617_093516.js | blank canvas (flat color, mean=0) |
| shader_files_2/cool_20260617_161620.js | blank canvas (flat color, mean=0) |
| shader_files_2/cool_20260617_162105.js | runtime error: ctx.fillRect is not a function |
| shader_files_2/holyshitballs_20260614_185526.js | blank canvas (flat color, mean=0) |
| shader_files_2/holyshitballs_20260614_190005.js | GLSL shader failed to compile |
| shader_files_2/hypercolor_damage_carnival_engine_20260619_112354.js | GLSL shader failed to compile |
| shader_files_2/neon_serpent_interference_20260625_131723.js | blank canvas (flat color, mean=0) |
| shader_files_2/optical_riso_20260623_115045.js | compile error: Cannot use import statement outside a module |
| shader_files_2/phosphene_field_20260629_195254.js | GLSL shader failed to compile |
| shader_files_2/phosphor_reef_engine_20260620_175410.js | compile error: Unexpected token &#x27;export&#x27; |
| shader_files_2/phosphor_reef_engine_20260620_214408.js<br>shader_files_2/phosphor_reef_engine_20260620_214732.js | GLSL shader failed to compile |
| shader_files_2/phosphor_reef_engine_20260620_215539.js<br>shader_files_2/phosphor_signal_reef_20260620_214938.js<br>shader_files_2/phosphor_signal_reef_engine_20260620_215924.js | compile error: Identifier &#x27;canvas&#x27; has already been declared |
| shader_files_2/phosphor_reef_engine_20260620_230214.js<br>shader_files_2/phosphor_signal_reef_engine_20260620_230527.js | compile error: Unexpected token &#x27;:&#x27; |
| shader_files_2/phosphor_reef_engine_20260621_172827.js | GLSL shader failed to compile |
| shader_files_2/phosphor_signal_reef_20260620_203403.js | blank canvas (flat color, mean=0) |
| shader_files_2/phosphor_signal_reef_20260620_213313.js | compile error: Unexpected token &#x27;:&#x27; |
| shader_files_2/phosphor_signal_reef_20260621_180626.js | GLSL shader failed to compile |
| shader_files_2/phosphor_signal_reef_engine_20260621_132142.js | blank canvas (flat color, mean=0) |
| shader_files_2/prismatic-mycelium_20260622_190339.js | compile error: Unexpected token &#x27;export&#x27; |
| shader_files_2/prismatic-sigil-glass_20260624_012130.js | compile error: Unexpected token &#x27;export&#x27; |
| shader_files_2/prismatic-sigil-glass_20260624_012927.js | GLSL shader failed to compile |
| shader_files_2/prismatic_scale_matrix_20260625_145616.js | blank canvas (flat color, mean=0) |
| shader_files_2/prismatic_scale_matrix_20260625_154231.js | compile error: Identifier &#x27;canvas&#x27; has already been declared |
| shader_files_2/prismatic_tape_oracle_20260618_200138.js | blank canvas (flat color, mean=0) |
| shader_files_2/prismatic_tape_oracle_20260619_204248.js | compile error: Unexpected token &#x27;export&#x27; |
| shader_files_2/prismatic_tape_oracle_20260619_210824.js | GLSL shader failed to compile |
| shader_files_2/psychedelic-sirds_20260621_190719.js<br>shader_files_2/psychedelic_sirds_20260621_190751.js | compile error: Function statements require a function name |
| shader_files_2/psychedelic_sirds_20260622_215321.js | GLSL shader failed to compile |
| shader_files_2/qolorful_zodiac_engine_20260627_194031.js | compile error: Unexpected token &#x27;export&#x27; |
| shader_files_2/radshit_20260619_121547.js | blank canvas (flat color, mean=0) |
| shader_files_2/rainblown-rainbow_20260617_145822.js | blank canvas (flat color, mean=0) |
| shader_files_2/repo-chroma-soup_20260701_222310.js | GLSL shader failed to compile |
| shader_files_2/repo-chroma-soup_20260701_224626.js | compile error: Function statements require a function name |
| shader_files_2/repo-chroma-soup_20260701_224848.js | compile error: Unexpected token &#x27;export&#x27; |
| shader_files_2/retro-morphogenesis_20260618_094806.js | GLSL shader failed to compile |
| shader_files_2/signal_alchemy_engine_20260619_104027.js | GLSL shader failed to compile |
| shader_files_2/spectral-lattice_20260622_104842.js | GLSL shader failed to compile |
| shader_files_2/spectral_candy_avalanche_20260624_113216.js | compile error: Unexpected token &#x27;export&#x27; |
| shader_files_2/spectral_candy_avalanche_garden_20260624_104236.js<br>shader_files_2/spectral_candy_garden_20260624_104422.js | GLSL shader failed to compile |
| shader_files_2/spectral_candy_avalanche_garden_20260624_134843.js | blank canvas (flat color, mean=0) |
| shader_files_2/spectral_candy_garden_20260624_103552.js | runtime error: gl.viewport is not a function |
| shader_files_2/spectral_candy_garden_20260624_104747.js | GLSL shader failed to compile |
| shader_files_2/spectral_candy_garden_20260624_115424.js | blank canvas (flat color, mean=0) |
| shader_files_2/spectral_candy_garden_20260624_182832.js | blank canvas (flat color, mean=0) |
| shader_files_2/spectral_candy_garden_20260625_175003.js | GLSL shader failed to compile |
| shader_files_2/spectral_candy_garden_20260625_180425.js | compile error: Unexpected token &#x27;export&#x27; |
| shader_files_2/spectral_collapse_20260630_113208.js | GLSL shader failed to compile |
| shader_files_2/THISWEIRDGREENONEHERE_20260630_143757.js<br>shader_files_2/THISWEIRDGREENONEHERE_20260630_143759.js<br>shader_files_2/spectrum-happened_20260630_143214.js<br>shader_files_2/spectrum_already_happened_20260630_142732.js<br>shader_files_2/spectrum_already_happened_20260630_143556.js | GLSL shader failed to compile |
| shaderfiles3/computational-soup_20260702_235404.js | compile error: Unexpected token &#x27;export&#x27; |
| shaderfiles3/computational-soup_20260704_193435.js<br>shaderfiles3/computational_soup_20260704_193544.js | blank canvas (flat color, mean=0) |
| shaderfiles3/computational_soup_20260704_202406.js | compile error: Unexpected token &#x27;export&#x27; |
| shaderfiles3/dmt-breakthrough_20260816_205704.js | compile error: Unexpected token &#x27;export&#x27; |
| shaderfiles3/dmt_breakthrough_20260816_204527.js | GLSL shader failed to compile |
| shaderfiles3/geocities_cathedral_20260709_213502.js<br>shaderfiles3/geocities_cathedral_20260709_213510.js | GLSL shader failed to compile |
| shaderfiles3/gorgeous_20260705_165543.js | blank canvas (flat color, mean=0) |
| shaderfiles3/jewel_phosphenes_20260705_162313.js | compile error: Function statements require a function name |
| shaderfiles3/morphogenetic-attractor_20260809_090552.js | runtime error: repos is not defined |
| shaderfiles3/neon-trash-oracle_20260709_134234.js | GLSL shader failed to compile |
| shaderfiles3/neon_trash_oracle_20260709_212210.js | compile error: Unexpected token &#x27;export&#x27; |
| shaderfiles3/neon_trash_oracle_20260715_154017.js | GLSL shader failed to compile |
| shaderfiles3/neon_trash_oracle_20260725_232816.js | compile error: Unexpected token &#x27;export&#x27; |
| shaderfiles3/repo-chroma-soup_20260702_234607.js | compile error: Unexpected token &#x27;export&#x27; |
| shaderfiles3/repo-chroma-soup_20260704_065310.js | compile error: Unexpected token &#x27;export&#x27; |
| shaderfiles3/repo-chroma-soup_20260704_071701.js | GLSL shader failed to compile |
| shaderfiles3/retrocausal_blast_20260705_094334.js | runtime error: quad.clone(...).setMaterial is not a function |
