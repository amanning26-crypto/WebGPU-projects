// renderer.js
// Handles instanced rendering of 200,000 cubes in 3 styles:
// 1) Colored, 2) Textured, 3) Lit

export class Renderer {
  constructor(device, format, commonWGSL, coloredWGSL, texturedWGSL, litWGSL, texture) {
    this.device = device;
    this.format = format;
    this.texture = texture;

    this.commonWGSL = commonWGSL;
    this.coloredWGSL = coloredWGSL;
    this.texturedWGSL = texturedWGSL;
    this.litWGSL = litWGSL;

    this.canvas = document.getElementById("gfx");
    this.context = this.canvas.getContext("webgpu");

    this.createDepthTexture();
    this.createBindGroupLayouts();
    this.createPipelines();
    this.createVertexBuffers();
    this.createBindGroups();
  }

  // ------------------------------------------------------------
  // Depth Buffer
  // ------------------------------------------------------------
  createDepthTexture() {
    this.depthTexture = this.device.createTexture({
      size: [this.canvas.width, this.canvas.height],
      format: "depth24plus",
      usage: GPUTextureUsage.RENDER_ATTACHMENT
    });

    this.depthView = this.depthTexture.createView();
  }

  resize() {
    this.createDepthTexture();
  }

  // ------------------------------------------------------------
  // Vertex Data (cube)
  // ------------------------------------------------------------
  createVertexBuffers() {
    const vertices = new Float32Array([
      // pos            normal         uv      color
      // Front
      -1,-1, 1,   0,0,1,   0,0,   1,0,0,
       1,-1, 1,   0,0,1,   1,0,   0,1,0,
       1, 1, 1,   0,0,1,   1,1,   0,0,1,
      -1, 1, 1,   0,0,1,   0,1,   1,1,0,

      // Back
      -1,-1,-1,   0,0,-1,  1,0,   1,0,1,
       1,-1,-1,   0,0,-1,  0,0,   0,1,1,
       1, 1,-1,   0,0,-1,  0,1,   1,1,1,
      -1, 1,-1,   0,0,-1,  1,1,   0.2,0.2,0.2,
    ]);

    const indices = new Uint16Array([
      0,1,2, 0,2,3,
      4,6,5, 4,7,6,
      4,0,3, 4,3,7,
      1,5,6, 1,6,2,
      3,2,6, 3,6,7,
      4,5,1, 4,1,0
    ]);

    this.vertexBuffer = this.device.createBuffer({
      size: vertices.byteLength,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST
    });
    this.device.queue.writeBuffer(this.vertexBuffer, 0, vertices);

    this.indexBuffer = this.device.createBuffer({
      size: indices.byteLength,
      usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST
    });
    this.device.queue.writeBuffer(this.indexBuffer, 0, indices);

    this.indexCount = indices.length;
  }

  // ------------------------------------------------------------
  // Bind Group Layouts
  // ------------------------------------------------------------
  createBindGroupLayouts() {
    this.uniformLayout = this.device.createBindGroupLayout({
      entries: [
        {
          binding: 0,
          visibility: GPUShaderStage.VERTEX,
          buffer: { type: "uniform" }
        },
        {
          binding: 1,
          visibility: GPUShaderStage.VERTEX,
          buffer: { type: "read-only-storage" }
        }
      ]
    });

    this.textureLayout = this.device.createBindGroupLayout({
      entries: [
        { binding: 0, visibility: GPUShaderStage.FRAGMENT, sampler: {} },
        { binding: 1, visibility: GPUShaderStage.FRAGMENT, texture: {} }
      ]
    });
  }

  // ------------------------------------------------------------
  // Pipelines
  // ------------------------------------------------------------
  createPipelines() {
    this.pipelineColored = this.createPipeline(this.coloredWGSL);
    this.pipelineTextured = this.createPipeline(this.texturedWGSL);
    this.pipelineLit = this.createPipeline(this.litWGSL);
  }

  createPipeline(shaderCode) {
    const module = this.device.createShaderModule({
      code: this.commonWGSL + "\n" + shaderCode
    });

    return this.device.createRenderPipeline({
      layout: this.device.createPipelineLayout({
        bindGroupLayouts: [this.uniformLayout, this.textureLayout]
      }),
      vertex: {
        module,
        entryPoint: "vs_main",
        buffers: [{
          arrayStride: 12 * 4, // pos(3) normal(3) uv(2) color(3)
          attributes: [
            { shaderLocation: 0, offset: 0,     format: "float32x3" },
            { shaderLocation: 1, offset: 3*4,   format: "float32x3" },
            { shaderLocation: 2, offset: 6*4,   format: "float32x2" },
            { shaderLocation: 3, offset: 8*4,   format: "float32x3" }
          ]
        }]
      },
      fragment: {
        module,
        entryPoint: "fs_main",
        targets: [{ format: this.format }]
      },
      primitive: { topology: "triangle-list", cullMode: "back" },
      depthStencil: {
        format: "depth24plus",
        depthWriteEnabled: true,
        depthCompare: "less"
      }
    });
  }

  // ------------------------------------------------------------
  // Bind Groups
  // ------------------------------------------------------------
  createBindGroups() {
    // 256-byte uniform buffer for MVP (alignment requirement)
    this.uniformBuffer = this.device.createBuffer({
      size: 256,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    });
	


    // Identity matrix buffer for rendering-only mode
    this.identityMatrixBuffer = this.device.createBuffer({
      size: 64,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
    });
    this.device.queue.writeBuffer(
      this.identityMatrixBuffer,
      0,
      new Float32Array([
        1,0,0,0,
        0,1,0,0,
        0,0,1,0,
        0,0,0,1
      ])
    );

    this.sampler = this.device.createSampler({
      magFilter: "linear",
      minFilter: "linear"
    });

    this.textureBindGroup = this.device.createBindGroup({
      layout: this.textureLayout,
      entries: [
        { binding: 0, resource: this.sampler },
        { binding: 1, resource: this.texture.createView() }
      ]
    });

    // default uniform bind group (will swap storage buffer if needed)
    this.uniformBindGroup = this.device.createBindGroup({
      layout: this.uniformLayout,
      entries: [
        { binding: 0, resource: { buffer: this.uniformBuffer }},
        { binding: 1, resource: { buffer: this.identityMatrixBuffer }}
      ]
    });
  }

  // ------------------------------------------------------------
  // Matrix Helpers
  // ------------------------------------------------------------
  projectionMatrixOld(width, height) {
    const safeHeight = height || 1;
    const aspect = width / safeHeight;
    const f = 1.0 / Math.tan(Math.PI / 6);
    const nf = 1 / (0.1 - 200);

    return new Float32Array([
      f/aspect,0,0,0,
      0,f,0,0,
      0,0,(200+0.1)*nf,-1,
      0,0,(2*200*0.1)*nf,0
    ]);
  }
  
  projectionMatrix(width, height) {
	  const safeHeight = height || 1;
	  const aspect = width / safeHeight;
	  const f = 1.0 / Math.tan(Math.PI / 6);
	  const nf = 1 / (0.1 - 200);

	  return new Float32Array([
		f/aspect,0,0,0,
		0,f,0,0,
		0,0,(200+0.1)*nf,-1,
		0,0,(2*200*0.1)*nf,0
	  ]);
	}


  viewMatrix(angleX, angleY) {
    const sx = Math.sin(angleX), cx = Math.cos(angleX);
    const sy = Math.sin(angleY), cy = Math.cos(angleY);

    return new Float32Array([
      cy,  sx*sy,  cx*sy, 0,
      0,   cx,    -sx,    0,
      -sy, sx*cy, cx*cy,  0,
      0,   0,      -50,   1
    ]);
  }

  multiplyMat4(a, b) {
    const out = new Float32Array(16);
    for (let row = 0; row < 4; row++) {
      for (let col = 0; col < 4; col++) {
        out[col + row*4] =
          a[row*4 + 0] * b[col + 0] +
          a[row*4 + 1] * b[col + 4] +
          a[row*4 + 2] * b[col + 8] +
          a[row*4 + 3] * b[col + 12];
      }
    }
    return out;
  }

  // ------------------------------------------------------------
  // Render Instances
  // ------------------------------------------------------------
  
  renderInstances(encoder, matrixBuffer, count, angleX, angleY, style) {
  const proj = this.projectionMatrix(this.canvas.width, this.canvas.height);
  const view = this.viewMatrix(angleX, angleY);
  const mvp = this.multiplyMat4(proj, view);
  this.device.queue.writeBuffer(this.uniformBuffer, 0, mvp);

  const colorView = this.context.getCurrentTexture().createView();

  const pass = encoder.beginRenderPass({
    colorAttachments: [{
      view: colorView,
      clearValue: { r:0.1, g:0.1, b:0.12, a:1 },
      loadOp: "clear",
      storeOp: "store"
    }],
    depthStencilAttachment: {
      view: this.depthView,
      depthClearValue: 1,
      depthLoadOp: "clear",
      depthStoreOp: "store"
    }
  });

  let pipeline =
    style === 1 ? this.pipelineColored :
    style === 2 ? this.pipelineTextured :
                  this.pipelineLit;

  pass.setPipeline(pipeline);

  const instanceBuffer = this.identityMatrixBuffer;
  const uniformBindGroup = this.device.createBindGroup({
    layout: this.uniformLayout,
    entries: [
      { binding: 0, resource: { buffer: this.uniformBuffer }},
      { binding: 1, resource: { buffer: instanceBuffer }}
    ]
  });

  pass.setBindGroup(0, uniformBindGroup);
  pass.setBindGroup(1, this.textureBindGroup);
  pass.setVertexBuffer(0, this.vertexBuffer);
  pass.setIndexBuffer(this.indexBuffer, "uint16");

  pass.drawIndexed(this.indexCount, 1); // single cube
  pass.end();
}




  renderInstancesBad(encoder, matrixBuffer, count, angleX, angleY, style) {
    // MVP = proj * view
    const proj = this.projectionMatrix(this.canvas.width, this.canvas.height);
    const view = this.viewMatrix(angleX, angleY);
    const mvp = this.multiplyMat4(proj, view);
    this.device.queue.writeBuffer(this.uniformBuffer, 0, mvp);

    // If the instance buffer object changed, rebuild bind group
    const instanceBuffer = matrixBuffer ?? this.identityMatrixBuffer;
    if (instanceBuffer !== this.currentInstanceBuffer) {
      this.currentInstanceBuffer = instanceBuffer;
      this.uniformBindGroup = this.device.createBindGroup({
        layout: this.uniformLayout,
        entries: [
          { binding: 0, resource: { buffer: this.uniformBuffer }},
          { binding: 1, resource: { buffer: instanceBuffer }}
        ]
      });
    }

    const colorView = this.context.getCurrentTexture().createView();

    const pass = encoder.beginRenderPass({
      colorAttachments: [{
        view: colorView,
        clearValue: { r:0.1, g:0.1, b:0.12, a:1 },
        loadOp: "clear",
        storeOp: "store"
      }],
      depthStencilAttachment: {
        view: this.depthView,
        depthClearValue: 1,
        depthLoadOp: "clear",
        depthStoreOp: "store"
      }
    });

    let pipeline =
      style === 1 ? this.pipelineColored :
      style === 2 ? this.pipelineTextured :
                    this.pipelineLit;

    pass.setPipeline(pipeline);
    pass.setBindGroup(0, this.uniformBindGroup);
    pass.setBindGroup(1, this.textureBindGroup);
    pass.setVertexBuffer(0, this.vertexBuffer);
    pass.setIndexBuffer(this.indexBuffer, "uint16");

    // For debugging lockups, you can temporarily clamp count:
    // const safeCount = Math.min(count, 5000);
    // pass.drawIndexed(this.indexCount, safeCount);

    //pass.drawIndexed(this.indexCount, count);
	
	// pass.drawIndexed(this.indexCount, count);
pass.drawIndexed(this.indexCount, 1); // draw exactly one cube - DEBUGGING

	
    pass.end();
  }
}
