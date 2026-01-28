const canvas = document.getElementById("gfx");

if (!navigator.gpu) {
  throw new Error("WebGPU not supported");
}

// --- WebGPU setup ---
const adapter = await navigator.gpu.requestAdapter();
const device = await adapter.requestDevice();

const context = canvas.getContext("webgpu");
const format = navigator.gpu.getPreferredCanvasFormat();

context.configure({
  device: device,
  format: format,
  alphaMode: "opaque",
});

// --- Triangle vertices ---
const vertices = new Float32Array([
   0.0,  0.5,
  -0.5, -0.5,
   0.5, -0.5,
]);

const vertexBuffer = device.createBuffer({
  size: vertices.byteLength,
  usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
});
device.queue.writeBuffer(vertexBuffer, 0, vertices);

// --- Uniform buffer (rotation matrix) ---
const uniformBuffer = device.createBuffer({
  size: 16, // 2x2 floats
  usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
});

// --- Shader ---
const shader = device.createShaderModule({
  code: `
struct Uniforms {
  rot : mat2x2<f32>
};

@group(0) @binding(0)
var<uniform> uniforms : Uniforms;

struct VSOut {
  @builtin(position) position : vec4<f32>
};

@vertex
fn vs_main(@location(0) pos : vec2<f32>) -> VSOut {
  var out : VSOut;
  let rotated = uniforms.rot * pos;
  out.position = vec4<f32>(rotated, 0.0, 1.0);
  return out;
}

@fragment
fn fs_main() -> @location(0) vec4<f32> {
  return vec4<f32>(0.2, 0.8, 1.0, 1.0);
}
`
});

// --- Pipeline ---
const pipeline = device.createRenderPipeline({
  layout: "auto",
  vertex: {
    module: shader,
    entryPoint: "vs_main",
    buffers: [{
      arrayStride: 8,
      attributes: [{
        shaderLocation: 0,
        format: "float32x2",
        offset: 0,
      }],
    }],
  },
  fragment: {
    module: shader,
    entryPoint: "fs_main",
    targets: [{ format }],
  },
  primitive: {
    topology: "triangle-list",
  },
});

// --- Bind group ---
const bindGroup = device.createBindGroup({
  layout: pipeline.getBindGroupLayout(0),
  entries: [{
    binding: 0,
    resource: { buffer: uniformBuffer },
  }],
});

// --- Mouse interaction ---
let dragging = false;
let lastX = 0;
let angle = 0;

canvas.addEventListener("mousedown", e => {
  dragging = true;
  lastX = e.clientX;
});

window.addEventListener("mouseup", () => dragging = false);

window.addEventListener("mousemove", e => {
  if (!dragging) return;
  const dx = e.clientX - lastX;
  lastX = e.clientX;
  angle += dx * 0.01;
});

// --- Render loop ---
function frame() {
  const c = Math.cos(angle);
  const s = Math.sin(angle);

  device.queue.writeBuffer(
    uniformBuffer,
    0,
    new Float32Array([ c, -s, s, c ])
  );

  const encoder = device.createCommandEncoder();
  const pass = encoder.beginRenderPass({
    colorAttachments: [{
      view: context.getCurrentTexture().createView(),
      clearValue: { r: 0.5, g: 0.5, b: 0.5, a: 1 }, // dark bg
      loadOp: "clear",
      storeOp: "store",
    }],
  });

  pass.setPipeline(pipeline);
  pass.setBindGroup(0, bindGroup);
  pass.setVertexBuffer(0, vertexBuffer);
  pass.draw(3);
  pass.end();

  device.queue.submit([encoder.finish()]);
  requestAnimationFrame(frame);
}


// without this, I get chunky graphics
function resizeCanvas() {
  const dpr = window.devicePixelRatio || 1;
  const width = canvas.clientWidth * dpr;
  const height = canvas.clientHeight * dpr;

  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
}

resizeCanvas();
window.addEventListener("resize", resizeCanvas);


requestAnimationFrame(frame);
