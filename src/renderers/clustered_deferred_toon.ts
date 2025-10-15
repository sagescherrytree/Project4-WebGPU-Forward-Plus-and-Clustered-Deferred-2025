import * as renderer from '../renderer';
import * as shaders from '../shaders/shaders';
import { Stage } from '../stage/stage';

export class ClusteredDeferredToonRenderer extends renderer.Renderer {
    // TODO-3: add layouts, pipelines, textures, etc. needed for Deferred here
    // you may need extra uniforms such as the camera view matrix and the canvas resolution

    // G Buffer.
    sceneUniformsBindGroupLayout: GPUBindGroupLayout;
    sceneUniformsBindGroup: GPUBindGroup;
    GBufferPipeline: GPURenderPipeline;

    // Texture buffers.
    positionTexture: GPUTexture;
    positionTextureView: GPUTextureView;

    albedoTexture: GPUTexture;
    albedoTextureView: GPUTextureView;

    normalTexture: GPUTexture;
    normalTextureView: GPUTextureView;

    depthTexture: GPUTexture;
    depthTextureView: GPUTextureView;

    // Deferred Buffer.
    deferredBindGroupLayout: GPUBindGroupLayout;
    deferredBindGroup: GPUBindGroup;
    deferredFullScreenPipeline: GPURenderPipeline;

    // Toon Buffer.
    toonBindGroupLayout: GPUBindGroupLayout;
    toonBindGroup: GPUBindGroup;
    toonPipeline: GPURenderPipeline;

    constructor(stage: Stage) {
        super(stage);

        // TODO-3: initialize layouts, pipelines, textures, etc. needed for Deferred here
        // you'll need two pipelines: one for the G-buffer pass and one for the fullscreen pass
        // Initialise GPU texture buffers.
        this.positionTexture = renderer.device.createTexture({
            size: [renderer.canvas.width, renderer.canvas.height],
            format: "rgba16float",
            usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING
        });
        this.positionTextureView = this.positionTexture.createView();

        this.albedoTexture = renderer.device.createTexture({
            size: [renderer.canvas.width, renderer.canvas.height],
            format: renderer.canvasFormat,
            usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING
        });
        this.albedoTextureView = this.albedoTexture.createView();

        this.normalTexture = renderer.device.createTexture({
            size: [renderer.canvas.width, renderer.canvas.height],
            format: "rgba16float",
            usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING
        });
        this.normalTextureView = this.normalTexture.createView();

        this.depthTexture = renderer.device.createTexture({
            size: [renderer.canvas.width, renderer.canvas.height],
            format: "depth24plus",
            usage: GPUTextureUsage.RENDER_ATTACHMENT
        });
        this.depthTextureView = this.depthTexture.createView();

        // Scene buffers, regular render pass.
        this.sceneUniformsBindGroupLayout = renderer.device.createBindGroupLayout({
            label: "scene uniforms bind group layout",
            entries: [
                { // Uniform camera
                    binding: 0,
                    visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
                    buffer: { type: "uniform" }
                },
                { // lightSet
                    binding: 1,
                    visibility: GPUShaderStage.FRAGMENT,
                    buffer: { type: "read-only-storage" }
                },
                { // clusterSet
                    binding: 2,
                    visibility: GPUShaderStage.FRAGMENT,
                    buffer: { type: "read-only-storage" }
                }
            ]
        });
        this.sceneUniformsBindGroup = renderer.device.createBindGroup({
            label: "scene uniforms bind group",
            layout: this.sceneUniformsBindGroupLayout,
            entries: [
                { // Uniform camera
                    binding: 0,
                    resource: { buffer: this.camera.uniformsBuffer }
                },
                {
                    binding: 1,
                    resource: { buffer: this.lights.lightSetStorageBuffer }
                },
                { // Clusters.
                    binding: 2,
                    resource: { buffer: this.lights.clusterSetBuffer }
                }
            ]
        });

        // Regular render pipeline.
        this.GBufferPipeline = renderer.device.createRenderPipeline({
            layout: renderer.device.createPipelineLayout({
                label: "clustered deferred pipeline layout",
                bindGroupLayouts: [
                    this.sceneUniformsBindGroupLayout,
                    renderer.modelBindGroupLayout,
                    renderer.materialBindGroupLayout
                ]
            }),
            depthStencil: {
                depthWriteEnabled: true,
                depthCompare: "less",
                format: "depth24plus"
            },
            vertex: {
                module: renderer.device.createShaderModule({
                    label: "clustered deferred vert shader",
                    code: shaders.naiveVertSrc
                }),
                buffers: [renderer.vertexBufferLayout]
            },
            fragment: {
                module: renderer.device.createShaderModule({
                    label: "clustered deferred frag shader",
                    code: shaders.clusteredDeferredFragSrc,
                }),
                targets: [
                    {
                        format: "rgba16float"
                    },
                    {
                        format: renderer.canvasFormat,
                    },
                    {
                        format: "rgba16float"
                    }
                ]
            }
        });

        // Deferred render pass.
        this.deferredBindGroupLayout = renderer.device.createBindGroupLayout({
            label: "deferred bind group layout",
            entries: [
                { // position
                    binding: 0,
                    visibility: GPUShaderStage.FRAGMENT,
                    texture: {}
                },
                { // albedo
                    binding: 1,
                    visibility: GPUShaderStage.FRAGMENT,
                    texture: {}
                },
                { // normal
                    binding: 2,
                    visibility: GPUShaderStage.FRAGMENT,
                    texture: {}
                }
            ]
        });

        this.deferredBindGroup = renderer.device.createBindGroup({
            label: "deferred bind group",
            layout: this.deferredBindGroupLayout,
            entries: [
                {
                    binding: 0,
                    resource: this.positionTextureView
                },
                {
                    binding: 1,
                    resource: this.albedoTextureView
                },
                {
                    binding: 2,
                    resource: this.normalTextureView
                }
            ]
        });

        // Deferred compute pipeline.
        this.deferredFullScreenPipeline = renderer.device.createRenderPipeline({
            layout: renderer.device.createPipelineLayout({
                label: "full screen deferred pipeline layout",
                bindGroupLayouts: [
                    this.sceneUniformsBindGroupLayout,
                    this.deferredBindGroupLayout
                ]
            }),
            depthStencil: {
                depthWriteEnabled: true,
                depthCompare: "less",
                format: "depth24plus"
            },
            vertex: {
                module: renderer.device.createShaderModule({
                    label: "full screen clustered deferred vert shader",
                    code: shaders.clusteredDeferredFullscreenVertSrc
                }),
                buffers: []
            },
            fragment: {
                module: renderer.device.createShaderModule({
                    label: "full screen clustered deferred frag shader",
                    code: shaders.clusteredDeferredFullscreenFragSrc,
                }),
                targets: [
                    {
                        format: renderer.canvasFormat,
                    }
                ]
            }
        });

        // Toon pipeline.
        this.toonBindGroupLayout = renderer.device.createBindGroupLayout({
            label: "toon bind group layout",
            entries: [
                { // position
                    binding: 0,
                    visibility: GPUShaderStage.FRAGMENT,
                    texture: {}
                },
                { // albedo
                    binding: 1,
                    visibility: GPUShaderStage.FRAGMENT,
                    texture: {}
                },
                { // normal
                    binding: 2,
                    visibility: GPUShaderStage.FRAGMENT,
                    texture: {}
                }
            ]
        });

        this.toonBindGroup = renderer.device.createBindGroup({
            label: "toon bind group",
            layout: this.deferredBindGroupLayout,
            entries: [
                {
                    binding: 0,
                    resource: this.positionTextureView
                },
                {
                    binding: 1,
                    resource: this.albedoTextureView
                },
                {
                    binding: 2,
                    resource: this.normalTextureView
                }
            ]
        });

        // Toon compute pipeline.
        this.toonPipeline = renderer.device.createRenderPipeline({
            layout: renderer.device.createPipelineLayout({
                label: "toon + clustered deferred pipeline layout",
                bindGroupLayouts: [
                    this.sceneUniformsBindGroupLayout,
                    this.toonBindGroupLayout
                ]
            }),
            depthStencil: {
                depthWriteEnabled: true,
                depthCompare: "less",
                format: "depth24plus"
            },
            vertex: {
                module: renderer.device.createShaderModule({
                    label: "toon + clustered deferred vert shader",
                    code: shaders.clusteredDeferredFullscreenVertSrc
                }),
                buffers: []
            },
            fragment: {
                module: renderer.device.createShaderModule({
                    label: "toon + clustered deferred frag shader",
                    code: shaders.clusteredDeferredToonSrc,
                }),
                targets: [
                    {
                        format: renderer.canvasFormat,
                    }
                ]
            }
        });
    }

    override draw() {
        // TODO-3: run the Deferred rendering pass:
        // - run the clustering compute shader
        // - run the G-buffer pass, outputting position, albedo, and normals
        // - run the fullscreen pass, which reads from the G-buffer and performs lighting calculations
        const encoder = renderer.device.createCommandEncoder();

        // Run Light Clustering Compute Pass
        this.lights.doLightClustering(encoder);

        const canvasTextureView = renderer.context.getCurrentTexture().createView();

        const renderPass = encoder.beginRenderPass({
            label: "clustered deferred render pass",
            colorAttachments: [
                {
                    view: this.positionTextureView,
                    clearValue: [0, 0, 0, 0],
                    loadOp: "clear",
                    storeOp: "store"
                },
                {
                    view: this.albedoTextureView,
                    clearValue: [0, 0, 0, 0],
                    loadOp: "clear",
                    storeOp: "store"
                },
                {
                    view: this.normalTextureView,
                    clearValue: [0, 0, 0, 0],
                    loadOp: "clear",
                    storeOp: "store"
                }
            ],
            depthStencilAttachment: {
                view: this.depthTextureView,
                depthClearValue: 1.0,
                depthLoadOp: "clear",
                depthStoreOp: "store"
            }
        });

        renderPass.setPipeline(this.GBufferPipeline);
        renderPass.setBindGroup(shaders.constants.bindGroup_scene, this.sceneUniformsBindGroup);

        this.scene.iterate(node => {
            renderPass.setBindGroup(shaders.constants.bindGroup_model, node.modelBindGroup);
        }, material => {
            renderPass.setBindGroup(shaders.constants.bindGroup_material, material.materialBindGroup);
        }, primitive => {
            renderPass.setVertexBuffer(0, primitive.vertexBuffer);
            renderPass.setIndexBuffer(primitive.indexBuffer, 'uint32');
            renderPass.drawIndexed(primitive.numIndices);
        });

        renderPass.end();
        // End base render pass.

        // run the fullscreen pass, which reads from the G-buffer and performs lighting calcs.
        const fullscreenRenderPass = encoder.beginRenderPass({
            label: "fullscreen deferred render pass",
            colorAttachments: [
                {
                    view: canvasTextureView,
                    clearValue: [0, 0, 0, 0],
                    loadOp: "clear",
                    storeOp: "store"
                }
            ],
            depthStencilAttachment: {
                view: this.depthTextureView,
                depthClearValue: 1.0,
                depthLoadOp: "clear",
                depthStoreOp: "store"
            }
        });
        fullscreenRenderPass.setPipeline(this.deferredFullScreenPipeline);
        fullscreenRenderPass.setBindGroup(shaders.constants.bindGroup_scene, this.sceneUniformsBindGroup)
        fullscreenRenderPass.setBindGroup(shaders.constants.bindGroup_textures, this.deferredBindGroup);
        fullscreenRenderPass.draw(6);
        fullscreenRenderPass.end();
        // End lighting calc render pass.

        // Begin toon render pass. Reads from 
        const toonRenderPass = encoder.beginRenderPass({
            label: "toon render pass",
            colorAttachments: [
                {
                    view: canvasTextureView,
                    clearValue: [0, 0, 0, 0],
                    loadOp: "clear",
                    storeOp: "store"
                }
            ],
            depthStencilAttachment: {
                view: this.depthTextureView,
                depthClearValue: 1.0,
                depthLoadOp: "clear",
                depthStoreOp: "store"
            }
        });
        // Read in toon pipeline.
        toonRenderPass.setPipeline(this.toonPipeline);
        toonRenderPass.setBindGroup(shaders.constants.bindGroup_scene, this.sceneUniformsBindGroup)
        toonRenderPass.setBindGroup(shaders.constants.bindGroup_textures, this.toonBindGroup);
        toonRenderPass.draw(6);
        toonRenderPass.end();

        renderer.device.queue.submit([encoder.finish()]);
    }
}
