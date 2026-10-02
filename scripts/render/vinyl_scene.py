"""On Repeat: photoreal LP renders for the homepage shelf.

Every album is rendered top-down through one orthographic camera as separate
layers that the page stacks in CSS:

  sleeve_<slug>.png  printed board sleeve with ring wear and its contact shadow
  record.png         the vinyl, shared by every album. The groove sheen is baked
                     here and never moves, because a real record's highlight stays
                     put while the disc turns underneath it
  label_<slug>.png   the centre label, the only layer the page rotates

Same camera, same lights, same canvas for sleeve and record, so a CSS translate
slides the record out of the sleeve without breaking perspective.

    blender -b -P scripts/render/vinyl_scene.py -- <covers> <labels> <out> [slug|all] [samples]
"""
import math
import os
import sys

import bpy
from mathutils import Vector

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from vinyl_albums import ALBUMS  # noqa: E402

# Real LP dimensions, metres.
SLEEVE = 0.314
SLEEVE_T = 0.0032
DISC_R = 0.1505
DISC_T = 0.0016
LABEL_R = 0.0505
CANVAS = 0.42          # ortho frame across, room for the shadow and the slide
RES = 1400
LABEL_RES = 760


# ---------------------------------------------------------------- scene
def reset(samples):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    sc.render.engine = "CYCLES"
    sc.cycles.device = "GPU"
    sc.cycles.samples = samples
    sc.cycles.use_adaptive_sampling = True
    sc.cycles.adaptive_threshold = 0.006
    sc.cycles.use_denoising = True
    sc.cycles.max_bounces = 10
    sc.cycles.glossy_bounces = 6
    sc.render.film_transparent = True
    sc.render.image_settings.file_format = "PNG"
    sc.render.image_settings.color_mode = "RGBA"
    sc.render.image_settings.color_depth = "16"
    sc.render.image_settings.compression = 15
    # Standard keeps the printed sleeve art faithful to the source file.
    sc.view_settings.view_transform = "Standard"
    sc.view_settings.look = "None"
    sc.view_settings.exposure = 0.0

    prefs = bpy.context.preferences.addons["cycles"].preferences
    for dt in ("OPTIX", "CUDA"):
        try:
            prefs.compute_device_type = dt
            prefs.get_devices()
            if any(d.type == dt for d in prefs.devices):
                for d in prefs.devices:
                    d.use = d.type == dt
                break
        except Exception:
            continue

    world = bpy.data.worlds.new("room")
    sc.world = world
    world.use_nodes = True
    bg = world.node_tree.nodes["Background"]
    bg.inputs["Color"].default_value = (0.86, 0.84, 0.80, 1)
    bg.inputs["Strength"].default_value = 0.012
    return sc


def look_at(obj, target):
    d = Vector(target) - obj.location
    obj.rotation_euler = d.to_track_quat("-Z", "Y").to_euler()


def lights():
    # Key: big soft window, upper left, a little warm. Its reflection is what
    # draws the streak across the grooves.
    bpy.ops.object.light_add(type="AREA", location=(-0.62, 0.52, 0.78))
    key = bpy.context.object
    key.data.shape = "RECTANGLE"
    key.data.size, key.data.size_y = 1.1, 0.7
    key.data.energy = 21
    key.data.color = (1.0, 0.95, 0.88)
    look_at(key, (0.02, -0.02, 0))

    # Fill: broad and dim from the right so the shadow side keeps detail.
    bpy.ops.object.light_add(type="AREA", location=(0.9, -0.3, 0.6))
    fill = bpy.context.object
    fill.data.size = 1.6
    fill.data.energy = 4
    fill.data.color = (0.92, 0.95, 1.0)
    look_at(fill, (0, 0, 0))



def sheen_strip(energy=3.0):
    """A long thin softbox almost overhead. Only the record job uses it: from a
    top-down camera this is the only light the vinyl can mirror, and it's what
    draws the streak across the grooves."""
    bpy.ops.object.light_add(type="AREA", location=(0.05, 0.14, 1.1))
    s = bpy.context.object
    s.data.shape = "RECTANGLE"
    s.data.size, s.data.size_y = 0.8, 0.05
    s.data.energy = energy
    s.rotation_euler = (math.radians(-7), 0, math.radians(-28))


def gloss_panel(energy=1.2):
    """Very dim overhead panel for the sleeve's laminate: a gentle gradient of
    gloss, not a hotspot."""
    bpy.ops.object.light_add(type="AREA", location=(-0.25, 0.3, 1.6))
    p = bpy.context.object
    p.data.size = 1.2
    p.data.energy = energy
    look_at(p, (0, 0, 0))


def camera(scale=CANVAS, res=RES, cx=0.0, cy=0.0):
    bpy.ops.object.camera_add(location=(cx, cy, 2.0), rotation=(0, 0, 0))
    cam = bpy.context.object
    cam.data.type = "ORTHO"
    cam.data.ortho_scale = scale
    cam.data.clip_end = 10
    sc = bpy.context.scene
    sc.camera = cam
    sc.render.resolution_x = sc.render.resolution_y = res
    return cam


def table():
    bpy.ops.mesh.primitive_plane_add(size=3, location=(0, 0, 0))
    t = bpy.context.object
    t.is_shadow_catcher = True
    return t


# ---------------------------------------------------------------- materials
def node(nt, kind, loc=(0, 0), **inputs):
    n = nt.nodes.new(kind)
    n.location = loc
    for k, v in inputs.items():
        n.inputs[k].default_value = v
    return n


def sleeve_material(cover_path):
    m = bpy.data.materials.new("sleeve")
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    out = node(nt, "ShaderNodeOutputMaterial", (1400, 0))
    bsdf = node(nt, "ShaderNodeBsdfPrincipled", (1100, 0))
    bsdf.inputs["Specular IOR Level"].default_value = 0.32
    nt.links.new(bsdf.outputs[0], out.inputs[0])

    tc = node(nt, "ShaderNodeTexCoord", (-1400, 0))
    sep = node(nt, "ShaderNodeSeparateXYZ", (-1200, 0))
    nt.links.new(tc.outputs["Object"], sep.inputs[0])

    # Cover art: object space is -0.5..0.5 on the unit cube before scaling.
    uv = node(nt, "ShaderNodeMapping", (-1000, 300))
    uv.inputs["Location"].default_value = (0.5, 0.5, 0)
    nt.links.new(tc.outputs["Object"], uv.inputs[0])
    img = nt.nodes.new("ShaderNodeTexImage")
    img.location = (-800, 300)
    img.image = bpy.data.images.load(cover_path)
    img.extension = "EXTEND"
    img.interpolation = "Cubic"
    nt.links.new(uv.outputs[0], img.inputs[0])

    # Distance from centre for ring wear, distance to edge for corner wear.
    xy = node(nt, "ShaderNodeCombineXYZ", (-1000, -100))
    nt.links.new(sep.outputs[0], xy.inputs[0])
    nt.links.new(sep.outputs[1], xy.inputs[1])
    rad = node(nt, "ShaderNodeVectorMath", (-850, -100))
    rad.operation = "LENGTH"
    nt.links.new(xy.outputs[0], rad.inputs[0])
    ring_c = DISC_R / SLEEVE
    ring = node(nt, "ShaderNodeMapRange", (-650, -100))
    ring.interpolation_type = "SMOOTHERSTEP"
    ring.inputs["From Min"].default_value = ring_c - 0.012
    ring.inputs["From Max"].default_value = ring_c - 0.004
    nt.links.new(rad.outputs["Value"], ring.inputs["Value"])
    ring_out = node(nt, "ShaderNodeMapRange", (-650, -300))
    ring_out.inputs["From Min"].default_value = ring_c + 0.002
    ring_out.inputs["From Max"].default_value = ring_c - 0.004
    nt.links.new(rad.outputs["Value"], ring_out.inputs["Value"])
    ring_band = node(nt, "ShaderNodeMath", (-450, -200))
    ring_band.operation = "MULTIPLY"
    nt.links.new(ring.outputs[0], ring_band.inputs[0])
    nt.links.new(ring_out.outputs[0], ring_band.inputs[1])

    ax = node(nt, "ShaderNodeMath", (-1000, -500)); ax.operation = "ABSOLUTE"
    ay = node(nt, "ShaderNodeMath", (-1000, -650)); ay.operation = "ABSOLUTE"
    nt.links.new(sep.outputs[0], ax.inputs[0])
    nt.links.new(sep.outputs[1], ay.inputs[0])
    mx = node(nt, "ShaderNodeMath", (-850, -560)); mx.operation = "MAXIMUM"
    nt.links.new(ax.outputs[0], mx.inputs[0])
    nt.links.new(ay.outputs[0], mx.inputs[1])
    edge = node(nt, "ShaderNodeMapRange", (-650, -560))
    edge.inputs["From Min"].default_value = 0.493
    edge.inputs["From Max"].default_value = 0.5
    nt.links.new(mx.outputs[0], edge.inputs["Value"])

    # Wear is broken up by noise so nothing reads as a clean vector ring.
    wn = node(nt, "ShaderNodeTexNoise", (-650, -800), Scale=140.0, Detail=10.0, Roughness=0.7)
    nt.links.new(tc.outputs["Object"], wn.inputs["Vector"])
    wcut = node(nt, "ShaderNodeMapRange", (-450, -800))
    wcut.inputs["From Min"].default_value = 0.5
    wcut.inputs["From Max"].default_value = 0.78
    nt.links.new(wn.outputs["Fac"], wcut.inputs["Value"])

    # Ring wear rubs through in long soft patches, not speckle.
    rn = node(nt, "ShaderNodeTexNoise", (-650, -1000), Scale=7.0, Detail=2.0, Roughness=0.4)
    nt.links.new(tc.outputs["Object"], rn.inputs["Vector"])
    rcut = node(nt, "ShaderNodeMapRange", (-450, -1000))
    rcut.inputs["From Min"].default_value = 0.45
    rcut.inputs["From Max"].default_value = 0.7
    rcut.inputs["To Max"].default_value = 0.7
    nt.links.new(rn.outputs["Fac"], rcut.inputs["Value"])
    ring_w = node(nt, "ShaderNodeMath", (-250, -250)); ring_w.operation = "MULTIPLY"
    nt.links.new(ring_band.outputs[0], ring_w.inputs[0])
    nt.links.new(rcut.outputs[0], ring_w.inputs[1])
    edge_w = node(nt, "ShaderNodeMath", (-250, -560)); edge_w.operation = "MULTIPLY"
    nt.links.new(edge.outputs[0], edge_w.inputs[0])
    nt.links.new(wcut.outputs[0], edge_w.inputs[1])
    wear = node(nt, "ShaderNodeMath", (-80, -400)); wear.operation = "ADD"
    wear.use_clamp = True
    nt.links.new(ring_w.outputs[0], wear.inputs[0])
    nt.links.new(edge_w.outputs[0], wear.inputs[1])
    wear_amt = node(nt, "ShaderNodeMath", (80, -400)); wear_amt.operation = "MULTIPLY"
    wear_amt.inputs[1].default_value = 0.075
    nt.links.new(wear.outputs[0], wear_amt.inputs[0])

    # Scuffed board shows through as a pale, slightly warm grey.
    worn = node(nt, "ShaderNodeMix", (300, 200))
    worn.data_type = "RGBA"
    worn.blend_type = "SCREEN"
    worn.inputs["B"].default_value = (0.78, 0.75, 0.70, 1)
    nt.links.new(wear_amt.outputs[0], worn.inputs["Factor"])
    nt.links.new(img.outputs["Color"], worn.inputs["A"])

    # Faces that aren't the front are raw board edge.
    geo = node(nt, "ShaderNodeNewGeometry", (-200, 600))
    nz = node(nt, "ShaderNodeSeparateXYZ", (0, 600))
    nt.links.new(geo.outputs["Normal"], nz.inputs[0])
    front = node(nt, "ShaderNodeMapRange", (200, 600))
    front.inputs["From Min"].default_value = 0.7
    front.inputs["From Max"].default_value = 0.95
    nt.links.new(nz.outputs[2], front.inputs["Value"])
    face = node(nt, "ShaderNodeMix", (600, 300))
    face.data_type = "RGBA"
    face.inputs["A"].default_value = (0.62, 0.60, 0.56, 1)
    nt.links.new(front.outputs[0], face.inputs["Factor"])
    nt.links.new(worn.outputs["Result"], face.inputs["B"])
    nt.links.new(face.outputs["Result"], bsdf.inputs["Base Color"])

    # Laminated print, softened where it's scuffed.
    rough = node(nt, "ShaderNodeMath", (600, -200)); rough.operation = "MULTIPLY_ADD"
    rough.inputs[1].default_value = 0.4
    rough.inputs[2].default_value = 0.42
    nt.links.new(wear.outputs[0], rough.inputs[0])
    nt.links.new(rough.outputs[0], bsdf.inputs["Roughness"])

    # Paper tooth plus the raised ring of the record pressing through the board.
    tooth = node(nt, "ShaderNodeTexNoise", (300, -700), Scale=900.0, Detail=4.0)
    nt.links.new(tc.outputs["Object"], tooth.inputs["Vector"])
    hsum = node(nt, "ShaderNodeMath", (550, -650)); hsum.operation = "MULTIPLY_ADD"
    hsum.inputs[1].default_value = 6.0
    nt.links.new(ring_band.outputs[0], hsum.inputs[0])
    nt.links.new(tooth.outputs["Fac"], hsum.inputs[2])
    bump = node(nt, "ShaderNodeBump", (850, -500), Strength=0.035, Distance=0.0006)
    nt.links.new(hsum.outputs[0], bump.inputs["Height"])
    nt.links.new(bump.outputs[0], bsdf.inputs["Normal"])
    return m


def vinyl_material():
    """Pressed PVC: near-black, anisotropic along the spiral, banded by the music."""
    m = bpy.data.materials.new("vinyl")
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    out = node(nt, "ShaderNodeOutputMaterial", (1200, 0))
    bsdf = node(nt, "ShaderNodeBsdfPrincipled", (900, 0))
    bsdf.inputs["Base Color"].default_value = (0.006, 0.006, 0.0065, 1)
    bsdf.inputs["Specular IOR Level"].default_value = 0.55
    nt.links.new(bsdf.outputs[0], out.inputs[0])

    tan = nt.nodes.new("ShaderNodeTangent")
    tan.location = (600, -400)
    tan.direction_type = "RADIAL"
    tan.axis = "Z"
    nt.links.new(tan.outputs[0], bsdf.inputs["Tangent"])

    tc = node(nt, "ShaderNodeTexCoord", (-1200, 0))
    sep = node(nt, "ShaderNodeSeparateXYZ", (-1000, 0))
    nt.links.new(tc.outputs["Object"], sep.inputs[0])
    xy = node(nt, "ShaderNodeCombineXYZ", (-850, 0))
    nt.links.new(sep.outputs[0], xy.inputs[0])
    nt.links.new(sep.outputs[1], xy.inputs[1])
    r = node(nt, "ShaderNodeVectorMath", (-700, 0)); r.operation = "LENGTH"
    nt.links.new(xy.outputs[0], r.inputs[0])

    def band(lo, hi, soft, loc):
        a = node(nt, "ShaderNodeMapRange", (loc[0], loc[1]))
        a.interpolation_type = "SMOOTHSTEP"
        a.inputs["From Min"].default_value = lo - soft
        a.inputs["From Max"].default_value = lo + soft
        nt.links.new(r.outputs["Value"], a.inputs["Value"])
        b = node(nt, "ShaderNodeMapRange", (loc[0], loc[1] - 160))
        b.interpolation_type = "SMOOTHSTEP"
        b.inputs["From Min"].default_value = hi + soft
        b.inputs["From Max"].default_value = hi - soft
        nt.links.new(r.outputs["Value"], b.inputs["Value"])
        m_ = node(nt, "ShaderNodeMath", (loc[0] + 180, loc[1] - 80)); m_.operation = "MULTIPLY"
        nt.links.new(a.outputs[0], m_.inputs[0])
        nt.links.new(b.outputs[0], m_.inputs[1])
        return m_

    # Grooved programme area, minus five quiet track gaps.
    grooves = band(0.0605, 0.1462, 0.0004, (-450, 400))
    gaps = [0.0745, 0.0890, 0.1032, 0.1180, 0.1325]
    acc = grooves
    for i, g in enumerate(gaps):
        gb = band(g - 0.0006, g + 0.0006, 0.0002, (-450, 100 - i * 360))
        inv = node(nt, "ShaderNodeMath", (-90, 100 - i * 360)); inv.operation = "SUBTRACT"
        inv.inputs[0].default_value = 1.0
        nt.links.new(gb.outputs[0], inv.inputs[1])
        mul = node(nt, "ShaderNodeMath", (80, 100 - i * 360)); mul.operation = "MULTIPLY"
        nt.links.new(acc.outputs[0], mul.inputs[0])
        nt.links.new(inv.outputs[0], mul.inputs[1])
        acc = mul

    # Loud and quiet passages cut the groove differently: soft radial banding.
    rr = node(nt, "ShaderNodeCombineXYZ", (-500, -1700))
    nt.links.new(r.outputs["Value"], rr.inputs[0])
    music = node(nt, "ShaderNodeTexNoise", (-300, -1700), Scale=140.0, Detail=3.0, Roughness=0.5)
    music.noise_dimensions = "1D"
    nt.links.new(r.outputs["Value"], music.inputs["W"])
    fine = node(nt, "ShaderNodeTexNoise", (-300, -1950), Scale=1100.0, Detail=1.0, Roughness=0.3)
    fine.noise_dimensions = "1D"
    nt.links.new(r.outputs["Value"], fine.inputs["W"])
    blend = node(nt, "ShaderNodeMix", (-120, -1850))
    blend.data_type = "FLOAT"
    blend.inputs["Factor"].default_value = 0.3
    nt.links.new(music.outputs["Fac"], blend.inputs["A"])
    nt.links.new(fine.outputs["Fac"], blend.inputs["B"])
    mus = node(nt, "ShaderNodeMapRange", (-100, -1700))
    mus.inputs["To Min"].default_value = 0.085
    mus.inputs["To Max"].default_value = 0.16
    nt.links.new(blend.outputs["Result"], mus.inputs["Value"])

    rough = node(nt, "ShaderNodeMix", (500, 200))
    rough.data_type = "FLOAT"
    rough.inputs["A"].default_value = 0.16   # land, run-out, rim: smoother cut, duller sheen
    nt.links.new(acc.outputs[0], rough.inputs["Factor"])
    nt.links.new(mus.outputs[0], rough.inputs["B"])
    nt.links.new(rough.outputs["Result"], bsdf.inputs["Roughness"])

    aniso = node(nt, "ShaderNodeMath", (500, 0)); aniso.operation = "MULTIPLY"
    aniso.inputs[1].default_value = 0.97
    nt.links.new(acc.outputs[0], aniso.inputs[0])
    nt.links.new(aniso.outputs[0], bsdf.inputs["Anisotropic"])
    return m


def label_material(label_path):
    m = bpy.data.materials.new("label")
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    out = node(nt, "ShaderNodeOutputMaterial", (900, 0))
    bsdf = node(nt, "ShaderNodeBsdfPrincipled", (300, 0), Roughness=0.62)
    bsdf.inputs["Specular IOR Level"].default_value = 0.3
    tc = node(nt, "ShaderNodeTexCoord", (-900, 0))
    mp = node(nt, "ShaderNodeMapping", (-700, 0))
    mp.inputs["Location"].default_value = (0.5, 0.5, 0)
    mp.inputs["Scale"].default_value = (0.5 / LABEL_R, 0.5 / LABEL_R, 1)
    # Mapping scales before translating, so feed metres and let it normalise.
    mp.vector_type = "POINT"
    nt.links.new(tc.outputs["Object"], mp.inputs[0])
    img = nt.nodes.new("ShaderNodeTexImage")
    img.location = (-450, 0)
    img.image = bpy.data.images.load(label_path)
    img.interpolation = "Cubic"
    img.extension = "CLIP"
    nt.links.new(mp.outputs[0], img.inputs[0])
    nt.links.new(img.outputs["Color"], bsdf.inputs["Base Color"])
    tooth = node(nt, "ShaderNodeTexNoise", (-200, -300), Scale=2400.0, Detail=3.0)
    nt.links.new(tc.outputs["Object"], tooth.inputs["Vector"])
    bump = node(nt, "ShaderNodeBump", (100, -300), Strength=0.04, Distance=0.0003)
    nt.links.new(tooth.outputs["Fac"], bump.inputs["Height"])
    nt.links.new(bump.outputs[0], bsdf.inputs["Normal"])
    # Spindle hole comes through as real transparency.
    tr = node(nt, "ShaderNodeBsdfTransparent", (300, 200))
    mix = node(nt, "ShaderNodeMixShader", (650, 0))
    nt.links.new(img.outputs["Alpha"], mix.inputs[0])
    nt.links.new(tr.outputs[0], mix.inputs[1])
    nt.links.new(bsdf.outputs[0], mix.inputs[2])
    nt.links.new(mix.outputs[0], out.inputs[0])
    return m


# ---------------------------------------------------------------- objects
def sleeve(cover_path):
    bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0, DISC_T + SLEEVE_T / 2))
    s = bpy.context.object
    s.scale = (SLEEVE, SLEEVE, SLEEVE_T)
    bpy.ops.object.transform_apply(scale=False)
    bev = s.modifiers.new("soft", "BEVEL")
    bev.width = 0.0012
    bev.segments = 4
    bev.affect = "EDGES"
    bev.use_clamp_overlap = True
    bpy.ops.object.shade_smooth()
    s.data.materials.append(sleeve_material(cover_path))
    return s


def disc():
    bpy.ops.mesh.primitive_cylinder_add(vertices=512, radius=DISC_R, depth=DISC_T,
                                        location=(0, 0, DISC_T / 2))
    d = bpy.context.object
    bev = d.modifiers.new("rim", "BEVEL")
    bev.width = 0.0005
    bev.segments = 3
    bpy.ops.object.shade_smooth()
    d.data.materials.append(vinyl_material())
    return d


def label(label_path):
    bpy.ops.mesh.primitive_cylinder_add(vertices=256, radius=LABEL_R, depth=0.0002,
                                        location=(0, 0, DISC_T + 0.0001))
    l_ = bpy.context.object
    bpy.ops.object.shade_smooth()
    if label_path:
        l_.data.materials.append(label_material(label_path))
    return l_


def render(path):
    sc = bpy.context.scene
    sc.render.filepath = path
    bpy.ops.render.render(write_still=True)
    print("[vinyl] wrote", path)


# ---------------------------------------------------------------- jobs
def job_sleeve(a, covers, out, samples):
    reset(samples)
    lights(); gloss_panel(); table(); camera()
    sleeve(os.path.join(covers, a["slug"] + ".jpg"))
    render(os.path.join(out, f"sleeve_{a['slug']}.png"))


def job_record(out, samples):
    reset(samples)
    lights(); sheen_strip(); table(); camera()
    disc()
    hole = label(None)
    hole.is_holdout = True  # the page lays the turning label in here
    render(os.path.join(out, "record.png"))


def job_label(a, labels, out, samples):
    reset(samples)
    lights(); camera(scale=LABEL_R * 2.02, res=LABEL_RES)
    label(os.path.join(labels, f"label_{a['slug']}.png"))
    render(os.path.join(out, f"label_{a['slug']}.png"))


if __name__ == "__main__":
    argv = sys.argv[sys.argv.index("--") + 1:]
    covers, labels, out = argv[0], argv[1], argv[2]
    which = argv[3] if len(argv) > 3 else "all"
    samples = int(argv[4]) if len(argv) > 4 else 256
    os.makedirs(out, exist_ok=True)
    picks = ALBUMS if which in ("all", "sleeves", "labels") else [a for a in ALBUMS if a["slug"] == which]
    if which in ("all", "record"):
        job_record(out, samples)
    for a in picks:
        if which != "labels" and which != "record":
            job_sleeve(a, covers, out, samples)
        if which != "sleeves" and which != "record":
            job_label(a, labels, out, samples)
