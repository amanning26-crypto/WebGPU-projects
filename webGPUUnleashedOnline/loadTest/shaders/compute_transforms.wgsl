// ============================================================
// compute_transforms.wgsl
// GPU-side matrix generation + heavy compute benchmark
// ============================================================

// ------------------------------------------------------------
// Uniforms: angleX, angleY
// ------------------------------------------------------------
struct Angles {
    angleX : f32,
    angleY : f32,
    pad1   : f32,
    pad2   : f32,
};
@group(0) @binding(0) var<uniform> uAngles : Angles;

// ------------------------------------------------------------
// Output buffer: array of model matrices
// ------------------------------------------------------------
struct MatrixBuffer {
    m : array<mat4x4<f32>>,
};
@group(0) @binding(1) var<storage, read_write> uOut : MatrixBuffer;

// ------------------------------------------------------------
// Rotation helpers
// ------------------------------------------------------------
fn rotX(a : f32) -> mat4x4<f32> {
    let c = cos(a);
    let s = sin(a);
    return mat4x4<f32>(
        vec4<f32>(1, 0, 0, 0),
        vec4<f32>(0, c, s, 0),
        vec4<f32>(0, -s, c, 0),
        vec4<f32>(0, 0, 0, 1)
    );
}

fn rotY(a : f32) -> mat4x4<f32> {
    let c = cos(a);
    let s = sin(a);
    return mat4x4<f32>(
        vec4<f32>(c, 0, -s, 0),
        vec4<f32>(0, 1, 0, 0),
        vec4<f32>(s, 0, c, 0),
        vec4<f32>(0, 0, 0, 1)
    );
}

// ------------------------------------------------------------
// Entry Point 1: Generate 200,000 model matrices
// ------------------------------------------------------------
@compute @workgroup_size(256)
fn generate_transforms(@builtin(global_invocation_id) gid : vec3<u32>) {
    let index = gid.x;

    // Bounds check (in case instance count isn't divisible by 256)
    if (index >= arrayLength(&uOut.m)) {
        return;
    }

    // Compute model matrix = rotY * rotX
    let model = rotY(uAngles.angleY) * rotX(uAngles.angleX);

    // Write to output buffer
    uOut.m[index] = model;
}

// ------------------------------------------------------------
// Entry Point 2: Heavy compute-only FLOP benchmark
// ------------------------------------------------------------
@compute @workgroup_size(256)
fn compute_heavy(@builtin(global_invocation_id) gid : vec3<u32>) {
    // Each thread performs thousands of FLOPs
    var acc : f32 = f32(gid.x);

    for (var i = 0u; i < 2000u; i = i + 1u) {
        acc = sin(acc) * cos(acc) + sqrt(abs(acc) + 1.0);
    }

    // Prevent compiler from optimizing everything away
    if (acc < 0.0) {
        // no-op
    }
}
