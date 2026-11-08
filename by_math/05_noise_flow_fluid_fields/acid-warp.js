const W = 350;
const H = Math.floor(350 * (grid.height / grid.width));

if (!canvas.__weaveBuffer || canvas.__weaveBuffer.height !== H) {
    canvas.__weaveBuffer = document.createElement('canvas');
    canvas.__weaveBuffer.width = W;
    canvas.__weaveBuffer.height = H;
    canvas.__weaveCtx = canvas.__weaveBuffer.getContext('2d', { willReadFrequently: true });
    canvas.__imgData = canvas.__weaveCtx.createImageData(W, H);
}

const wCtx = canvas.__weaveCtx;
const imgData = canvas.__imgData;
const data = imgData.data;

const sqrt = Math.sqrt;
const atan2 = Math.atan2;
const cos = Math.cos;
const sin = Math.sin;
const abs = Math.abs;
const floor = Math.floor;
const log = Math.log;
const random = Math.random;

const aspect = W / H;
let idx = 0;

const p1x = cos(time * 0.7) * 0.6;
const p1y = sin(time * 0.5) * 0.6;
const p2x = cos(time * 0.3 + 2.0) * 0.6;
const p2y = sin(time * 0.9 + 1.0) * 0.6;

for (let y = 0; y < H; y++) {
    let dy = (y / H) * 2.0 - 1.0;
    
    for (let x = 0; x < W; x++) {
        let dx = (x / W) * 2.0 - 1.0;
        dx *= aspect;

        let d1x = dx - p1x, d1y = dy - p1y;
        let d2x = dx - p2x, d2y = dy - p2y;

        let cx = d1x * d2x - d1y * d2y;
        let cy = d1x * d2y + d1y * d2x;

        let r = sqrt(cx * cx + cy * cy);
        let a = atan2(cy, cx);

        let log_r = log(r + 0.001);
        let spiral_a = a + log_r * 0.4; 

        let tx = log_r * 14.0 - time * 4.0;
        let ty = spiral_a * 14.0 / Math.PI;

        let tension = sin(tx * 2.0) * sin(ty * 2.0);
        tx += tension * 0.2;
        ty += tension * 0.2;

        let ix = floor(tx);
        let iy = floor(ty);
        let fx = tx - ix;
        let fy = ty - iy;

        let jx = abs(ix);
        let jy = abs(iy);

        let block = ((jx >> 2) ^ (jy >> 2)) & 1;
        let thread_thickness = block ? 0.45 : 0.20;

        let pattern = (jx ^ jy) % 3 === 0 || (jx & jy) % 5 === 0;
        let warp_on_top = pattern;

        let dist_x = abs(fx - 0.5);
        let dist_y = abs(fy - 0.5);

        let is_warp = dist_x < thread_thickness;
        let is_weft = dist_y < thread_thickness;

        let r_col = 0.02, g_col = 0.0, b_col = 0.06;

        if (is_warp || is_weft) {
            let warp_z = is_warp ? sqrt(thread_thickness * thread_thickness - dist_x * dist_x) / thread_thickness : 0;
            let weft_z = is_weft ? sqrt(thread_thickness * thread_thickness - dist_y * dist_y) / thread_thickness : 0;

            let vis = 0;
            let z = 0;
            
            if (warp_on_top) {
                if (is_warp) { vis = 1; z = warp_z; }
                else { vis = 2; z = weft_z * 0.35; }
            } else {
                if (is_weft) { vis = 2; z = weft_z; }
                else { vis = 1; z = warp_z * 0.35; }
            }

            let c_idx = vis === 1 ? (log_r * 0.4 + time * 0.25) : (a * 0.6 - time * 0.15);

            let pr = 0.5 + 0.5 * cos(6.283 * (2.0 * c_idx + 0.5));
            let pg = 0.5 + 0.5 * cos(6.283 * (1.0 * c_idx + 0.2));
            let pb = 0.5 + 0.33 * cos(6.283 * (1.0 * c_idx + 0.25));

            let twist = vis === 1 ? fy : fx;
            let ply = sin(twist * 45.0 + z * 8.0) * 0.15;
            let fuzz = (random() - 0.5) * 0.25;

            let light = z + ply + fuzz;
            light = light * light * 1.4;

            r_col = pr * light;
            g_col = pg * light;
            b_col = pb * light;
        }

        if ((jx * jy) % 127 === 0) {
            r_col = 1.0 - r_col;
            g_col = 1.0 - g_col;
            b_col = 1.0;
        }

        data[idx++] = r_col * 255;
        data[idx++] = g_col * 255;
        data[idx++] = b_col * 255;
        data[idx++] = 255;
    }
}

wCtx.putImageData(imgData, 0, 0);

ctx.imageSmoothingEnabled = false;
ctx.drawImage(canvas.__weaveBuffer, 0, 0, grid.width, grid.height);