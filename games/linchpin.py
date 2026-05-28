"""
LINCHPIN — The space between sectors
Guinea Pig Trench LLC

The between IS the product. The mistake IS the signal. The almost IS the always.

Controls:
  WASD - Move (W forward, S back)
  Mouse - Look
  Left Shift - Boost
  Left Click - Fire
  Space - FTL Jump (when ready)
  P - Pause
  ESC - Quit
"""

import pygame
from pygame.locals import *
from OpenGL.GL import *
from OpenGL.GLU import *
from OpenGL.GL.shaders import compileProgram, compileShader
import numpy as np
import math
import random
import ctypes

# ------------------- Configuration -------------------
SCREEN_SIZE = (1280, 720)
FPS = 60
DEG2RAD = math.pi / 180.0

SHIP_HULL_COLOR = (0.30, 0.34, 0.38)
SHIP_ACCENT_COLOR = (0.10, 0.60, 1.00)

SECTOR_SIZE = 10000.0
MAJOR_NODE_STEP = 5

BASE_PLANET_RADIUS = 5.0

STAR_COUNT = 800
COMPASS_RADIUS = 60.0
FIRE_COOLDOWN = 0.12

NEBULA_R_MAJOR = 4000.0
NEBULA_R_MINOR = 800.0
NEBULA_SEGMENTS = 32
NEBULA_RADIAL = 16

VISIBLE_DISTANCE = 32000.0
FOV_MARGIN_DEG = 10.0
NEAR_PERSIST_RADIUS = 8000.0
FAR_CULL_RADIUS = 30000.0

FOG_COLOR = np.array([0.02, 0.03, 0.05], dtype=np.float32)


# =====================================================
# Core State
# =====================================================
class PlanetMesh:
    def __init__(self, radius, res_hi=50, res_lo=30, d_noise_hi=0.06, d_noise_lo=0.03):
        self.hi_verts, self.hi_norms, self.hi_indices = self._gen_mesh(radius, res_hi, d_noise_hi)
        self.lo_verts, self.lo_norms, self.lo_indices = self._gen_mesh(radius, res_lo, d_noise_lo)
        self.radius = radius
        self.hi_index_count = len(self.hi_indices)
        self.lo_index_count = len(self.lo_indices)

    def _gen_mesh(self, r, res, d_noise):
        verts = []
        normals = []
        indices = []
        for i in range(res + 1):
            lat = math.pi * i / res
            slat = math.sin(lat)
            clat = math.cos(lat)
            for j in range(res + 1):
                lon = 2 * math.pi * j / res
                clon = math.cos(lon)
                slon = math.sin(lon)
                x = slat * clon
                y = slat * slon
                z = clat
                m = r * (1 + np.random.uniform(-d_noise, d_noise))
                verts.append([x * m, y * m, z * m])
                normals.append([x, y, z])
        for i in range(res):
            base_i = i * (res + 1)
            next_i = (i + 1) * (res + 1)
            for j in range(res):
                i0 = base_i + j
                i1 = next_i + j
                i2 = next_i + j + 1
                i3 = base_i + j + 1
                indices.extend((i0, i1, i2, i0, i2, i3))
        return (
            np.array(verts, dtype=np.float32),
            np.array(normals, dtype=np.float32),
            np.array(indices, dtype=np.uint32)
        )


class SystemBody:
    def __init__(self, kind, pos, radius, color, orbit_radius=0.0, orbit_speed=0.0, orbit_phase=0.0):
        self.kind = kind
        self.base_pos = np.array(pos, dtype=np.float32)
        self.pos = np.array(pos, dtype=np.float32)
        self.radius = radius
        self.color = color
        self.orbit_radius = orbit_radius
        self.orbit_speed = orbit_speed
        self.orbit_phase = orbit_phase
        self.mesh = None
        self.land_scale = 1.0
        self.heat = 0.0
        self.fade = 1.0


class PlanetDef:
    __slots__ = ("orbit_radius", "orbit_phase", "orbit_speed", "radius", "color", "y_offset")
    def __init__(self, orbit_radius, orbit_phase, orbit_speed, radius, color, y_offset):
        self.orbit_radius = orbit_radius
        self.orbit_phase = orbit_phase
        self.orbit_speed = orbit_speed
        self.radius = radius
        self.color = color
        self.y_offset = y_offset


class System:
    def __init__(self, sector_coord, stars, planet_defs, nebula_segments):
        self.sector_coord = sector_coord
        self.stars = stars
        self.planet_defs = planet_defs
        self.active_planets = []
        self.nebula_segments = nebula_segments


# ------------------- Ship VBOs -------------------
class ShipVBO:
    def __init__(self):
        self.vertices = np.array([
            -0.4, 0.2, 1.6, *SHIP_HULL_COLOR,
            0.4, 0.2, 1.6, *SHIP_HULL_COLOR,
            0.3, 0.2, -1.8, *SHIP_HULL_COLOR,
            -0.3, 0.2, -1.8, *SHIP_HULL_COLOR,
            -0.4,-0.2, 1.2, *SHIP_HULL_COLOR,
            0.4,-0.2, 1.2, *SHIP_HULL_COLOR,
            0.3,-0.2, -1.5, *SHIP_HULL_COLOR,
            -0.3,-0.2, -1.5, *SHIP_HULL_COLOR,
            -0.2, 0.0, 0.4, *SHIP_HULL_COLOR,
            -3.0, 0.0, -1.6, *SHIP_HULL_COLOR,
            -0.2, 0.0, -0.6, *SHIP_HULL_COLOR,
            0.2, 0.0, 0.4, *SHIP_HULL_COLOR,
            3.0, 0.0, -1.6, *SHIP_HULL_COLOR,
            0.2, 0.0, -0.6, *SHIP_HULL_COLOR,
        ], dtype=np.float32)
        self.indices = np.array([
            0, 1, 2, 0, 2, 3,
            4, 6, 5, 4, 7, 6,
            8, 9, 10,
            11, 12, 13
        ], dtype=np.uint32)
        self.vao = glGenVertexArrays(1)
        glBindVertexArray(self.vao)
        self.vbo = glGenBuffers(1)
        glBindBuffer(GL_ARRAY_BUFFER, self.vbo)
        glBufferData(GL_ARRAY_BUFFER, self.vertices.nbytes, self.vertices, GL_STATIC_DRAW)
        self.ebo = glGenBuffers(1)
        glBindBuffer(GL_ELEMENT_ARRAY_BUFFER, self.ebo)
        glBufferData(GL_ELEMENT_ARRAY_BUFFER, self.indices.nbytes, self.indices, GL_STATIC_DRAW)
        stride = 6 * 4
        glEnableVertexAttribArray(0)
        glVertexAttribPointer(0, 3, GL_FLOAT, GL_FALSE, stride, ctypes.c_void_p(0))
        glEnableVertexAttribArray(1)
        glVertexAttribPointer(1, 3, GL_FLOAT, GL_FALSE, stride, ctypes.c_void_p(12))
        glBindVertexArray(0)
        self.count = len(self.indices)


class EngineGlow:
    def __init__(self):
        self.vertices = np.array([-0.5,-0.5,0.0, 0.5,-0.5,0.0, 0.5,0.5,0.0, -0.5,0.5,0.0], dtype=np.float32)
        self.indices = np.array([0,1,2, 0,2,3], dtype=np.uint32)
        self.vao = glGenVertexArrays(1)
        glBindVertexArray(self.vao)
        self.vbo = glGenBuffers(1)
        glBindBuffer(GL_ARRAY_BUFFER, self.vbo)
        glBufferData(GL_ARRAY_BUFFER, self.vertices.nbytes, self.vertices, GL_STATIC_DRAW)
        self.ebo = glGenBuffers(1)
        glBindBuffer(GL_ELEMENT_ARRAY_BUFFER, self.ebo)
        glBufferData(GL_ELEMENT_ARRAY_BUFFER, self.indices.nbytes, self.indices, GL_STATIC_DRAW)
        glEnableVertexAttribArray(0)
        glVertexAttribPointer(0, 3, GL_FLOAT, GL_FALSE, 3*4, ctypes.c_void_p(0))
        glBindVertexArray(0)
        self.count = len(self.indices)


# ------------------- Shaders -------------------
SHIP_VERTEX_SHADER = """
#version 120
attribute vec3 in_pos;
attribute vec3 in_color;
uniform mat4 model;
uniform mat4 view;
uniform mat4 projection;
varying vec3 frag_color;
void main() {
    frag_color = in_color;
    gl_Position = projection * view * model * vec4(in_pos, 1.0);
}
"""

SHIP_FRAGMENT_SHADER = """
#version 120
varying vec3 frag_color;
void main() {
    gl_FragColor = vec4(frag_color, 1.0);
}
"""

ENGINE_VERTEX_SHADER = """
#version 120
attribute vec3 in_pos;
uniform mat4 model;
uniform mat4 view;
uniform mat4 projection;
varying vec2 tex_coord;
void main() {
    gl_Position = projection * view * model * vec4(in_pos, 1.0);
    tex_coord = in_pos.xy;
}
"""

ENGINE_FRAGMENT_SHADER = """
#version 120
varying vec2 tex_coord;
uniform float alpha;
void main() {
    float intensity = 1.0 - length(tex_coord);
    gl_FragColor = vec4(0.2, 0.7, 1.0, alpha * intensity);
}
"""


def create_shader(vs, fs):
    return compileProgram(compileShader(vs, GL_VERTEX_SHADER), compileShader(fs, GL_FRAGMENT_SHADER))


# =====================================================
# Linchpin — Core State
# =====================================================
class Linchpin:
    def __init__(self):
        self.time = 0.0
        self.player_pos = np.array([0.0, 0.0, 40.0], dtype=np.float32)
        self.player_rot = np.array([0.0, 180.0, 0.0], dtype=np.float32)
        self.boost = False
        self.cam_pos = self.player_pos.copy()
        self.cam_shake = 0.0
        self.ship_roll = 0.0
        self.fov = 45.0
        self.projectiles = []
        self.hit_effects = []
        self.ftl_ready = True
        self.ftl_cooldown = 0.0
        self.stars = self._generate_local_stars()
        self.current_sector = (0, 0, 0)
        self.system = None
        self.star_light_pos = np.array([300.0, 150.0, -300.0], dtype=np.float32)
        self.base_planet_mesh = PlanetMesh(BASE_PLANET_RADIUS)
        self.paused = False
        self.running = True
        self.ship_vbo = None
        self.engine_glow = None
        self.ship_shader = None
        self.glow_shader = None
        self.speed = 0.0
        self.max_speed = 220.0
        self.ls = 0.0

    def _generate_local_stars(self):
        s = np.random.uniform(-1, 1, (STAR_COUNT, 3))
        for i in range(STAR_COUNT):
            v = s[i]
            n = np.linalg.norm(v)
            if n > 1e-6:
                v /= n
            s[i] = v * random.uniform(150, 400)
        return s.astype(np.float32)

    def get_radar_entities(self):
        entities = []
        if self.system is not None:
            for b in self.system.stars:
                entities.append({'pos': b.pos, 'color': (1.0, 1.0, 0.6)})
            for b in self.system.active_planets:
                entities.append({'pos': b.pos, 'color': (0.2, 0.6, 1.0)})
            for p in self.projectiles:
                entities.append({'pos': p.pos, 'color': (1.0, 0.2, 0.0)})
        return entities


# =====================================================
# Game Objects
# =====================================================
class Projectile:
    __slots__ = ("pos", "dir", "life")
    def __init__(self, pos, direction):
        self.pos = np.array(pos, dtype=np.float32)
        self.dir = np.array(direction, dtype=np.float32)
        self.life = 1.5
    def update(self, dt):
        self.pos += self.dir * (180.0 * dt)
        self.life -= dt


class HitEffect:
    __slots__ = ("pos", "life")
    def __init__(self, pos):
        self.pos = np.array(pos, dtype=np.float32)
        self.life = 0.5
    def update(self, dt):
        self.life -= dt


# =====================================================
# Universe / Systems
# =====================================================
def sector_coord_from_pos(pos):
    inv_sector = 1.0 / SECTOR_SIZE
    return (int(math.floor(pos[0] * inv_sector)), int(math.floor(pos[1] * inv_sector)), int(math.floor(pos[2] * inv_sector)))


def sector_seed(coord):
    return hash(coord) & 0xffffffff


def fractal_scaling_for_sector(coord):
    sx, sy, sz = coord
    d = math.sqrt(sx*sx + sy*sy + sz*sz)
    return 1.0 + d * 0.15, min(1.0, d * 0.05), min(1.5, 0.5 + d * 0.2)


def generate_torus_segment(R, r, segR, segr, theta0, theta1, rng, intensity):
    verts, norms, idx = [], [], []
    for i in range(segR):
        t = theta0 + (theta1 - theta0) * (i / (segR - 1))
        cosT, sinT = math.cos(t), math.sin(t)
        for j in range(segr):
            phi = 2 * math.pi * j / (segr - 1)
            cosP, sinP = math.cos(phi), math.sin(phi)
            nx, ny, nz = cosT*cosP, sinT*cosP, sinP
            noise = math.sin(t*3 + phi*4 + rng.random()*10) * 200 * intensity
            verts.append([(R + r*cosP)*cosT + nx*noise, (R + r*cosP)*sinT + ny*noise, r*sinP + nz*noise])
            norms.append([nx, ny, nz])
    for i in range(segR - 1):
        for j in range(segr - 1):
            i0 = i*segr + j
            i1 = (i+1)*segr + j
            idx.extend((i0, i1, i1+1, i0, i1+1, i0+1))
    return np.array(verts, dtype=np.float32), np.array(norms, dtype=np.float32), np.array(idx, dtype=np.uint32)


def generate_nebula_segments(rng, intensity):
    segments = []
    seg_angle = 2 * math.pi / NEBULA_SEGMENTS
    for i in range(NEBULA_SEGMENTS):
        segments.append(generate_torus_segment(NEBULA_R_MAJOR, NEBULA_R_MINOR, 24, 12, seg_angle*i, seg_angle*(i+1), rng, intensity))
    return segments


def generate_system_for_sector(coord, base_mesh):
    seed = sector_seed(coord)
    rng = random.Random(seed)
    size_scale, color_shift, nebula_intensity = fractal_scaling_for_sector(coord)
    stars = []
    planet_defs = []
    for _ in range(rng.randint(1, 2)):
        pos = np.array([rng.uniform(-2000, 2000), rng.uniform(-2000, 2000), rng.uniform(-2000, 2000)], dtype=np.float32)
        base_col = np.array([1.0, 0.9, 0.7])
        exotic = np.array([0.6, 0.3, 1.0])
        col = base_col * (1 - color_shift) + exotic * color_shift
        stars.append(SystemBody("star", pos, rng.uniform(40, 80) * (0.6 + size_scale*0.4), tuple(col.tolist())))
    for _ in range(rng.randint(2, 7)):
        orbit_r = rng.uniform(600, 4000) * size_scale
        base_c = np.array([rng.uniform(0.1, 0.8) for _ in range(3)])
        alien_c = np.array([rng.uniform(0.1, 1.0), rng.uniform(0.0, 0.5), rng.uniform(0.5, 1.0)])
        c = base_c * (1 - color_shift) + alien_c * color_shift
        planet_defs.append(PlanetDef(orbit_r, rng.uniform(0, 2*math.pi), rng.uniform(5e-5, 3e-4)/max(0.5, size_scale),
                                     rng.uniform(3, 15)*size_scale, tuple(c.tolist()), rng.uniform(-150, 150)*size_scale*0.5))
    return System(coord, stars, planet_defs, generate_nebula_segments(rng, nebula_intensity))


# =====================================================
# FOV / Visibility
# =====================================================
def compute_camera_axes(lp):
    pr, yr = lp.player_rot[0]*DEG2RAD, lp.player_rot[1]*DEG2RAD
    fwd = np.array([math.sin(yr)*math.cos(pr), -math.sin(pr), -math.cos(yr)*math.cos(pr)], dtype=np.float32)
    right = np.cross(fwd, [0, 1, 0])
    n = np.linalg.norm(right)
    if n < 1e-5: right = np.array([1, 0, 0], dtype=np.float32)
    else: right /= n
    return fwd, right, np.cross(right, fwd)


def should_instantiate(lp, pos, radius):
    dist = np.linalg.norm(pos - lp.player_pos)
    if dist < NEAR_PERSIST_RADIUS: return True
    if dist > FAR_CULL_RADIUS: return False
    fwd, _, _ = compute_camera_axes(lp)
    to_obj = (pos - lp.player_pos)
    d = np.linalg.norm(to_obj)
    if d < 1e-3: return True
    cos_a = float(np.clip(np.dot(to_obj/d, fwd), -1, 1))
    return math.acos(cos_a) < (lp.fov + FOV_MARGIN_DEG) * DEG2RAD * 0.5


def distance_fade(dist):
    if dist <= NEAR_PERSIST_RADIUS: return 1.0
    if dist >= FAR_CULL_RADIUS: return 0.0
    t = (dist - NEAR_PERSIST_RADIUS) / (FAR_CULL_RADIUS - NEAR_PERSIST_RADIUS)
    return (1 - t) ** 2


# =====================================================
# Drawing
# =====================================================
def draw_planet_body(lp, body):
    dist = float(np.linalg.norm(lp.player_pos - body.pos))
    mesh = body.mesh
    if dist < 5 * body.radius:
        verts, norms, idx, idx_count = mesh.hi_verts, mesh.hi_norms, mesh.hi_indices, mesh.hi_index_count
    else:
        verts, norms, idx, idx_count = mesh.lo_verts, mesh.lo_norms, mesh.lo_indices, mesh.lo_index_count
    body.land_scale = 1.0 + max(0, min((3*body.radius - dist)/(2*body.radius), 0.8)) if dist < 3*body.radius else 1.0
    body.heat = max(0, min((body.radius + 3 - dist)/3, 1))
    df = distance_fade(dist)
    cf = max(0, min(df * body.fade, 1))
    if cf <= 0.001: return
    ft = max(0, min(1 - df, 1))
    base_col = np.array(body.color, dtype=np.float32)
    noise = (math.sin(lp.time*6 + dist*0.01)*0.5 + 0.5) * 0.25 * ft
    fm = max(0, min(ft*0.8 + noise, 1))
    final_col = base_col*(1 - fm) + FOG_COLOR*fm
    glPushMatrix()
    glTranslatef(*body.pos)
    glRotatef(lp.time*2, 0, 1, 0)
    s = body.land_scale * (body.radius/BASE_PLANET_RADIUS) * (0.8 + 0.2*df)
    glScalef(s, s, s)
    glEnableClientState(GL_VERTEX_ARRAY)
    glEnableClientState(GL_NORMAL_ARRAY)
    glVertexPointerf(verts)
    glNormalPointerf(norms)
    glColor4f(*final_col, cf)
    glDrawElements(GL_TRIANGLES, idx_count, GL_UNSIGNED_INT, idx)
    glDisableClientState(GL_NORMAL_ARRAY)
    glDisableClientState(GL_VERTEX_ARRAY)
    glPopMatrix()


def draw_local_starfield(lp):
    glDisable(GL_LIGHTING)
    glDisable(GL_DEPTH_TEST)
    glPushMatrix()
    glTranslatef(*lp.player_pos)
    glEnableClientState(GL_VERTEX_ARRAY)
    glVertexPointerf(lp.stars)
    glColor4f(1, 1, 1, 0.25)
    glDrawArrays(GL_POINTS, 0, STAR_COUNT)
    glDisableClientState(GL_VERTEX_ARRAY)
    glPopMatrix()
    glEnable(GL_DEPTH_TEST)


def draw_nebula_ring(lp):
    if lp.system is None: return
    glDisable(GL_LIGHTING)
    glDisable(GL_DEPTH_TEST)
    glDepthMask(GL_FALSE)
    for i, (verts, _, idx) in enumerate(lp.system.nebula_segments):
        glPushMatrix()
        glRotatef(math.sin(lp.time*0.05 + i)*5, 0, 0, 1)
        glEnableClientState(GL_VERTEX_ARRAY)
        glVertexPointerf(verts)
        pulse = 0.5 + 0.5*math.sin(lp.time*0.3 + i*0.7)
        glColor4f(0.4*pulse, 0.6, 1.0, 0.25*pulse)
        glDrawElements(GL_TRIANGLES, len(idx), GL_UNSIGNED_INT, idx)
        glDisableClientState(GL_VERTEX_ARRAY)
        glPopMatrix()
    glDepthMask(True)
    glEnable(GL_DEPTH_TEST)
    glEnable(GL_LIGHTING)


def draw_ui(lp):
    glMatrixMode(GL_PROJECTION)
    glPushMatrix()
    glLoadIdentity()
    gluOrtho2D(0, SCREEN_SIZE[0], 0, SCREEN_SIZE[1])
    glMatrixMode(GL_MODELVIEW)
    glPushMatrix()
    glLoadIdentity()
    glDisable(GL_DEPTH_TEST)
    glDisable(GL_LIGHTING)
    glEnable(GL_BLEND)
    cx, cy = SCREEN_SIZE[0]//2, SCREEN_SIZE[1]//2
    glColor4f(0, 1, 0, 0.5)
    glBegin(GL_LINES)
    glVertex2f(cx-10, cy); glVertex2f(cx+10, cy)
    glVertex2f(cx, cy-10); glVertex2f(cx, cy+10)
    glEnd()
    # Radar
    rx, ry = SCREEN_SIZE[0]-130, 130
    r = COMPASS_RADIUS * (1 + 0.03*math.sin(lp.time*5))
    glPushMatrix()
    glTranslatef(rx, ry, 0)
    glColor4f(0, 0.8, 0.5, 0.2)
    for s in (0.6, 1.0):
        glBegin(GL_LINE_LOOP)
        for i in range(32):
            t = 2*math.pi*i/32
            glVertex2f(r*s*math.cos(t), r*s*math.sin(t))
        glEnd()
    entities = lp.get_radar_entities()
    y_rad = lp.player_rot[1]*DEG2RAD
    sy, cy2 = math.sin(y_rad), math.cos(y_rad)
    glPointSize(4)
    glBegin(GL_POINTS)
    px, py2, pz = lp.player_pos
    for ent in entities:
        rx2 = float(ent['pos'][0]) - px
        rz2 = float(ent['pos'][2]) - pz
        lx = rx2*cy2 - rz2*sy
        lz = rx2*sy + rz2*cy2
        glColor4f(*ent['color'], 0.6)
        glVertex2f(lx/1500*COMPASS_RADIUS, lz/1500*COMPASS_RADIUS)
    glEnd()
    glPopMatrix()
    # Speed bar
    glColor4f(0, 0.8, 0.2, 0.6)
    glBegin(GL_LINE_LOOP)
    glVertex2f(40, 80); glVertex2f(160, 80); glVertex2f(160, 88); glVertex2f(40, 88)
    glEnd()
    sn = min(lp.speed/lp.max_speed, 1)
    glColor4f(0, 0.8, 0.2, 0.3)
    glBegin(GL_QUADS)
    glVertex2f(40, 80); glVertex2f(40+120*sn, 80); glVertex2f(40+120*sn, 88); glVertex2f(40, 88)
    glEnd()
    # FTL indicator
    if lp.ftl_ready: glColor4f(0.2, 0.8, 1, 0.8)
    else: glColor4f(0.2, 0.8, 1, 0.3)
    glBegin(GL_LINE_LOOP)
    glVertex2f(SCREEN_SIZE[0]-100, 30); glVertex2f(SCREEN_SIZE[0]-60, 30)
    glVertex2f(SCREEN_SIZE[0]-60, 50); glVertex2f(SCREEN_SIZE[0]-100, 50)
    glEnd()
    # Sector display
    glColor4f(0, 0.8, 0.5, 0.4)
    glEnable(GL_DEPTH_TEST)
    glMatrixMode(GL_MODELVIEW)
    glPopMatrix()
    glMatrixMode(GL_PROJECTION)
    glPopMatrix()


# ------------------- Ship rendering -------------------
def build_projection_matrix(fov_deg, aspect, near, far):
    f = 1.0 / math.tan(math.radians(fov_deg)/2)
    nf = 1.0/(near - far)
    return np.array([[f/aspect,0,0,0],[0,f,0,0],[0,0,(far+near)*nf,(2*far*near)*nf],[0,0,-1,0]], dtype=np.float32)


def build_view_matrix(eye, target, up):
    fwd = target - eye
    fwd /= np.linalg.norm(fwd)
    right = np.cross(up, fwd)
    right /= np.linalg.norm(right)
    cam_up = np.cross(fwd, right)
    view = np.identity(4, dtype=np.float32)
    view[0,:3] = right
    view[1,:3] = cam_up
    view[2,:3] = -fwd
    view[:3,3] = -eye
    return view


def draw_ship_modern(lp, view, projection):
    if lp.ship_shader is None or lp.ship_vbo is None: return
    glUseProgram(lp.ship_shader)
    pr, yr, rr = lp.player_rot[0]*DEG2RAD, lp.player_rot[1]*DEG2RAD, lp.ship_roll*DEG2RAD
    cx, sx2 = math.cos(pr), math.sin(pr)
    cy3, sy3 = math.cos(yr), math.sin(yr)
    cz, sz = math.cos(rr), math.sin(rr)
    Rx = np.array([[1,0,0,0],[0,cx,-sx2,0],[0,sx2,cx,0],[0,0,0,1]], dtype=np.float32)
    Ry = np.array([[cy3,0,sy3,0],[0,1,0,0],[-sy3,0,cy3,0],[0,0,0,1]], dtype=np.float32)
    Rz = np.array([[cz,-sz,0,0],[sz,cz,0,0],[0,0,1,0],[0,0,0,1]], dtype=np.float32)
    model = Rz @ Rx @ Ry
    model[:3,3] = lp.player_pos
    glUniformMatrix4fv(glGetUniformLocation(lp.ship_shader, "model"), 1, GL_FALSE, model)
    glUniformMatrix4fv(glGetUniformLocation(lp.ship_shader, "view"), 1, GL_FALSE, view)
    glUniformMatrix4fv(glGetUniformLocation(lp.ship_shader, "projection"), 1, GL_FALSE, projection)
    glBindVertexArray(lp.ship_vbo.vao)
    glDrawElements(GL_TRIANGLES, lp.ship_vbo.count, GL_UNSIGNED_INT, None)
    glBindVertexArray(0)
    glUseProgram(0)


def draw_engine_glow(lp, view, projection):
    if lp.glow_shader is None or lp.engine_glow is None: return
    glUseProgram(lp.glow_shader)
    glEnable(GL_BLEND)
    glBlendFunc(GL_SRC_ALPHA, GL_ONE)
    throttle = min(lp.speed/lp.max_speed, 1)
    pulse = 0.8 + 0.2*math.sin(lp.time*30)
    glUniformMatrix4fv(glGetUniformLocation(lp.glow_shader, "view"), 1, GL_FALSE, view)
    glUniformMatrix4fv(glGetUniformLocation(lp.glow_shader, "projection"), 1, GL_FALSE, projection)
    for side in (-0.8, 0.8):
        model = np.identity(4, dtype=np.float32)
        model[:3,3] = lp.player_pos + np.array([side, -0.1, -1.9], dtype=np.float32)
        s = 0.15 + throttle*0.15
        model = model @ np.diag([s, s, 2*throttle+0.2, 1]).astype(np.float32)
        glUniformMatrix4fv(glGetUniformLocation(lp.glow_shader, "model"), 1, GL_FALSE, model)
        glUniform1f(glGetUniformLocation(lp.glow_shader, "alpha"), 0.25*pulse)
        glBindVertexArray(lp.engine_glow.vao)
        glDrawElements(GL_TRIANGLES, lp.engine_glow.count, GL_UNSIGNED_INT, None)
        glBindVertexArray(0)
    glDisable(GL_BLEND)
    glUseProgram(0)


# =====================================================
# Input & Update
# =====================================================
def handle_input(lp, dt):
    for e in pygame.event.get():
        if e.type == QUIT: lp.running = False
        elif e.type == KEYDOWN:
            if e.key == K_ESCAPE: lp.running = False
            elif e.key == K_p: lp.paused = not lp.paused
            elif e.key == K_SPACE and lp.ftl_ready: perform_ftl_jump(lp)
    if lp.paused: return
    dx, dy = pygame.mouse.get_rel()
    lp.player_rot[1] -= dx * 0.15
    lp.player_rot[0] = float(np.clip(lp.player_rot[0] + dy*0.15, -85, 85))
    lp.ship_roll += (max(-25, min(-dx*0.3, 25)) - lp.ship_roll) * 0.2


def perform_ftl_jump(lp):
    pr, yr = lp.player_rot[0]*DEG2RAD, lp.player_rot[1]*DEG2RAD
    fwd = np.array([math.sin(yr)*math.cos(pr), 0, -math.cos(yr)*math.cos(pr)], dtype=np.float32)
    n = np.linalg.norm(fwd[:2])
    if n > 1e-3: fwd /= n
    sx, sy2, sz = lp.current_sector
    new_sector = (sx + int(round(fwd[0]*MAJOR_NODE_STEP)), sy2, sz + int(round(fwd[2]*MAJOR_NODE_STEP)))
    lp.current_sector = new_sector
    lp.player_pos = np.array([new_sector[0]*SECTOR_SIZE + 1000*fwd[0], 0, new_sector[2]*SECTOR_SIZE + 1000*fwd[2]], dtype=np.float32)
    lp.cam_pos = lp.player_pos.copy()
    lp.system = None
    lp.ftl_ready = False
    lp.ftl_cooldown = 5.0
    lp.cam_shake = 2.0


def update_system(lp, dt):
    new_sector = sector_coord_from_pos(lp.player_pos)
    if lp.system is None or new_sector != lp.current_sector:
        lp.current_sector = new_sector
        lp.system = generate_system_for_sector(new_sector, lp.base_planet_mesh)
        if lp.system.stars: lp.star_light_pos = lp.system.stars[0].pos
    active = lp.system.active_planets
    new_active = []
    for pd in lp.system.planet_defs:
        pd.orbit_phase += pd.orbit_speed * dt
        pos = np.array([math.cos(pd.orbit_phase)*pd.orbit_radius, pd.y_offset, math.sin(pd.orbit_phase)*pd.orbit_radius], dtype=np.float32)
        existing = None
        for b in active:
            if getattr(b, '_def_ref', None) is pd:
                existing = b; break
        if should_instantiate(lp, pos, pd.radius):
            if existing is None:
                body = SystemBody("planet", pos, pd.radius, pd.color, pd.orbit_radius, pd.orbit_speed, pd.orbit_phase)
                body.mesh = lp.base_planet_mesh
                body._def_ref = pd
                body.fade = 0.0
                new_active.append(body)
            else:
                existing.pos = pos
                existing.fade = min(1, existing.fade + dt*1.5)
                new_active.append(existing)
        elif existing is not None:
            existing.pos = pos
            existing.fade -= dt
            if existing.fade > 0: new_active.append(existing)
    lp.system.active_planets = new_active


def update_world(lp, dt):
    if lp.paused: return
    if not lp.ftl_ready:
        lp.ftl_cooldown -= dt
        if lp.ftl_cooldown <= 0: lp.ftl_ready = True
    fwd, _, _ = compute_camera_axes(lp)
    keys = pygame.key.get_pressed()
    lp.boost = keys[K_LSHIFT]
    ms = (220 if lp.boost else 60) * dt
    if keys[K_w]:
        lp.player_pos += fwd * ms
        lp.speed = min(lp.speed + 80*dt, lp.max_speed)
    elif keys[K_s]:
        lp.player_pos -= fwd * ms
        lp.speed = max(lp.speed - 80*dt, 0)
    else:
        lp.speed = max(lp.speed - 60*dt, 0)
    update_system(lp, dt)
    desired = lp.player_pos - fwd*12 + np.array([0, 3, 0], dtype=np.float32)
    lp.cam_pos += (desired - lp.cam_pos) * 0.15
    if lp.boost: lp.cam_shake = max(lp.cam_shake, 0.7)
    lp.cam_shake *= 0.9
    if pygame.mouse.get_pressed()[0] and (lp.time - lp.ls) > FIRE_COOLDOWN:
        lp.projectiles.append(Projectile(lp.player_pos.copy(), fwd.copy()))
        lp.ls = lp.time
        lp.cam_shake = max(lp.cam_shake, 0.5)
    for p in lp.projectiles: p.update(dt)
    lp.projectiles = [p for p in lp.projectiles if p.life > 0]
    for h in lp.hit_effects: h.update(dt)
    lp.hit_effects = [h for h in lp.hit_effects if h.life > 0]
    if lp.system:
        for p in lp.projectiles:
            for b in lp.system.active_planets:
                if float(np.linalg.norm(p.pos - b.pos)) < b.radius:
                    p.life = 0
                    lp.hit_effects.append(HitEffect(p.pos.copy()))
        lp.projectiles = [p for p in lp.projectiles if p.life > 0]
    lp.fov += ((65 if lp.boost else 45) - lp.fov) * 0.05


# =====================================================
# Render
# =====================================================
def render(lp, quad):
    glClear(GL_COLOR_BUFFER_BIT | GL_DEPTH_BUFFER_BIT)
    fwd, _, _ = compute_camera_axes(lp)
    shake = lp.cam_shake
    if shake > 0.01:
        offset = np.array([(random.random()-0.5)*shake*0.2, (random.random()-0.5)*shake*0.1, (random.random()-0.5)*shake*0.2], dtype=np.float32)
        cam = lp.cam_pos + offset
    else:
        cam = lp.cam_pos

    glMatrixMode(GL_PROJECTION)
    glLoadIdentity()
    gluPerspective(lp.fov, SCREEN_SIZE[0]/SCREEN_SIZE[1], 0.1, 100000)
    glMatrixMode(GL_MODELVIEW)
    glLoadIdentity()
    gluLookAt(*cam, *lp.player_pos, 0, 1, 0)

    draw_nebula_ring(lp)
    draw_local_starfield(lp)
    glEnable(GL_LIGHTING)
    glEnable(GL_LIGHT0)
    glLightfv(GL_LIGHT0, GL_POSITION, (*lp.star_light_pos, 1))

    if lp.system:
        for b in lp.system.stars:
            glDisable(GL_LIGHTING)
            glPushMatrix()
            glTranslatef(*b.pos)
            glColor3f(*b.color)
            glEnable(GL_BLEND)
            glBlendFunc(GL_SRC_ALPHA, GL_ONE)
            gluSphere(quad, b.radius, 20, 20)
            glBlendFunc(GL_SRC_ALPHA, GL_ONE_MINUS_SRC_ALPHA)
            glDisable(GL_BLEND)
            glPopMatrix()
            glEnable(GL_LIGHTING)
        for b in lp.system.active_planets:
            draw_planet_body(lp, b)

    glDisable(GL_LIGHTING)
    glPointSize(3)
    glBegin(GL_POINTS)
    for p in lp.projectiles:
        a = max(0, p.life/1.5)**2
        if a > 0.003: glColor4f(1, 0.4, 0, a); glVertex3f(*p.pos)
    glEnd()
    glBegin(GL_POINTS)
    for h in lp.hit_effects:
        t = max(0, h.life/0.5)
        a = t*t*(3-2*t)
        if a > 0.003: glColor4f(1, 0.8, 0.2, a); glVertex3f(*h.pos)
    glEnd()

    projection = build_projection_matrix(lp.fov, SCREEN_SIZE[0]/SCREEN_SIZE[1], 0.1, 100000)
    view = build_view_matrix(cam, lp.player_pos, np.array([0, 1, 0], dtype=np.float32))
    draw_ship_modern(lp, view, projection)
    draw_engine_glow(lp, view, projection)
    draw_ui(lp)


# =====================================================
# Main
# =====================================================
def main():
    pygame.init()
    pygame.display.set_mode(SCREEN_SIZE, DOUBLEBUF | OPENGL)
    pygame.display.set_caption("LINCHPIN — Guinea Pig Trench")
    pygame.mouse.set_visible(False)
    pygame.event.set_grab(True)

    lp = Linchpin()

    glViewport(0, 0, *SCREEN_SIZE)
    glEnable(GL_BLEND)
    glBlendFunc(GL_SRC_ALPHA, GL_ONE_MINUS_SRC_ALPHA)
    glEnable(GL_DEPTH_TEST)
    glClearColor(0, 0, 0.02, 1)
    glEnable(GL_LIGHTING)
    glEnable(GL_LIGHT0)
    glEnable(GL_COLOR_MATERIAL)
    glColorMaterial(GL_FRONT_AND_BACK, GL_AMBIENT_AND_DIFFUSE)
    glLightfv(GL_LIGHT0, GL_DIFFUSE, (0.9, 0.9, 0.8, 1))
    glLightfv(GL_LIGHT0, GL_AMBIENT, (0.1, 0.1, 0.15, 1))
    glDisable(GL_CULL_FACE)

    lp.ship_vbo = ShipVBO()
    lp.engine_glow = EngineGlow()
    lp.ship_shader = create_shader(SHIP_VERTEX_SHADER, SHIP_FRAGMENT_SHADER)
    lp.glow_shader = create_shader(ENGINE_VERTEX_SHADER, ENGINE_FRAGMENT_SHADER)

    quad = gluNewQuadric()
    clock = pygame.time.Clock()

    while lp.running:
        dt = clock.tick(FPS) / 1000.0
        lp.time += dt
        handle_input(lp, dt)
        update_world(lp, dt)
        render(lp, quad)
        pygame.display.flip()

    pygame.quit()


if __name__ == "__main__":
    main()
