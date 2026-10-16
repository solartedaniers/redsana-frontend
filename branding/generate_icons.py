"""Genera todos los iconos de RedSana desde las dos fuentes de branding/ (requiere Pillow).

Uso, desde la raíz del frontend:  python branding/generate_icons.py
Todo lo configurable (tamaños, rutas, colores) vive en branding/brand.json.
"""
import json
from dataclasses import dataclass
from pathlib import Path

from PIL import Image

BRANDING_DIR = Path(__file__).resolve().parent


@dataclass(frozen=True)
class BrandConfig:
    raw: dict

    @classmethod
    def load(cls, path: Path) -> "BrandConfig":
        return cls(json.loads(path.read_text(encoding="utf-8")))

    def path(self, relative: str) -> Path:
        return (BRANDING_DIR / relative).resolve()

    def section(self, name: str) -> dict:
        return self.raw[name]

    def __getitem__(self, key: str):
        return self.raw[key]


class IconRenderer:
    """Dibuja un icono cuadrado: hasta compactMaxSize usa el escudo sin anillos, que se lee mejor en chico."""

    def __init__(self, config: BrandConfig) -> None:
        self._full = Image.open(config.path(config["sources"]["full"])).convert("RGB")
        self._compact = Image.open(config.path(config["sources"]["compact"])).convert("RGB")
        self._compact_max_size = config["compactMaxSize"]
        self._background = config["iconBackground"]

    def render(self, size: int, padding_ratio: float) -> Image.Image:
        source = self._compact if size <= self._compact_max_size else self._full
        content = max(1, round(size * (1 - 2 * padding_ratio)))
        canvas = Image.new("RGB", (size, size), self._background)
        offset = (size - content) // 2
        canvas.paste(source.resize((content, content), Image.LANCZOS), (offset, offset))
        return canvas


class PwaIconWriter:
    """Iconos de la web: PNG normales y maskable, apple-touch-icon, favicon y la lista de iconos del manifest."""

    def __init__(self, config: BrandConfig, renderer: IconRenderer) -> None:
        self._config = config
        self._pwa = config.section("pwa")
        self._renderer = renderer
        self._directory = config.path(self._pwa["directory"])
        self._public_root = config.path(self._pwa["publicRoot"])

    def write(self) -> list[Path]:
        self._directory.mkdir(parents=True, exist_ok=True)
        written: list[Path] = []
        manifest_icons = []
        for size in self._pwa["sizes"]:
            path = self._save(self._renderer.render(size, self._config["paddingRatio"]), f"icon-{size}x{size}.png")
            written.append(path)
            manifest_icons.append(self._manifest_entry(path, size, "any"))
        # Maskable: el símbolo queda dentro de la zona segura (círculo del 80 % central) que el sistema puede recortar.
        for size in self._pwa["maskableSizes"]:
            path = self._save(self._renderer.render(size, self._config["maskablePaddingRatio"]), f"icon-maskable-{size}x{size}.png")
            written.append(path)
            manifest_icons.append(self._manifest_entry(path, size, "maskable"))
        apple_size = self._pwa["appleTouchSize"]
        written.append(self._save(self._renderer.render(apple_size, self._config["paddingRatio"]), "apple-touch-icon.png"))
        written.append(self._write_favicon())
        self._update_manifest_icons(manifest_icons)
        return written

    def _save(self, image: Image.Image, name: str) -> Path:
        path = self._directory / name
        image.save(path, optimize=True)
        return path

    def _manifest_entry(self, path: Path, size: int, purpose: str) -> dict:
        return {
            "src": path.relative_to(self._public_root).as_posix(),
            "sizes": f"{size}x{size}",
            "type": "image/png",
            "purpose": purpose,
        }

    def _write_favicon(self) -> Path:
        favicon = self._config.section("favicon")
        sizes = favicon["sizes"]
        frames = [self._renderer.render(size, self._config["paddingRatio"]) for size in sizes]
        path = self._config.path(favicon["path"])
        # Cada fotograma va dibujado a su tamaño (no reescalado desde el mayor) para que el chico use el escudo compacto.
        frames[-1].save(path, format="ICO", sizes=[(s, s) for s in sizes], append_images=frames[:-1])
        return path

    def _update_manifest_icons(self, icons: list[dict]) -> None:
        path = self._config.path(self._pwa["manifest"])
        manifest = json.loads(path.read_text(encoding="utf-8"))
        manifest["icons"] = icons
        path.write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


class BrandAssetsGenerator:
    def __init__(self, config: BrandConfig) -> None:
        renderer = IconRenderer(config)
        self._writers = [PwaIconWriter(config, renderer)]

    def run(self) -> None:
        for writer in self._writers:
            for path in writer.write():
                print(f"[branding] {path.relative_to(BRANDING_DIR.parent).as_posix()}")


if __name__ == "__main__":
    BrandAssetsGenerator(BrandConfig.load(BRANDING_DIR / "brand.json")).run()
