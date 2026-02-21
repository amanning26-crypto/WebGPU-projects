// benchmark.js
// Coordinates the 5 benchmark modes for 200,000 cubes

export class BenchmarkController {
  constructor(device, renderer, computeEngine) {
    this.device = device;
    this.renderer = renderer;
    this.compute = computeEngine;

    // 200,000 instances
    this.instanceCount = 200000;

    // Storage buffer for CPU-side matrices
    this.cpuMatrixBuffer = device.createBuffer({
      size: this.instanceCount * 64, // 4x4 matrix per instance
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
    });

    // Storage buffer for GPU-side matrices
    this.gpuMatrixBuffer = device.createBuffer({
      size: this.instanceCount * 64,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.STORAGE_BINDING
    });

    // Preallocate CPU matrix array
    this.cpuMatrices = new Float32Array(this.instanceCount * 16);
  }

  // ------------------------------------------------------------
  // Simple GPU submission (no timestamp queries, returns 0 ms)
  // ------------------------------------------------------------
  async submitGPU(callback) {
    const encoder = this.device.createCommandEncoder();
    await callback(encoder);
    this.device.queue.submit([encoder.finish()]);
    return 0; // we’re not measuring GPU time here
  }

  // ------------------------------------------------------------
  // Mode 1: CPU Transform Mode
  // ------------------------------------------------------------
  async runCPUTransformMode(angleX, angleY, renderStyle) {
    // CPU computes 200k model matrices
    const sx = Math.sin(angleX), cx = Math.cos(angleX);
    const sy = Math.sin(angleY), cy = Math.cos(angleY);

    let ptr = 0;
    for (let i = 0; i < this.instanceCount; i++) {
      // Simple rotation-only model matrix
      this.cpuMatrices[ptr++] = cy;
      this.cpuMatrices[ptr++] = 0;
      this.cpuMatrices[ptr++] = -sy;
      this.cpuMatrices[ptr++] = 0;

      this.cpuMatrices[ptr++] = sx * sy;
      this.cpuMatrices[ptr++] = cx;
      this.cpuMatrices[ptr++] = sx * cy;
      this.cpuMatrices[ptr++] = 0;

      this.cpuMatrices[ptr++] = cx * sy;
      this.cpuMatrices[ptr++] = -sx;
      this.cpuMatrices[ptr++] = cx * cy;
      this.cpuMatrices[ptr++] = 0;

      this.cpuMatrices[ptr++] = 0;
      this.cpuMatrices[ptr++] = 0;
      this.cpuMatrices[ptr++] = 0;
      this.cpuMatrices[ptr++] = 1;
    }

    // Upload to GPU
    this.device.queue.writeBuffer(this.cpuMatrixBuffer, 0, this.cpuMatrices);

    // Render using CPU matrices
    return await this.submitGPU(async encoder => {
      this.renderer.renderInstances(
        encoder,
        this.cpuMatrixBuffer,
        this.instanceCount,
        angleX,
        angleY,
        renderStyle
      );
    });
  }

  // ------------------------------------------------------------
  // Mode 2: GPU Transform Mode
  // ------------------------------------------------------------
  async runGPUTransformMode(angleX, angleY, renderStyle) {
    // GPU compute shader generates 200k matrices
    await this.compute.generateTransforms(
      this.gpuMatrixBuffer,
      this.instanceCount,
      angleX,
      angleY
    );

    // Render using GPU matrices
    return await this.submitGPU(async encoder => {
      this.renderer.renderInstances(
        encoder,
        this.gpuMatrixBuffer,
        this.instanceCount,
        angleX,
        angleY,
        renderStyle
      );
    });
  }

  // ------------------------------------------------------------
  // Mode 3: Compute-Only Mode
  // ------------------------------------------------------------
  async runComputeOnlyMode() {
    return await this.submitGPU(async encoder => {
      await this.compute.computeHeavy(encoder);
    });
  }

  // ------------------------------------------------------------
  // Mode 4: Rendering-Only Mode
  // ------------------------------------------------------------
  async runRenderingOnlyMode(angleX, angleY, renderStyle) {
    // Render 200k cubes with identity matrices
    return await this.submitGPU(async encoder => {
      this.renderer.renderInstances(
        encoder,
        null, // no instance matrices → identity
        this.instanceCount,
        angleX,
        angleY,
        renderStyle
      );
    });
  }

  // ------------------------------------------------------------
  // Mode 5: Combined Stress Mode
  // ------------------------------------------------------------
  async runCombinedMode(angleX, angleY, renderStyle) {
    // GPU generates matrices + rendering
    await this.compute.generateTransforms(
      this.gpuMatrixBuffer,
      this.instanceCount,
      angleX,
      angleY
    );

    return await this.submitGPU(async encoder => {
      this.renderer.renderInstances(
        encoder,
        this.gpuMatrixBuffer,
        this.instanceCount,
        angleX,
        angleY,
        renderStyle
      );
    });
  }
}
