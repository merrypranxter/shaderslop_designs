const C = {
    add: (a, b) => ({ re: a.re + b.re, im: a.im + b.im }),
    sub: (a, b) => ({ re: a.re - b.re, im: a.im - b.im }),
    mul: (a, b) => ({ re: a.re * b.re - a.im * b.im, im: a.re * b.im + a.im * b.re }),
    div: (a, b) => {
        let d = b.re * b.re + b.im * b.im;
        return { re: (a.re * b.re + a.im * b.im) / d, im: (a.im * b.re - a.re * b.im) / d };
    },
    conj: (a) => ({ re: a.re, im: -a.im }),
    abs: (a) => Math.sqrt(a.re * a.re + a.im * a.im)
};

function mobius(z, p) {
    let num = C.add(z, p);
    let den = C.add({ re: 1, im: 0 }, C.mul(C.conj(p), z));
    return C.div(num, den);
}

function hash(x, y) {
    let dot = x * 127.1 + y * 311.7;
    return (Math.sin(dot) * 43758.5453123) % 1;
}

function noise(x, y) {
    let ix = Math.floor(x), iy = Math.floor(y);
    let fx = x - ix, fy = y - iy;
    let u = fx * fx * (3 - 2 * fx);
    let v = fy * fy * (3 - 2 * fy);
    let a = hash(ix, iy);
    let b = hash(ix + 1, iy);
    let c = hash(ix, iy + 1);
    let d = hash(ix + 1, iy + 1);
    return a + u * (b - a) + v * (c - a + u * (a - b - c + d));
}

function fbm(x, y, t) {
    let v = 0, amp = 0.5, freq = 1.0;
    for (let i = 0; i < 4; i++) {
        v += amp * noise(x * freq + t, y * freq - t);
        freq *= 2.0;
        amp *= 0.5;
    }
    return v;
}

function palette(t, sides) {
    let r, g, b;
    if (sides === 6) {
        r = 0.5 + 0.5 * Math.cos(2 * Math.PI * (1.0 * t + 0.0));
        g = 0.5 + 0.5 * Math.cos(2 * Math.PI * (0.9 * t + 0.25));
        b = 0.5 + 0.5 * Math.cos(2 * Math.PI * (0.8 * t + 0.5));
    } else {
        r = 0.5 + 0.5 * Math.cos(2 * Math.PI * (0.8 * t + 0.2));
        g = 0.5 + 0.5 * Math.cos(2 * Math.PI * (1.0 * t + 0.8));
        b = 0.5 + 0.5 * Math.cos(2 * Math.PI * (0.0 * t + 0.1));
    }
    return `rgb(${r * 255},${g * 255},${b * 255})`;
}

function drawGeodesic(ctx, A, B, steps) {
    let num = C.sub(B, A);
    let den = C.sub({ re: 1, im: 0 }, C.mul(C.conj(A), B));
    let B_prime = C.div(num, den);

    ctx.moveTo(A.re, A.im);
    for (let i = 1; i <= steps; i++) {
        let t = i / steps;
        let w = { re: B_prime.re * t, im: B_prime.im * t };
        let pt_num = C.add(w, A);
        let pt_den = C.add({ re: 1, im: 0 }, C.mul(C.conj(A), w));
        let pt = C.div(pt_num, pt_den);
        ctx.lineTo(pt.re, pt.im);
    }
}

if (!canvas.__feral_crystal) {
    let edges = [];
    let crystals = [];
    let MAX_DEPTH = 5;
    let L = 0.75;

    function buildTree(z, dir_angle, depth) {
        if (depth === 0) return;

        let num_branches = (depth === MAX_DEPTH) ? 6 : 3;
        let angles = [];
        if (num_branches === 6) {
            for (let i = 0; i < 6; i++) angles.push(i * Math.PI / 3);
        } else {
            let r_val = Math.random();
            if (r_val < 0.05) angles = [-Math.PI / 2, Math.PI / 2]; 
            else if (r_val < 0.2) angles = [-Math.PI / 4, Math.PI / 4]; 
            else if (r_val < 0.3) angles = [0]; 
            else angles = [-Math.PI / 3, 0, Math.PI / 3]; 
        }

        for (let a of angles) {
            let angle = dir_angle + a;
            let L_mut = L * (0.8 + 0.4 * Math.random());
            let r_mut = Math.tanh(L_mut / 2);
            let child_local = { re: r_mut * Math.cos(angle), im: r_mut * Math.sin(angle) };

            let child_global = mobius(child_local, z);
            edges.push({ a: z, b: child_global });

            let hex_r_mut = Math.tanh((0.15 + 0.1 * Math.random()) / 2);
            let hex_pts = [];
            let sides = Math.random() < 0.15 ? 4 : 6; 
            for (let i = 0; i < sides; i++) {
                let ha = i * Math.PI * 2 / sides + angle;
                let hw = { re: hex_r_mut * Math.cos(ha), im: hex_r_mut * Math.sin(ha) };
                hex_pts.push(mobius(hw, child_global));
            }
            crystals.push({ center: child_global, vertices: hex_pts, sides: sides });

            buildTree(child_global, angle, depth - 1);
        }
    }

    let root = { re: 0, im: 0 };
    let hex_r = Math.tanh(0.2 / 2);
    let hex_pts = [];
    for (let i = 0; i < 6; i++) {
        let ha = i * Math.PI / 3;
        hex_pts.push({ re: hex_r * Math.cos(ha), im: hex_r * Math.sin(ha) });
    }
    crystals.push({ center: root, vertices: hex_pts, sides: 6 });

    buildTree(root, 0, MAX_DEPTH);

    canvas.__feral_crystal = {
        edges: edges,
        crystals: crystals,
        current_a: { re: 0, im: 0 }
    };
}

let state = canvas.__feral_crystal;

ctx.fillStyle = '#020203';
ctx.fillRect(0, 0, grid.width, grid.height);

let cx = grid.width / 2;
let cy = grid.height / 2;
let scale = Math.min(cx, cy) * 0.95;

let target_a = { re: 0, im: 0 };
if (mouse.isPressed) {
    let mx = (mouse.x - cx) / scale;
    let my = -(mouse.y - cy) / scale;
    let mr = Math.sqrt(mx * mx + my * my);
    if (mr < 0.95) {
        target_a = { re: mx, im: my };
    } else {
        target_a = { re: mx * 0.95 / mr, im: my * 0.95 / mr };
    }
} else {
    target_a = {
        re: 0.65 * Math.cos(time * 0.15 + fbm(time * 0.1, 0, 0)),
        im: 0.65 * Math.sin(time * 0.22 + fbm(0, time * 0.1, 0))
    };
}

state.current_a.re += (target_a.re - state.current_a.re) * 0.08;
state.current_a.im += (target_a.im - state.current_a.im) * 0.08;
let a = state.current_a;

ctx.save();
ctx.translate(cx, cy);
ctx.scale(scale, -scale); 

ctx.beginPath();
ctx.arc(0, 0, 1, 0, Math.PI * 2);
let grad = ctx.createRadialGradient(0, 0, 0.5, 0, 0, 1);
grad.addColorStop(0, '#0a0b10');
grad.addColorStop(1, '#000000');
ctx.fillStyle = grad;
ctx.fill();
ctx.lineWidth = 2.0 / scale;
ctx.strokeStyle = 'rgba(100, 150, 255, 0.2)';
ctx.stroke();

ctx.lineWidth = 1.5 / scale;
ctx.strokeStyle = 'rgba(120, 180, 255, 0.4)';
ctx.lineCap = 'round';
ctx.lineJoin = 'round';

ctx.beginPath();
for (let edge of state.edges) {
    let A = mobius(edge.a, a);
    let B = mobius(edge.b, a);
    if (C.abs(A) < 0.99 && C.abs(B) < 0.99) {
        drawGeodesic(ctx, A, B, 12);
    }
}
ctx.stroke();

for (let crystal of state.crystals) {
    let C_anim = mobius(crystal.center, a);
    let dist = C.abs(C_anim);
    
    if (dist > 0.98) continue;

    let V_anim = crystal.vertices.map(v => mobius(v, a));
    let stress = dist * 5.0 + fbm(C_anim.re * 3, C_anim.im * 3, time * 0.4);
    let alpha = Math.max(0, 1.0 - Math.pow(dist, 4));

    ctx.globalAlpha = alpha;
    ctx.lineWidth = 0.8 / scale;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';

    for (let i = 0; i < crystal.sides; i++) {
        let v1 = V_anim[i];
        let v2 = V_anim[(i + 1) % crystal.sides];

        let facet_t = stress + i * 0.08 - time * 0.15;
        ctx.fillStyle = palette(facet_t, crystal.sides);

        ctx.beginPath();
        ctx.moveTo(C_anim.re, C_anim.im);
        ctx.lineTo(v1.re, v1.im);
        ctx.lineTo(v2.re, v2.im);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
    }
}

ctx.restore();