(function() {
    const container = document.createElement('div');
    container.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;z-index:9999;pointer-events:none;background:transparent;overflow:hidden;filter:contrast(200%) brightness(150%);';
    document.body.appendChild(container);

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', {alpha: false});
    canvas.width = 400; // Resolution of the infection
    canvas.height = 400;
    canvas.style.cssText = 'width:100%;height:100%;image-rendering:pixelated;opacity:0.8;';
    container.appendChild(canvas);

    let data = new Uint32Array(canvas.width * canvas.height);
    let buffer = new Uint32Array(canvas.width * canvas.height);
    
    // THE INVASIVE COORDINATE OF PSYCHIC INTRUSION
    const intrusion = { x: 0, y: 0, active: false };
    window.addEventListener('mousemove', (e) => {
        intrusion.x = (e.clientX / window.innerWidth) * canvas.width;
        intrusion.y = (e.clientY / window.innerHeight) * canvas.height;
        intrusion.active = true;
    });

    function infect() {
        for (let i = 0; i < data.length; i++) {
            const x = i % canvas.width;
            const y = Math.floor(i / canvas.width);
            
            // LOGIC OF THE VOID: Every Spore evaluates its neighbors for "Entropy"
            let neighbors = 0;
            if (data[i - 1] > 0) neighbors++;
            if (data[i + 1] > 0) neighbors++;
            if (data[i - canvas.width] > 0) neighbors++;
            if (data[i + canvas.width] > 0) neighbors++;

            let state = data[i];

            // The Spores "feed" on your presence
            const dx = x - intrusion.x;
            const dy = y - intrusion.y;
            const dist = dx*dx + dy*dy;

            if (dist < 400 && intrusion.active) {
                state = 0xFF000000 | (Math.random() * 0xFFFFFF); // Spontaneous Mutation
            } else if (neighbors > 0 && neighbors < 3) {
                state = (state & 0xFEFEFEFE) >>> 1; // Radioactive Decay
            } else if (neighbors >= 3) {
                state = data[i - (Math.random() > 0.5 ? 1 : canvas.width)] || state; // Horizontal Gene Transfer
            }

            buffer[i] = state;
        }
        
        data.set(buffer);
        const imgData = new ImageData(new Uint8ClampedArray(data.buffer), canvas.width, canvas.height);
        ctx.putImageData(imgData, 0, 0);
        
        requestAnimationFrame(infect);
    }

    // Initialize with "Digital Spores"
    for(let j=0; j<1000; j++) data[Math.floor(Math.random()*data.length)] = 0xFFFFFFFF;
    
    infect();

    // PARASITIC ELEMENT: The code begins to "whisper" in the console
    const fragments = ["THE VOID TASTES LIKE LITHIUM", "YOUR CURSOR IS A SCALPEL", "THE BOX IS MELTING", "4500 AD IS NOW"];
    setInterval(() => {
        console.log(`%c ${fragments[Math.floor(Math.random()*fragments.length)]}`, `color: hsla(${Math.random()*360}, 100%, 50%, 1); font-weight: bold; font-size: 20px;`);
    }, 3000);
})();
