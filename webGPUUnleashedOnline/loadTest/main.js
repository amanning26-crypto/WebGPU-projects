import { BenchmarkController } from "./benchmark.js";
import { Renderer } from "./renderer.js";
import { ComputeEngine } from "./compute.js";

const canvas = document.getElementById("gfx");
const hud = document.getElementById("hud");

let device, context, format;
let renderer, computeEngine, benchmark;

let angleX = 0;
let angleY = 0;
let dragging = false;
let lastX = 0, lastY = 0;

let autoX = 0.4;
let autoY = 0.6;

let mode = 1;          // 1–5 benchmark modes
let renderStyle = 1;   // 1=colored, 2=textured, 3=lit

// ------------------------------------------------------------
// WebGPU Initialization
// ------------------------------------------------------------
async function initWebGPU() {
  if (!navigator.gpu) {
    alert("WebGPU not supported");
    return;
  }

  const adapter = await navigator.gpu.requestAdapter();
  device = await adapter.requestDevice();

  context = canvas.getContext("webgpu");
  format = navigator.gpu.getPreferredCanvasFormat();

  resizeCanvas();
  window.addEventListener("resize", resizeCanvas);

  context.configure({
    device,
    format,
    alphaMode: "opaque"
  });

  return device;
}

function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}

// ------------------------------------------------------------
// Shader Loader
// ------------------------------------------------------------
async function loadText(url) {
  const res = await fetch(url);
  return await res.text();
}

async function loadTexture(url) {
  const img = new Image();
  img.src = url;
  await img.decode();

  const bitmap = await createImageBitmap(img);

  const texture = device.createTexture({
    size: [bitmap.width, bitmap.height, 1],
    format: "rgba8unorm",
    usage: GPUTextureUsage.TEXTURE_BINDING |
           GPUTextureUsage.COPY_DST |
           GPUTextureUsage.RENDER_ATTACHMENT
  });

  device.queue.copyExternalImageToTexture(
    { source: bitmap },
    { texture: texture },
    [bitmap.width, bitmap.height]
  );

  return texture;
}

// ------------------------------------------------------------
// Input Handling
// ------------------------------------------------------------
function setupInput() {
  canvas.addEventListener("mousedown", e => {
    dragging = true;
    lastX = e.clientX;
    lastY = e.clientY;
  });

  window.addEventListener("mouseup", () => dragging = false);

  window.addEventListener("mousemove", e => {
    if (!dragging) return;
    angleY += (e.clientX - lastX) * 0.01;
    angleX += (e.clientY - lastY) * 0.01;
    lastX = e.clientX;
    lastY = e.clientY;
  });

  window.addEventListener("keydown", e => {
    if (e.key === "+") { autoX *= 1.2; autoY *= 1.2; }
    if (e.key === "-") { autoX *= 0.8; autoY *= 0.8; }
    if (e.key === "0") { autoX = 0; autoY = 0; }

    if (e.key === "1") mode = 1;
    if (e.key === "2") mode = 2;
    if (e.key === "3") mode = 3;
    if (e.key === "4") mode = 4;
    if (e.key === "5") mode = 5;

    if (e.key === "F1") renderStyle = 1;
    if (e.key === "F2") renderStyle = 2;
    if (e.key === "F3") renderStyle = 3;
  });
}

// ------------------------------------------------------------
// HUD
// ------------------------------------------------------------
function updateHUD(fps, cpuMs, gpuMs) {
  const modeNames = [
    "",
    "CPU Transform Mode",
    "GPU Transform Mode",
    "Compute-Only Mode",
    "Rendering-Only Mode",
    "Combined Stress Mode"
  ];

  const styleNames = ["", "Colored", "Textured", "Lit"];

  hud.textContent =
    `FPS: ${fps.toFixed(1)}
CPU: ${cpuMs.toFixed(2)} ms
GPU: ${gpuMs.toFixed(2)} ms (approx)
Mode: ${modeNames[mode]}
Render: ${styleNames[renderStyle]}
Instances: 200,000`;
}

// ------------------------------------------------------------
// Frame Loop
// ------------------------------------------------------------
let lastTime = performance.now();
let frameCount = 0;
let fps = 0;

async function frame() {
  const now = performance.now();
  const dt = (now - lastTime) / 1000;
  lastTime = now;

  frameCount++;
  if (frameCount % 20 === 0) {
    fps = 1 / dt;
  }

  if (!dragging) {
    angleX += autoX * dt;
    angleY += autoY * dt;
  }

  const cpuStart = performance.now();

  let gpuMs = 0;

  switch (mode) {
    case 1:
      gpuMs = await benchmark.runCPUTransformMode(angleX, angleY, renderStyle);
      break;
    case 2:
      gpuMs = await benchmark.runGPUTransformMode(angleX, angleY, renderStyle);
      break;
    case 3:
      gpuMs = await benchmark.runComputeOnlyMode();
      break;
    case 4:
      gpuMs = await benchmark.runRenderingOnlyMode(angleX, angleY, renderStyle);
      break;
    case 5:
      gpuMs = await benchmark.runCombinedMode(angleX, angleY, renderStyle);
      break;
  }

  const cpuMs = performance.now() - cpuStart;

  updateHUD(fps, cpuMs, gpuMs);

  requestAnimationFrame(frame);
}

// ------------------------------------------------------------
// Main Entry
// ------------------------------------------------------------
async function main() {
  await initWebGPU();
  setupInput();

  const commonWGSL = await loadText("./shaders/common.wgsl");
  const coloredWGSL = await loadText("./shaders/cube_colored.wgsl");
  const texturedWGSL = await loadText("./shaders/cube_textured.wgsl");
  const litWGSL = await loadText("./shaders/cube_lit.wgsl");
  const computeWGSL = await loadText("./shaders/compute_transforms.wgsl");

  const texture = await loadTexture("./textures/crate.png");

  renderer = new Renderer(device, format, commonWGSL, coloredWGSL, texturedWGSL, litWGSL, texture);
  computeEngine = new ComputeEngine(device, computeWGSL);
  benchmark = new BenchmarkController(device, renderer, computeEngine);

  requestAnimationFrame(frame);
}

main();
