// ============================================================
// cube_colored.wgsl
// Fastest rendering mode: per-vertex color, no textures, no lighting
// ============================================================

// ------------------------------------------------------------
// Vertex Inputs
// ------------------------------------------------------------
struct VertexIn {
    @location(0) position : vec3<f32>,
    @location(1) normal   : vec3<f32>,   // unused
    @location(2) uv       : vec2<f32>,   // unused
    @location(3) color    : vec3<f32>,
    @builtin(instance_index) instance : u32,
};

// ------------------------------------------------------------
// Vertex Outputs
// ------------------------------------------------------------
struct VertexOut {
    @builtin(position) pos : vec4<f32>,
    @location(0) color : vec3<f32>,
};

// ------------------------------------------------------------
// Vertex Shader
// ------------------------------------------------------------
@vertex
fn vs_main(input : VertexIn) -> VertexOut {
    var out : VertexOut;

    // Instance transform (if provided)
    let model = uInstances.m[input.instance];

    // MVP from common.wgsl
    let worldPos = model * vec4<f32>(input.position, 1.0);
    out.pos = uUniforms.mvp * worldPos;

    out.color = input.color;
    return out;
}

// ------------------------------------------------------------
// Fragment Shader
// ------------------------------------------------------------
@fragment
fn fs_main(input : VertexOut) -> @location(0) vec4<f32> {
    return vec4<f32>(input.color, 1.0);
}
