import pygame
import moderngl
import numpy as np
import sys
import math

# ================= CONFIG =================
WIDTH, HEIGHT = 1280, 720
NUM_PARTICLES = 40000
RADIUS_MIN = 80.0
RADIUS_MAX = 650.0

# ================= SHADERS =================

VERT_SHADER = """
#version 330
in vec4 in_particle;
in float in_hue;

uniform float u_time;
uniform mat4 u_mvp;

out float v_hue;
out float v_depth;

void main() {
    vec3 pos = in_particle.xyz;
    float speed = in_particle.w;

    vec3 axis = normalize(vec3(0.6, 1.0, 0.4));
    float angle = u_time * speed;
    float c = cos(angle);
    float s = sin(angle);
    float ic = 1.0 - c;

    mat3 R = mat3(
        c + axis.x * axis.x * ic,
        axis.y * axis.x * ic + axis.z * s,
        axis.z * axis.x * ic - axis.y * s,
        axis.x * axis.y * ic - axis.z * s,
        c + axis.y * axis.y * ic,
        axis.z * axis.y * ic + axis.x * s,
        axis.x * axis.z * ic + axis.y * s,
        axis.y * axis.z * ic - axis.x * s,
        c + axis.z * axis.z * ic
    );

    pos = R * pos;

    float rXZ = length(pos.xz);
    float spiral = 1.0 - 0.0008 * speed * rXZ;
    pos.xz *= max(0.2, spiral);

    vec4 clip = u_mvp * vec4(pos, 1.0);
    gl_Position = clip;

    float size = 45.0 / max(0.1, clip.w);
    gl_PointSize = clamp(size, 1.5, 10.0);

    v_hue = in_hue;
    v_depth = length(pos);
}
"""

FRAG_SHADER = """
#version 330
in float v_hue;
in float v_depth;
out vec4 f_color;
uniform float u_time;

vec3 hsv2rgb(vec3 c){
    vec4 K = vec4(1.0, 2.0/3.0, 1.0/3.0, 3.0);
    vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
    return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}

void main() {
    vec2 uv = gl_PointCoord * 2.0 - 1.0;
    float d = length(uv);
    if (d > 1.0) discard;

    float depthFade = clamp(1.3 - 0.0012 * v_depth, 0.2, 1.0);
    float glow = exp(-d * 4.0);
    float hue = fract(v_hue + u_time * 0.06);
    vec3 color = hsv2rgb(vec3(hue, 0.8, 1.0));

    f_color = vec4(color * glow * 2.5 * depthFade, glow * depthFade);
}
"""

QUAD_VERT = """
#version 330
in vec2 in_vert;
out vec2 v_uv;
void main() {
    v_uv = in_vert * 0.5 + 0.5;
    gl_Position = vec4(in_vert, 0.0, 1.0);
}
"""

BLUR_FRAG = """
#version 330
uniform sampler2D image;
uniform bool horizontal;
in vec2 v_uv;
out vec4 f_color;
float w[5] = float[](0.227, 0.194, 0.121, 0.054, 0.016);
void main() {
    vec2 texel = 1.0 / vec2(textureSize(image, 0));
    vec3 result = texture(image, v_uv).rgb * w[0];
    for (int i = 1; i < 5; i++) {
        vec2 offset = horizontal ? vec2(texel.x * i, 0.0) : vec2(0.0, texel.y * i);
        result += texture(image, v_uv + offset).rgb * w[i];
        result += texture(image, v_uv - offset).rgb * w[i];
    }
    f_color = vec4(result, 1.0);
}
"""

COMP_FRAG = """
#version 330
uniform sampler2D scene;
uniform sampler2D bloom;
in vec2 v_uv;
out vec4 f_color;
void main() {
    vec3 base = texture(scene, v_uv).rgb;
    vec3 blur = texture(bloom, v_uv).rgb;
    vec3 color = base + blur * -2.23;
    color = vec3(1.0) - exp(-color * 1.2);
    f_color = vec4(color, 1.0);
}
"""


# ================= ENGINE =================

class NeonVortex3D:
    def __init__(self):
        pygame.init()
        pygame.display.gl_set_attribute(pygame.GL_CONTEXT_MAJOR_VERSION, 3)
        pygame.display.gl_set_attribute(pygame.GL_CONTEXT_MINOR_VERSION, 3)
        pygame.display.gl_set_attribute(pygame.GL_CONTEXT_PROFILE_MASK, pygame.GL_CONTEXT_PROFILE_CORE)

        self.screen = pygame.display.set_mode((WIDTH, HEIGHT), pygame.OPENGL | pygame.DOUBLEBUF)
        pygame.display.set_caption("Neon Vortex — Guinea Pig Trench")
        self.ctx = moderngl.create_context()

        self.ctx.enable(moderngl.DEPTH_TEST)
        self.ctx.enable(moderngl.PROGRAM_POINT_SIZE)
        self.ctx.enable(moderngl.BLEND)

        self.clock = pygame.time.Clock()
        self.time = 0.0

        self.particle_prog = self.ctx.program(vertex_shader=VERT_SHADER, fragment_shader=FRAG_SHADER)
        self.blur_prog = self.ctx.program(vertex_shader=QUAD_VERT, fragment_shader=BLUR_FRAG)
        self.comp_prog = self.ctx.program(vertex_shader=QUAD_VERT, fragment_shader=COMP_FRAG)

        quad_data = np.array([-1, -1, 1, -1, -1, 1, 1, 1], dtype="f4")
        self.quad_vbo = self.ctx.buffer(quad_data)
        self.quad_vao = self.ctx.simple_vertex_array(self.blur_prog, self.quad_vbo, "in_vert")
        self.comp_vao = self.ctx.simple_vertex_array(self.comp_prog, self.quad_vbo, "in_vert")

        data = self._create_particles()
        self.vbo = self.ctx.buffer(data.tobytes())
        self.particle_vao = self.ctx.vertex_array(
            self.particle_prog,
            [(self.vbo, "4f 1f", "in_particle", "in_hue")]
        )

        self.scene_tex = self.ctx.texture((WIDTH, HEIGHT), 4)
        self.depth_rb = self.ctx.depth_renderbuffer((WIDTH, HEIGHT))
        self.scene_fbo = self.ctx.framebuffer(color_attachments=[self.scene_tex], depth_attachment=self.depth_rb)

        self.blur_tex_h = self.ctx.texture((WIDTH, HEIGHT), 4)
        self.blur_fbo_h = self.ctx.framebuffer([self.blur_tex_h])
        self.blur_tex_v = self.ctx.texture((WIDTH, HEIGHT), 4)
        self.blur_fbo_v = self.ctx.framebuffer([self.blur_tex_v])

    def _create_particles(self):
        particles = np.zeros((NUM_PARTICLES, 5), dtype="f4")
        for i in range(NUM_PARTICLES):
            theta = np.random.uniform(0, 2 * np.pi)
            phi = np.random.uniform(0.1, np.pi - 0.1)
            r = RADIUS_MIN + (np.random.rand() ** 0.6) * (RADIUS_MAX - RADIUS_MIN)
            particles[i, 0] = r * math.sin(phi) * math.cos(theta)
            particles[i, 1] = r * math.cos(phi) * 0.8
            particles[i, 2] = r * math.sin(phi) * math.sin(theta)
            particles[i, 3] = np.random.uniform(0.4, 1.3)
            particles[i, 4] = np.random.rand()
        return particles

    def _get_mvp(self):
        fov, near, far = 60.0, 0.1, 2500.0
        f = 1.0 / math.tan(math.radians(fov) / 2.0)
        aspect = WIDTH / HEIGHT
        proj = np.array([
            [f / aspect, 0, 0, 0],
            [0, f, 0, 0],
            [0, 0, (far + near) / (near - far), (2 * far * near) / (near - far)],
            [0, 0, -1, 0]
        ], dtype="f4")

        t = self.time * 0.25
        eye = np.array([math.sin(t) * 1000, math.sin(t * 0.7) * 350, math.cos(t) * 1000])
        target = np.array([0, 0, 0])
        up = np.array([0, 1, 0])

        z = (eye - target)
        z /= np.linalg.norm(z)
        x = np.cross(up, z)
        x /= np.linalg.norm(x)
        y = np.cross(z, x)

        view = np.eye(4, dtype="f4")
        view[0, :3], view[1, :3], view[2, :3] = x, y, z
        view[0, 3], view[1, 3], view[2, 3] = -np.dot(x, eye), -np.dot(y, eye), -np.dot(z, eye)

        return (proj @ view).T.astype("f4")

    def run(self):
        print("Neon Vortex — Guinea Pig Trench")
        print("Close window or ESC to exit")

        while True:
            self.time += self.clock.tick(60) / 1000.0
            for e in pygame.event.get():
                if e.type == pygame.QUIT:
                    pygame.quit()
                    return
                if e.type == pygame.KEYDOWN and e.key == pygame.K_ESCAPE:
                    pygame.quit()
                    return

            # Pass 1: Particles to FBO
            self.scene_fbo.use()
            self.ctx.clear(0.01, 0.01, 0.05, 1.0)
            self.ctx.blend_func = moderngl.SRC_ALPHA, moderngl.ONE
            self.particle_prog["u_time"].value = self.time
            self.particle_prog["u_mvp"].write(self._get_mvp().tobytes())
            self.particle_vao.render(moderngl.POINTS)

            # Pass 2-3: Blur
            self.ctx.disable(moderngl.DEPTH_TEST)

            self.blur_fbo_h.use()
            self.scene_tex.use(0)
            self.blur_prog["horizontal"] = True
            self.quad_vao.render(moderngl.TRIANGLE_STRIP)

            self.blur_fbo_v.use()
            self.blur_tex_h.use(0)
            self.blur_prog["horizontal"] = False
            self.quad_vao.render(moderngl.TRIANGLE_STRIP)

            # Pass 4: Negative bloom composite
            self.ctx.screen.use()
            self.scene_tex.use(0)
            self.blur_tex_v.use(1)
            self.comp_prog["scene"] = 0
            self.comp_prog["bloom"] = 1
            self.comp_vao.render(moderngl.TRIANGLE_STRIP)

            self.ctx.enable(moderngl.DEPTH_TEST)
            pygame.display.flip()


if __name__ == "__main__":
    NeonVortex3D().run()
