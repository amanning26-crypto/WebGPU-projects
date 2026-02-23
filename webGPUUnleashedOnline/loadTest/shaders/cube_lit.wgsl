// ============================================================
// cube_lit.wgsl
// Highest-cost rendering mode: Blinn–Phong lighting
// ============================================================

// ------------------------------------------------------------
// Texture + sampler (optional for specular map or fallback)
// ------------------------------------------------------------
@group(1) @binding(0) var uSampler : sampler;
@group(1) @binding(1) var uTexture : texture_2d<f32>;

// ------------------------------------------------------------
// Light direction (constant for now)
// ------------------------------------------------------------
const LIGHT_DIR : vec3<f32> = normalize(vec3<f32>(0.4, 0.6, 0.7));

// ------------------------------------------------------------
// Vertex Inputs
// ------------------------------------------------------------
struct VertexIn {
    @location(0) position : vec3<f32>,
    @location(1) normal   : vec3<f32>,
    @location(2) uv       : vec2<f32>,
    @location(3) color    : vec3<f32>,
    @builtin(instance_index) instance : u32,
};

// ------------------------------------------------------------
// Vertex Outputs
// ------------------------------------------------------------
struct VertexOut {
    @builtin(position) pos : vec4<f32>,
    @location(0) worldPos  : vec3<f32>,
    @location(1) normal    : vec3<f32>,
    @location(2) uv        : vec2<f32>,
    @location(3) color     : vec3<f32>,
};

// ------------------------------------------------------------
// Vertex Shader
// ------------------------------------------------------------
@vertex
fn vs_main(input : VertexIn) -> VertexOut {
    var out : VertexOut;

    // Instance transform
    let model = uInstances.m[input.instance];

    // Transform position
    let world = model * vec4<f32>(input.position, 1.0);
    out.pos = uUniforms.mvp * world;
    out.worldPos = world.xyz;

    // Transform normal (ignore scale/shear)
    let n = (model * vec4<f32>(input.normal, 0.0)).xyz;
    out.normal = normalize(n);

    out.uv = input.uv;
    out.color = input.color;

    return out;
}

// ------------------------------------------------------------
// Fragment Shader (Blinn–Phong)
// ------------------------------------------------------------
@fragment
fn fs_main(input : VertexOut) -> @location(0) vec4<f32> {
    let N = normalize(input.normal);
    let L = LIGHT_DIR;
    let V = normalize(-input.worldPos); // camera at origin
    let H = normalize(L + V);

    // Lighting terms
    let ambient = 0.15;
    let diff = max(dot(N, L), 0.0);
    let spec = pow(max(dot(N, H), 0.0), 32.0);

    // Base color from texture or vertex color
    let texColor = textureSample(uTexture, uSampler, input.uv);
    let base = select(vec3<f32>(input.color), texColor.rgb, texColor.a > 0.01);

    let finalColor =
        base * ambient +
        base * diff * 0.9 +
        vec3<f32>(1.0, 1.0, 1.0) * spec * 0.4;

    return vec4<f32>(finalColor, 1.0);
}
