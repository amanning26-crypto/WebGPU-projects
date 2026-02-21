// ============================================================
// cube_textured.wgsl
// Medium-cost rendering mode: texture sampling + UVs
// ============================================================

// ------------------------------------------------------------
// Bindings for texture + sampler
// ------------------------------------------------------------
@group(1) @binding(0) var uSampler : sampler;
@group(1) @binding(1) var uTexture : texture_2d<f32>;

// ------------------------------------------------------------
// Vertex Inputs
// ------------------------------------------------------------
struct VertexIn {
    @location(0) position : vec3<f32>,
    @location(1) normal   : vec3<f32>,   // unused here
    @location(2) uv       : vec2<f32>,
    @location(3) color    : vec3<f32>,   // fallback if texture missing
    @builtin(instance_index) instance : u32,
};

// ------------------------------------------------------------
// Vertex Outputs
// ------------------------------------------------------------
struct VertexOut {
    @builtin(position) pos : vec4<f32>,
    @location(0) uv    : vec2<f32>,
    @location(1) color : vec3<f32>,
};

// ------------------------------------------------------------
// Vertex Shader
// ------------------------------------------------------------
@vertex
fn vs_main(input : VertexIn) -> VertexOut {
    var out : VertexOut;

    // Instance transform
    let model = uInstances.m[input.instance];

    // MVP from common.wgsl
    let worldPos = model * vec4<f32>(input.position, 1.0);
    out.pos = uUniforms.mvp * worldPos;

    out.uv = input.uv;
    out.color = input.color; // used if texture fails

    return out;
}

// ------------------------------------------------------------
// Fragment Shader
// ------------------------------------------------------------
@fragment
fn fs_main(input : VertexOut) -> @location(0) vec4<f32> {
    let texColor = textureSample(uTexture, uSampler, input.uv);

    // If texture is transparent or missing, fall back to vertex color
    if (texColor.a < 0.01) {
        return vec4<f32>(input.color, 1.0);
    }

    return texColor;
}
