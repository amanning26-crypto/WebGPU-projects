function shaderModuleFromCode(device, shaderId) {
    const code = document.getElementById(shaderId).textContent;
    return device.createShaderModule({ code });
}


function createGPUBuffer(device, data, usage) {
    // Create a buffer with enough size
    const buffer = device.createBuffer({
        size: data.byteLength,
        usage: usage | GPUBufferUsage.COPY_DST,
        mappedAtCreation: true
    });

    // Copy the data into the buffer
    new Float32Array(buffer.getMappedRange()).set(data);


    /* from
    WebGPU enforces explicit synchronization.
    Mapping gives you exclusive CPU access.
    Unmapping hands the buffer back to the GPU.

    This avoids race conditions and makes GPU memory management predictable.
    */
    buffer.unmap();

    return buffer;
}
