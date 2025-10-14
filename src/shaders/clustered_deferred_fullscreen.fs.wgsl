// TODO-3: implement the Clustered Deferred fullscreen fragment shader

// Similar to the Forward+ fragment shader, but with vertex information coming from the G-buffer instead.
@group(${bindGroup_scene}) @binding(0) var<uniform> cameraUnif: CameraUniforms;
@group(${bindGroup_scene}) @binding(1) var<storage, read> lightSet: LightSet;
@group(${bindGroup_scene}) @binding(2) var<storage, read> clusterSet: ClusterSet;

// Textures.
@group(${bindGroup_textures}) @binding(0) var posTex: texture_2d<f32>;
@group(${bindGroup_textures}) @binding(1) var albedoTex: texture_2d<f32>;
@group(${bindGroup_textures}) @binding(2) var normalTex: texture_2d<f32>;

@fragment
fn main(@builtin(position) fragPos: vec4f) -> @location(0) vec4f
{
    let index = vec2i(floor(fragPos.xy));

    let worldPos = textureLoad(posTex, index, 0).xyz;
    let albedo = textureLoad(albedoTex, index, 0);
    let normal = textureLoad(normalTex, index, 0).xyz;

    // Determine which cluster holds the current fragment.
    let clusterDimsU : vec3<u32> = vec3<u32>(${clusterDims[0]}, ${clusterDims[1]}, ${clusterDims[2]});
    // Transform to view space:
    let viewPosIn = cameraUnif.viewMat * vec4f(worldPos, 1.0);
    let viewProjPosIn = cameraUnif.viewProjMat * vec4f(worldPos, 1.0);

    let ndcX = (viewProjPosIn.x / viewProjPosIn.w) * 0.5 + 0.5;
    let ndcY = (viewProjPosIn.y / viewProjPosIn.w) * 0.5 + 0.5;
    let clusterX = u32(clamp(floor(ndcX * f32(clusterDimsU.x)), 0.0, f32(clusterDimsU.x - 1u)));
    let clusterY = u32(clamp(floor(ndcY * f32(clusterDimsU.y)), 0.0, f32(clusterDimsU.y - 1u)));

    let logDepth = log(cameraUnif.nearFarClip[1] / cameraUnif.nearFarClip[0]);
    let zSliceF = clamp(floor(log(-viewPosIn.z / cameraUnif.nearFarClip[0]) / logDepth * f32(clusterDimsU.z)), 0.0, f32(clusterDimsU.z - 1u));
    let clusterZ = u32(zSliceF);

    let clusterIdx: u32 = clusterX + clusterY * clusterDimsU.x + clusterZ * clusterDimsU.x * clusterDimsU.y;
    
    // Get current cluster from calculated clusterIdx.
    let currCluster = clusterSet.clusters[clusterIdx];
    let currNumLights = currCluster.numLights;

    // Initialise light contrib variable.
    var totalLightContrib = vec3f(0, 0, 0);

    // For each light in cluster:
    for (var i = 0u; i < currNumLights; i++) {
        // Access the light's properties using its index.
        let lightIdx = currCluster.lights[i];
        let light = lightSet.lights[lightIdx];
        // Calculate the contribution of the light based on its position, the fragment’s position, and the surface normal.
        totalLightContrib += calculateLightContrib(light, worldPos, normal);
        // Add the calculated contribution to the total light accumulation.
    }

    // Multiply the fragment’s diffuse color by the accumulated light contribution.
    var finalColor = albedo.rgb * totalLightContrib;

    return vec4f(finalColor, 1.0);
}
