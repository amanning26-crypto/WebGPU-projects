// compute.js
// GPU-side matrix generation + compute-only stress benchmark

export class ComputeEngine {
  constructor(device, computeWGSL) {
    this.device = device;

    // Create compute shader module
    this.module = device.createShaderModule({
      code: computeWGSL
    });

    // Pipeline for generating transforms
    this.pipelineGenerate = device.createComputePipeline({
      layout: "auto",
      compute: {
        module: this.module,
        entryPoint: "generate_transforms"
      }
    });

    // Pipeline for heavy compute-only FLOP test
    this.pipelineHeavy = device.createComputePipeline({
      layout: "auto",
      compute: {
        module: this.module,
        entryPoint: "compute_heavy"
      }
    });

    // Uniform buffer for angles
    this.uniformBuffer = device.createBuffer({
      size: 16, // angleX, angleY, padding
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    });
  }

  // ------------------------------------------------------------
  // GPU-side generation of 200k model matrices
  // ------------------------------------------------------------
  async generateTransforms(matrixBuffer, count, angleX, angleY) {
    // Upload angles
    this.device.queue.writeBuffer(
      this.uniformBuffer,
      0,
      new Float32Array([angleX, angleY])
    );

    const bindGroup = this.device.createBindGroup({
      layout: this.pipelineGenerate.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: this.uniformBuffer }},
        { binding: 1, resource: { buffer: matrixBuffer }}
      ]
    });

    const encoder = this.device.createCommandEncoder();
    const pass = encoder.beginComputePass();

    pass.setPipeline(this.pipelineGenerate);
    pass.setBindGroup(0, bindGroup);

    // 256 threads per workgroup
    const workgroupSize = 256;
    const numGroups = Math.ceil(count / workgroupSize);

    pass.dispatchWorkgroups(numGroups);
    pass.end();

    this.device.queue.submit([encoder.finish()]);
  }

  // ------------------------------------------------------------
  // Compute-only heavy FLOP benchmark
  // ------------------------------------------------------------
  async computeHeavy(encoder) {
    const bindGroup = this.device.createBindGroup({
      layout: this.pipelineHeavy.getBindGroupLayout(0),
      entries: []
    });

    const pass = encoder.beginComputePass();
    pass.setPipeline(this.pipelineHeavy);
    pass.setBindGroup(0, bindGroup);

    // 4096 workgroups × 256 threads = 1,048,576 threads
    // Each thread performs thousands of FLOPs
    pass.dispatchWorkgroups(4096);

    pass.end();
  }
}
