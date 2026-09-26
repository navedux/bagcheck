"""Bagcheck icon: the side-eye money bag.

Writes the brand SVGs used by the app:
  public/brand/bagcheck-icon.svg   full detail (nav, share image, app icon)
  src/app/icon.svg                 simplified cut for browser tabs (no tag)

Run: python3 scripts/brand/icon.py
The icon is the one place gradients and glow are allowed (see docs/design.md).
"""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]

TILE = ("#1a1d25", "#0b0c10")
GLOW = "#56c4d8"
BODY = ["#effeff", "#8fe6f2", "#4fc3dc", "#3b86e2", "#7b5cf0"]
RIM = "#b9a6ff"
MOUTH = "#1b3d78"

BODY_PATH = (
    "M196 262 C108 284 24 352 16 468 L16 560 L496 560 L496 468 "
    "C488 352 404 284 316 262 Z"
)
BUNCH = (
    "M206 270 C190 246 158 228 140 206 C126 188 128 166 146 160 "
    "C150 136 172 124 194 130 C204 108 232 102 250 116 "
    "C266 100 296 104 306 124 C326 116 352 128 356 150 "
    "C378 152 392 172 384 192 C372 222 334 246 308 270 Z"
)
FRONT = (
    "M216 270 C206 238 194 204 198 176 C200 152 222 140 238 152 "
    "C248 138 272 134 282 150 C298 140 318 152 316 178 C318 206 310 238 300 270 Z"
)


def eyes() -> str:
    out = []
    for i, cx in enumerate((214, 302)):
        out += [
            # Soft socket so the eyes sit in the fabric, not on it.
            f'<ellipse cx="{cx}" cy="382" rx="31" ry="43" fill="#0a0f24" opacity=".22" filter="url(#b6)"/>',
            f'<ellipse cx="{cx}" cy="376" rx="25" ry="37" fill="url(#eye)"/>',
            # Half-lidded side-eye: skeptical, checking who is selling.
            f'<g clip-path="url(#eyeclip{i})">'
            f'<path d="M{cx-30} 330 L{cx+30} 330 L{cx+30} 362 Q{cx} 350 {cx-30} 368 Z" fill="url(#lid)"/>'
            f'<path d="M{cx-30} 368 Q{cx} 350 {cx+30} 362" fill="none" stroke="#0a0f24" stroke-width="5" opacity=".6"/>'
            "</g>",
            f'<circle cx="{cx+12}" cy="382" r="6.5" fill="#fff"/>',
            f'<circle cx="{cx+2}" cy="396" r="2.6" fill="#fff" opacity=".7"/>',
            f'<path d="M{cx-16} 402 Q{cx} 412 {cx+16} 402" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" opacity=".25"/>',
        ]
    return "".join(out)


def tag() -> str:
    # Luggage tag on the cord: the airport pun in the name, with a check.
    shape = "M372 326 L412 326 L424 340 L424 404 Q424 414 414 414 L370 414 Q360 414 360 404 L360 340 Z"
    return (
        '<path d="M338 272 C356 292 366 306 372 330" fill="none" stroke="url(#cord)" stroke-width="6" stroke-linecap="round"/>'
        '<g transform="rotate(14 392 368)">'
        f'<path d="{shape}" fill="#000" opacity=".35" filter="url(#b6)" transform="translate(4 8)"/>'
        f'<path d="{shape}" fill="url(#tag)"/>'
        f'<path d="{shape}" fill="none" stroke="#fff" stroke-opacity=".7" stroke-width="2"/>'
        '<path d="M368 346 L368 400 Q368 406 374 406 L410 406 Q416 406 416 400 L416 346" fill="none" stroke="#b9c6da" stroke-width="1.6" stroke-dasharray="4 3"/>'
        '<circle cx="392" cy="342" r="7.5" fill="none" stroke="#c9d2e0" stroke-width="3.5"/>'
        '<circle cx="392" cy="342" r="5" fill="#141824"/>'
        '<path d="M376 374 L388 386 L410 360" fill="none" stroke="url(#chk)" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>'
        '<rect x="376" y="394" width="30" height="3" rx="1.5" fill="#b9c6da"/>'
        "</g>"
    )


def ruffle() -> str:
    return "".join([
        # Back of the bunch: uneven lobes, left side drooping, right lobe flipping out.
        f'<path d="{BUNCH}" fill="url(#ruff)"/>',
        '<g clip-path="url(#bunchclip)">',
        f'<path d="{BUNCH}" fill="url(#flapshade)"/>',
        # The open mouth of the bag, behind the front flap.
        '<path d="M170 150 C212 122 304 118 348 148 C302 166 214 168 170 150 Z" fill="url(#mouth)"/>',
        '<g fill="none" stroke-linecap="round" filter="url(#b6)">'
        '<path d="M206 266 C188 238 170 212 156 180" stroke="#0a0f24" stroke-opacity=".38" stroke-width="14"/>'
        '<path d="M308 266 C328 240 348 214 364 184" stroke="#0a0f24" stroke-opacity=".42" stroke-width="14"/>'
        "</g>"
        '<g fill="none" stroke-linecap="round" filter="url(#b3)">'
        '<path d="M196 262 C176 236 158 214 146 190" stroke="#fff" stroke-opacity=".45" stroke-width="6"/>'
        '<path d="M320 262 C340 238 360 216 374 192" stroke="#fff" stroke-opacity=".2" stroke-width="6"/>'
        "</g>",
        # Rolled lip along the top edge.
        f'<path d="{BUNCH}" fill="none" stroke="#fff" stroke-opacity=".6" stroke-width="5" clip-path="url(#lipclip)" filter="url(#b3)" transform="translate(1 4)"/>',
        '<ellipse cx="226" cy="116" rx="18" ry="7" transform="rotate(-18 226 116)" fill="#fff" opacity=".7" filter="url(#b3)"/>',
        '<ellipse cx="168" cy="146" rx="12" ry="6" transform="rotate(-40 168 146)" fill="#fff" opacity=".55" filter="url(#b3)"/>',
        "</g>",
        # Front flap folding over the mouth, casting a shadow into it.
        f'<path d="{FRONT}" fill="#0a0f24" opacity=".45" filter="url(#b6)" transform="translate(0 -6)"/>',
        f'<path d="{FRONT}" fill="url(#ruff)"/>',
        '<g clip-path="url(#frontclip)">',
        f'<path d="{FRONT}" fill="url(#flapshade)"/>',
        '<g fill="none" stroke-linecap="round" filter="url(#b6)">'
        '<path d="M236 268 C230 232 224 200 228 162" stroke="#0a0f24" stroke-opacity=".3" stroke-width="12"/>'
        '<path d="M282 268 C288 232 294 200 290 160" stroke="#0a0f24" stroke-opacity=".34" stroke-width="12"/>'
        "</g>"
        '<g fill="none" stroke-linecap="round" filter="url(#b3)">'
        '<path d="M258 266 C256 228 254 194 256 156" stroke="#fff" stroke-opacity=".55" stroke-width="8"/>'
        '<path d="M216 262 C210 230 206 200 210 170" stroke="#fff" stroke-opacity=".35" stroke-width="5"/>'
        "</g>",
        f'<path d="{FRONT}" fill="none" stroke="#fff" stroke-opacity=".7" stroke-width="4" clip-path="url(#lipclip2)" filter="url(#b1)" transform="translate(0 3)"/>',
        "</g>",
    ])


def build(with_tag: bool) -> str:
    b = BODY
    parts = [
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">',
        "<defs>",
        '<clipPath id="sq"><rect width="512" height="512" rx="114"/></clipPath>',
        f'<clipPath id="bodyclip"><path d="{BODY_PATH}"/></clipPath>',
        f'<clipPath id="bunchclip"><path d="{BUNCH}"/></clipPath>',
        f'<clipPath id="frontclip"><path d="{FRONT}"/></clipPath>',
        '<clipPath id="eyeclip0"><ellipse cx="214" cy="376" rx="25" ry="37"/></clipPath>',
        '<clipPath id="eyeclip1"><ellipse cx="302" cy="376" rx="25" ry="37"/></clipPath>',
        '<clipPath id="lipclip"><rect x="0" y="0" width="512" height="176"/></clipPath>',
        '<clipPath id="lipclip2"><rect x="0" y="0" width="512" height="168"/></clipPath>',
        '<filter id="b1" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="1.2"/></filter>',
        '<filter id="b3" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="3"/></filter>',
        '<filter id="b6" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="6"/></filter>',
        '<filter id="b12" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="12"/></filter>',
        '<filter id="b28" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="28"/></filter>',
        f'<linearGradient id="tile" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="{TILE[0]}"/><stop offset="1" stop-color="{TILE[1]}"/></linearGradient>',
        '<linearGradient id="edge" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".22"/><stop offset=".3" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#fff" stop-opacity=".05"/></linearGradient>',
        f'<linearGradient id="body" x1=".12" y1="0" x2=".9" y2="1"><stop offset="0" stop-color="{b[0]}"/><stop offset=".22" stop-color="{b[1]}"/><stop offset=".48" stop-color="{b[2]}"/><stop offset=".78" stop-color="{b[3]}"/><stop offset="1" stop-color="{b[4]}"/></linearGradient>',
        f'<linearGradient id="ruff" x1=".2" y1="0" x2=".8" y2="1"><stop offset="0" stop-color="{b[0]}"/><stop offset=".5" stop-color="{b[1]}"/><stop offset="1" stop-color="{b[2]}"/></linearGradient>',
        '<radialGradient id="shade" cx=".32" cy=".18" r=".95"><stop offset=".45" stop-color="#0a0f24" stop-opacity="0"/><stop offset="1" stop-color="#0a0f24" stop-opacity=".55"/></radialGradient>',
        f'<linearGradient id="mouth" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#050818"/><stop offset="1" stop-color="{MOUTH}"/></linearGradient>',
        '<linearGradient id="flapshade" x1="0" y1="0" x2="1" y2=".4"><stop offset="0" stop-color="#0a0f24" stop-opacity="0"/><stop offset=".55" stop-color="#0a0f24" stop-opacity=".08"/><stop offset="1" stop-color="#0a0f24" stop-opacity=".42"/></linearGradient>',
        '<linearGradient id="eye" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1f2554"/><stop offset="1" stop-color="#05081a"/></linearGradient>',
        f'<linearGradient id="lid" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="{b[1]}"/><stop offset="1" stop-color="{b[2]}"/></linearGradient>',
        '<linearGradient id="cord" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#2a2f7a"/><stop offset=".45" stop-color="#4b53c4"/><stop offset="1" stop-color="#1c1f55"/></linearGradient>',
        '<linearGradient id="tag" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#dfe9f7"/></linearGradient>',
        f'<linearGradient id="chk" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="{b[2]}"/><stop offset="1" stop-color="{b[3]}"/></linearGradient>',
        '<pattern id="dots" width="22" height="22" patternUnits="userSpaceOnUse"><circle cx="11" cy="11" r="1.4" fill="#fff" opacity=".06"/></pattern>',
        "</defs>",
        '<g clip-path="url(#sq)">',
        '<rect width="512" height="512" fill="url(#tile)"/>',
        '<rect width="512" height="512" fill="url(#dots)"/>',
        f'<ellipse cx="256" cy="430" rx="250" ry="170" fill="{GLOW}" opacity=".35" filter="url(#b28)"/>',
        f'<path d="{BODY_PATH}" fill="url(#body)"/>',
        f'<path d="{BODY_PATH}" fill="url(#shade)"/>',
        '<g clip-path="url(#bodyclip)">',
        # Tension folds where the cord cinches the neck.
        '<g fill="none" stroke-linecap="round" filter="url(#b6)">'
        '<path d="M202 276 C184 292 166 310 150 334" stroke="#0a0f24" stroke-opacity=".32" stroke-width="16"/>'
        '<path d="M228 282 C220 298 214 314 210 332" stroke="#0a0f24" stroke-opacity=".26" stroke-width="13"/>'
        '<path d="M286 282 C294 298 300 314 304 332" stroke="#0a0f24" stroke-opacity=".26" stroke-width="13"/>'
        '<path d="M310 276 C330 292 348 310 364 334" stroke="#0a0f24" stroke-opacity=".34" stroke-width="16"/>'
        "</g>"
        '<g fill="none" stroke-linecap="round" filter="url(#b3)">'
        '<path d="M214 280 C198 298 184 316 174 336" stroke="#fff" stroke-opacity=".45" stroke-width="6"/>'
        '<path d="M244 286 C240 302 238 316 238 330" stroke="#fff" stroke-opacity=".35" stroke-width="5"/>'
        '<path d="M268 286 C272 302 276 316 278 330" stroke="#fff" stroke-opacity=".28" stroke-width="5"/>'
        '<path d="M298 280 C314 298 328 316 338 336" stroke="#fff" stroke-opacity=".2" stroke-width="6"/>'
        "</g>"
        # Broad folds running down the sides.
        '<g fill="none" stroke-linecap="round" filter="url(#b12)">'
        '<path d="M150 334 C120 370 100 410 92 460" stroke="#0a0f24" stroke-opacity=".22" stroke-width="22"/>'
        '<path d="M364 334 C396 370 414 410 420 460" stroke="#0a0f24" stroke-opacity=".26" stroke-width="22"/>'
        "</g>",
        '<ellipse cx="256" cy="286" rx="112" ry="20" fill="#0a0f24" opacity=".45" filter="url(#b12)"/>',
        f'<path d="{BODY_PATH}" fill="none" stroke="{RIM}" stroke-width="18" opacity=".55" filter="url(#b12)" transform="translate(10 6)"/>',
        '<ellipse cx="120" cy="400" rx="46" ry="92" transform="rotate(28 120 400)" fill="#fff" opacity=".42" filter="url(#b12)"/>',
        '<path d="M86 420 C96 372 120 336 156 312" fill="none" stroke="#fff" stroke-width="7" stroke-linecap="round" opacity=".75" filter="url(#b3)"/>',
        "</g>",
        ruffle(),
        # Braided cord with a knot.
        '<path d="M192 262 C230 282 282 282 320 262" fill="none" stroke="#000" stroke-opacity=".35" stroke-width="22" stroke-linecap="round" filter="url(#b6)" transform="translate(0 6)"/>',
        '<path d="M192 262 C230 282 282 282 320 262" fill="none" stroke="url(#cord)" stroke-width="18" stroke-linecap="round"/>',
        '<path d="M192 262 C230 282 282 282 320 262" fill="none" stroke="#8d96ff" stroke-width="14" stroke-dasharray="3 6" opacity=".45"/>',
        '<path d="M200 262 C234 278 280 278 314 262" fill="none" stroke="#b4baff" stroke-width="2.5" stroke-linecap="round" opacity=".7"/>',
        '<ellipse cx="326" cy="266" rx="17" ry="14" fill="url(#cord)"/>',
        '<ellipse cx="322" cy="261" rx="7" ry="4" fill="#b6bdff" opacity=".7"/>',
    ]
    if with_tag:
        parts.append(tag())
    else:
        parts.append('<path d="M334 274 C344 290 346 304 342 318" fill="none" stroke="url(#cord)" stroke-width="7" stroke-linecap="round"/>')
    parts += [
        eyes(),
        "</g>",
        '<rect x="1.5" y="1.5" width="509" height="509" rx="112.5" fill="none" stroke="url(#edge)" stroke-width="3"/>',
        "</svg>",
    ]
    return "".join(parts)


if __name__ == "__main__":
    (ROOT / "public" / "brand").mkdir(parents=True, exist_ok=True)
    (ROOT / "public" / "brand" / "bagcheck-icon.svg").write_text(build(with_tag=True) + "\n")
    (ROOT / "src" / "app" / "icon.svg").write_text(build(with_tag=False) + "\n")
    print("wrote public/brand/bagcheck-icon.svg and src/app/icon.svg")
